import { resolveModulePath } from "exsolve";
import { SUPPORTED_EXTENSIONS } from "./loader";
import { join, normalize } from "pathe";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, extname } from "node:path";
import * as rc9 from "rc9";

const UPDATABLE_EXTS = [".js", ".ts", ".mjs", ".cjs", ".mts", ".cts"] as const;

/**
 * @experimental Update a config file or create a new one.
 */
export async function updateConfig(
  opts: UpdateConfigOptions,
): Promise<UpdateConfigResult> {
  const { parseModule } = await import("magicast");

  // Try to find an existing config file
  let configFile =
    tryResolve(`./${opts.configFile}`, opts.cwd, SUPPORTED_EXTENSIONS) ||
    tryResolve(
      `./.config/${opts.configFile}`,
      opts.cwd,
      SUPPORTED_EXTENSIONS,
    ) ||
    tryResolve(
      `./.config/${opts.configFile.split(".")[0]}`,
      opts.cwd,
      SUPPORTED_EXTENSIONS,
    );

  // If not found
  let created = false;
  if (!configFile) {
    configFile = join(
      opts.cwd,
      opts.configFile + (opts.createExtension || ".ts"),
    );
    const createResult =
      (await opts.onCreate?.({ configFile: configFile })) ?? true;
    if (!createResult) {
      throw new Error("Config file creation aborted.");
    }
    const content =
      typeof createResult === "string" ? createResult : `export default {}\n`;
    await mkdir(dirname(configFile), { recursive: true });
    await writeFile(configFile, content, "utf8");
    created = true;
  }

  // Make sure extension is editable
  const ext = extname(configFile);
  if (!UPDATABLE_EXTS.includes(ext as any)) {
    throw new Error(
      `Unsupported config file extension: ${ext} (${configFile}) (supported: ${UPDATABLE_EXTS.join(", ")})`,
    );
  }

  const contents = await readFile(configFile, "utf8");
  const _module = parseModule(contents, opts.magicast);

  const defaultExport = _module.exports.default;
  if (!defaultExport) {
    throw new Error("Default export is missing in the config file!");
  }
  const configObj =
    defaultExport.$type === "function-call"
      ? defaultExport.$args[0]
      : defaultExport;

  await opts.onUpdate?.(configObj);

  await writeFile(configFile, _module.generate().code);

  return {
    configFile,
    created,
  };
}

/**
 * Update an RC config file in the current working directory.
 *
 * Uses rc9 to read, merge, and write RC configuration files.
 * RC files use a simple key-value format with automatic flattening/unflattening.
 *
 * @param opts - Configuration options
 * @returns Path to the RC config file
 *
 * @example
 * ```ts
 * import { updateConfigRC } from "c12/update";
 *
 * const configFile = await updateConfigRC({
 *   name: ".myapprc",
 *   dir: process.cwd(),
 *   onUpdate: (config) => {
 *     config.apiUrl = "https://api.example.com";
 *     config.enabled = true;
 *   },
 * });
 * ```
 */
export async function updateConfigRC(
  opts: UpdateConfigRCOptions,
): Promise<string> {
  if (!opts.name) {
    throw new Error("RC config file name is required");
  }

  const rcOptions: rc9.RCOptions = {
    name: opts.name,
    dir: opts.dir || process.cwd(),
    flat: opts.flat,
  };

  // Ensure directory exists
  await mkdir(rcOptions.dir, { recursive: true });

  // Read existing config (returns empty object if file doesn't exist)
  const existingConfig = rc9.read(rcOptions);

  // Allow user to update the config
  await opts.onUpdate?.(existingConfig);

  // Write updated config using rc9.update
  rc9.update(existingConfig, rcOptions);

  // Return the full path to the config file
  const configPath = join(rcOptions.dir, rcOptions.name);
  return configPath;
}

// --- Internal ---

function tryResolve(path: string, cwd: string, extensions: string[]) {
  const res = resolveModulePath(path, {
    try: true,
    from: join(cwd, "/"),
    extensions,
    suffixes: ["", "/index"],
    cache: false,
  });
  return res ? normalize(res) : undefined;
}

// --- Types ---

export interface UpdateConfigResult {
  configFile?: string;
  created?: boolean;
}

type MaybePromise<T> = T | Promise<T>;

type MagicAstOptions = Exclude<
  Parameters<(typeof import("magicast"))["parseModule"]>[1],
  undefined
>;

export interface UpdateConfigOptions {
  /**
   * Current working directory
   */
  cwd: string;

  /**
   * Config file name
   */
  configFile: string;

  /**
   * Extension used for new config file.
   */
  createExtension?: string;

  /**
   * Magicast options
   */
  magicast?: MagicAstOptions;

  /**
   * Update function.
   */
  onUpdate?: (config: any) => MaybePromise<void>;

  /**
   * Handle default config creation.
   *
   * Tip: you can use this option as a hook to prompt users about config creation.
   *
   * Context object:
   *  - path: determined full path to the config file
   *
   * Returns types:
   *  - string: custom config template
   *  - true: write the template
   *  - false: abort the operation
   */
  onCreate?: (ctx: { configFile: string }) => MaybePromise<string | boolean>;
}

export interface UpdateConfigRCOptions {
  /**
   * RC config file name (e.g., ".myapprc")
   */
  name: string;

  /**
   * Directory to read/write the RC config file.
   * Defaults to current working directory.
   */
  dir?: string;

  /**
   * If true, disables automatic flattening/unflattening of config values.
   * Default is false.
   *
   * @see https://github.com/unjs/rc9#unflatten
   */
  flat?: boolean;

  /**
   * Update function called with the current config object.
   * Modify the config object to update values.
   */
  onUpdate?: (config: any) => MaybePromise<void>;
}
