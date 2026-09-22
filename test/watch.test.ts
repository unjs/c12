import { fileURLToPath } from "node:url";
import { renameSync, rmSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { join, normalize } from "pathe";
import { mkdir, rename, rm, symlink, writeFile } from "node:fs/promises";
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

  it("re-watches a .config directory replaced by another one", async () => {
    await mkdir(r(".config"));
    await writeFile(r(".config/test.json"), JSON.stringify({ foo: 1 }));
    const config = await setup();

    await mkdir(r(".config-new"));
    await writeFile(r(".config-new/test.json"), JSON.stringify({ foo: 2 }));
    // Swap synchronously so no watcher event is handled in between
    rmSync(r(".config"), { recursive: true });
    renameSync(r(".config-new"), r(".config"));
    await vi.waitFor(() => expect(config.config.foo).toBe(2));

    await writeFile(r(".config/test.json"), JSON.stringify({ foo: 3 }));
    await vi.waitFor(() => expect(config.config.foo).toBe(3));
  });

  // Windows refuses to rename a directory while a descendant has an open `fs.watch` handle (EPERM)
  it.skipIf(process.platform === "win32")(
    "re-watches nested directories after parent is moved away and back",
    async () => {
      await mkdir(r("layer/.config"), { recursive: true });
      await writeFile(r("layer/.config/test.json"), JSON.stringify({ foo: 1 }));
      await writeFile(r("test.config.json"), JSON.stringify({ extends: ["./layer"] }));
      const config = await setup();
      expect(config.config.foo).toBe(1);

      await rename(r("layer"), r("layer-moved"));
      await vi.waitFor(() => expect(config.config.foo).toBeUndefined());
      await rename(r("layer-moved"), r("layer"));
      await vi.waitFor(() => expect(config.config.foo).toBe(1));

      await writeFile(r("layer/.config/test.json"), JSON.stringify({ foo: 2 }));
      await vi.waitFor(() => expect(config.config.foo).toBe(2));
    },
  );

  it("re-watches cwd after it is removed and re-created", async () => {
    await writeFile(r("test.config.json"), JSON.stringify({ foo: 1 }));
    const config = await setup();

    await rm(tmpDir, { recursive: true });
    await vi.waitFor(() =>
      expect(events).toContainEqual({ type: "removed", path: "<tmp>/test.config.json" }),
    );
    await mkdir(tmpDir);
    await writeFile(r("test.config.json"), JSON.stringify({ foo: 2 }));
    await vi.waitFor(() => expect(config.config.foo).toBe(2));
  });

  it.skipIf(process.platform === "win32")(
    "detects changes to symlinked config target",
    async () => {
      await mkdir(r("shared"));
      await writeFile(r("shared/real.json"), JSON.stringify({ foo: 1 }));
      await symlink(r("shared/real.json"), r("test.config.json"));
      const config = await setup();
      expect(config.config.foo).toBe(1);

      await writeFile(r("shared/real.json"), JSON.stringify({ foo: 2 }));
      await vi.waitFor(() => expect(config.config.foo).toBe(2));
      expect(events).toContainEqual({ type: "updated", path: "<tmp>/test.config.json" });
    },
  );

  it("coalesces events within debounce window", async () => {
    const config = await setup({ debounce: 200 });
    await writeFile(r("test.config.json"), JSON.stringify({ foo: 1 }));
    await writeFile(r("test.config.json"), JSON.stringify({ foo: 2 }));
    await vi.waitFor(() => expect(config.config.foo).toBe(2));
    expect(events).toEqual([{ type: "created", path: "<tmp>/test.config.json" }]);
  });

  it("does not throw unhandled errors from hooks", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await writeFile(r("test.config.json"), JSON.stringify({ foo: 1 }));
    watcher = await watchConfig({
      cwd: tmpDir,
      name: "test",
      debounce: 10,
      onUpdate: () => {
        throw new Error("hook failed");
      },
    });
    await writeFile(r("test.config.json"), JSON.stringify({ foo: 2 }));
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("hook failed")),
    );
    warn.mockRestore();
  });

  it("does not call hooks after unwatch with pending events", async () => {
    await writeFile(r("test.config.json"), JSON.stringify({ foo: 1 }));
    const config = await setup({ debounce: 200 });
    await writeFile(r("test.config.json"), JSON.stringify({ foo: 2 }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    await config.unwatch();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(events).toEqual([]);
    expect(config.config.foo).toBe(1);
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
