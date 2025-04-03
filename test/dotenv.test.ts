import { fileURLToPath } from "node:url";
import { beforeEach, expect, it, describe, afterAll } from "vitest";
import { join, normalize } from "pathe";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { setupDotenv } from "../src";

const tmpDir = normalize(
  fileURLToPath(new URL(".tmp-config", import.meta.url)),
);
const r = (path: string) => join(tmpDir, path);

describe("update config file", () => {
  beforeEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
    await mkdir(tmpDir, { recursive: true });
  });
  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });
  it("should read .env file into process.env", async () => {
    await setupDotenv({ cwd: tmpDir });
    expect(process.env.dotenv).toBeUndefined();

    await writeFile(r(".env"), "dotenv=123");
    await setupDotenv({ cwd: tmpDir });
    expect(process.env.dotenv).toBe("123");

    await writeFile(r(".env"), "dotenv=456");
    await setupDotenv({ cwd: tmpDir });
    expect(process.env.dotenv).toBe("456");
  });
  it("should not override OS environment values", async () => {
    process.env.override = "os";

    await writeFile(r(".env"), "override=123");
    await setupDotenv({ cwd: tmpDir });
    expect(process.env.override).toBe("os");

    await writeFile(r(".env"), "override=456");
    await setupDotenv({ cwd: tmpDir });
    expect(process.env.override).toBe("os");
  });
});
