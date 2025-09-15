export { createDefineConfig } from "./types";
export type { DotenvOptions, Env } from "./dotenv";
export type { ConfigWatcher, WatchConfigOptions } from "./watch";
export type {
  C12InputConfig,
  ConfigFunctionContext,
  ConfigLayer,
  ConfigLayerMeta,
  ConfigSource,
  DefineConfig,
  InputConfig,
  LoadConfigOptions,
  ResolvableConfig,
  ResolvableConfigContext,
  ResolvedConfig,
  SourceOptions,
  UserInputConfig,
} from "./types";

export { loadDotenv, setupDotenv } from "./dotenv";
export { SUPPORTED_EXTENSIONS, loadConfig, resolveConfigPath } from "./loader";
export { watchConfig } from "./watch";
