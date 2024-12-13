import type { Jiti, JitiOptions } from "jiti";
import type { DownloadTemplateOptions } from "giget";
import type { GlobOptions } from "tinyglobby"
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
  name?: string;
  cwd?: string;

  configFile?: string;
  splitConfigFile?: boolean | GlobOptions

  rcFile?: false | string;
  globalRc?: boolean;

  dotenv?: boolean | DotenvOptions;

  envName?: string | false;

  packageJson?: boolean | string | string[];

  defaults?: T;

  defaultConfig?: ResolvableConfig<T>;
  overrides?: ResolvableConfig<T>;

  omit$Keys?: boolean;

  resolve?: (
    id: string,
    options: LoadConfigOptions<T, MT>,
  ) =>
    | null
    | undefined
    | ResolvedConfig<T, MT>
    | Promise<ResolvedConfig<T, MT> | undefined | null>;

  jiti?: Jiti;
  jitiOptions?: JitiOptions;

  giget?: false | DownloadTemplateOptions;

  merger?: (...sources: Array<T | null | undefined>) => T;

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
