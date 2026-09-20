import { fileURLToPath } from "node:url";
import { beforeEach, expect, it, describe, afterAll, vi } from "vitest";
import { join, normalize } from "pathe";
import { mkdir, rm, unlink, writeFile } from "node:fs/promises";
import { loadDotenv, setupDotenv } from "../src/index.ts";

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

  it("should support _FILE env vars when enabled", async () => {
    const secretPath = r(".secret");
    await writeFile(secretPath, "my-secret-value");
    process.env.TEST_SECRET_FILE = secretPath;

    await setupDotenv({ cwd: tmpDir, expandFileReferences: true });
    expect(process.env.TEST_SECRET).toBe("my-secret-value");

    delete process.env.TEST_SECRET;
    delete process.env.TEST_SECRET_FILE;
  });

  it("should not expand _FILE env vars by default", async () => {
    const secretPath = r(".secret");
    await writeFile(secretPath, "my-secret-value");
    process.env.TEST_SECRET_FILE = secretPath;

    await setupDotenv({ cwd: tmpDir });
    expect(process.env.TEST_SECRET).toBeUndefined();

    delete process.env.TEST_SECRET;
    delete process.env.TEST_SECRET_FILE;
  });
});

const interpolateDir = normalize(
  fileURLToPath(new URL(".tmp-dotenv-interpolate", import.meta.url)),
);

