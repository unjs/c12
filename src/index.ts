export type { DotenvOptions, Env } from "./dotenv";
export { loadDotenv, setupDotenv } from "./dotenv";
export { SUPPORTED_EXTENSIONS, loadConfig, resolveConfigPath } from "./loader";
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
export { createDefineConfig } from "./types";
export type { ConfigWatcher, WatchConfigOptions } from "./watch";
export { watchConfig } from "./watch";
