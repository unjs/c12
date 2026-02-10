export { type DotenvOptions, type Env, loadDotenv, setupDotenv } from "./dotenv.ts";

export { SUPPORTED_EXTENSIONS, loadConfig } from "./loader.ts";

export * from "./types.ts";

export {
  type ConfigProvider,
  type ProviderContext,
  type ProviderResult,
  getDefaultProviders,
  sortProviders,
  createOverridesProvider,
  createMainProvider,
  createRcProvider,
  createPackageJsonProvider,
  createDefaultConfigProvider,
} from "./providers.ts";

export { type ConfigWatcher, type WatchConfigOptions, watchConfig } from "./watch.ts";
