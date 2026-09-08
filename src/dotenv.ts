import { readFileSync, statSync } from "node:fs";
import * as nodeUtil from "node:util";
import { resolve } from "pathe";

export interface DotenvOptions {
  /**
   * The project root directory (either absolute or relative to the current working directory).
   *
   * Defaults to `options.cwd` in `loadConfig` context, or `process.cwd()` when used as standalone.
   */
  cwd?: string;

  /**
   * What file or files to look in for environment variables (either absolute or relative
   * to the current working directory). For example, `.env`.
   * With the array type, the order enforce the env loading priority (last one overrides).
   */
  fileName?: string | string[];

  /**
   * Whether to interpolate variables within .env.
   *
   * Supported syntax is `$VAR`, `${VAR}` and `\${VAR}` (escaped, resolves to a literal `${VAR}`).
   *
   * Within braces, a default value can be provided with `${VAR:-default}` (used when `VAR` is
   * unset **or** empty) or `${VAR-default}` (used when `VAR` is unset only). Default values can
   * themselves contain interpolations.
   *
   * @example
   * ```env
   * BASE_DIR="/test"
   * # resolves to "/test/further"
   * ANOTHER_DIR="${BASE_DIR}/further"
   * # resolves to "/test/fallback" when UNSET_DIR is unset or empty
   * FALLBACK_DIR="${UNSET_DIR:-${BASE_DIR}/fallback}"
   * ```
   */
  interpolate?: boolean;

  /**
   * An object describing environment variables (key, value pairs).
   */
  env?: NodeJS.ProcessEnv;

  /**
   * Resolve `_FILE` suffixed environment variables by reading the file at the
   * specified path and assigning its trimmed content to the base key.
   *
   * This is useful for container secrets (e.g. Docker, Kubernetes) where
   * sensitive values are mounted as files.
   *
   * @default false
   *
   * @example
   * ```env
   * DATABASE_PASSWORD_FILE="/run/secrets/db_password"
   * # resolves to DATABASE_PASSWORD=<contents of /run/secrets/db_password>
   * ```
   */
  expandFileReferences?: boolean;
}

export type Env = typeof process.env;

/**
 * Load and interpolate environment variables into `process.env`.
 * If you need more control (or access to the values), consider using `loadDotenv` instead
 *
 */
export async function setupDotenv(options: DotenvOptions): Promise<Env> {
  const targetEnvironment = options.env ?? process.env;

  // Load env
  const environment = await loadDotenv({
    cwd: options.cwd,
    fileName: options.fileName ?? ".env",
    env: targetEnvironment,
    interpolate: options.interpolate ?? true,
    expandFileReferences: options.expandFileReferences ?? false,
  });

  const dotenvVars = getDotEnvVars(targetEnvironment);

  // Fill process.env
  for (const key in environment) {
    // Skip private variables
    if (key.startsWith("_")) {
      continue;
    }
    // Override if variables are not already set or come from `.env`
    if (targetEnvironment[key] === undefined || dotenvVars.has(key)) {
      targetEnvironment[key] = environment[key];
    }
  }

  return environment;
}

/** Load environment variables into an object. */
export async function loadDotenv(options: DotenvOptions): Promise<Env> {
  const environment = Object.create(null);

  const cwd = resolve(options.cwd || ".");
  const _fileName = options.fileName || ".env";
  const dotenvFiles = typeof _fileName === "string" ? [_fileName] : _fileName;

  const dotenvVars = getDotEnvVars(options.env || {});

  // Apply process.env
  Object.assign(environment, options.env);

  for (const file of dotenvFiles) {
    const dotenvFile = resolve(cwd, file);
    if (!statSync(dotenvFile, { throwIfNoEntry: false })?.isFile()) {
      continue;
    }
    const parsed = await readEnvFile(dotenvFile);
    for (const key in parsed) {
      if (key in environment && !dotenvVars.has(key)) {
        continue; // Do not override existing env variables
      }
      environment[key] = parsed[key];
      dotenvVars.add(key);
    }
  }

  // Support _FILE environment variables
  if (options.expandFileReferences) {
    for (const key in environment) {
      if (key.endsWith("_FILE")) {
        const targetKey = key.slice(0, -5);
        if (environment[targetKey] === undefined) {
          const filePath = environment[key];
          if (filePath && statSync(filePath, { throwIfNoEntry: false })?.isFile()) {
            const value = readFileSync(filePath, "utf8");
            environment[targetKey] = value.trim();
            dotenvVars.add(targetKey);
          }
        }
      }
    }
  }

  // Interpolate env
  if (options.interpolate) {
    interpolate(environment);
  }

  return environment;
}

// --- readEnvFile ---

type ParseEnvFn = (src: string) => Record<string, string>;

let _parseEnv = nodeUtil.parseEnv as ParseEnvFn | undefined;

