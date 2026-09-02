import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { join, normalize } from "pathe";
import { loadConfig } from "../src/index.ts";

const r = (path: string) => normalize(fileURLToPath(new URL(path, import.meta.url)));

const downloadTemplate = vi.hoisted(() => vi.fn());

vi.mock("giget", () => ({
  downloadTemplate,
}));

// Regression coverage for unjs/c12#128 & nuxt/nuxt#33382: when a layer is
// extended with `install: true` from inside a pnpm workspace, c12 must ask
// giget+nypm to install in isolation (`--ignore-workspace`), otherwise pnpm
// escalates to the consumer's `pnpm-workspace.yaml` and re-runs the
// consumer's own `postinstall`, which can re-enter c12 and recurse.
describe("loader: giget install options", () => {
  // `downloadTemplate` is mocked but loader.ts still resolves and cleans up the
  // real clone dir, which for this source+cwd is the same shared cache entry
  // that test/loader.test.ts's "extend from git repo" downloads into. Point
  // these tests at a throwaway cache so they cannot delete it mid-extract.
  let cacheDir: string;

  beforeAll(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), "c12-giget-test-"));
    vi.stubEnv("XDG_CACHE_HOME", cacheDir);
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await rm(cacheDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    downloadTemplate.mockReset();
    downloadTemplate.mockImplementation(async () => ({
      dir: r("./fixture/_github"),
      source: "github:unjs/c12/test/fixture",
      name: "_github",
      tar: "",
    }));
  });

  it("forwards ignoreWorkspace when sourceOptions.install is true", async () => {
    await loadConfig({
      name: "test",
      cwd: r("./fixture/new_dir"),
      overrides: {
        extends: [["github:unjs/c12/test/fixture", { install: true }]],
      },
    });

    expect(downloadTemplate).toHaveBeenCalledTimes(1);
    const opts = downloadTemplate.mock.calls[0]![1];
    expect(opts.install).toEqual({ ignoreWorkspace: true });
    expect(opts.force).toBe(true);
  });

  it("passes install: false when sourceOptions.install is falsy", async () => {
    await loadConfig({
      name: "test",
      cwd: r("./fixture/new_dir"),
      overrides: {
        extends: ["github:unjs/c12/test/fixture"],
      },
    });

    expect(downloadTemplate).toHaveBeenCalledTimes(1);
    const opts = downloadTemplate.mock.calls[0]![1];
    expect(opts.install).toBe(false);
  });

  it("merges sourceOptions.install object on top of ignoreWorkspace default", async () => {
    await loadConfig({
      name: "test",
      cwd: r("./fixture/new_dir"),
      overrides: {
        extends: [["github:unjs/c12/test/fixture", { install: { silent: true } }]],
      },
    });

    expect(downloadTemplate).toHaveBeenCalledTimes(1);
    const opts = downloadTemplate.mock.calls[0]![1];
    expect(opts.install).toEqual({ ignoreWorkspace: true, silent: true });
    expect(opts.force).toBe(true);
  });

  it("does not install when sourceOptions.install is null", async () => {
    await loadConfig({
      name: "test",
      cwd: r("./fixture/new_dir"),
      overrides: {
        // reachable from YAML (`install:` with an empty value) and JSON layers
        extends: [["github:unjs/c12/test/fixture", { install: null as never }]],
      },
    });

    expect(downloadTemplate).toHaveBeenCalledTimes(1);
    const opts = downloadTemplate.mock.calls[0]![1];
    expect(opts.install).toBe(false);
    expect(opts.force).toBe(false);
  });

  it("keeps the ignoreWorkspace default when it is explicitly undefined", async () => {
    await loadConfig({
      name: "test",
      cwd: r("./fixture/new_dir"),
      overrides: {
        extends: [["github:unjs/c12/test/fixture", { install: { ignoreWorkspace: undefined } }]],
      },
    });

    expect(downloadTemplate).toHaveBeenCalledTimes(1);
    const opts = downloadTemplate.mock.calls[0]![1];
    expect(opts.install).toEqual({ ignoreWorkspace: true });
  });

  it("lets sourceOptions.install opt back in to workspace-aware install", async () => {
    await loadConfig({
      name: "test",
      cwd: r("./fixture/new_dir"),
      overrides: {
        extends: [["github:unjs/c12/test/fixture", { install: { ignoreWorkspace: false } }]],
      },
    });

    expect(downloadTemplate).toHaveBeenCalledTimes(1);
    const opts = downloadTemplate.mock.calls[0]![1];
    expect(opts.install).toEqual({ ignoreWorkspace: false });
  });
});
