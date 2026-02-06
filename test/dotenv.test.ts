import { fileURLToPath } from "node:url";
import { beforeEach, expect, it, describe, afterAll } from "vitest";
import { join, normalize } from "pathe";
import { mkdir, rm, unlink, writeFile } from "node:fs/promises";
import { setupDotenv } from "../src/index.ts";

const tmpDir = normalize(fileURLToPath(new URL(".tmp-dotenv", import.meta.url)));
const r = (path: string) => join(tmpDir, path);

const cwdEnvFileName = ".env.12345";
const cwdEnvPath = join(process.cwd(), cwdEnvFileName);

describe("update config file", () => {
  beforeEach(async () => {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    await mkdir(tmpDir, { recursive: true });
  });
  afterAll(async () => {
    // await rm(tmpDir, { recursive: true, force: true });
    await unlink(cwdEnvPath).catch(console.error);
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

  it("should load envs files with the correct priorities", async () => {
    await writeFile(r(".my-env"), "foo=bar");
    await setupDotenv({ cwd: tmpDir, fileName: ".my-env" });
    expect(process.env.foo).toBe("bar");

    await writeFile(r(".my-env"), "fizz=buzz");
    await writeFile(r(".my-env"), "api_key=12345678");
    await writeFile(r(".my-env.local"), "fizz=buzz_local");
    await setupDotenv({ cwd: tmpDir, fileName: [".my-env", ".my-env.local"] });
    expect(process.env.api_key).toBe("12345678");
    expect(process.env.fizz).toBe("buzz_local");
  });

  it("should default to `process.cwd()` when `options.cwd` is not provided", async () => {
    await writeFile(cwdEnvPath, "humpty=dumpty");

    await setupDotenv({ fileName: [cwdEnvFileName] });

    expect(process.env.humpty).toBe("dumpty");
  });

  it("should support _FILE env vars", async () => {
    const secretPath = r(".secret");
    await writeFile(secretPath, "my-secret-value");
    process.env.TEST_SECRET_FILE = secretPath;

    await setupDotenv({ cwd: tmpDir, expandEnvFiles: true });
    expect(process.env.TEST_SECRET).toBe("my-secret-value");
  });

  it("should not support _FILE env vars by default (turn off feature)", async () => {
    process.env.TEST_SECRET_FILE = "normal-secret-into-key-with-file-suffix";

    await setupDotenv({ cwd: tmpDir, expandEnvFiles: false });
    expect(process.env.TEST_SECRET_FILE).toBe("normal-secret-into-key-with-file-suffix");
  });

  it("should not support _FILE env vars by default (backward compatibility)", async () => {
    process.env.TEST_SECRET_FILE = "normal-secret-into-key-with-file-suffix";

    await setupDotenv({ cwd: tmpDir });
    expect(process.env.TEST_SECRET_FILE).toBe("normal-secret-into-key-with-file-suffix");
  });
});
