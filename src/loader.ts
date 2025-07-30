import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { homedir } from "node:os";
import { resolve, extname, dirname, basename, join, normalize } from "pathe";
import { resolveModulePath } from "exsolve";
import { createJiti } from "jiti";
import * as rc9 from "rc9";
import { defu } from "defu";
import { findWorkspaceDir, readPackageJSON } from "pkg-types";
import { setupDotenv } from "./dotenv";

import type {
  UserInputConfig,
  ConfigLayerMeta,
  LoadConfigOptions,
  ResolvedConfig,
  ResolvableConfig,
  ConfigLayer,
  SourceOptions,
  InputConfig,
  ConfigSource,
  ConfigFunctionContext,
} from "./types";

const _normalize = (p?: string) => p?.replace(/\\/g, "/");

const ASYNC_LOADERS = {
  ".yaml": () => import("confbox/yaml").then((r) => r.parseYAML),
  ".yml": () => import("confbox/yaml").then((r) => r.parseYAML),
  ".jsonc": () => import("confbox/jsonc").then((r) => r.parseJSONC),
  ".json5": () => import("confbox/json5").then((r) => r.parseJSON5),
  ".toml": () => import("confbox/toml").then((r) => r.parseTOML),
} as const;

export const SUPPORTED_EXTENSIONS = Object.freeze([
  // with jiti
  ".js",
  ".ts",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".json",
  // with confbox
  ".jsonc",
  ".json5",
  ".yaml",
  ".yml",
  ".toml",
]) as unknown as string[];

export async function loadConfig<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta,
>(options: LoadConfigOptions<T, MT>): Promise<ResolvedConfig<T, MT>> {
  // Normalize options
  options.cwd = resolve(process.cwd(), options.cwd || ".");
  options.name = options.name || "config";
  options.envName = options.envName ?? process.env.NODE_ENV;
  options.configFile =
    options.configFile ??
    (options.name === "config" ? "config" : `${options.name}.config`);
  options.rcFile = options.rcFile ?? `.${options.name}rc`;
  if (options.extend !== false) {
    options.extend = {
      extendKey: "extends",
      ...options.extend,
    };
  }

  // Custom merger
  const _merger = options.merger || defu;

  // Create jiti instance
  options.jiti =
    options.jiti ||
    createJiti(join(options.cwd, options.configFile), {
      interopDefault: true,
      moduleCache: false,
      extensions: [...SUPPORTED_EXTENSIONS],
      ...options.jitiOptions,
    });

  // Create context
  const r: ResolvedConfig<T, MT> = {
    config: {} as any,
    cwd: options.cwd,
    configFile: resolve(options.cwd, options.configFile),
    layers: [],
  };

  // prettier-ignore
  const rawConfigs: Record<
    ConfigSource,
    ResolvableConfig<T> | null | undefined
  > = {
    overrides: options.overrides,
    main: undefined,
    rc: undefined,
    packageJson: undefined,
    defaultConfig: options.defaultConfig,
  };

  // Load dotenv
  if (options.dotenv) {
    await setupDotenv({
      cwd: options.cwd,
      ...(options.dotenv === true ? {} : options.dotenv),
    });
  }

  // Load main config file
  const _mainConfig = await resolveConfig(".", options);
  if (_mainConfig.configFile) {
    rawConfigs.main = _mainConfig.config;
    r.configFile = _mainConfig.configFile;
  }

  if (_mainConfig.meta) {
    r.meta = _mainConfig.meta;
  }

  // Load rc files
  if (options.rcFile) {
    const rcSources: T[] = [];
    // 1. cwd
    rcSources.push(rc9.read({ name: options.rcFile, dir: options.cwd }));
    if (options.globalRc) {
      // 2. workspace
      const workspaceDir = await findWorkspaceDir(options.cwd).catch(() => {});
      if (workspaceDir) {
        rcSources.push(rc9.read({ name: options.rcFile, dir: workspaceDir }));
      }
      // 3. user home
      rcSources.push(rc9.readUser({ name: options.rcFile, dir: options.cwd }));
    }
    rawConfigs.rc = _merger({} as T, ...rcSources);
  }

  // Load config from package.json
  if (options.packageJson) {
    const keys = (
      Array.isArray(options.packageJson)
        ? options.packageJson
        : [
            typeof options.packageJson === "string"
              ? options.packageJson
              : options.name,
          ]
    ).filter((t) => t && typeof t === "string");
    const pkgJsonFile = await readPackageJSON(options.cwd).catch(() => {});
    const values = keys.map((key) => pkgJsonFile?.[key]);
    rawConfigs.packageJson = _merger({} as T, ...values);
  }

  // Resolve config sources
  const configs = {} as Record<ConfigSource, T | null | undefined>;
  // TODO: #253 change order from defaults to overrides in next major version
  for (const key in rawConfigs) {
    const value = rawConfigs[key as ConfigSource];
    configs[key as ConfigSource] = await (typeof value === "function"
      ? value({ configs, rawConfigs })
      : value);
  }

  // Combine sources
  r.config = _merger(
    configs.overrides,
    configs.main,
    configs.rc,
    configs.packageJson,
    configs.defaultConfig,
  ) as T;

  // Allow extending
  if (options.extend) {
    await extendConfig(r.config, options);
    r.layers = r.config._layers;
    delete r.config._layers;
    r.config = _merger(r.config, ...r.layers!.map((e) => e.config)) as T;
  }

  // Preserve unmerged sources as layers
  const baseLayers: ConfigLayer<T, MT>[] = [
    configs.overrides && {
      config: configs.overrides,
      configFile: undefined,
      cwd: undefined,
    },
    { config: configs.main, configFile: options.configFile, cwd: options.cwd },
    configs.rc && { config: configs.rc, configFile: options.rcFile },
    configs.packageJson && {
      config: configs.packageJson,
      configFile: "package.json",
    },
  ].filter((l) => l && l.config) as ConfigLayer<T, MT>[];

  r.layers = [...baseLayers, ...r.layers!];

  // Apply defaults
  if (options.defaults) {
    r.config = _merger(r.config, options.defaults) as T;
  }

  // Remove environment-specific and built-in keys start with $
  if (options.omit$Keys) {
    for (const key in r.config) {
      if (key.startsWith("$")) {
        delete r.config[key];
      }
    }
  }

  // Return resolved config
  return r;
}

