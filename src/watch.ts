import { existsSync, watch, type FSWatcher } from "node:fs";
import { debounce } from "perfect-debounce";
import { basename, dirname, join, resolve } from "pathe";
import type { diff } from "ohash/utils";
import type {
  UserInputConfig,
  ConfigLayerMeta,
  ResolvedConfig,
  LoadConfigOptions,
} from "./types.ts";
import { SUPPORTED_EXTENSIONS, loadConfig } from "./loader.ts";

type DiffEntries = ReturnType<typeof diff>;

type WatchEventType = "created" | "updated" | "removed";

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
> extends LoadConfigOptions<T, MT> {
  debounce?: false | number;

  onWatch?: (event: { type: WatchEventType; path: string }) => void | Promise<void>;

  acceptHMR?: (context: {
    getDiff: () => DiffEntries;
    newConfig: ResolvedConfig<T, MT>;
    oldConfig: ResolvedConfig<T, MT>;
  }) => void | boolean | Promise<void | boolean>;

  onUpdate?: (context: {
    getDiff: () => ReturnType<typeof diff>;
    newConfig: ResolvedConfig<T, MT>;
    oldConfig: ResolvedConfig<T, MT>;
  }) => void | Promise<void>;
}

export async function watchConfig<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta,
>(options: WatchConfigOptions<T, MT>): Promise<ConfigWatcher<T, MT>> {
  let config = await loadConfig<T, MT>(options);

  const configName = options.name || "config";
  const configFileName =
    options.configFile ?? (options.name === "config" ? "config" : `${options.name}.config`);
  const watchingFiles = [
    ...new Set(
      // Always include root cwd so config files created later are detected
      [{ cwd: config.cwd, source: undefined }, ...(config.layers || [])]
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

  const { diff } = await import("ohash/utils");

  const onChange = async (type: WatchEventType, path: string) => {
    if (options.onWatch) {
      await options.onWatch({
        type,
        path,
      });
    }
    const oldConfig = config;
    try {
      config = await loadConfig(options);
    } catch (error) {
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

  let onEvent = onChange;
  if (options.debounce !== false) {
    const debouncedOnChange = debounce(onChange, options.debounce ?? 100);
    // Writing a new file emits "created" followed by "updated"; keep reporting it as "created"
    let pending: { type: WatchEventType; path: string } | undefined;
    onEvent = (type, path) => {
      if (type === "updated" && pending?.type === "created" && pending.path === path) {
        type = "created";
      }
      const current = (pending = { type, path });
      return debouncedOnChange(type, path).finally(() => {
        if (pending === current) {
          pending = undefined;
        }
      });
    };
  }

  const _fswatcher = watchFiles(watchingFiles, onEvent);

  const utils: Partial<ConfigWatcher<T, MT>> = {
    watchingFiles,
    unwatch: async () => {
      _fswatcher.close();
    },
  };

  return new Proxy<ConfigWatcher<T, MT>>(utils as ConfigWatcher<T, MT>, {
    get(_, prop) {
      if (prop in utils) {
        return utils[prop as keyof typeof utils];
      }
      return config[prop as keyof ResolvedConfig<T, MT>];
    },
  });
}

// --- Internal ---

/**
 * Watch a fixed list of file paths using native (non-recursive) `fs.watch` on their parent directories.
 *
 * Directories that do not exist yet are watched through their nearest existing ancestor
 * and picked up once they are created.
 */
function watchFiles(
  files: string[],
  onEvent: (type: WatchEventType, path: string) => void,
): { close: () => void } {
  const exists = new Map<string, boolean>();
  const filesByDir = new Map<string, Set<string>>();
  const pendingDirs = new Map<string, Set<string>>(); // parent dir -> missing child dir names
  const watchers = new Map<string, FSWatcher>();
  let closed = false;

  for (const file of files) {
    exists.set(file, existsSync(file));
    const dir = dirname(file);
    let names = filesByDir.get(dir);
    if (!names) {
      filesByDir.set(dir, (names = new Set()));
    }
    names.add(basename(file));
  }

  const check = (path: string) => {
    const prev = exists.get(path);
    const now = existsSync(path);
    if (!now && !prev) {
      return;
    }
    exists.set(path, now);
    onEvent(now ? (prev ? "updated" : "created") : "removed", path);
  };

  const rescan = (dir: string) => {
    for (const name of filesByDir.get(dir) || []) {
      check(join(dir, name));
    }
    for (const name of pendingDirs.get(dir) || []) {
      onDirEvent(dir, name);
    }
  };

  const addPending = (dir: string) => {
    const parent = dirname(dir);
    if (parent === dir) {
      return;
    }
    let names = pendingDirs.get(parent);
    if (!names) {
      pendingDirs.set(parent, (names = new Set()));
    }
    names.add(basename(dir));
    watchDir(parent);
  };

  const unwatchDir = (dir: string) => {
    watchers.get(dir)?.close();
    watchers.delete(dir);
    // Watched children and files are gone as well
    for (const child of watchers.keys()) {
      if (dirname(child) === dir) {
        unwatchDir(child);
      }
    }
    rescan(dir);
  };

  const onDirEvent = (dir: string, filename: string | null) => {
    if (closed) {
      return;
    }
    if (!filename) {
      rescan(dir);
      return;
    }
    const path = join(dir, filename);
    if (exists.has(path)) {
      check(path);
    }
    if (pendingDirs.get(dir)?.has(filename) && existsSync(path)) {
      pendingDirs.get(dir)!.delete(filename);
      watchDir(path);
      rescan(path);
    } else if (watchers.has(path) && !existsSync(path)) {
      unwatchDir(path);
      addPending(path);
    }
  };

  function watchDir(dir: string) {
    if (closed || watchers.has(dir)) {
      return;
    }
    let watcher: FSWatcher;
    try {
      watcher = watch(dir, { persistent: true }, (_event, filename) =>
        onDirEvent(dir, filename?.toString() || null),
      );
    } catch {
      addPending(dir);
      return;
    }
    watcher.on("error", () => {
      if (watchers.get(dir) !== watcher) {
        return;
      }
      unwatchDir(dir);
      if (existsSync(dir)) {
        watchDir(dir);
      } else {
        addPending(dir);
      }
    });
    watchers.set(dir, watcher);
  }

  for (const dir of filesByDir.keys()) {
    watchDir(dir);
  }

  return {
    close: () => {
      closed = true;
      for (const watcher of watchers.values()) {
        watcher.close();
      }
      watchers.clear();
    },
  };
}
