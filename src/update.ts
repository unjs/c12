import { resolvePath as _resolvePath } from "mlly";
import { SUPPORTED_EXTENSIONS } from "./loader";
import { join } from "pathe";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, extname } from "node:path";

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
    (await _tryResolve(
      `./${opts.configFile}`,
      opts.cwd,
      SUPPORTED_EXTENSIONS,
    )) ||
    (await _tryResolve(
      `./.config/${opts.configFile}`,
      opts.cwd,
      SUPPORTED_EXTENSIONS,
    ));

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

// --- Internal ---

function _tryResolve(path: string, cwd: string, exts: readonly string[]) {
  return _resolvePath(path, {
    url: join(cwd, "_index.js"),
    extensions: exts as string[],
  }).catch(() => undefined);
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