async function extendConfig<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta,
>(config: InputConfig<T, MT>, options: LoadConfigOptions<T, MT>) {
  (config as any)._layers = config._layers || [];
  if (!options.extend) {
    return;
  }
  let keys = options.extend.extendKey;
  if (typeof keys === "string") {
    keys = [keys];
  }
  const extendSources = [];
  for (const key of keys as string[]) {
    extendSources.push(
      ...(Array.isArray(config[key]) ? config[key] : [config[key]]).filter(
        Boolean,
      ),
    );
    delete config[key];
  }
  for (let extendSource of extendSources) {
    const originalExtendSource = extendSource;
    let sourceOptions = {};
    if (extendSource.source) {
      sourceOptions = extendSource.options || {};
      extendSource = extendSource.source;
    }
    if (Array.isArray(extendSource)) {
      sourceOptions = extendSource[1] || {};
      extendSource = extendSource[0];
    }
    if (typeof extendSource !== "string") {
      // TODO: Use error in next major versions

      console.warn(
        `Cannot extend config from \`${JSON.stringify(
          originalExtendSource,
        )}\` in ${options.cwd}`,
      );
      continue;
    }
    const _config = await resolveConfig(extendSource, options, sourceOptions);
    if (!_config.config) {
      // TODO: Use error in next major versions

      console.warn(
        `Cannot extend config from \`${extendSource}\` in ${options.cwd}`,
      );
      continue;
    }
    await extendConfig(_config.config, { ...options, cwd: _config.cwd });
    config._layers.push(_config);
    if (_config.config._layers) {
      config._layers.push(..._config.config._layers);
      delete _config.config._layers;
    }
  }
}

// TODO: Either expose from giget directly or redirect all non file:// protocols to giget
const GIGET_PREFIXES = [
  "gh:",
  "github:",
  "gitlab:",
  "bitbucket:",
  "https://",
  "http://",
];

// https://github.com/dword-design/package-name-regex
const NPM_PACKAGE_RE =
  /^(@[\da-z~-][\d._a-z~-]*\/)?[\da-z~-][\d._a-z~-]*($|\/.*)/;

