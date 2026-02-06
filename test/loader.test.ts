import { fileURLToPath } from "node:url";
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it, beforeEach, describe } from "vitest";
import { normalize } from "pathe";
import type { ConfigLayer, ConfigLayerMeta, UserInputConfig } from "../src/index.ts";
import { loadConfig } from "../src/index.ts";

import { z } from "zod";

const r = (path: string) => normalize(fileURLToPath(new URL(path, import.meta.url)));
const transformPaths = (object: object) =>
  JSON.parse(JSON.stringify(object).replaceAll(r("."), "<path>/"));

describe("loader", () => {
  beforeEach(() => {
    rmSync(resolve(r("./fixture"), "node_modules", ".c12"), {
      recursive: true,
      force: true,
    });
  });

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

  it("load fixture config with validate for zod - toThrow", async () => {
    const ColorsSchema = z.object({
      primary: z.string().optional(),
      text: z.number().optional(), // error cause
      secondary: z.string().optional(),
    });

    const EnvSchema = z.object({
      test: z
        .object({
          baseEnvConfig: z.boolean(),
        })
        .optional(),
    });

    const TestSchema = z.object({
      extends: z.array(z.union([z.string(), z.array(z.any())])),
      envConfig: z.boolean(),
    });

    const ConfigSchema = z.object({
      defaultConfig: z.boolean().optional(),
      virtual: z.boolean().optional(),
      githubLayer: z.boolean().optional(),
      npmConfig: z.boolean().optional(),
      devConfig: z.boolean().optional(),
      baseConfig: z.boolean().optional(),
      colors: ColorsSchema.optional(),
      array: z.array(z.string()).optional(),
      $env: EnvSchema.optional(),
      baseEnvConfig: z.boolean().optional(),
      packageJSON2: z.boolean().optional(),
      packageJSON: z.boolean().optional(),
      testConfig: z.boolean().optional(),
      rcFile: z.boolean().optional(),
      $test: TestSchema.optional(),
      configFile: z.union([z.string(), z.boolean()]).optional(),
      overridden: z.boolean().optional(),
      enableDefault: z.boolean().optional(),
      envConfig: z.boolean().optional(),
      theme: z.string().optional(),
    });

    const LayerSchema = z.object({
      config: ConfigSchema,
      configFile: z.string().optional(),
      cwd: z.string().optional(),
      source: z.string().optional(),
      sourceOptions: z
        .object({
          giget: z.record(z.string(), z.any()).optional(),
        })
        .optional(),
      meta: z
        .object({
          name: z.string().optional(),
          version: z.string().optional(),
        })
        .optional(),
    });

    const MainSchema = z.object({
      config: ConfigSchema,
      cwd: z.string(),
      configFile: z.string(),
      layers: z.array(LayerSchema),
      meta: z.object({}).optional(),
    });
    type UserConfig = Partial<{
      virtual: boolean;
      overridden: boolean;
      enableDefault: boolean;
      defaultConfig: boolean;
      extends: string[];
    }>;
    expect(
      loadConfig<UserConfig, ConfigLayerMeta, typeof MainSchema>({
        cwd: r("./fixture"),
        name: "test",
        dotenv: true,
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
        schema: MainSchema,
      }),
    ).rejects.toThrow();
  });

  it("load fixture config with validate for zod - not.toThrow", async () => {
    const ColorsSchema = z.object({
      primary: z.string().optional(),
      text: z.string().optional(),
      secondary: z.string().optional(),
    });

    const EnvSchema = z
      .object({
        test: z
          .object({
            baseEnvConfig: z.boolean(),
          })
          .optional(),
      })
      .optional();

    const TestSchema = z
      .object({
        extends: z.array(z.union([z.string(), z.array(z.any()), z.record(z.string(), z.any())])),
        envConfig: z.boolean(),
      })
      .optional();

    const ConfigSchema = z.object({
      defaultConfig: z.boolean().optional(),
      virtual: z.boolean().optional(),
      githubLayer: z.boolean().optional(),
      npmConfig: z.boolean().optional(),
      devConfig: z.boolean().optional(),
      baseConfig: z.boolean().optional(),
      colors: ColorsSchema.optional(),
      array: z.array(z.string()).optional(),
      $env: EnvSchema,
      baseEnvConfig: z.boolean().optional(),
      packageJSON2: z.boolean().optional(),
      packageJSON: z.boolean().optional(),
      testConfig: z.boolean().optional(),
      rcFile: z.boolean().optional(),
      $test: TestSchema,
      configFile: z.union([z.string(), z.boolean(), z.undefined()]).optional(),
      overridden: z.boolean().optional(),
      enableDefault: z.boolean().optional(),
      envConfig: z.boolean().optional(),
      theme: z.string().optional(),
    });

    const LayerSchema = z.object({
      config: ConfigSchema,
      configFile: z.union([z.string(), z.undefined()]).optional(),
      cwd: z.union([z.string(), z.undefined()]).optional(),
      source: z.string().optional(),
      sourceOptions: z
        .object({
          giget: z.record(z.string(), z.any()).optional(),
        })
        .optional(),
      meta: z.record(z.string(), z.any()).optional(),
    });

    const MainSchema = z.object({
      config: ConfigSchema,
      cwd: z.string(),
      configFile: z.string(),
      layers: z.array(LayerSchema),
      meta: z.record(z.string(), z.any()).optional(),
    });

    type UserConfig = Partial<{
      virtual: boolean;
      overridden: boolean;
      enableDefault: boolean;
      defaultConfig: boolean;
      extends: string[];
    }>;
    expect(
      loadConfig<UserConfig, ConfigLayerMeta, typeof MainSchema>({
        cwd: r("./fixture"),
        name: "test",
        dotenv: true,
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
        schema: MainSchema,
      }),
    ).resolves.not.toThrow();
  });
  it("no config loaded and configFileRequired is true", async () => {
    await expect(
      loadConfig({
        configFile: "CUSTOM",
        configFileRequired: true,
      }),
    ).rejects.toThrow();
  });

  describe("load fixture config with validate for zod - not.toThrow", async () => {
    const ColorsSchema = z.object({
      primary: z.string().optional(),
      text: z.string().optional(),
      secondary: z.string().optional(),
    });

    const EnvSchema = z.object({
      test: z.optional(
        z.object({
          baseEnvConfig: z.boolean(),
        }),
      ),
    });

    const TestSchema = z.object({
      extends: z.array(z.union([z.string(), z.array(z.any()), z.record(z.string(), z.any())])),
      envConfig: z.boolean(),
    });

    const ConfigSchema = z.object({
      defaultConfig: z.optional(z.boolean()),
      virtual: z.optional(z.boolean()),
      githubLayer: z.optional(z.boolean()),
      npmConfig: z.optional(z.boolean()),
      devConfig: z.optional(z.boolean()),
      baseConfig: z.optional(z.boolean()),
      colors: z.optional(ColorsSchema),
      array: z.optional(z.array(z.string())),
      $env: z.optional(EnvSchema),
      baseEnvConfig: z.optional(z.boolean()),
      packageJSON2: z.optional(z.boolean()),
      packageJSON: z.optional(z.boolean()),
      testConfig: z.optional(z.boolean()),
      rcFile: z.optional(z.boolean()),
      $test: z.optional(TestSchema),
      configFile: z.optional(z.union([z.string(), z.boolean()])),
      overridden: z.optional(z.boolean()),
      enableDefault: z.optional(z.boolean()),
      envConfig: z.optional(z.boolean()),
      theme: z.optional(z.string()),
    });

    const LayerSchema = z.object({
      config: ConfigSchema,
      configFile: z.optional(z.string()),
      cwd: z.optional(z.string()),
      source: z.optional(z.string()),
      sourceOptions: z.optional(
        z.object({
          giget: z.optional(z.record(z.string(), z.any())),
        }),
      ),
      meta: z.optional(z.record(z.string(), z.any())),
    });

    const MainSchema = z.object({
      config: ConfigSchema,
      cwd: z.string(),
      configFile: z.string(),
      layers: z.array(LayerSchema),
      meta: z.optional(z.record(z.string(), z.any())),
    });

    type UserConfig = Partial<{
      virtual: boolean;
      overridden: boolean;
      enableDefault: boolean;
      defaultConfig: boolean;
      extends: string[];
    }>;
    expect(
      loadConfig<UserConfig, ConfigLayerMeta, typeof MainSchema>({
        cwd: r("./fixture"),
        name: "test",
        dotenv: true,
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
        schema: MainSchema,
      }),
    ).resolves.not.toThrow();

    it("no config loaded and configFileRequired is default setting", async () => {
      await expect(
        loadConfig({
          configFile: "CUSTOM",
        }),
      ).resolves.not.toThrowError();
    });

    it("no config loaded and configFileRequired is true", async () => {
      expect(
        loadConfig({
          configFile: "CUSTOM",
          configFileRequired: true,
        }),
      ).rejects.toThrowError("Required config (CUSTOM) cannot be resolved.");
    });
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
});
