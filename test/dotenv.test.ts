import { fileURLToPath } from "node:url";
import { expect, it, describe } from "vitest";
import { normalize } from "pathe";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { setupDotenv } from "../src";
import { beforeEach } from "node:test"

const r = (path: string) =>
  normalize(fileURLToPath(new URL(path, import.meta.url)));

describe("update config file", () => {
  const tmpDir = r("./.tmp-config");
  beforeEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
    await mkdir(tmpDir, { recursive: true });
  });
  it("should read .env file into process.env", async () => {
    await setupDotenv({ cwd: tmpDir });
    expect(process.env.dotenv).toBeUndefined();

    await writeFile(r("./.tmp-config/.env"), "dotenv=123");
    await setupDotenv({ cwd: tmpDir });
    expect(process.env.dotenv).toBe("123");

    await writeFile(r("./.tmp-config/.env"), "dotenv=456");
    await setupDotenv({ cwd: tmpDir });
    expect(process.env.dotenv).toBe("456");
  });
  it("should not override OS environment values", async () => {
    process.env.override = "os";

    await writeFile(r("./.tmp-config/.env"), "override=123");
    await setupDotenv({ cwd: tmpDir });
    expect(process.env.override).toBe("os");

    await writeFile(r("./.tmp-config/.env"), "override=456");
    await setupDotenv({ cwd: tmpDir });
    expect(process.env.override).toBe("os");
  });
});
