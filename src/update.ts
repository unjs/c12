import { resolveModulePath } from "exsolve";
import { SUPPORTED_EXTENSIONS } from "./loader.ts";
import { join, normalize } from "pathe";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, extname } from "node:path";

const UPDATABLE_EXTS = [".js", ".ts", ".mjs", ".cjs", ".mts", ".cts"] as const;

/**
 * @experimental Update a config file or create a new one.
 */
export async function updateConfig(opts: UpdateConfigOptions): Promise<UpdateConfigResult> {
  const magicast = await import("magicast");

  // Try to find an existing config file
  let configFile =
    tryResolve(`./${opts.configFile}`, opts.cwd, SUPPORTED_EXTENSIONS) ||
    tryResolve(`./.config/${opts.configFile}`, opts.cwd, SUPPORTED_EXTENSIONS) ||
    tryResolve(
      `./.config/${opts.configFile.replace(/\.config$/, "")}`,
      opts.cwd,
      SUPPORTED_EXTENSIONS,
    );

  // If not found
  let created = false;
  if (!configFile) {
    configFile = join(opts.cwd, opts.configFile + (opts.createExtension || ".ts"));
    const createResult = (await opts.onCreate?.({ configFile: configFile })) ?? true;
    if (!createResult) {
      throw new Error("Config file creation aborted.");
    }
    const content = typeof createResult === "string" ? createResult : `export default {}\n`;
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
  const _module = magicast.parseModule(contents, opts.magicast);

  const defaultExport = _module.exports.default;
  if (!defaultExport) {
    throw new Error("Default export is missing in the config file!");
  }
  const configTarget = opts.onUpdate
    ? resolveConfigTarget(defaultExport, _module, magicast)
    : undefined;
  if (opts.onUpdate && !configTarget) {
    throw new Error(
      `Default export in ${configFile} is not a statically analyzable object, so it cannot be updated.`,
    );
  }

  if (configTarget) {
    await opts.onUpdate?.(configTarget.proxy);
    configTarget.commit?.();
  }

  await writeFile(configFile, _module.generate().code);

  return {
    configFile,
    created,
  };
}

// --- Internal ---

type ConfigObjectNode = {
  type: string;
  [key: string]: any;
};

function resolveConfigTarget(
  exportValue: any,
  mod: any,
  magicast: typeof import("magicast"),
): { proxy: any; commit?: () => void } | undefined {
  switch (exportValue.$type) {
    case "object": {
      return { proxy: exportValue };
    }
    case "function-call": {
      const arg = exportValue.$args[0];
      return arg ? resolveConfigTarget(arg, mod, magicast) : undefined;
    }
    case "arrow-function-expression":
    case "function-expression": {
      const body = exportValue.$body;
      if (body?.$type === "object") {
        return { proxy: body };
      }
      if (body?.$type === "block-statement") {
        const returned = findReturnedObject(body.$ast);
        return returned ? detachedConfigTarget(returned, magicast) : undefined;
      }
      return undefined;
    }
    case "identifier": {
      const init = findVariableInit(mod.$ast, exportValue.$name);
      return init?.type === "ObjectExpression" ? detachedConfigTarget(init, magicast) : undefined;
    }
    default: {
      return undefined;
    }
  }
}

function findReturnedObject(block: ConfigObjectNode): ConfigObjectNode | undefined {
  const returns = block.body.filter((node: ConfigObjectNode) => node.type === "ReturnStatement");
  if (returns.length !== 1) {
    return undefined;
  }
  const argument = unwrapExpression(returns[0].argument);
  return argument?.type === "ObjectExpression" ? argument : undefined;
}

function findVariableInit(program: ConfigObjectNode, name: string): ConfigObjectNode | undefined {
  for (const node of program.body) {
    if (node.type !== "VariableDeclaration") {
      continue;
    }
    for (const declaration of node.declarations) {
      if (declaration.id?.type === "Identifier" && declaration.id.name === name) {
        return unwrapExpression(declaration.init);
      }
    }
  }
}

function unwrapExpression(node: ConfigObjectNode | undefined): ConfigObjectNode | undefined {
  while (
    node &&
    (node.type === "TSAsExpression" ||
      node.type === "TSSatisfiesExpression" ||
      node.type === "ParenthesizedExpression")
  ) {
    node = node.expression;
  }
  return node;
}

/**
 * Magicast has no proxy for return statements or variable declarations, so
 * round-trip the object through an expression proxy and write it back in place.
 */
function detachedConfigTarget(node: ConfigObjectNode, magicast: typeof import("magicast")) {
  const proxy: any = magicast.parseExpression(magicast.generateCode(node as any).code);
  return {
    proxy,
    commit: () => {
      for (const key of Object.keys(node)) {
        delete node[key];
      }
      Object.assign(node, proxy.$ast);
    },
  };
}

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
