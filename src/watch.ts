import type { ChokidarOptions } from "chokidar";
import { debounce } from "perfect-debounce";
import { resolve } from "pathe";
import type { diff } from "ohash/utils";
import type {
  UserInputConfig,
  ConfigLayerMeta,
  ResolvedConfig,
  LoadConfigOptions,
  StandardSchemaV1,
  InferSchemaConfig,
} from "./types.ts";
import { SUPPORTED_EXTENSIONS, loadConfig } from "./loader.ts";

type DiffEntries = ReturnType<typeof diff>;

export type ConfigWatcher<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta,
> = ResolvedConfig<T, MT> & {
  watchingFiles: string[];
  unwatch: () => Promise<void>;
};

export interface WatchConfigOptions<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta,
  S extends StandardSchemaV1 | undefined = StandardSchemaV1 | undefined,
> extends LoadConfigOptions<T, MT, S> {
  chokidarOptions?: ChokidarOptions;
  debounce?: false | number;

  onWatch?: (event: {
    type: "created" | "updated" | "removed";
    path: string;
  }) => void | Promise<void>;

  acceptHMR?: (context: {
    getDiff: () => DiffEntries;
    newConfig: ResolvedConfig<InferSchemaConfig<T, S>, MT>;
    oldConfig: ResolvedConfig<InferSchemaConfig<T, S>, MT>;
  }) => void | boolean | Promise<void | boolean>;

  onUpdate?: (context: {
    getDiff: () => ReturnType<typeof diff>;
    newConfig: ResolvedConfig<InferSchemaConfig<T, S>, MT>;
    oldConfig: ResolvedConfig<InferSchemaConfig<T, S>, MT>;
  }) => void | Promise<void>;
}

const eventMap = {
  add: "created",
  change: "updated",
  unlink: "removed",
} as const;

export async function watchConfig<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta,
  S extends StandardSchemaV1 | undefined = StandardSchemaV1 | undefined,
>(options: WatchConfigOptions<T, MT, S>): Promise<ConfigWatcher<InferSchemaConfig<T, S>, MT>> {
  type C = InferSchemaConfig<T, S>;

  let config = await loadConfig<T, MT, S>(options);

  const configName = options.name || "config";
  const configFileName =
    options.configFile ?? (options.name === "config" ? "config" : `${options.name}.config`);
  const watchingFiles = [
    ...new Set(
      (config.layers || [])
        .filter((l) => l.cwd)
        .flatMap((l) => [
          ...SUPPORTED_EXTENSIONS.flatMap((ext) => [
            resolve(l.cwd!, configFileName + ext),
            resolve(l.cwd!, ".config", configFileName + ext),
            resolve(l.cwd!, ".config", configFileName.replace(/\.config$/, "") + ext),
          ]),
          l.source && resolve(l.cwd!, l.source),
          // TODO: Support watching rc from home and workspace
          options.rcFile &&
            resolve(
              l.cwd!,
              typeof options.rcFile === "string" ? options.rcFile : `.${configName}rc`,
            ),
          options.packageJson && resolve(l.cwd!, "package.json"),
        ])
        .filter(Boolean),
    ),
  ] as string[];

  const watch = await import("chokidar").then((r) => r.watch || r.default || r);
  const { diff } = await import("ohash/utils");
  const _fswatcher = watch(watchingFiles, {
    ignoreInitial: true,
    ...options.chokidarOptions,
  });

  const onChange = async (event: string, path: string) => {
    const type = eventMap[event as keyof typeof eventMap];
    if (!type) {
      return;
    }
    if (options.onWatch) {
      await options.onWatch({
        type,
        path,
      });
    }
    const oldConfig = config;
    try {
      config = await loadConfig<T, MT, S>(options);
    } catch (error) {
      // Includes schema validation errors: previous config is kept
      console.warn(`Failed to load config ${path}\n${error}`);
      return;
    }
    const changeCtx = {
      newConfig: config,
      oldConfig,
      getDiff: () => diff(oldConfig.config, config.config),
    };
    if (options.acceptHMR) {
      const changeHandled = await options.acceptHMR(changeCtx);
      if (changeHandled) {
        return;
      }
    }
    if (options.onUpdate) {
      await options.onUpdate(changeCtx);
    }
  };

  if (options.debounce === false) {
    _fswatcher.on("all", onChange);
  } else {
    _fswatcher.on("all", debounce(onChange, options.debounce ?? 100));
  }

  const utils: Partial<ConfigWatcher<C, MT>> = {
    watchingFiles,
    unwatch: async () => {
      await _fswatcher.close();
    },
  };

  return new Proxy<ConfigWatcher<C, MT>>(utils as ConfigWatcher<C, MT>, {
    get(_, prop) {
      if (prop in utils) {
        return utils[prop as keyof typeof utils];
      }
      return config[prop as keyof ResolvedConfig<C, MT>];
    },
  });
}