describe("dotenv interpolation", () => {
  beforeEach(async () => {
    await rm(interpolateDir, { recursive: true, force: true }).catch(() => {});
    await mkdir(interpolateDir, { recursive: true });
  });
  afterAll(async () => {
    await rm(interpolateDir, { recursive: true, force: true }).catch(() => {});
  });

  const loadEnv = async (contents: string) => {
    await writeFile(join(interpolateDir, ".env"), contents);
    const env = await loadDotenv({
      cwd: interpolateDir,
      env: {},
      interpolate: true,
    });
    return { ...env };
  };

  it("resolves `${VAR}` and `$VAR`", async () => {
    expect(
      await loadEnv(
        [
          "BASE_DIR=/test",
          "BRACED=${BASE_DIR}/further",
          "PLAIN=$BASE_DIR/further",
          "MIXED=${BASE_DIR}:$BASE_DIR",
        ].join("\n"),
      ),
    ).toMatchInlineSnapshot(`
      {
        "BASE_DIR": "/test",
        "BRACED": "/test/further",
        "MIXED": "/test:/test",
        "PLAIN": "/test/further",
      }
    `);
  });

  it("keeps unresolvable references as-is", async () => {
    expect(await loadEnv(["BRACED=${UNSET}", "PLAIN=$UNSET"].join("\n"))).toMatchInlineSnapshot(`
      {
        "BRACED": "\${UNSET}",
        "PLAIN": "$UNSET",
      }
    `);
  });

  it("supports escaping with `\\$`", async () => {
    expect(
      await loadEnv(
        ["BASE_DIR=/test", String.raw`BRACED=\${BASE_DIR}`, String.raw`PLAIN=\$BASE_DIR`].join(
          "\n",
        ),
      ),
    ).toMatchInlineSnapshot(`
      {
        "BASE_DIR": "/test",
        "BRACED": "\${BASE_DIR}",
        "PLAIN": "$BASE_DIR",
      }
    `);
  });

  it("supports `${VAR:-default}` (unset or empty)", async () => {
    expect(
      await loadEnv(
        [
          "SET=value",
          "EMPTY=",
          "FROM_SET=${SET:-fallback}",
          "FROM_EMPTY=${EMPTY:-fallback}",
          "FROM_UNSET=${UNSET:-fallback}",
        ].join("\n"),
      ),
    ).toMatchInlineSnapshot(`
      {
        "EMPTY": "",
        "FROM_EMPTY": "fallback",
        "FROM_SET": "value",
        "FROM_UNSET": "fallback",
        "SET": "value",
      }
    `);
  });

  it("supports `${VAR-default}` (unset only)", async () => {
    expect(
      await loadEnv(
        [
          "SET=value",
          "EMPTY=",
          "FROM_SET=${SET-fallback}",
          "FROM_EMPTY=${EMPTY-fallback}",
          "FROM_UNSET=${UNSET-fallback}",
        ].join("\n"),
      ),
    ).toMatchInlineSnapshot(`
      {
        "EMPTY": "",
        "FROM_EMPTY": "",
        "FROM_SET": "value",
        "FROM_UNSET": "fallback",
        "SET": "value",
      }
    `);
  });

  it("supports empty default values", async () => {
    expect(await loadEnv(["EMPTY=", "A=${UNSET:-}", "B=${EMPTY:-}", "C=${UNSET-}"].join("\n")))
      .toMatchInlineSnapshot(`
      {
        "A": "",
        "B": "",
        "C": "",
        "EMPTY": "",
      }
    `);
  });

  it("supports nested default values", async () => {
    expect(
      await loadEnv(
        [
          "BASE_DIR=/test",
          "NESTED=${UNSET:-${BASE_DIR}/nested}",
          "NESTED_DEFAULT=${UNSET:-${ALSO_UNSET:-deep}}",
          "NESTED_MISSING=${UNSET:-${ALSO_UNSET}}",
        ].join("\n"),
      ),
    ).toMatchInlineSnapshot(`
      {
        "BASE_DIR": "/test",
        "NESTED": "/test/nested",
        "NESTED_DEFAULT": "deep",
        "NESTED_MISSING": "\${ALSO_UNSET}",
      }
    `);
  });

  it("supports special characters within default values", async () => {
    expect(
      await loadEnv(
        [
          "URL='${UNSET:-https://example.com/a b.c}'",
          "PRICE='${UNSET:-$5.00}'",
          "COLON='${UNSET:-a:b:c}'",
        ].join("\n"),
      ),
    ).toMatchInlineSnapshot(`
      {
        "COLON": "a:b:c",
        "PRICE": "$5.00",
        "URL": "https://example.com/a b.c",
      }
    `);
  });

  it("only supports default values within braces", async () => {
    expect(await loadEnv(["NAME=c12", "SET=$NAME-suffix", "UNSET=$UNKNOWN-suffix"].join("\n")))
      .toMatchInlineSnapshot(`
      {
        "NAME": "c12",
        "SET": "c12-suffix",
        "UNSET": "$UNKNOWN-suffix",
      }
    `);
  });

  it("supports `:` within variable names", async () => {
    expect(
      await loadEnv(
        ["COLON=${a:b:-c}", "TRAILING_COLON=${a::-b}", "IN_DEFAULT=${UNSET:-:b}"].join("\n"),
      ),
    ).toMatchInlineSnapshot(`
      {
        "COLON": "c",
        "IN_DEFAULT": ":b",
        "TRAILING_COLON": "b",
      }
    `);
  });

  it("stops an unbraced `$VAR` at a `:`", async () => {
    expect(
      await loadEnv(
        [
          "HOST=localhost",
          "PORT=5432",
          "USER=admin",
          "PASSWORD=secret",
          "ADDR=$HOST:$PORT",
          "DATABASE_URL=postgres://$USER:$PASSWORD@$HOST:$PORT/app",
          "TRAILING=$HOST:",
        ].join("\n"),
      ),
    ).toMatchInlineSnapshot(`
      {
        "ADDR": "localhost:5432",
        "DATABASE_URL": "postgres://admin:secret@localhost:5432/app",
        "HOST": "localhost",
        "PASSWORD": "secret",
        "PORT": "5432",
        "TRAILING": "localhost:",
        "USER": "admin",
      }
    `);
  });

  it("supports braces within default values", async () => {
    expect(
      await loadEnv(
        ["BARE='${UNSET:-{a}b}'", "JSON='${UNSET:-{\"j\":1}}'", "ESCAPED='${UNSET:-a\\}b}'"].join(
          "\n",
        ),
      ),
    ).toMatchInlineSnapshot(`
      {
        "BARE": "{a}b",
        "ESCAPED": "a}b",
        "JSON": "{"j":1}",
      }
    `);
  });

  it("keeps degenerate references as-is", async () => {
    expect(
      await loadEnv(
        [
          "SET=value",
          "UNTERMINATED=${SET:-",
          "EMPTY_REF=${}",
          "NO_KEY=${:-x}",
          "LONE_DOLLAR=$",
        ].join("\n"),
      ),
    ).toMatchInlineSnapshot(`
      {
        "EMPTY_REF": "\${}",
        "LONE_DOLLAR": "$",
        "NO_KEY": "\${:-x}",
        "SET": "value",
        "UNTERMINATED": "\${SET:-",
      }
    `);
  });

  it("does not mangle `$` replacement patterns within values", async () => {
    expect(await loadEnv(["AMP=$&", "REF=${AMP}", "BASE_DIR=/test", "STRAY=$BASE_DIR}"].join("\n")))
      .toMatchInlineSnapshot(`
      {
        "AMP": "$&",
        "BASE_DIR": "/test",
        "REF": "$&",
        "STRAY": "/test}",
      }
    `);
  });

  it("does not warn for self references guarded by a default", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      await loadEnv(
        [
          "PORT=${PORT-3000}",
          "LOG_LEVEL=${LOG_LEVEL:-info}",
          "NESTED=${NESTED:-${NESTED:-x}}",
        ].join("\n"),
      ),
    ).toMatchInlineSnapshot(`
      {
        "LOG_LEVEL": "info",
        "NESTED": "x",
        "PORT": "3000",
      }
    `);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("warns and resolves to an empty value for recursive variables", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await loadEnv(["A=${B}", "B=${A}"].join("\n"))).toMatchInlineSnapshot(`
      {
        "A": "",
        "B": "",
      }
    `);
    expect(warn).toHaveBeenCalledWith(
      "Please avoid recursive environment variables ( loop: B > A > B )",
    );
    warn.mockRestore();
  });

  it("warns for recursive variables reached through a default value", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await loadEnv(["A=${B:-${A}}"].join("\n"))).toMatchInlineSnapshot(`
      {
        "A": "",
      }
    `);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
