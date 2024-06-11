import { fileURLToPath } from "node:url";
import { expect, it, describe, beforeAll } from "vitest";
import { normalize } from "pathe";
import { updateConfigFile } from "../src/update";
import { readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

const r = (path: string) =>
  normalize(fileURLToPath(new URL(path, import.meta.url)));

describe("update config file", () => {
  const tmpDir = r("./.tmp");
  beforeAll(async () => {
    await rm(tmpDir, { recursive: true }).catch(() => {});
  });
  it("create new config", async () => {
    let onCreateFile;
    const res = await updateConfigFile({
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
});
