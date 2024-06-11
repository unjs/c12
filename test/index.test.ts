import { fileURLToPath } from "node:url";
import { expect, it, describe } from "vitest";
import { normalize } from "pathe";
import type { ConfigLayer, ConfigLayerMeta, UserInputConfig } from "../src";
import { loadConfig } from "../src";

const r = (path: string) =>
  normalize(fileURLToPath(new URL(path, import.meta.url)));
const transformPaths = (object: object) =>
  JSON.parse(JSON.stringify(object).replaceAll(r("."), "<path>/"));

describe("c12", () => {
  it("load fixture config", async () => {
    type UserConfig = Partial<{
      virtual: boolean;
      overriden: boolean;
      enableDefault: boolean;
      defaultConfig: boolean;
      extends: string[];
    }>;
    const { config, layers } = await loadConfig<UserConfig>({
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
        overriden: true,
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
        "enableDefault": true,
        "envConfig": true,
        "githubLayer": true,
        "npmConfig": true,
        "overriden": true,
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
            "overriden": true,
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
            "overriden": false,
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
          "config": {
            "devConfig": true,
          },
          "configFile": "<path>/fixture/test.config.dev.ts",
          "cwd": "<path>/fixture",
          "meta": {},
          "source": "./test.config.dev",
          "sourceOptions": {},
        },
        {
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
        "envConfig": true,
        "githubLayer": true,
        "npmConfig": true,
        "overriden": false,
        "theme": "./theme",
      }
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
});
