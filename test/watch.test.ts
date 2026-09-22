import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { join, normalize } from "pathe";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { watchConfig, type ConfigWatcher } from "../src/index.ts";

const tmpDir = normalize(fileURLToPath(new URL(".tmp-watch", import.meta.url)));
const r = (path: string) => join(tmpDir, path);

describe("watchConfig", () => {
  let watcher: ConfigWatcher | undefined;
  let events: { type: string; path: string }[];

  const setup = async (opts: { debounce?: false | number } = {}) => {
    events = [];
    watcher = await watchConfig({
      cwd: tmpDir,
      name: "test",
      debounce: 10,
      ...opts,
      onWatch: (event) => {
        events.push({ type: event.type, path: event.path.replace(tmpDir, "<tmp>") });
      },
    });
    return watcher;
  };

  beforeEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await watcher?.unwatch();
    watcher = undefined;
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("reloads on update", async () => {
    await writeFile(r("test.config.json"), JSON.stringify({ foo: 1 }));
    const config = await setup();
    expect(config.config.foo).toBe(1);
    expect(config.watchingFiles).toContain(r("test.config.json"));

    await writeFile(r("test.config.json"), JSON.stringify({ foo: 2 }));
    await vi.waitFor(() => expect(config.config.foo).toBe(2));
    expect(events).toContainEqual({ type: "updated", path: "<tmp>/test.config.json" });
  });

  it("detects created and removed files", async () => {
    const config = await setup();
    expect(config.config.foo).toBeUndefined();

    await writeFile(r("test.config.json"), JSON.stringify({ foo: "created" }));
    await vi.waitFor(() => expect(config.config.foo).toBe("created"));
    expect(events).toContainEqual({ type: "created", path: "<tmp>/test.config.json" });

    await rm(r("test.config.json"));
    await vi.waitFor(() => expect(config.config.foo).toBeUndefined());
    expect(events).toContainEqual({ type: "removed", path: "<tmp>/test.config.json" });
  });

  it("detects atomic writes (rename over) as update", async () => {
    await writeFile(r("test.config.json"), JSON.stringify({ foo: 1 }));
    const config = await setup();

    await writeFile(r("test.config.json.tmp"), JSON.stringify({ foo: 2 }));
    await rename(r("test.config.json.tmp"), r("test.config.json"));
    await vi.waitFor(() => expect(config.config.foo).toBe(2));
    expect(events).toContainEqual({ type: "updated", path: "<tmp>/test.config.json" });
    expect(events.map((e) => e.type)).not.toContain("removed");
  });

  it("watches config in a not-yet-existing .config directory", async () => {
    const config = await setup();

    await mkdir(r(".config"));
    await writeFile(r(".config/test.json"), JSON.stringify({ foo: "dotconfig" }));
    await vi.waitFor(() => expect(config.config.foo).toBe("dotconfig"));

    await writeFile(r(".config/test.json"), JSON.stringify({ foo: "dotconfig2" }));
    await vi.waitFor(() => expect(config.config.foo).toBe("dotconfig2"));

    // Removing and re-creating the directory keeps working
    await rm(r(".config"), { recursive: true });
    await vi.waitFor(() => expect(config.config.foo).toBeUndefined());
    await mkdir(r(".config"));
    await writeFile(r(".config/test.json"), JSON.stringify({ foo: "again" }));
    await vi.waitFor(() => expect(config.config.foo).toBe("again"));
  });

  it("ignores unrelated files", async () => {
    const onUpdate = vi.fn();
    await writeFile(r("test.config.json"), JSON.stringify({ foo: 1 }));
    watcher = await watchConfig({ cwd: tmpDir, name: "test", debounce: false, onUpdate });

    await writeFile(r("other.json"), "{}");
    await writeFile(r("test.config.json"), JSON.stringify({ foo: 2 }));
    await vi.waitFor(() => expect(watcher!.config.foo).toBe(2));
    expect(onUpdate.mock.calls.every(([ctx]) => ctx.newConfig.config.foo === 2)).toBe(true);
  });

  it("stops watching after unwatch", async () => {
    await writeFile(r("test.config.json"), JSON.stringify({ foo: 1 }));
    const config = await setup();
    await config.unwatch();

    await writeFile(r("test.config.json"), JSON.stringify({ foo: 2 }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(config.config.foo).toBe(1);
    expect(events).toEqual([]);
  });
});
