import type { Jiti, JitiOptions } from "jiti";
import type { DownloadTemplateOptions } from "giget";
import type { DotenvOptions } from "./dotenv";

export interface ConfigLayerMeta {
  name?: string;
  [key: string]: any;
}

export type UserInputConfig = Record<string, any>;

export interface C12InputConfig<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta,
> {
  $test?: T;
  $development?: T;
  $production?: T;
  $env?: Record<string, T>;
  $meta?: MT;
}

export type InputConfig<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta,
> = C12InputConfig<T, MT> & T;

export interface SourceOptions<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta,
> {
  /** Custom meta for layer */
  meta?: MT;

  /** Layer config overrides */
  overrides?: T;

  [key: string]: any;

  /**
   * Options for cloning remote sources
   *
   * @see https://giget.unjs.io
   */
  giget?: DownloadTemplateOptions;

  /**
   * Install dependencies after cloning
   *
   * @see https://nypm.unjs.io
   */
  install?: boolean;

  /**
   * Token for cloning private sources
   *
   * @see https://giget.unjs.io#providing-token-for-private-repositories
   */
  auth?: string;
}

export interface ConfigLayer<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta,
> {
  config: T | null;
  source?: string;
  sourceOptions?: SourceOptions<T, MT>;
  meta?: MT;
  cwd?: string;
  configFile?: string;
}

export interface ResolvedConfig<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta,
> extends ConfigLayer<T, MT> {
  config: T;
  layers?: ConfigLayer<T, MT>[];
  cwd?: string;
}

export interface ResolvableConfigContext<
  T extends UserInputConfig = UserInputConfig,
> {
  configs: Record<
    "overrides" | "main" | "rc" | "packageJson" | "defaultConfig",
    T | null | undefined
  >;
}

type MaybePromise<T> = T | Promise<T>;
export type ResolvableConfig<T extends UserInputConfig = UserInputConfig> =
  | MaybePromise<T | null | undefined>
  | ((ctx: ResolvableConfigContext<T>) => MaybePromise<T | null | undefined>);

export interface LoadConfigOptions<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta,
> {
  /**
   * Configuration base name.
   *
   * @default 'config'
   */
  name?: string;
  /**
   * Resolve configuration from this working directory.
   *
   * @default process.cwd()
   */
  cwd?: string;

  /**
   * Configuration file name without extension. Default is generated from `name` (f.e., if `name` is `foo`, the config file will be => `foo.config`).
   *
   * Set to `false` to avoid loading the config file.
   */
  configFile?: string;

  /**
   * RC Config file name. Default is generated from `name` (name=foo => `.foorc`).
   *
   * Set to `false` to disable loading RC config.
   */
  rcFile?: false | string;
  /**
   * Load RC config from the workspace directory and the user's home directory. Only enabled when `rcFile` is provided. Set to `false` to disable this functionality.
   */
  globalRc?: boolean;

  /**
   * Loads `.env` file if enabled. It is disabled by default.
   */
  dotenv?: boolean | DotenvOptions;

  /**
   * Environment name used for [environment specific configuration](#environment-specific-configuration).
   *
   * The default is `process.env.NODE_ENV`. You can set `envName` to `false` or an empty string to disable the feature.
   */
  envName?: string | false;

  /**
   * Loads config from nearest `package.json` file. It is disabled by default.
   *
   * If `true` value is passed, c12 uses `name` field from `package.json`.
   *
   * You can also pass either a string or an array of strings as a value to use those fields.
   */
  packageJson?: boolean | string | string[];

  /**
   * Specify default configuration. It has the **lowest** priority and is applied **after extending** config.
   */
  defaults?: T;

  /**
   * Specify default configuration. It is applied **before** extending config.
   */
  defaultConfig?: ResolvableConfig<T>;
  /**
   * Specify override configuration. It has the **highest** priority and is applied **before extending** config.
   */
  overrides?: ResolvableConfig<T>;

  /**
   * Exclude environment-specific and built-in keys start with `$` in the resolved config.
   *
   * @default false
   */
  omit$Keys?: boolean;

  resolve?: (
    id: string,
    options: LoadConfigOptions<T, MT>,
  ) =>
    | null
    | undefined
    | ResolvedConfig<T, MT>
    | Promise<ResolvedConfig<T, MT> | undefined | null>;

  /**
   * Custom [`unjs/jiti`](https://github.com/unjs/jiti) instance used to import configuration files.
   */
  jiti?: Jiti;
  /**
   * Custom [`unjs/jiti`](https://github.com/unjs/jiti) options to import configuration files.
   */
  jitiOptions?: JitiOptions;

  /**
   * Options passed to [`unjs/giget`](https://github.com/unjs/giget) when extending layer from git source.
   */
  giget?: false | DownloadTemplateOptions;

  /**
   * Custom options merger function. Default is [`defu`](https://github.com/unjs/defu).
   *
   * **Note:** Custom merge function should deeply merge options with arguments high -> low priority.
   */
  merger?: (...sources: Array<T | null | undefined>) => T;

  /**
   * Load configuration files using defineConfig utility without import statements.
   * If true, the utility name is `define${pascalCase(name)}Config`, else use string.
   */
  globalDefineConfigFn?: boolean | string;

  /**
   * Allow extending of configuration.
   *
   * @see https://github.com/unjs/c12#extending-configuration
   */
  extend?:
    | false
    | {
        extendKey?: string | string[];
      };
}

export type DefineConfig<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta,
> = (input: InputConfig<T, MT>) => InputConfig<T, MT>;

export function createDefineConfig<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta,
>(): DefineConfig<T, MT> {
  return (input: InputConfig<T, MT>) => input;
}