async function resolveConfig<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta,
>(
  source: string,
  options: LoadConfigOptions<T, MT>,
  sourceOptions: SourceOptions<T, MT> = {},
): Promise<ResolvedConfig<T, MT>> {
  // Custom user resolver
  if (options.resolve) {
    const res = await options.resolve(source, options);
    if (res) {
      return res;
    }
  }

  // Custom merger
  const _merger = options.merger || defu;

  // Download giget URIs and resolve to local path
  const customProviderKeys = Object.keys(
    sourceOptions.giget?.providers || {},
  ).map((key) => `${key}:`);
  const gigetPrefixes =
    customProviderKeys.length > 0
      ? [...new Set([...customProviderKeys, ...GIGET_PREFIXES])]
      : GIGET_PREFIXES;

  if (
    options.giget !== false &&
    gigetPrefixes.some((prefix) => source.startsWith(prefix))
  ) {
    const { downloadTemplate } = await import("giget");
    const { digest } = await import("ohash");

    const cloneName =
      source.replace(/\W+/g, "_").split("_").splice(0, 3).join("_") +
      "_" +
      digest(source).slice(0, 10).replace(/[-_]/g, "");

    let cloneDir: string;

    const localNodeModules = resolve(options.cwd!, "node_modules");

    const parentDir = dirname(options.cwd!);
    if (basename(parentDir) === ".c12") {
      cloneDir = join(parentDir, cloneName);
    } else if (existsSync(localNodeModules)) {
      cloneDir = join(localNodeModules, ".c12", cloneName);
    } else {
      cloneDir = process.env.XDG_CACHE_HOME
        ? resolve(process.env.XDG_CACHE_HOME, "c12", cloneName)
        : resolve(homedir(), ".cache/c12", cloneName);
    }

    if (existsSync(cloneDir) && !sourceOptions.install) {
      await rm(cloneDir, { recursive: true });
    }
    const cloned = await downloadTemplate(source, {
      dir: cloneDir,
      install: sourceOptions.install,
      force: sourceOptions.install,
      auth: sourceOptions.auth,
      ...options.giget,
      ...sourceOptions.giget,
    });
    source = cloned.dir;
  }

  // Try resolving as npm package
  if (NPM_PACKAGE_RE.test(source)) {
    source = tryResolve(source, options) || source;
  }

  // Import from local fs
  const ext = extname(source);
  const isDir = !ext || ext === basename(source); /* #71 */
  const cwd = resolve(options.cwd!, isDir ? source : dirname(source));
  if (isDir) {
    source = options.configFile!;
  }
  const res: ResolvedConfig<T, MT> = {
    config: undefined as unknown as T,
    configFile: undefined,
    cwd,
    source,
    sourceOptions,
  };

  res.configFile =
    tryResolve(resolve(cwd, source), options) ||
    tryResolve(
      resolve(cwd, ".config", source.replace(/\.config$/, "")),
      options,
    ) ||
    tryResolve(resolve(cwd, ".config", source), options) ||
    source;

  if (!existsSync(res.configFile!)) {
    return res;
  }

  const configFileExt = extname(res.configFile!) || "";
  if (configFileExt in ASYNC_LOADERS) {
    const asyncLoader =
      await ASYNC_LOADERS[configFileExt as keyof typeof ASYNC_LOADERS]();
    const contents = await readFile(res.configFile!, "utf8");
    res.config = asyncLoader(contents);
  } else {
    res.config = (await options.jiti!.import(res.configFile!, {
      default: true,
    })) as T;
  }
  if (typeof res.config === "function") {
    // Support conditional config functions
    res.config = await (options.configContext
      ? (res.config as (ctx: ConfigFunctionContext) => Promise<any>)(
          options.configContext,
        )
      : (res.config as () => Promise<any>)());
  }

  // Extend env specific config
  if (options.envName) {
    const envConfig = {
      ...res.config!["$" + options.envName],
      ...res.config!.$env?.[options.envName],
    };
    if (Object.keys(envConfig).length > 0) {
      res.config = _merger(envConfig, res.config);
    }
  }

  // Meta
  res.meta = defu(res.sourceOptions!.meta, res.config!.$meta) as MT;
  delete res.config!.$meta;

  // Overrides
  if (res.sourceOptions!.overrides) {
    res.config = _merger(res.sourceOptions!.overrides, res.config) as T;
  }

  // Always windows paths
  res.configFile = _normalize(res.configFile);
  res.source = _normalize(res.source);

  return res;
}

// --- internal ---

function tryResolve(id: string, options: LoadConfigOptions<any, any>) {
  const res = resolveModulePath(id, {
    try: true,
    from: pathToFileURL(join(options.cwd || ".", options.configFile || "/")),
    suffixes: ["", "/index"],
    extensions: SUPPORTED_EXTENSIONS,
    cache: false,
  });
  return res ? normalize(res) : undefined;
}
