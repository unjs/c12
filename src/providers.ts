import * as rc9 from "rc9";
import { findWorkspaceDir, readPackageJSON } from "pkg-types";

import type {
  UserInputConfig,
  ConfigLayerMeta,
  LoadConfigOptions,
  ConfigLayer,
  ResolvableConfig,
} from "./types.ts";

/**
 * Context passed to config providers during loading
 */
export interface ProviderContext<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta,
> {
  /** Normalized load options */
  options: LoadConfigOptions<T, MT>;
  /** Merger function (defu or custom) */
  merger: (...sources: Array<T | null | undefined>) => T;
  /** Resolve a config file (used by main provider) */
  resolveConfig: (
    source: string,
    options: LoadConfigOptions<T, MT>,
  ) => Promise<{
    config?: T;
    configFile?: string;
    _configFile?: string;
    cwd?: string;
    meta?: MT;
  }>;
  /** Results from previously loaded providers (by name) */
  loadedConfigs: Map<string, T | null | undefined>;
}

/**
 * Result returned by a config provider
 */
export interface ProviderResult<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta,
> {
  /** The loaded configuration (or null/undefined if not found) */
  config: T | null | undefined;
  /** Layer metadata for introspection */
  layer?: Partial<ConfigLayer<T, MT>>;
  /** Additional metadata to merge into ResolvedConfig */
  meta?: MT;
  /** Resolved config file path (for main provider) */
  configFile?: string;
  /** Internal config file path */
  _configFile?: string;
}

/**
 * A pluggable configuration source provider
 */
export interface ConfigProvider<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta,
> {
  /** Unique name for this provider */
  name: string;
  /**
   * Priority determines merge order.
   * Lower numbers = higher priority (merged first, so they "win").
   * Built-in priorities: overrides=100, main=200, rc=300, packageJson=400, defaultConfig=500
   */
  priority: number;
  /**
   * Load configuration from this provider.
   * Return null/undefined if this provider has no config to contribute.
   */
  load(ctx: ProviderContext<T, MT>): Promise<ProviderResult<T, MT> | null | undefined>;
}

/**
 * Built-in provider: overrides from options
 */
export function createOverridesProvider<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta,
>(): ConfigProvider<T, MT> {
  return {
    name: "overrides",
    priority: 100,
    async load(ctx) {
      const config = await resolveResolvableConfig(ctx.options.overrides, ctx);
      if (!config) return null;
      return {
        config,
        layer: {
          config,
          configFile: undefined,
          cwd: undefined,
        },
      };
    },
  };
}

/**
 * Built-in provider: main config file
 */
export function createMainProvider<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta,
>(): ConfigProvider<T, MT> {
  return {
    name: "main",
    priority: 200,
    async load(ctx) {
      const result = await ctx.resolveConfig(".", ctx.options);
      if (!result.configFile) return null;
      return {
        config: result.config,
        configFile: result.configFile,
        _configFile: result._configFile,
        meta: result.meta,
        layer: {
          config: result.config,
          configFile: ctx.options.configFile,
          cwd: ctx.options.cwd,
        },
      };
    },
  };
}

/**
 * Built-in provider: RC files (.namerc)
 */
export function createRcProvider<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta,
>(): ConfigProvider<T, MT> {
  return {
    name: "rc",
    priority: 300,
    async load(ctx) {
      const { options, merger } = ctx;
      if (!options.rcFile) return null;

      const rcSources: T[] = [];

      // 1. cwd
      rcSources.push(rc9.read({ name: options.rcFile, dir: options.cwd }));

      if (options.globalRc) {
        // 2. workspace
        const workspaceDir = await findWorkspaceDir(options.cwd!).catch(() => {});
        if (workspaceDir) {
          rcSources.push(rc9.read({ name: options.rcFile, dir: workspaceDir }));
        }
        // 3. user home
        rcSources.push(rc9.readUser({ name: options.rcFile, dir: options.cwd }));
      }

      const config = merger({} as T, ...rcSources);
      if (!config || Object.keys(config).length === 0) return null;

      return {
        config,
        layer: {
          config,
          configFile: options.rcFile,
        },
      };
    },
  };
}

/**
 * Built-in provider: package.json config
 */
export function createPackageJsonProvider<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta,
>(): ConfigProvider<T, MT> {
  return {
    name: "packageJson",
    priority: 400,
    async load(ctx) {
      const { options, merger } = ctx;
      if (!options.packageJson) return null;

      const keys = (
        Array.isArray(options.packageJson)
          ? options.packageJson
          : [typeof options.packageJson === "string" ? options.packageJson : options.name]
      ).filter((t): t is string => typeof t === "string" && t.length > 0);

      const pkgJsonFile = await readPackageJSON(options.cwd!).catch(() => {});
      if (!pkgJsonFile) return null;

      const values = keys.map((key) => pkgJsonFile[key] as T | undefined);
      const config = merger({} as T, ...values);
      if (!config || Object.keys(config).length === 0) return null;

      return {
        config,
        layer: {
          config,
          configFile: "package.json",
        },
      };
    },
  };
}

/**
 * Built-in provider: defaultConfig from options
 */
export function createDefaultConfigProvider<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta,
>(): ConfigProvider<T, MT> {
  return {
    name: "defaultConfig",
    priority: 500,
    async load(ctx) {
      const config = await resolveResolvableConfig(ctx.options.defaultConfig, ctx);
      if (!config) return null;
      return { config };
    },
  };
}

/**
 * Get the default set of built-in providers in standard order
 */
export function getDefaultProviders<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta,
>(): ConfigProvider<T, MT>[] {
  return [
    createOverridesProvider<T, MT>(),
    createMainProvider<T, MT>(),
    createRcProvider<T, MT>(),
    createPackageJsonProvider<T, MT>(),
    createDefaultConfigProvider<T, MT>(),
  ];
}

/**
 * Sort providers by priority (lower priority number = higher precedence)
 */
export function sortProviders<T extends UserInputConfig, MT extends ConfigLayerMeta>(
  providers: ConfigProvider<T, MT>[],
): ConfigProvider<T, MT>[] {
  return [...providers].sort((a, b) => a.priority - b.priority);
}

/**
 * Helper to resolve a ResolvableConfig (handles functions)
 */
async function resolveResolvableConfig<T extends UserInputConfig, MT extends ConfigLayerMeta>(
  value: ResolvableConfig<T> | null | undefined,
  ctx: ProviderContext<T, MT>,
): Promise<T | null | undefined> {
  if (typeof value === "function") {
    // Build legacy context from loaded configs
    const configs: Record<string, T | null | undefined> = {};
    const rawConfigs: Record<string, ResolvableConfig<T> | null | undefined> = {};
    for (const [name, config] of ctx.loadedConfigs) {
      configs[name] = config;
      rawConfigs[name] = config;
    }
    return value({ configs, rawConfigs } as any);
  }
  return value;
}
