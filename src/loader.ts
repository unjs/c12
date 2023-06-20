import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve, extname, dirname } from "pathe";
import createJiti from "jiti";
import * as rc9 from "rc9";
import { defu } from "defu";
import { findWorkspaceDir, readPackageJSON } from "pkg-types";
import { setupDotenv } from "./dotenv";

import type {
  UserInputConfig,
  ConfigLayerMeta,
  LoadConfigOptions,
  ResolvedConfig,
  ConfigLayer,
  SourceOptions,
  InputConfig,
} from "./types";

export async function loadConfig<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta
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

  // Create jiti instance
  options.jiti =
    options.jiti ||
    createJiti(undefined as unknown as string, {
      interopDefault: true,
      requireCache: false,
      esmResolve: true,
      ...options.jitiOptions,
    });

  // Create context
  const r: ResolvedConfig<T, MT> = {
    config: {} as any,
    cwd: options.cwd,
    configFile: resolve(options.cwd, options.configFile),
    layers: [],
  };

  // Load dotenv
  if (options.dotenv) {
    await setupDotenv({
      cwd: options.cwd,
      ...(options.dotenv === true ? {} : options.dotenv),
    });
  }

  // Load config file
  const { config, configFile } = await resolveConfig(".", options);
  if (configFile) {
    r.configFile = configFile;
  }

  // Load rc files
  const configRC = {};
  if (options.rcFile) {
    if (options.globalRc) {
      Object.assign(
        configRC,
        rc9.readUser({ name: options.rcFile, dir: options.cwd })
      );
      const workspaceDir = await findWorkspaceDir(options.cwd).catch(() => {});
      if (workspaceDir) {
        Object.assign(
          configRC,
          rc9.read({ name: options.rcFile, dir: workspaceDir })
        );
      }
    }
    Object.assign(
      configRC,
      rc9.read({ name: options.rcFile, dir: options.cwd })
    );
  }

  // Load config from package.json
  const pkgJson = {};
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
    Object.assign(pkgJson, defu({}, ...values));
  }

  // Combine sources
  r.config = defu(
    options.overrides,
    config,
    configRC,
    pkgJson,
    options.defaultConfig
  ) as T;

  // Allow extending
  if (options.extend) {
    await extendConfig(r.config, options);
    r.layers = r.config._layers;
    delete r.config._layers;
    r.config = defu(r.config, ...r.layers!.map((e) => e.config)) as T;
  }

  // Preserve unmerged sources as layers
  const baseLayers = [
    options.overrides && {
      config: options.overrides,
      configFile: undefined,
      cwd: undefined,
    },
    { config, configFile: options.configFile, cwd: options.cwd },
    options.rcFile && { config: configRC, configFile: options.rcFile },
    options.packageJson && { config: pkgJson, configFile: "package.json" },
  ].filter((l) => l && l.config) as ConfigLayer<T, MT>[];

  r.layers = [...baseLayers, ...r.layers!];

  // Apply defaults
  if (options.defaults) {
    r.config = defu(r.config, options.defaults) as T;
  }

  // Return resolved config
  return r;
}

async function extendConfig<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta
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
        Boolean
      )
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
      // eslint-disable-next-line no-console
      console.warn(
        `Cannot extend config from \`${JSON.stringify(
          originalExtendSource
        )}\` in ${options.cwd}`
      );
      continue;
    }
    const _config = await resolveConfig(extendSource, options, sourceOptions);
    if (!_config.config) {
      // TODO: Use error in next major versions
      // eslint-disable-next-line no-console
      console.warn(
        `Cannot extend config from \`${extendSource}\` in ${options.cwd}`
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

const GIT_PREFIXES = ["github:", "gitlab:", "bitbucket:", "https://"];

// https://github.com/dword-design/package-name-regex
const NPM_PACKAGE_RE =
  /^(@[\da-z~-][\d._a-z~-]*\/)?[\da-z~-][\d._a-z~-]*($|\/.*)/;

async function resolveConfig<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta
>(
  source: string,
  options: LoadConfigOptions<T, MT>,
  sourceOptions: SourceOptions<T, MT> = {}
): Promise<ResolvedConfig<T, MT>> {
  // Custom user resolver
  if (options.resolve) {
    const res = await options.resolve(source, options);
    if (res) {
      return res;
    }
  }

  // Download git URLs and resolve to local path
  if (GIT_PREFIXES.some((prefix) => source.startsWith(prefix))) {
    const { downloadTemplate } = await import("giget");
    const url = new URL(source);
    const gitRepo =
      url.protocol + url.pathname.split("/").slice(0, 2).join("/");
    const name = gitRepo.replace(/[#/:@\\]/g, "_");
    const tmpDir = process.env.XDG_CACHE_HOME
      ? resolve(process.env.XDG_CACHE_HOME, "c12", name)
      : resolve(homedir(), ".cache/c12", name);
    if (existsSync(tmpDir)) {
      await rm(tmpDir, { recursive: true });
    }
    const cloned = await downloadTemplate(source, { dir: tmpDir });
    source = cloned.dir;
  }

  // Try resolving as npm package
  if (NPM_PACKAGE_RE.test(source)) {
    try {
      source = options.jiti!.resolve(source, { paths: [options.cwd!] });
    } catch {}
  }

  // Import from local fs
  const isDir = !extname(source);
  const cwd = resolve(options.cwd!, isDir ? source : dirname(source));
  if (isDir) {
    source = options.configFile!;
  }
  const res: ResolvedConfig<T, MT> = {
    config: undefined as unknown as T,
    cwd,
    source,
    sourceOptions,
  };
  try {
    res.configFile = options.jiti!.resolve(resolve(cwd, source), {
      paths: [cwd],
    });
  } catch {}
  if (!existsSync(res.configFile!)) {
    return res;
  }
  res.config = options.jiti!(res.configFile!);
  if (res.config instanceof Function) {
    res.config = await res.config();
  }

  // Extend env specific config
  if (options.envName) {
    const envConfig = {
      ...res.config!["$" + options.envName],
      ...res.config!.$env?.[options.envName],
    };
    if (Object.keys(envConfig).length > 0) {
      res.config = defu(envConfig, res.config);
    }
  }

  // Meta
  res.meta = defu(res.sourceOptions!.meta, res.config!.$meta) as MT;
  delete res.config!.$meta;

  // Overrides
  if (res.sourceOptions!.overrides) {
    res.config = defu(res.sourceOptions!.overrides, res.config) as T;
  }

  return res;
}
