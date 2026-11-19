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
  it("update config returned by an arrow function", async () => {
    await mkdir(tmpDir, { recursive: true });
    await writeFile(r("./.tmp/arrow.config.ts"), "export default () => ({ test: true })");
    await writeFile(
      r("./.tmp/define-arrow.config.ts"),
      "export default defineConfig((ctx) => ({ test: true }))",
    );
    for (const name of ["arrow", "define-arrow"]) {
      await updateConfig({
        cwd: tmpDir,
        configFile: `${name}.config`,
        onUpdate: (config) => {
          config.test2 = false;
        },
      });
    }
    expect(await readFile(r("./.tmp/arrow.config.ts"), "utf8")).toMatchInlineSnapshot(`
      "export default () => ({
        test: true,
        test2: false
      })"
    `);
    expect(await readFile(r("./.tmp/define-arrow.config.ts"), "utf8")).toMatchInlineSnapshot(`
      "export default defineConfig((ctx) => ({
        test: true,
        test2: false
      }))"
    `);
  });
  it("throw for a default export that is not an object", async () => {
    const sources = {
      "block-arrow": "export default () => { return { test: true } }",
      identifier: "const config = { test: true }\nexport default config",
    };
    await mkdir(tmpDir, { recursive: true });
    for (const [name, source] of Object.entries(sources)) {
      await writeFile(r(`./.tmp/${name}.config.ts`), source);
      let onUpdateCalled = false;
      await expect(
        updateConfig({
          cwd: tmpDir,
          configFile: `${name}.config`,
          onUpdate: () => {
            onUpdateCalled = true;
          },
        }),
      ).rejects.toThrow("Unsupported default export");
      expect(onUpdateCalled).toBe(false);
      expect(await readFile(r(`./.tmp/${name}.config.ts`), "utf8")).toBe(source);
      // Without `onUpdate` nothing is edited, so any default export is accepted
      await expect(
        updateConfig({ cwd: tmpDir, configFile: `${name}.config` }),
      ).resolves.toMatchObject({ created: false });
    }
  });
});
