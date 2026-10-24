import { execFile } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { expect, it, describe, vi } from "vitest";
import { createDefu } from "defu";
import { normalize } from "pathe";
import type {
  ConfigLayer,
  ConfigLayerMeta,
  StandardSchemaV1,
  UserInputConfig,
} from "../src/index.ts";
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

  it("supports multiple env names", async () => {
    const load = (envName: string | string[]) =>
      loadConfig({ name: "test", cwd: r("./fixture/env-names"), envName, omit$Keys: true }).then(
        (r) => r.config,
      );

    expect(await load("production")).toMatchInlineSnapshot(`
      {
        "logLevel": "error",
        "nested": {
          "a": 1,
          "b": 2,
          "c": 2,
        },
        "plugins": [
          "prod",
          "base",
        ],
      }
    `);
    expect(await load(["production", "prerender"])).toMatchInlineSnapshot(`
      {
        "logLevel": "silent",
        "nested": {
          "a": 3,
          "b": 2,
          "c": 2,
        },
        "plugins": [
          "prerender",
          "prod",
          "base",
        ],
      }
    `);
    expect(await load(["prerender", "production"])).toMatchInlineSnapshot(`
      {
        "logLevel": "error",
        "nested": {
          "a": 3,
          "b": 2,
          "c": 2,
        },
        "plugins": [
          "prod",
          "prerender",
          "base",
        ],
      }
    `);
  });

  it("dedupes repeated env names (last occurrence wins)", async () => {
    const load = (envName: string | string[]) =>
      loadConfig({ name: "test", cwd: r("./fixture/env-names"), envName, omit$Keys: true }).then(
        (r) => r.config,
      );

    expect(await load(["production", "production"])).toEqual(await load("production"));
    expect(await load(["production", "prerender", "production"])).toMatchInlineSnapshot(`
      {
        "logLevel": "error",
        "nested": {
          "a": 3,
          "b": 2,
          "c": 2,
        },
        "plugins": [
          "prod",
          "prerender",
          "base",
        ],
      }
    `);
  });

  describe("env config in overrides", () => {
    const load = (options: Parameters<typeof loadConfig>[0]) =>
      loadConfig({ name: "test", cwd: r("./fixture/env-names"), omit$Keys: true, ...options });

    it("applies env config with a string envName", async () => {
      const { config } = await load({
        envName: "production",
        overrides: {
          logLevel: "warn",
          nested: { d: 1 },
          $production: { logLevel: "debug", nested: { d: 2 } },
          $development: { logLevel: "verbose" },
        },
      });
      expect(config).toMatchInlineSnapshot(`
        {
          "logLevel": "debug",
          "nested": {
            "a": 1,
            "b": 2,
            "c": 2,
            "d": 2,
          },
          "plugins": [
            "prod",
            "base",
          ],
        }
      `);
    });

    it("applies env config with an array envName", async () => {
      const overrides = {
        $production: { logLevel: "debug", extra: "production" },
        $prerender: { extra: "prerender" },
      };
      const { config } = await load({ envName: ["production", "prerender"], overrides });
      expect(config).toMatchObject({ logLevel: "debug", extra: "prerender" });
      const { config: reversed } = await load({ envName: ["prerender", "production"], overrides });
      expect(reversed).toMatchObject({ logLevel: "debug", extra: "production" });
    });

    it("applies `$env.<name>` config", async () => {
      const { config } = await load({
        envName: "staging",
        overrides: {
          logLevel: "warn",
          $staging: { logLevel: "verbose", extra: true },
          $env: { staging: { logLevel: "debug" } },
        },
      });
      expect(config).toMatchObject({ logLevel: "debug", extra: true });
    });

    it("applies env config to function overrides", async () => {
      const { config } = await load({
        envName: "production",
        overrides: () => ({ $production: { logLevel: "debug" } }),
      });
      expect(config.logLevel).toBe("debug");
    });

    it("does not apply env config when envName is false", async () => {
      const { config } = await load({
        envName: false,
        overrides: {
          logLevel: "warn",
          $test: { logLevel: "debug" },
          $production: { logLevel: "debug" },
        },
      });
      expect(config.logLevel).toBe("warn");
    });

    it("uses envMerger", async () => {
      const replaceArrays = createDefu((obj, key, value) => {
        if (Array.isArray(value)) {
          obj[key] = value;
          return true;
        }
      });
      const overrides = { modules: ["base"], $production: { modules: ["production"] } };
      const { config: defaultConfig } = await load({ envName: "production", overrides });
      expect(defaultConfig.modules).toEqual(["production", "base"]);
      const { config } = await load({
        envName: "production",
        overrides,
        envMerger: (...sources) => replaceArrays({}, ...sources),
      });
      expect(config.modules).toEqual(["production"]);
    });

    it("exposes env-applied overrides as a layer", async () => {
      const overrides = { logLevel: "warn", $production: { logLevel: "debug" } };
      const { layers } = await load({ envName: "production", overrides });
      expect(layers![0]).toEqual({
        config: { logLevel: "debug", $production: { logLevel: "debug" } },
        configFile: undefined,
        cwd: undefined,
      });
      expect(overrides.logLevel).toBe("warn");
    });

    it("applies env config to per-layer overrides", async () => {
      const { config } = await load({
        cwd: r("./fixture/env-layer-overrides"),
        envName: "production",
      });
      expect(config).toMatchObject({ logLevel: "debug", fromBase: true });
    });
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

  // https://github.com/unjs/c12/issues/205
  it("extends a non-extensible (frozen) layer", async () => {
    const { config } = await loadConfig({
      name: "test",
      cwd: r("./fixture/frozen-extends"),
    });

    expect(config).toMatchObject({
      app: true,
      frozenBase: true,
      shared: "base",
    });
  });

  it.each([false, "production"] as const)(
    "skips extended layers resolving to null or undefined (envName: %s)",
    async (envName) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        const { config, layers } = await loadConfig({
          name: "test",
          cwd: r("./fixture/null-layer"),
          envName,
        });
        expect(config).toEqual({ app: true });
        expect(transformPaths(layers!)).toMatchInlineSnapshot(`
          [
            {
              "config": {
                "app": true,
                "extends": [
                  "./null-base",
                  "./undefined-base",
                ],
              },
              "configFile": "test.config",
              "cwd": "<path>/fixture/null-layer",
            },
            {
              "config": {},
              "configFile": ".testrc",
            },
          ]
        `);
        expect(warn.mock.calls.map((c) => c[0])).toEqual([
          `Cannot extend config from \`./null-base\` in ${r("./fixture/null-layer")}`,
          `Cannot extend config from \`./undefined-base\` in ${r("./fixture/null-layer")}`,
        ]);
      } finally {
        warn.mockRestore();
      }
    },
  );

  it.each([false, "production"] as const)(
    "treats a main config resolving to null as empty (envName: %s)",
    async (envName) => {
      const { config, layers, meta } = await loadConfig({
        name: "test",
        cwd: r("./fixture/null-main"),
        envName,
      });
      expect(config).toEqual({});
      expect(transformPaths(layers!)).toMatchInlineSnapshot(`
        [
          {
            "config": {},
            "configFile": ".testrc",
          },
        ]
      `);
      expect(meta).toBeUndefined();
    },
  );

  it("configFile: false skips main config file", async () => {
    const { config, configFile } = await loadConfig({
      cwd: r("./fixture"),
      name: "test",
      configFile: false,
      packageJson: "c12",
    });

    expect(configFile).toBeUndefined();
    expect(config.configFile).toBeUndefined();
    expect(config.rcFile).toBe(true);
    expect(config.packageJSON).toBe(true);
  });

  it("configFile: false still resolves directory extends via {name}.config", async () => {
    const { config, configFile } = await loadConfig<{
      configFile?: boolean;
      loadedFromJSON?: boolean;
      extends?: string[];
    }>({
      cwd: r("./fixture"),
      name: "test",
      configFile: false,
      rcFile: false,
      overrides: { extends: ["./json"] },
    });

    expect(configFile).toBeUndefined();
    expect(config.configFile).toBeUndefined();
    expect(config.loadedFromJSON).toBe(true);
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

  it("loads frozen arrays exported from config without merging", async () => {
    const { config } = await loadConfig({
      name: "test",
      cwd: r("./fixture/frozen-array"),
    });
    expect(config).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it.each([
    { configFile: "null.config", ext: ".json", envName: false as const },
    { configFile: "null.config", ext: ".json", envName: "production" },
    { configFile: "function.config", ext: ".mjs", envName: false as const },
    { configFile: "function.config", ext: ".mjs", envName: "production" },
    { configFile: "null-export.config", ext: ".mjs", envName: false as const },
    { configFile: "null-export.config", ext: ".mjs", envName: "production" },
    { configFile: "undefined-export.config", ext: ".mjs", envName: false as const },
    { configFile: "undefined-export.config", ext: ".mjs", envName: "production" },
  ])(
    "treats $configFile ($ext) as empty config (envName: $envName)",
    async ({ configFile, ext, envName }) => {
      const { config, _configFile } = await loadConfig({
        configFile,
        envName,
        rcFile: false,
        cwd: r("./fixture/empty"),
        defaults: { fromDefaults: true },
      });
      expect(_configFile).toBe(r(`./fixture/empty/${configFile}${ext}`));
      expect(config).toEqual({ fromDefaults: true });
    },
  );

  it("loads .json configs without jiti", async () => {
    const { config, configFile } = await loadConfig({
      name: "test",
      cwd: r("./fixture/json"),
    });
    expect(configFile).toBe(r("./fixture/json/test.config.json"));
    expect(config).toMatchObject({ loadedFromJSON: true, baseKey: true });
  });

  it("envMerger", async () => {
    const baseOptions = {
      name: "test",
      cwd: r("./fixture/env-merger"),
      envName: "test",
      overrides: { plugins: ["override"] },
    };

    // Default merger (defu) concatenates env override arrays
    const { config: defaultConfig } = await loadConfig(baseOptions);
    expect(defaultConfig.plugins).toMatchInlineSnapshot(`
      [
        "override",
        "test-only",
        "base",
      ]
    `);

    // Custom envMerger replaces arrays for env overrides only;
    // `overrides` are still merged with the default merger (concatenated)
    const replaceArrays = createDefu((obj, key, value) => {
      if (Array.isArray(value)) {
        obj[key] = value;
        return true;
      }
    });
    const { config } = await loadConfig<{ plugins?: string[] }>({
      ...baseOptions,
      envMerger: (...sources) => replaceArrays({}, ...sources),
    });
    expect(config.plugins).toMatchInlineSnapshot(`
      [
        "override",
        "test-only",
      ]
    `);
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
  describe("schema", () => {
    const schema: StandardSchemaV1 = {
      "~standard": {
        version: 1,
        vendor: "custom",
        validate: async (value: any) =>
          typeof value.theme === "string"
            ? { value: { ...value, validated: true } }
            : {
                issues: [
                  { message: "Expected string", path: [{ key: "theme" }] },
                  { message: "Invalid" },
                ],
              },
      },
    };

    it("uses validated output", async () => {
      const { config } = await loadConfig({ cwd: r("./fixture"), name: "test", schema });
      expect(config.validated).toBe(true);
    });

    it("throws on validation issues", async () => {
      const promise = loadConfig({
        cwd: r("./fixture"),
        name: "test",
        overrides: { theme: 123 },
        schema,
      });
      await expect(promise).rejects.toThrowError(
        "Config validation failed (custom):\n  - theme: Expected string\n  - Invalid",
      );
      await expect(promise).rejects.toSatisfy((error: Error) => Array.isArray(error.cause));
    });

    it("supports sync validate and nested paths", async () => {
      const promise = loadConfig({
        cwd: r("./fixture"),
        name: "test",
        schema: {
          "~standard": {
            version: 1,
            vendor: "sync",
            validate: () => ({ issues: [{ message: "Bad", path: ["a", 0, { key: "b" }] }] }),
          },
        },
      });
      await expect(promise).rejects.toThrowError(
        "Config validation failed (sync):\n  - a.0.b: Bad",
      );
    });

    it("throws on invalid schema option", async () => {
      for (const schema of [true, {}, { "~standard": {} }, () => {}]) {
        await expect(
          loadConfig({ cwd: r("./fixture"), name: "test", schema: schema as any }),
        ).rejects.toThrowError("Invalid `schema` option");
      }
    });

    it("validates after omitting $ keys", async () => {
      let input: Record<string, unknown> | undefined;
      await loadConfig({
        cwd: r("./fixture"),
        name: "test",
        overrides: { $test: { a: 1 } },
        omit$Keys: true,
        schema: {
          "~standard": {
            version: 1,
            vendor: "custom",
            validate: (value: any) => ({ value: (input = value) }),
          },
        },
      });
      expect(Object.keys(input!).some((key) => key.startsWith("$"))).toBe(false);
    });
  });
});