async function readEnvFile(path: string): Promise<Record<string, string>> {
  const src = readFileSync(path, "utf8");
  if (!_parseEnv) {
    try {
      const dotenv = await import("dotenv");
      _parseEnv = (src: string) => dotenv.parse(src) as Record<string, string>;
    } catch {
      throw new Error(
        "Failed to parse .env file: `node:util.parseEnv` is not available and `dotenv` package is not installed. Please upgrade your runtime or install `dotenv` as a dependency.",
      );
    }
  }
  return _parseEnv(src);
}

// Based on https://github.com/motdotla/dotenv-expand
function interpolate(
  target: Record<string, any>,
  source: Record<string, any> = {},
  parse = (v: any) => v,
) {
  function getValue(key: string) {
    // Source value 'wins' over target value
    return source[key] === undefined ? target[key] : source[key];
  }

  function interpolate(value: unknown, parents: string[] = []): any {
    if (typeof value !== "string") {
      return value;
    }

    let result = "";
    let index = 0;

    while (index < value.length) {
      const char = value[index];

      // `\$` escapes to a literal `$`
      if (char === "\\" && value[index + 1] === "$") {
        result += "$";
        index += 2;
        continue;
      }

      const ref = char === "$" ? parseRef(value, index) : undefined;
      if (!ref) {
        result += char;
        index++;
        continue;
      }

      // Avoid recursion
      if (parents.includes(ref.key)) {
        console.warn(
          `Please avoid recursive environment variables ( loop: ${parents.join(
            " > ",
          )} > ${ref.key} )`,
        );
        return "";
      }

      // Resolve recursive interpolations
      let resolved = interpolate(getValue(ref.key), [...parents, ref.key]);

      // Fallback to the default value (`${VAR:-default}` or `${VAR-default}`)
      if (
        ref.defaultValue !== undefined &&
        (resolved === undefined || (ref.operator === ":-" && resolved === ""))
      ) {
        resolved = interpolate(ref.defaultValue, parents);
      }

      // Unresolvable references are kept as-is
      result += resolved === undefined ? value.slice(index, ref.end) : resolved;
      index = ref.end;
    }

    return parse(result);
  }

  for (const key in target) {
    target[key] = interpolate(getValue(key));
  }
}

interface EnvRef {
  /** Referenced variable name. */
  key: string;
  /** Index right after the reference. */
  end: number;
  /** Default value operator (`:-` also applies to empty values). */
  operator?: "-" | ":-";
  /** Raw (not yet interpolated) default value. */
  defaultValue?: string;
}

const REF_NAME_RE = /[\w:]+/y;

/** Parse a `$VAR`, `${VAR}`, `${VAR:-default}` or `${VAR-default}` reference starting at `start`. */
function parseRef(input: string, start: number): EnvRef | undefined {
  let index = start + 1; /* skip `$` */
  const braced = input[index] === "{";
  if (braced) {
    index++;
  }

  REF_NAME_RE.lastIndex = index;
  const name = REF_NAME_RE.exec(input);
  if (!name) {
    return;
  }
  let key = name[0];
  index = REF_NAME_RE.lastIndex;

  // `$VAR` (defaults are only supported within braces)
  if (!braced) {
    return { key, end: index };
  }

  // `${VAR}`
  if (input[index] === "}") {
    return { key, end: index + 1 };
  }

  // `${VAR:-default}` and `${VAR-default}`
  if (input[index] === "-") {
    let operator: EnvRef["operator"] = "-";
    if (key.endsWith(":")) {
      key = key.slice(0, -1);
      operator = ":-";
    }
    const defaultValue = key ? readDefault(input, index + 1) : undefined;
    if (!defaultValue) {
      return;
    }
    return { key, operator, defaultValue: defaultValue.value, end: defaultValue.end };
  }

  // Unterminated `${VAR`
  return { key, end: index };
}

/** Read a default value up to the (nesting aware) closing brace. */
function readDefault(input: string, start: number): { value: string; end: number } | undefined {
  let value = "";
  let depth = 1;
  for (let index = start; index < input.length; index++) {
    const char = input[index];
    if (char === "\\" && index + 1 < input.length) {
      value += char + input[index + 1];
      index++;
      continue;
    }
    if (char === "$" && input[index + 1] === "{") {
      depth++;
      value += "${";
      index++;
      continue;
    }
    if (char === "}") {
      depth--;
      if (depth === 0) {
        return { value, end: index + 1 };
      }
    }
    value += char;
  }
}

// Internal: Keep track of which variables that are set by dotenv

declare global {
  var __c12_dotenv_vars__: Map<Record<string, any>, Set<string>>;
}

function getDotEnvVars(targetEnvironment: Record<string, any>) {
  const globalRegistry = (globalThis.__c12_dotenv_vars__ ||= new Map());
  if (!globalRegistry.has(targetEnvironment)) {
    globalRegistry.set(targetEnvironment, new Set());
  }
  return globalRegistry.get(targetEnvironment)!;
}
