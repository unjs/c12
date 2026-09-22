import type { DownloadTemplateOptions } from "giget";
import type { DotenvOptions } from "./dotenv.ts";

type JitiOptions = NonNullable<Parameters<typeof import("jiti").createJiti>[1]>;

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
   * Pass `true` to install with c12's defaults (`ignoreWorkspace: true`), or pass an object
   * to forward arbitrary nypm install options.
   *
   * @see https://nypm.unjs.io
   */
  install?: NonNullable<DownloadTemplateOptions["install"]>;

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
  _configFile?: string;
}

export type ConfigSource = "overrides" | "main" | "rc" | "packageJson" | "defaultConfig";

export interface ConfigFunctionContext {
  [key: string]: any;
}

export interface ResolvableConfigContext<T extends UserInputConfig = UserInputConfig> {
  configs: Record<ConfigSource, T | null | undefined>;
  rawConfigs: Record<ConfigSource, ResolvableConfig<T> | null | undefined>;
}

type MaybePromise<T> = T | Promise<T>;
export type ResolvableConfig<T extends UserInputConfig = UserInputConfig> =
  | MaybePromise<T | null | undefined>
  | ((ctx: ResolvableConfigContext<T>) => MaybePromise<T | null | undefined>);

export interface LoadConfigOptions<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta,
> {
  name?: string;
  cwd?: string;

  configFile?: string;

  rcFile?: false | string;
  globalRc?: boolean;

  dotenv?: boolean | DotenvOptions;

  /**
   * Environment name(s) used to apply `$<envName>` and `$env.<envName>` overrides.
   *
   * When an array is given, later names have higher priority.
   *
   * Default: `process.env.NODE_ENV`
   */
  envName?: string | string[] | false;

  packageJson?: boolean | string | string[];

  defaults?: T;

  defaultConfig?: ResolvableConfig<T>;
  overrides?: ResolvableConfig<T>;

  omit$Keys?: boolean;

  /** Context passed to config functions */
  context?: ConfigFunctionContext;

  resolve?: (
    id: string,
    options: LoadConfigOptions<T, MT>,
  ) => null | undefined | ResolvedConfig<T, MT> | Promise<ResolvedConfig<T, MT> | undefined | null>;

  /** Custom import function used to load configuration files */
  import?: (id: string) => Promise<unknown>;

  /** Custom resolver for picking which export to use from the loaded module. Default: `(mod) => mod.default || mod` */
  resolveModule?: (mod: any) => any;

  /** Options to override defaults when c12 falls back to [jiti](https://github.com/unjs/jiti) for loading config files. */
  jitiOptions?: JitiOptions;

  giget?: false | DownloadTemplateOptions;

  merger?: (...sources: Array<T | null | undefined>) => T;

  extend?:
    | false
    | {
        extendKey?: string | string[];
      };

  configFileRequired?: boolean;

  /**
   * [Standard Schema](https://standardschema.dev) (zod, valibot, arktype, ...) used to validate the final merged config.
   *
   * The validated output replaces `config` (schema defaults and transforms are applied).
   */
  schema?: StandardSchemaV1;
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

/**
 * Minimal [Standard Schema](https://standardschema.dev) v1 interface.
 */
export interface StandardSchemaV1<Output = unknown> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown,
    ) => StandardSchemaV1Result<Output> | Promise<StandardSchemaV1Result<Output>>;
  };
}

export type StandardSchemaV1Result<Output = unknown> =
  | { readonly value: Output; readonly issues?: undefined }
  | {
      readonly issues: ReadonlyArray<{
        readonly message: string;
        readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined;
      }>;
    };
