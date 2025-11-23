import type { Jiti, JitiOptions } from "jiti";
import type { DownloadTemplateOptions } from "giget";
import type { DotenvOptions } from "./dotenv";

// https://github.com/standard-schema/standard-schema/blob/main/packages/spec/src/index.ts
/** The Standard Schema interface. */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  /** The Standard Schema properties. */
  readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace StandardSchemaV1 {
  /** The Standard Schema properties interface. */
  export interface Props<Input = unknown, Output = Input> {
    /** The version number of the standard. */
    readonly version: 1;
    /** The vendor name of the schema library. */
    readonly vendor: string;
    /** Validates unknown input values. */
    readonly validate: (
      value: unknown,
    ) => Result<Output> | Promise<Result<Output>>;
    /** Inferred types associated with the schema. */
    readonly types?: Types<Input, Output> | undefined;
  }

  /** The result interface of the validate function. */
  export type Result<Output> = SuccessResult<Output> | FailureResult;

  /** The result interface if validation succeeds. */
  export interface SuccessResult<Output> {
    /** The typed output value. */
    readonly value: Output;
    /** The non-existent issues. */
    readonly issues?: undefined;
  }

  /** The result interface if validation fails. */
  export interface FailureResult {
    /** The issues of failed validation. */
    readonly issues: ReadonlyArray<Issue>;
  }

  /** The issue interface of the failure output. */
  export interface Issue {
    /** The error message of the issue. */
    readonly message: string;
    /** The path of the issue, if any. */
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }

  /** The path segment interface of the issue. */
  export interface PathSegment {
    /** The key representing a path segment. */
    readonly key: PropertyKey;
  }

  /** The Standard Schema types interface. */
  export interface Types<Input = unknown, Output = Input> {
    /** The input type of the schema. */
    readonly input: Input;
    /** The output type of the schema. */
    readonly output: Output;
  }

  /** Infers the input type of a Standard Schema. */
  export type InferInput<Schema extends StandardSchemaV1> = NonNullable<
    Schema["~standard"]["types"]
  >["input"];

  /** Infers the output type of a Standard Schema. */
  export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<
    Schema["~standard"]["types"]
  >["output"];

  // biome-ignore lint/complexity/noUselessEmptyExport: needed for granular visibility control of TS namespace
  export {};
}

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
  _configFile?: string;
}

export type ConfigSource =
  | "overrides"
  | "main"
  | "rc"
  | "packageJson"
  | "defaultConfig";

export interface ConfigFunctionContext {
  [key: string]: any;
}

export interface ResolvableConfigContext<
  T extends UserInputConfig = UserInputConfig,
> {
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
  S extends StandardSchemaV1 = StandardSchemaV1,
> {
  name?: string;
  cwd?: string;

  configFile?: string;

  rcFile?: false | string;
  globalRc?: boolean;

  dotenv?: boolean | DotenvOptions;

  envName?: string | false;

  packageJson?: boolean | string | string[];

  defaults?: T;

  defaultConfig?: ResolvableConfig<T>;
  overrides?: ResolvableConfig<T>;

  omit$Keys?: boolean;

  /** Context passed to config functions */
  context?: ConfigFunctionContext;

  resolve?: (
    id: string,
    options: LoadConfigOptions<T, MT, S>,
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

  configFileRequired?: boolean;

  schema?: S;
  validate?: (schema: S, input: ResolvedConfig<T, MT>) => void;
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
