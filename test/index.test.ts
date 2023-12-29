import { fileURLToPath } from "node:url";
import { expect, it, describe } from "vitest";
import { resolve } from "pathe";
import { loadConfig } from "../src";

const r = (path: string) =>
  resolve(fileURLToPath(new URL(path, import.meta.url)));
const transformPaths = (object: object) =>
  JSON.parse(JSON.stringify(object).replaceAll(r("."), "<path>"));

describe("c12", () => {
  it("load fixture config", async () => {
    type UserConfig = Partial<{
      virtual: boolean;
      overriden: boolean;
      defaultConfig: boolean;
      extends: string[];
    }>;
    const { config, layers } = await loadConfig<UserConfig>({
      cwd: r("./fixture"),
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
      defaultConfig: {
        extends: ["virtual"],
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
            "./config.dev",
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
                "./config.dev",
              ],
            },
            "array": [
              "a",
            ],
            "colors": {
              "primary": "user_primary",
            },
            "configFile": true,
            "envConfig": true,
            "extends": [
              "./config.dev",
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
          "configFile": "config",
          "cwd": "<path>/fixture",
        },
        {
          "config": {
            "rcFile": true,
            "testConfig": true,
          },
          "configFile": ".configrc",
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
          "configFile": "<path>/fixture/theme/config.ts",
          "cwd": "<path>/fixture/theme",
          "meta": {},
          "source": "config",
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
          "configFile": "<path>/fixture/.base/config.ts",
          "cwd": "<path>/fixture/.base",
          "meta": {
            "name": "base",
            "version": "1.0.0",
          },
          "source": "config",
          "sourceOptions": {},
        },
        {
          "config": {
            "devConfig": true,
          },
          "configFile": "<path>/fixture/config.dev.ts",
          "cwd": "<path>/fixture",
          "meta": {},
          "source": "./config.dev",
          "sourceOptions": {},
        },
        {
          "config": {
            "npmConfig": true,
          },
          "configFile": "<path>/fixture/node_modules/c12-npm-test/config.ts",
          "cwd": "<path>/fixture/node_modules/c12-npm-test",
          "meta": {},
          "source": "<path>/fixture/node_modules/c12-npm-test/config.ts",
          "sourceOptions": {},
        },
        {
          "config": {
            "githubLayer": true,
          },
          "configFile": "<path>/fixture/node_modules/.c12/gh_unjs_c12_vsPD2sVEDo/config.ts",
          "cwd": "<path>/fixture/node_modules/.c12/gh_unjs_c12_vsPD2sVEDo",
          "meta": {},
          "source": "config",
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
            "./config.dev",
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
});
