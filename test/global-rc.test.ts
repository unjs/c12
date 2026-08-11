import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolve } from "pathe";
import { loadConfig } from "../src/index.ts";

describe("global rc", () => {
  let dir: string;
  let home: string;
  let cwd: string;
  const env = {
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
  };

  const restoreEnv = () => {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };

  beforeEach(async () => {
    dir = await mkdtemp(resolve(tmpdir(), "c12-global-rc-"));
    home = resolve(dir, "home");
    cwd = resolve(dir, "project");
    await mkdir(resolve(home, ".config"), { recursive: true });
    await mkdir(cwd, { recursive: true });
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    delete process.env.XDG_CONFIG_HOME;
  });

  afterEach(async () => {
    restoreEnv();
    await rm(dir, { recursive: true, force: true });
  });

  const load = () => loadConfig({ cwd, name: "test", globalRc: true, packageJson: false });

  it("reads the legacy home rc file", async () => {
    await writeFile(resolve(home, ".testrc"), "legacy=true\nshared=home\n");
    const { config } = await load();
    expect(config).toMatchObject({ legacy: true, shared: "home" });
  });

  it("reads the rc file from ~/.config", async () => {
    await writeFile(resolve(home, ".config/.testrc"), "xdg=true\nshared=config\n");
    const { config } = await load();
    expect(config).toMatchObject({ xdg: true, shared: "config" });
  });

  it("prefers ~/.config over the legacy home rc file", async () => {
    await writeFile(resolve(home, ".testrc"), "legacy=true\nshared=home\n");
    await writeFile(resolve(home, ".config/.testrc"), "xdg=true\nshared=config\n");
    const { config } = await load();
    expect(config).toMatchObject({ legacy: true, xdg: true, shared: "config" });
  });

  it("still reads the legacy home rc file when ~/.config rc is empty", async () => {
    await writeFile(resolve(home, ".config/.testrc"), "");
    await writeFile(resolve(home, ".testrc"), "legacy=true\nshared=home\n");
    const { config } = await load();
    expect(config).toMatchObject({ legacy: true, shared: "home" });
  });

  it("prefers the project rc file over both", async () => {
    await writeFile(resolve(home, ".testrc"), "shared=home\n");
    await writeFile(resolve(home, ".config/.testrc"), "shared=config\n");
    await writeFile(resolve(cwd, ".testrc"), "shared=project\n");
    const { config } = await load();
    expect(config).toMatchObject({ shared: "project" });
  });

  it("reads a single location when XDG_CONFIG_HOME is set", async () => {
    const xdg = resolve(dir, "xdg");
    await mkdir(xdg, { recursive: true });
    process.env.XDG_CONFIG_HOME = xdg;
    await writeFile(resolve(xdg, ".testrc"), "xdg=true\nlist[]=a\n");
    await writeFile(resolve(home, ".testrc"), "legacy=true\n");
    const { config } = await load();
    expect(config).toMatchObject({ xdg: true, list: ["a"] });
    expect(config).not.toHaveProperty("legacy");
  });
});
