import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { join, normalize } from "pathe";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { watchConfig, type ConfigWatcher } from "../src/index.ts";

const tmpDir = normalize(fileURLToPath(new URL(".tmp-watch-rc-pkg", import.meta.url)));
const r = (path: string) => join(tmpDir, path);

describe("watchConfig rcFile and packageJson sources", () => {
  let watcher: ConfigWatcher | undefined;
  let events: { type: string; path: string }[];

  const setup = async (opts: Record<string, any> = {}) => {
    events = [];
    watcher = await watchConfig({
      cwd: tmpDir,
      name: "test",
      debounce: 10,
      onWatch: (event) => {
        events.push({ type: event.type, path: event.path.replace(tmpDir, "<tmp>") });
      },
      ...opts,
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

  it("watches the rc file in cwd and reloads on change", async () => {
    await writeFile(r(".testrc"), "foo=1\n");
    const config = await setup();
    expect(config.config.foo).toBe(1);
    expect(config.watchingFiles).toContain(r(".testrc"));

    await writeFile(r(".testrc"), "foo=2\n");
    await vi.waitFor(() => expect(watcher!.config.foo).toBe(2), { timeout: 5000 });
    expect(events).toContainEqual({ type: "updated", path: "<tmp>/.testrc" });
  });

  it("watches a custom rcFile path", async () => {
    await writeFile(r("custom.rc"), "foo=1\n");
    const config = await setup({ rcFile: "custom.rc" });
    expect(config.config.foo).toBe(1);
    expect(config.watchingFiles).toContain(r("custom.rc"));

    await writeFile(r("custom.rc"), "foo=2\n");
    await vi.waitFor(() => expect(watcher!.config.foo).toBe(2), { timeout: 5000 });
  });

  it("does not watch rc files when rcFile is disabled", async () => {
    const config = await setup({ rcFile: false });
    expect(config.watchingFiles).not.toContain(r(".testrc"));

    await writeFile(r(".testrc"), "foo=1\n");
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(watcher!.config.foo).toBeUndefined();
  });

  it("watches package.json and reloads on change", async () => {
    await writeFile(r("package.json"), JSON.stringify({ test: { foo: 1 } }));
    const config = await setup({ packageJson: true });
    expect(config.config.foo).toBe(1);
    expect(config.watchingFiles).toContain(r("package.json"));

    await writeFile(r("package.json"), JSON.stringify({ test: { foo: 2 } }));
    await vi.waitFor(() => expect(watcher!.config.foo).toBe(2), { timeout: 5000 });
    expect(events).toContainEqual({ type: "updated", path: "<tmp>/package.json" });
  });

  it("watches package.json with custom keys", async () => {
    await writeFile(r("package.json"), JSON.stringify({ custom: { foo: 1 } }));
    const config = await setup({ packageJson: ["custom"] });
    expect(config.config.foo).toBe(1);

    await writeFile(r("package.json"), JSON.stringify({ custom: { foo: 2 } }));
    await vi.waitFor(() => expect(watcher!.config.foo).toBe(2), { timeout: 5000 });
  });

  it("does not watch package.json when it is not enabled", async () => {
    const config = await setup();
    expect(config.watchingFiles).not.toContain(r("package.json"));

    await writeFile(r("package.json"), JSON.stringify({ test: { foo: 1 } }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(watcher!.config.foo).toBeUndefined();
  });
});
