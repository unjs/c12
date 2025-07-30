import { fileURLToPath } from "node:url";
import { expect, it, describe } from "vitest";
import { normalize } from "pathe";
import type { ConfigLayer, ConfigLayerMeta, UserInputConfig } from "../src";
import { loadConfig } from "../src";
import { z } from "zod";
import {
  object,
  string,
  boolean,
  array,
  optional,
  union,
  record,
  any,
  safeParse,
} from "valibot";

const r = (path: string) =>
  normalize(fileURLToPath(new URL(path, import.meta.url)));
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

    const configLayer = transformdLayers.find(
      (layer) => layer.configFile === "test.config",
    )!;
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
        validate: (schema, input) => {
          const result = schema.safeParse(input);
          if (!result.success) {
            throw new Error(result.error.errors.join("\n"));
          }
        },
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
        extends: z.array(
          z.union([
            z.string(),
            z.array(z.any()),
            z.record(z.string(), z.any()),
          ]),
        ),
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
        validate: (schema, input) => {
          const result = schema.safeParse(input);
          if (!result.success) {
            throw new Error(result.error.errors.join("\n"));
          }
        },
      }),
    ).resolves.not.toThrow();
  });

  it("load fixture config with validate for valibot - toThrow", async () => {
    const ColorsSchema = object({
      primary: optional(string()),
      text: optional(boolean()), // error cause
      secondary: optional(string()),
    });

    const EnvSchema = object({
      test: optional(
        object({
          baseEnvConfig: boolean(),
        }),
      ),
    });

    const TestSchema = object({
      extends: array(union([string(), array(any()), record(string(), any())])),
      envConfig: boolean(),
    });

    const ConfigSchema = object({
      defaultConfig: optional(boolean()),
      virtual: optional(boolean()),
      githubLayer: optional(boolean()),
      npmConfig: optional(boolean()),
      devConfig: optional(boolean()),
      baseConfig: optional(boolean()),
      colors: optional(ColorsSchema),
      array: optional(array(string())),
      $env: optional(EnvSchema),
      baseEnvConfig: optional(boolean()),
      packageJSON2: optional(boolean()),
      packageJSON: optional(boolean()),
      testConfig: optional(boolean()),
      rcFile: optional(boolean()),
      $test: optional(TestSchema),
      configFile: optional(union([string(), boolean()])),
      overridden: optional(boolean()),
      enableDefault: optional(boolean()),
      envConfig: optional(boolean()),
      theme: optional(string()),
    });

    const LayerSchema = object({
      config: ConfigSchema,
      configFile: optional(string()),
      cwd: optional(string()),
      source: optional(string()),
      sourceOptions: optional(
        object({
          giget: optional(record(string(), any())),
        }),
      ),
      meta: optional(record(string(), any())),
    });

    const MainSchema = object({
      config: ConfigSchema,
      cwd: string(),
      configFile: string(),
      layers: array(LayerSchema),
      meta: optional(record(string(), any())),
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
        validate: (schema, input) => {
          const result = safeParse(schema, input);
          if (!result.success) {
            throw new Error(result.issues.join("\n"));
          }
        },
      }),
    ).rejects.toThrow();
  });

  describe("load fixture config with validate for zod - not.toThrow", async () => {
    const ColorsSchema = object({
      primary: optional(string()),
      text: optional(string()),
      secondary: optional(string()),
    });

    const EnvSchema = object({
      test: optional(
        object({
          baseEnvConfig: boolean(),
        }),
      ),
    });

    const TestSchema = object({
      extends: array(union([string(), array(any()), record(string(), any())])),
      envConfig: boolean(),
    });

    const ConfigSchema = object({
      defaultConfig: optional(boolean()),
      virtual: optional(boolean()),
      githubLayer: optional(boolean()),
      npmConfig: optional(boolean()),
      devConfig: optional(boolean()),
      baseConfig: optional(boolean()),
      colors: optional(ColorsSchema),
      array: optional(array(string())),
      $env: optional(EnvSchema),
      baseEnvConfig: optional(boolean()),
      packageJSON2: optional(boolean()),
      packageJSON: optional(boolean()),
      testConfig: optional(boolean()),
      rcFile: optional(boolean()),
      $test: optional(TestSchema),
      configFile: optional(union([string(), boolean()])),
      overridden: optional(boolean()),
      enableDefault: optional(boolean()),
      envConfig: optional(boolean()),
      theme: optional(string()),
    });

    const LayerSchema = object({
      config: ConfigSchema,
      configFile: optional(string()),
      cwd: optional(string()),
      source: optional(string()),
      sourceOptions: optional(
        object({
          giget: optional(record(string(), any())),
        }),
      ),
      meta: optional(record(string(), any())),
    });

    const MainSchema = object({
      config: ConfigSchema,
      cwd: string(),
      configFile: string(),
      layers: array(LayerSchema),
      meta: optional(record(string(), any())),
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
        validate: (schema, input) => {
          const result = safeParse(schema, input);
          if (!result.success) {
            throw new Error(result.issues.join("\n"));
          }
        },
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
});
