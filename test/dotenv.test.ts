import { fileURLToPath } from "node:url";
import { beforeEach, expect, it, describe, afterAll } from "vitest";
import { join, normalize } from "pathe";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { setupDotenv } from "../src";

const tmpDir = normalize(
  fileURLToPath(new URL(".tmp-dotenv", import.meta.url)),
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

  it("should load envs files with the correct priorities", async () => {
    await writeFile(r(".env"), "BASE=base");
    await setupDotenv({ cwd: tmpDir });
    expect(process.env.BASE).toBe("base");

    delete process.env.BASE;
    await writeFile(r(".env"), "BASE=base");
    await writeFile(r(".env.local"), "BASE=local");
    await setupDotenv({ cwd: tmpDir, mode: "dev" });
    expect(process.env.BASE).toBe("local");

    delete process.env.BASE;
    await writeFile(r(".env"), "BASE=base");
    await writeFile(r(".env.local"), "BASE=local");
    await writeFile(r(".env.local"), "FOO=bar");
    await writeFile(r(".env.dev"), "BASE=dev");
    await setupDotenv({ cwd: tmpDir, mode: "dev" });
    expect(process.env.BASE).toBe("dev");
    expect(process.env.FOO).toBe("bar");

    delete process.env.BASE;
    await writeFile(r(".env"), "BASE=base");
    await writeFile(r(".env"), "FOO=bar");
    await writeFile(r(".env.local"), "BASE=local");
    await writeFile(r(".env.dev"), "BASE=dev");
    await writeFile(r(".env.dev.local"), "BASE=dev_local");
    await setupDotenv({ cwd: tmpDir, mode: "dev" });
    expect(process.env.BASE).toBe("dev_local");
    expect(process.env.FOO).toBe("bar");
  });
});
