import { fileURLToPath } from "node:url";
import { expect, it, describe, beforeAll } from "vitest";
import { normalize } from "pathe";
import { updateConfig } from "../src/update.ts";
import { readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const r = (path: string) => normalize(fileURLToPath(new URL(path, import.meta.url)));

describe("update config file", () => {
  const tmpDir = r("./.tmp");
  beforeAll(async () => {
    await rm(tmpDir, { recursive: true }).catch(() => {});
    await mkdir(tmpDir, { recursive: true });
  });
  it("create new config", async () => {
    let onCreateFile;
    const res = await updateConfig({
      cwd: tmpDir,
      configFile: "foo.config",
      onCreate: ({ configFile }) => {
        onCreateFile = configFile;
        return "export default { test: true }";
      },
      onUpdate: (config) => {
        config.test2 = false;
      },
    });
    expect(res.created).toBe(true);
    expect(res.configFile).toBe(r("./.tmp/foo.config.ts"));
    expect(onCreateFile).toBe(r("./.tmp/foo.config.ts"));

    expect(existsSync(r("./.tmp/foo.config.ts"))).toBe(true);
    const contents = await readFile(r("./.tmp/foo.config.ts"), "utf8");
    expect(contents).toMatchInlineSnapshot(`
      "export default {
        test: true,
        test2: false
      };"
    `);
  });
  it("update existing in .config folder", async () => {
    const tmpDotConfig = r("./.tmp/.config");
    await mkdir(tmpDotConfig, { recursive: true });
    await writeFile(r("./.tmp/.config/foobar.ts"), "export default { test: true }");
    const res = await updateConfig({
      cwd: tmpDir,
      configFile: "foobar.config",
      onCreate: () => {
        return "export default { test: true }";
      },
      onUpdate: (config) => {
        config.test2 = false;
      },
    });
    expect(res.created).toBe(false);
    expect(res.configFile).toBe(r("./.tmp/.config/foobar.ts"));

    expect(existsSync(r("./.tmp/.config/foobar.ts"))).toBe(true);
    const contents = await readFile(r("./.tmp/.config/foobar.ts"), "utf8");
    expect(contents).toMatchInlineSnapshot(`
      "export default {
        test: true,
        test2: false
      };"
    `);
  });
  it("update existing in .config folder with dotted name", async () => {
    await mkdir(r("./.tmp/.config"), { recursive: true });
    await writeFile(r("./.tmp/.config/foo.bar.ts"), "export default { test: true }");
    const res = await updateConfig({
      cwd: tmpDir,
      configFile: "foo.bar.config",
      onUpdate: (config) => {
        config.test2 = false;
      },
    });
    expect(res.created).toBe(false);
    expect(res.configFile).toBe(r("./.tmp/.config/foo.bar.ts"));
    expect(existsSync(r("./.tmp/foo.bar.config.ts"))).toBe(false);
  });
  it("update config exported as an arrow function", async () => {
    await mkdir(tmpDir, { recursive: true });
    await writeFile(r("./.tmp/arrow.config.ts"), "export default () => ({ test: true })");
    const res = await updateConfig({
      cwd: tmpDir,
      configFile: "arrow.config",
      onUpdate: (config) => {
        config.test2 = false;
      },
    });
    expect(res.created).toBe(false);
    const contents = await readFile(r("./.tmp/arrow.config.ts"), "utf8");
    expect(contents).toContain("() => ({");
    expect(contents).toContain("test2: false");
  });
  it("update config wrapped in defineConfig with an arrow function", async () => {
    await writeFile(
      r("./.tmp/define.config.ts"),
      "import { defineConfig } from 'c12'\nexport default defineConfig(() => ({ test: true }))",
    );
    await updateConfig({
      cwd: tmpDir,
      configFile: "define.config",
      onUpdate: (config) => {
        config.test2 = false;
      },
    });
    const contents = await readFile(r("./.tmp/define.config.ts"), "utf8");
    expect(contents).toContain("defineConfig(() => ({");
    expect(contents).toContain("test2: false");
  });
  it("update config returned from an arrow function with a block body", async () => {
    await writeFile(r("./.tmp/block.config.ts"), "export default () => { return { test: true } }");
    await updateConfig({
      cwd: tmpDir,
      configFile: "block.config",
      onUpdate: (config) => {
        config.test2 = false;
      },
    });
    const contents = await readFile(r("./.tmp/block.config.ts"), "utf8");
    expect(contents).toContain("return {");
    expect(contents).toContain("test2: false");
  });
  it("update config exported as a variable reference", async () => {
    await writeFile(
      r("./.tmp/variable.config.ts"),
      "const config = { test: true }\nexport default config",
    );
    await updateConfig({
      cwd: tmpDir,
      configFile: "variable.config",
      onUpdate: (config) => {
        config.test2 = false;
      },
    });
    const contents = await readFile(r("./.tmp/variable.config.ts"), "utf8");
    expect(contents).toContain("const config = {");
    expect(contents).toContain("test2: false");
  });
  it("update a config exported as a named variable", async () => {
    await writeFile(
      r("./.tmp/named-variable.config.ts"),
      "export const config = { test: true }\nexport default config",
    );
    await updateConfig({
      cwd: tmpDir,
      configFile: "named-variable.config",
      onUpdate: (config) => {
        config.test2 = false;
      },
    });
    const contents = await readFile(r("./.tmp/named-variable.config.ts"), "utf8");
    expect(contents).toContain("export const config = {");
    expect(contents).toContain("test2: false");
  });
  it("reject a config function with alternative return paths", async () => {
    await writeFile(
      r("./.tmp/branches.config.ts"),
      "export default (ctx) => {\n  if (ctx.dev) {\n    return { test: true }\n  }\n  return { test: false }\n}",
    );
    await expect(
      updateConfig({
        cwd: tmpDir,
        configFile: "branches.config",
        onUpdate: (config) => {
          config.test2 = false;
        },
      }),
    ).rejects.toThrow("not a statically analyzable object");
    const contents = await readFile(r("./.tmp/branches.config.ts"), "utf8");
    expect(contents).not.toContain("test2");
  });
  it("reject a config variable that is written after its declaration", async () => {
    await writeFile(
      r("./.tmp/overridden.config.ts"),
      "const config = {}\nconfig.test2 = true\nexport default config",
    );
    await expect(
      updateConfig({
        cwd: tmpDir,
        configFile: "overridden.config",
        onUpdate: (config) => {
          config.test2 = false;
        },
      }),
    ).rejects.toThrow("not a statically analyzable object");
    const contents = await readFile(r("./.tmp/overridden.config.ts"), "utf8");
    expect(contents).toContain("config.test2 = true");
  });
  it("reject a config that cannot be statically resolved", async () => {
    await writeFile(r("./.tmp/dynamic.config.ts"), "export default () => makeConfig()");
    await expect(
      updateConfig({
        cwd: tmpDir,
        configFile: "dynamic.config",
        onUpdate: (config) => {
          config.test2 = false;
        },
      }),
    ).rejects.toThrow("not a statically analyzable object");
    // Without an update callback nothing is edited, so the file is still accepted
    await expect(
      updateConfig({ cwd: tmpDir, configFile: "dynamic.config" }),
    ).resolves.toMatchObject({ created: false });
  });
});
