import { existsSync, lstatSync, realpathSync, statSync, watch, type FSWatcher } from "node:fs";
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

  let closed = false;

  const onChange = async (events: [path: string, type: WatchEventType][]) => {
    if (closed || events.length === 0) {
      return;
    }
    try {
      if (options.onWatch) {
        for (const [path, type] of events) {
          await options.onWatch({ type, path });
        }
      }
      const oldConfig = config;
      try {
        config = await loadConfig(options);
      } catch (error) {
        console.warn(`Failed to load config ${events.map((e) => e[0]).join(", ")}\n${error}`);
        return;
      }
      if (closed) {
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
    } catch (error) {
      console.warn(`Config watcher error\n${error}`);
    }
  };

  let onEvent: (type: WatchEventType, path: string) => void;
  let cancel: (() => void) | undefined;
  if (options.debounce === false) {
    onEvent = (type, path) => void onChange([[path, type]]);
  } else {
    // Coalesce events per path within the debounce window (e.g. "created" + "updated" => "created")
    const queue = new Map<string, WatchEventType>();
    const flush = debounce(() => {
      const events = [...queue];
      queue.clear();
      return onChange(events);
    }, options.debounce ?? 100);
    cancel = flush.cancel;
    onEvent = (type, path) => {
      const merged = mergeEventType(queue.get(path), type);
      if (merged) {
        queue.set(path, merged);
      } else {
        queue.delete(path);
      }
      void flush();
    };
  }

  const _fswatcher = watchFiles(watchingFiles, onEvent);

  const utils: Partial<ConfigWatcher<T, MT>> = {
    watchingFiles,
    unwatch: async () => {
      closed = true;
      cancel?.();
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

function mergeEventType(
  prev: WatchEventType | undefined,
  next: WatchEventType,
): WatchEventType | undefined {
  if (prev === "created") {
    // created + updated => created, created + removed => no change
    return next === "removed" ? undefined : "created";
  }
  if (prev === "removed" && next === "created") {
    return "updated";
  }
  return next;
}

const MAX_WATCH_RETRIES = 3;

/**
 * Watch a fixed list of file paths using native (non-recursive) `fs.watch` on their parent directories.
 *
 * - Directories that do not exist yet are watched through their nearest existing ancestor
 *   and picked up once they are created.
 * - Watched directories that are removed or replaced (inode change) are re-synced.
 * - Symlinked files also watch the directory of their resolved target.
 */
function watchFiles(
  files: string[],
  onEvent: (type: WatchEventType, path: string) => void,
): { close: () => void } {
  const exists = new Map<string, boolean>();
  const filesByDir = new Map<string, Set<string>>();
  const pendingDirs = new Map<string, Set<string>>(); // parent dir -> missing child dir names
  const watchers = new Map<string, { watcher: FSWatcher; ino: number }>();
  const links = new Map<string, { target: string; watcher: FSWatcher }>(); // symlinked file -> target watcher
  const retries = new Map<string, number>();
  let closed = false;

  const addToSet = (map: Map<string, Set<string>>, key: string, value: string) => {
    let set = map.get(key);
    if (!set) {
      map.set(key, (set = new Set()));
    }
    set.add(value);
  };

  for (const file of files) {
    exists.set(file, existsSync(file));
    addToSet(filesByDir, dirname(file), basename(file));
  }

  const syncLink = (file: string) => {
    let target: string | undefined;
    try {
      if (lstatSync(file).isSymbolicLink()) {
        target = realpathSync(file);
      }
    } catch {
      // Missing or broken link
    }
    const current = links.get(file);
    if (current?.target === target) {
      return;
    }
    current?.watcher.close();
    links.delete(file);
    if (!target || closed) {
      return;
    }
    const targetName = basename(target);
    try {
      const watcher = watch(dirname(target), { persistent: true }, (_event, filename) => {
        if (!closed && (!filename || filename.toString() === targetName)) {
          check(file);
        }
      });
      watcher.on("error", () => {
        watcher.close();
        if (links.get(file)?.watcher === watcher) {
          links.delete(file);
        }
      });
      links.set(file, { target, watcher });
    } catch {
      // Target directory is not watchable
    }
  };

  function check(path: string) {
    const prev = exists.get(path);
    const now = existsSync(path);
    syncLink(path);
    if (!now && !prev) {
      return;
    }
    exists.set(path, now);
    onEvent(now ? (prev ? "updated" : "created") : "removed", path);
  }

  function rescan(dir: string) {
    for (const name of filesByDir.get(dir) || []) {
      check(join(dir, name));
    }
    for (const name of pendingDirs.get(dir) || []) {
      syncDir(join(dir, name));
    }
  }

  /** Close watchers of `dir` and all its watched descendants, marking descendants as pending. */
  function unwatchDir(dir: string) {
    watchers.get(dir)?.watcher.close();
    watchers.delete(dir);
    for (const child of watchers.keys()) {
      if (dirname(child) === dir) {
        unwatchDir(child);
        addToSet(pendingDirs, dir, basename(child));
      }
    }
  }

  function addPending(dir: string) {
    const parent = dirname(dir);
    if (parent === dir) {
      return;
    }
    addToSet(pendingDirs, parent, basename(dir));
    watchDir(parent);
  }

  /** Make the watcher of `dir` match what is on disk (created, removed or replaced) and report changes. */
  function syncDir(dir: string) {
    if (closed) {
      return;
    }
    const ino = statDir(dir)?.ino;
    const current = watchers.get(dir);
    if (current && current.ino === ino) {
      return;
    }
    if (current) {
      unwatchDir(dir);
    }
    if (ino === undefined) {
      addPending(dir);
    } else {
      watchDir(dir);
    }
    rescan(dir);
  }

  function onDirEvent(dir: string, filename: string | null) {
    if (closed) {
      return;
    }
    // Watched directory itself removed or replaced
    if (watchers.get(dir)?.ino !== statDir(dir)?.ino) {
      syncDir(dir);
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
    if (watchers.has(path) || pendingDirs.get(dir)?.has(filename)) {
      syncDir(path);
    }
  }

  function watchDir(dir: string) {
    if (closed || watchers.has(dir)) {
      return;
    }
    let watcher: FSWatcher;
    let ino: number;
    try {
      ino = statSync(dir).ino;
      watcher = watch(dir, { persistent: true }, (_event, filename) =>
        onDirEvent(dir, filename?.toString() || null),
      );
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT" || code === "ENOTDIR") {
        addPending(dir);
      } else {
        console.warn(`Failed to watch ${dir}\n${error}`);
      }
      return;
    }
    pendingDirs.get(dirname(dir))?.delete(basename(dir));
    watcher.on("error", (error) => {
      if (watchers.get(dir)?.watcher !== watcher) {
        return;
      }
      unwatchDir(dir);
      const retry = (retries.get(dir) || 0) + 1;
      retries.set(dir, retry);
      if (retry > MAX_WATCH_RETRIES && existsSync(dir)) {
        console.warn(`Failed to watch ${dir}\n${error}`);
        return;
      }
      if (existsSync(dir)) {
        watchDir(dir);
      } else {
        addPending(dir);
      }
      rescan(dir);
    });
    watchers.set(dir, { watcher, ino });
  }

  for (const file of files) {
    syncLink(file);
  }
  for (const dir of filesByDir.keys()) {
    watchDir(dir);
  }

  return {
    close: () => {
      closed = true;
      for (const { watcher } of watchers.values()) {
        watcher.close();
      }
      for (const { watcher } of links.values()) {
        watcher.close();
      }
      watchers.clear();
      links.clear();
    },
  };
}

function statDir(dir: string) {
  try {
    const stat = statSync(dir);
    return stat.isDirectory() ? stat : undefined;
  } catch {
    return undefined;
  }
}
