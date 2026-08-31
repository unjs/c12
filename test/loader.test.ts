import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, describe, vi } from "vitest";
import { normalize } from "pathe";
import type { ConfigLayer, ConfigLayerMeta, UserInputConfig } from "../src/index.ts";
import { loadConfig } from "../src/index.ts";

const execFileAsync = promisify(execFile);

const r = (path: string) => normalize(fileURLToPath(new URL(path, import.meta.url)));
const transformPaths = (object: object) =>
  JSON.parse(JSON.stringify(object).replaceAll(r("."), "<path>/"));

describe("loader", () => {
  it("load fixture config", async () => {
    type UserConfig = Partial<{
      virtual: boolean;
      overridden: boolean;
      enableDefault: boolean;
      defaultConfig: boolean;
      extends: string[];
    }>;
    const { config, layers } = await loadConfig<UserConfig>({
      cwd: r("./fixture"),
      name: "test",
      dotenv: {
        cwd: r("./fixture"), // TODO: fix types
        fileName: [".env", ".env.local"],
      },
      packageJson: ["c12", "c12-alt"],
      globalRc: true,
      envName: "test",
      extend: {
        extendKey: ["theme", "extends"],
      },
      resolve: (id) => {
        if (id === "virtual") {
          return { config: { virtual: true } };
        }
      },
      overrides: {
        overridden: true,
      },
      defaults: {
        defaultConfig: true,
      },
      defaultConfig: ({ configs }) => {
        if (configs?.main?.enableDefault) {
          return Promise.resolve({
            extends: ["virtual"],
          });
        }
        return {};
      },
    });

    expect(transformPaths(config!)).toMatchInlineSnapshot(`
      {
        "$env": {
          "test": {
            "baseEnvConfig": true,
          },
        },
        "$test": {
          "envConfig": true,
          "extends": [
            "./test.config.dev",
          ],
        },
        "array": [
          "a",
          "b",
        ],
        "baseConfig": true,
        "baseEnvConfig": true,
        "colors": {
          "primary": "user_primary",
          "secondary": "theme_secondary",
          "text": "base_text",
        },
        "configFile": true,
        "defaultConfig": true,
        "devConfig": true,
        "dotenv": "true",
        "dotenvLocal": "true",
        "dotenvOverride": ".env.local",
        "enableDefault": true,
        "envConfig": true,
        "githubLayer": true,
        "not_a_folder": true,
        "npmConfig": true,
        "overridden": true,
        "packageJSON": true,
        "packageJSON2": true,
        "rcFile": true,
        "testConfig": true,
        "virtual": true,
      }
    `);

    expect(transformPaths(layers!)).toMatchInlineSnapshot(`
      [
        {
          "config": {
            "overridden": true,
          },
        },
        {
          "config": {
            "$test": {
              "envConfig": true,
              "extends": [
                "./test.config.dev",
              ],
            },
            "array": [
              "a",
            ],
            "colors": {
              "primary": "user_primary",
            },
            "configFile": true,
            "enableDefault": true,
            "envConfig": true,
            "extends": [
              "./test.config.dev",
              [
                "c12-npm-test",
              ],
              [
                "gh:unjs/c12/test/fixture/_github#main",
                {
                  "giget": {},
                },
              ],
              "./not-a-folder.ts",
            ],
            "overridden": false,
            "theme": "./theme",
          },
          "configFile": "test.config",
          "cwd": "<path>/fixture",
        },
        {
          "config": {
            "rcFile": true,
            "testConfig": true,
          },
          "configFile": ".testrc",
        },
        {
          "config": {
            "packageJSON": true,
            "packageJSON2": true,
          },
          "configFile": "package.json",
        },
        {
          "_configFile": "<path>/fixture/theme/.config/test.config.json5",
          "config": {
            "colors": {
              "primary": "theme_primary",
              "secondary": "theme_secondary",
            },
          },
          "configFile": "<path>/fixture/theme/.config/test.config.json5",
          "cwd": "<path>/fixture/theme",
          "meta": {},
          "source": "test.config",
          "sourceOptions": {},
        },
        {
          "_configFile": "<path>/fixture/.base/test.config.jsonc",
          "config": {
            "$env": {
              "test": {
                "baseEnvConfig": true,
              },
            },
            "array": [
              "b",
            ],
            "baseConfig": true,
            "baseEnvConfig": true,
            "colors": {
              "primary": "base_primary",
              "text": "base_text",
            },
          },
          "configFile": "<path>/fixture/.base/test.config.jsonc",
          "cwd": "<path>/fixture/.base",
          "meta": {
            "name": "base",
            "version": "1.0.0",
          },
          "source": "test.config",
          "sourceOptions": {},
        },
        {
          "_configFile": "<path>/fixture/test.config.dev.ts",
          "config": {
            "devConfig": true,
            "dotenv": "true",
            "dotenvLocal": "true",
            "dotenvOverride": ".env.local",
          },
          "configFile": "<path>/fixture/test.config.dev.ts",
          "cwd": "<path>/fixture",
          "meta": {},
          "source": "./test.config.dev",
          "sourceOptions": {},
        },
        {
          "_configFile": "<path>/fixture/node_modules/c12-npm-test/test.config.ts",
          "config": {
            "npmConfig": true,
          },
          "configFile": "<path>/fixture/node_modules/c12-npm-test/test.config.ts",
          "cwd": "<path>/fixture/node_modules/c12-npm-test",
          "meta": {},
          "source": "<path>/fixture/node_modules/c12-npm-test/test.config.ts",
          "sourceOptions": {},
        },
        {
          "_configFile": "<path>/fixture/node_modules/.c12/gh_unjs_c12_vsPD2sVEDo/test.config.ts",
          "config": {
            "githubLayer": true,
          },
          "configFile": "<path>/fixture/node_modules/.c12/gh_unjs_c12_vsPD2sVEDo/test.config.ts",
          "cwd": "<path>/fixture/node_modules/.c12/gh_unjs_c12_vsPD2sVEDo",
          "meta": {},
          "source": "test.config",
          "sourceOptions": {
            "giget": {},
          },
        },
        {
          "_configFile": "<path>/fixture/not-a-folder.ts",
          "config": {
            "not_a_folder": true,
          },
          "configFile": "<path>/fixture/not-a-folder.ts",
          "cwd": "<path>/fixture",
          "meta": {},
          "source": "./not-a-folder.ts",
          "sourceOptions": {},
        },
        {
          "config": {
            "virtual": true,
          },
        },
      ]
    `);
  });

  it("extend from git repo", async () => {
    const { config } = await loadConfig({
      name: "test",
      cwd: r("./fixture/new_dir"),
      overrides: {
        extends: ["github:unjs/c12/test/fixture"],
      },
    });
    const { config: nonExtendingConfig } = await loadConfig({
      name: "test",
      cwd: r("./fixture/new_dir"),
      giget: false,
      overrides: {
        extends: ["github:unjs/c12/test/fixture"],
      },
    });

    expect(transformPaths(config!)).toMatchInlineSnapshot(`
      {
        "$test": {
          "envConfig": true,
          "extends": [
            "./test.config.dev",
          ],
        },
        "array": [
          "a",
        ],
        "colors": {
          "primary": "user_primary",
        },
        "configFile": true,
        "devConfig": true,
        "dotenv": "true",
        "dotenvLocal": "true",
        "dotenvOverride": ".env.local",
        "enableDefault": true,
        "envConfig": true,
        "githubLayer": true,
        "not_a_folder": true,
        "npmConfig": true,
        "overridden": false,
        "theme": "./theme",
      }
    `);

    expect(transformPaths(nonExtendingConfig!)).toMatchInlineSnapshot(`
      {}
    `);
  });

  it("omit$Keys", async () => {
    const { config, layers } = await loadConfig({
      name: "test",
      cwd: r("./fixture"),
      envName: "test",
      omit$Keys: true,
      extend: {
        extendKey: ["theme", "extends"],
      },
    });

    const resolvedConfigKeys = Object.keys(config!);

    expect(resolvedConfigKeys).not.toContain("$env");
    expect(resolvedConfigKeys).not.toContain("$meta");
    expect(resolvedConfigKeys).not.toContain("$test");

    const transformdLayers = transformPaths(layers!) as ConfigLayer<
      UserInputConfig,
      ConfigLayerMeta
    >[];

    const configLayer = transformdLayers.find((layer) => layer.configFile === "test.config")!;
    expect(Object.keys(configLayer.config!)).toContain("$test");

    const baseLayerConfig = transformdLayers.find(
      (layer) => layer.configFile === "<path>/fixture/.base/test.config.jsonc",
    )!;
    expect(Object.keys(baseLayerConfig.config!)).toContain("$env");
  });

  it("no config loaded and configFileRequired is default setting", async () => {
    await expect(
      loadConfig({
        configFile: "CUSTOM",
      }),
    ).resolves.not.toThrowError();
  });

  it("no config loaded and configFileRequired is true", async () => {
    await expect(
      loadConfig({
        configFile: "CUSTOM",
        configFileRequired: true,
      }),
    ).rejects.toThrowError("Required config (CUSTOM) cannot be resolved.");
  });

  it("loads arrays exported from config without merging", async () => {
    const loaded = await loadConfig({
      name: "test",
      cwd: r("./fixture/array"),
    });
    expect(loaded.configFile).toBe(r("./fixture/array/test.config.ts"));
    expect(loaded._configFile).toEqual(loaded.configFile);
    expect(loaded.config).toEqual([
      { a: "boo", b: "foo" },
      { a: "boo", b: "foo" },
      { a: "boo", b: "foo" },
    ]);
    expect(loaded.layers![0]!.config).toEqual(loaded.config);
    expect(loaded.layers![1]!).toEqual({
      config: {
        rcFile: true,
      },
      configFile: ".testrc",
    });
  });

  it("try reproduce error with index.js on root importing jsx/tsx", async () => {
    await loadConfig({
      name: "test",
      cwd: r("./fixture/jsx"),
    });
  });

  it("extends from a directory whose name contains multiple dots (#278)", async () => {
    const { config, layers } = await loadConfig({
      name: "test",
      cwd: r("./fixture/multi-dot-extends"),
      extend: {
        extendKey: "extends",
      },
    });
    // The multi-dot dir should be resolved as a directory, not a file
    const multiDotLayer = layers?.find((l) => l.cwd && l.cwd.includes("my.dotted.layer"));
    expect(multiDotLayer).toBeDefined();
    expect(multiDotLayer?.config).toMatchObject({ multiDotLayer: true });
    // Base config key and extended layer key should both be present (merged)
    expect(config).toMatchObject({ baseKey: true, multiDotLayer: true });
  });

  it("falls back to jiti when native import fails", async () => {
    // Fixture uses a TS enum, which Node's strip-only mode rejects, so the
    // native dynamic import() throws and c12 must fall back to jiti.
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        [
          `import { loadConfig } from ${JSON.stringify(pathToFileURL(r("../src/index.ts")).href)};`,
          `const { config } = await loadConfig({ name: "test", cwd: ${JSON.stringify(r("./fixture/jiti"))} });`,
          `console.log(JSON.stringify(config));`,
        ].join("\n"),
      ],
      { env: { ...process.env, NODE_OPTIONS: "" } },
    );

    expect(JSON.parse(stdout.trim())).toMatchObject({
      loadedViaJiti: true,
      mode: "development",
    });
  });

  it("forwards jitiOptions to the jiti fallback", async () => {
    // The fixture imports `virtual:jiti-options`, which only resolves when
    // jitiOptions.virtualModules is forwarded to jiti — so a successful
    // load proves the option flowed through.
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        [
          `import { loadConfig } from ${JSON.stringify(pathToFileURL(r("../src/index.ts")).href)};`,
          `const { config } = await loadConfig({`,
          `  name: "test",`,
          `  cwd: ${JSON.stringify(r("./fixture/jiti-options"))},`,
          `  jitiOptions: { virtualModules: { "virtual:jiti-options": { value: "from-virtual" } } },`,
          `});`,
          `console.log(JSON.stringify(config));`,
        ].join("\n"),
      ],
      { env: { ...process.env, NODE_OPTIONS: "" } },
    );

    expect(JSON.parse(stdout.trim())).toMatchObject({ value: "from-virtual" });
  });

  it("returns fresh config objects on repeated loads for .mjs files", async () => {
    // vitest/vite strips query params from dynamic import(), so the ?t= cache
    // buster has no effect inside the test runner. We shell out to a real
    // Node.js process to test actual c12 behaviour.
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        [
          `import { loadConfig } from ${JSON.stringify(pathToFileURL(r("../src/index.ts")).href)};`,
          `const cwd = ${JSON.stringify(r("./fixture/esm-cache"))};`,
          `const first = await loadConfig({ name: "test", cwd });`,
          `first.config.nested.key = "modified";`,
          `const second = await loadConfig({ name: "test", cwd });`,
          `console.log(JSON.stringify({`,
          `  sameRef: second.config.nested === first.config.nested,`,
          `  key: second.config.nested.key,`,
          `}));`,
        ].join("\n"),
      ],
      { env: { ...process.env, NODE_OPTIONS: "" } },
    );

    const result = JSON.parse(stdout.trim());
    expect(result.sameRef).toBe(false);
    expect(result.key).toBe("original");
  });
  it("loads JSON configs without the optional jiti peer", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "c12-json-config-"));
    try {
      const loaderFile = join(tempDir, "block-jiti-loader.mjs");
      await writeFile(
        loaderFile,
        [
          "export async function resolve(specifier, context, nextResolve) {",
          '  if (specifier === "jiti") throw new Error("jiti unavailable");',
          "  return nextResolve(specifier, context);",
          "}",
        ].join("\n"),
      );

      const { stdout } = await execFileAsync(
        process.execPath,
        [
          "--experimental-loader",
          pathToFileURL(loaderFile).href,
          "--input-type=module",
          "-e",
          [
            `import { loadConfig } from ${JSON.stringify(pathToFileURL(r("../src/index.ts")).href)};`,
            `const { config } = await loadConfig({ cwd: ${JSON.stringify(r("./fixture/json"))}, name: "test" });`,
            "console.log(JSON.stringify(config));",
          ].join("\n"),
        ],
        { env: { ...process.env, NODE_OPTIONS: "" } },
      );

      expect(JSON.parse(stdout.trim())).toEqual({ jsonConfig: true });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
  it("uses custom module hooks for JSON configs", async () => {
    const importConfig = vi.fn(async () => ({ wrapped: { fromHook: true } }));
    const resolveModule = vi.fn((module: { wrapped: unknown }) => module.wrapped);

    const { config } = await loadConfig({
      cwd: r("./fixture/json"),
      name: "test",
      import: importConfig,
      resolveModule,
    });

    expect(config).toEqual({ fromHook: true });
    expect(importConfig).toHaveBeenCalledWith(r("./fixture/json/test.config.json"));
    expect(resolveModule).toHaveBeenCalledWith({ wrapped: { fromHook: true } });
  });
});
