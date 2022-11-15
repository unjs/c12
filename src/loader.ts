import { existsSync, promises as fsp } from "node:fs";
import os from "node:os";
import { resolve, extname, dirname } from "pathe";
import createJiti, { JITI } from "jiti";
import * as rc9 from "rc9";
import { defu } from "defu";
import { findWorkspaceDir } from "pkg-types";
import type { JITIOptions } from "jiti/dist/types";
import { DotenvOptions, setupDotenv } from "./dotenv";

export interface InputConfig extends Record<string, any> {}

export interface ConfigLayer<T extends InputConfig=InputConfig> {
  config: T | null
  cwd?: string
  configFile?: string
}

export interface ResolvedConfig<T extends InputConfig=InputConfig> extends ConfigLayer<T> {
  layers?: ConfigLayer<T>[]
  cwd?: string
}

export interface ResolveConfigOptions {
  cwd: string
}

export interface LoadConfigOptions<T extends InputConfig=InputConfig> {
  name?: string
  cwd?: string

  configFile?: string

  rcFile?: false | string
  globalRc?: boolean

  dotenv?: boolean | DotenvOptions

  defaults?: T
  defaultConfig?: T
  overrides?: T

  resolve?: (id: string, options: LoadConfigOptions) => null | ResolvedConfig | Promise<ResolvedConfig | null>

  jiti?: JITI
  jitiOptions?: JITIOptions,

  extend?: false | {
    extendKey?: string | string[]
  }
}

export async function loadConfig<T extends InputConfig=InputConfig> (options: LoadConfigOptions<T>): Promise<ResolvedConfig<T>> {
  // Normalize options
  options.cwd = resolve(process.cwd(), options.cwd || ".");
  options.name = options.name || "config";
  options.configFile = options.configFile ?? ((options.name !== "config") ? `${options.name}.config` : "config");
  options.rcFile = options.rcFile ?? (`.${options.name}rc`);
  if (options.extend !== false) {
    options.extend = {
      extendKey: "extends",
      ...options.extend
    };
  }

  // Create jiti instance
  options.jiti = options.jiti || createJiti(undefined, {
    interopDefault: true,
    requireCache: false,
    esmResolve: true,
    ...options.jitiOptions
  });

  // Create context
  const r: ResolvedConfig<T> = {
    config: {} as any,
    cwd: options.cwd,
    configFile: resolve(options.cwd, options.configFile),
    layers: []
  };

  // Load dotenv
  if (options.dotenv) {
    await setupDotenv({
      cwd: options.cwd,
      ...(options.dotenv === true ? {} : options.dotenv)
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
      Object.assign(configRC, rc9.readUser({ name: options.rcFile, dir: options.cwd }));
      const workspaceDir = await findWorkspaceDir(options.cwd).catch(() => {});
      if (workspaceDir) {
        Object.assign(configRC, rc9.read({ name: options.rcFile, dir: workspaceDir }));
      }
    }
    Object.assign(configRC, rc9.read({ name: options.rcFile, dir: options.cwd }));
  }

  // Combine sources
  r.config = defu(
    options.overrides,
    config,
    configRC,
    options.defaultConfig
  ) as T;

  // Allow extending
  if (options.extend) {
    await extendConfig(r.config, options);
    r.layers = r.config._layers;
    delete r.config._layers;
    r.config = defu(
      r.config,
      ...r.layers.map(e => e.config)
    ) as T;
  }

  // Preserve unmerged sources as layers
  const baseLayers = [
    options.overrides && { config: options.overrides, configFile: undefined, cwd: undefined },
    { config, configFile: options.configFile, cwd: options.cwd },
    options.rcFile && { config: configRC, configFile: options.rcFile }
  ].filter(l => l && l.config) as ConfigLayer<T>[];
  r.layers = [
    ...baseLayers,
    ...r.layers
  ];

  // Apply defaults
  if (options.defaults) {
    r.config = defu(r.config, options.defaults) as T;
  }

  // Return resolved config
  return r;
}

async function extendConfig (config, options: LoadConfigOptions) {
  config._layers = config._layers || [];
  if (!options.extend) { return; }
  let keys = options.extend.extendKey;
  if (typeof keys === "string") { keys = [keys]; }
  const extendSources = [];
  for (const key of keys) {
    extendSources.push(...(Array.isArray(config[key]) ? config[key] : [config[key]]).filter(Boolean));
    delete config[key];
  }
  for (const extendSource of extendSources) {
    if (typeof extendSource !== "string") {
      // TODO: Use error in next major versions
      // eslint-disable-next-line no-console
      console.warn(`Cannot extend config from \`${JSON.stringify(extendSource)}\` (which should be a string) in ${options.cwd}`);
      continue;
    }
    const _config = await resolveConfig(extendSource, options);
    if (!_config.config) {
      // TODO: Use error in next major versions
      // eslint-disable-next-line no-console
      console.warn(`Cannot extend config from \`${extendSource}\` in ${options.cwd}`);
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
const NPM_PACKAGE_RE = /^(@[\da-z~-][\d._a-z~-]*\/)?[\da-z~-][\d._a-z~-]*$/;

async function resolveConfig (source: string, options: LoadConfigOptions): Promise<ResolvedConfig> {
  // Custom user resolver
  if (options.resolve) {
    const res = await options.resolve(source, options);
    if (res) {
      return res;
    }
  }

  // Download git URLs and resolve to local path
  if (GIT_PREFIXES.some(prefix => source.startsWith(prefix))) {
    const url = new URL(source);
    const subPath = url.pathname.split("/").slice(2).join("/");
    const gitRepo = url.protocol + url.pathname.split("/").slice(0, 2).join("/");
    const tmpdir = resolve(os.tmpdir(), "c12/", gitRepo.replace(/[#/:@\\]/g, "_"));
    await fsp.rm(tmpdir, { recursive: true }).catch(() => {});
    const gittar = await import("gittar").then(r => r.default || r);
    const tarFile = await gittar.fetch(gitRepo);
    await gittar.extract(tarFile, tmpdir);
    source = resolve(tmpdir, subPath);
  }

  // Try resolving as npm package
  if (NPM_PACKAGE_RE.test(source)) {
    try {
      source = options.jiti.resolve(source, { paths: [options.cwd] });
    } catch {}
  }

  // Import from local fs
  const isDir = !extname(source);
  const cwd = resolve(options.cwd, isDir ? source : dirname(source));
  if (isDir) { source = options.configFile; }
  const res: ResolvedConfig = { config: undefined, cwd };
  try {
    res.configFile = options.jiti.resolve(resolve(cwd, source), { paths: [cwd] });
  } catch {}
  if (!existsSync(res.configFile)) {
    return res;
  }
  res.config = options.jiti(res.configFile);
  if (typeof res.config === "function") {
    res.config = await res.config();
  }
  return res;
}
