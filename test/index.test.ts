import { fileURLToPath } from "node:url";
import { expect, it, describe } from "vitest";
import { loadConfig } from "../src";

const r = (path) => fileURLToPath(new URL(path, import.meta.url));
const transformPaths = (object) =>
  JSON.parse(JSON.stringify(object).replaceAll(r("."), "<path>/"));

describe("c12", () => {
  it("load fixture config", async () => {
    const { config, layers } = await loadConfig({
      cwd: r("./fixture"),
      dotenv: true,
      packageJson: ["c12", "c12-alt"],
      globalRc: true,
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

    expect(transformPaths(config)).toMatchInlineSnapshot(`
      {
        "$env": {
          "test": {
            "baseTestConfig": true,
          },
        },
        "$test": {
          "envConfig": true,
        },
        "array": [
          "a",
          "b",
        ],
        "baseConfig": true,
        "baseTestConfig": true,
        "colors": {
          "primary": "user_primary",
          "secondary": "theme_secondary",
          "text": "base_text",
        },
        "configFile": true,
        "defaultConfig": true,
        "devConfig": true,
        "npmConfig": true,
        "overriden": true,
        "packageJSON": true,
        "packageJSON2": true,
        "rcFile": true,
        "testConfig": true,
        "virtual": true,
      }
    `);

    expect(transformPaths(layers)).toMatchInlineSnapshot(`
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
            },
            "array": [
              "a",
            ],
            "colors": {
              "primary": "user_primary",
            },
            "configFile": true,
            "extends": [
              "./config.dev",
              "c12-npm-test",
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
        },
        {
          "config": {
            "$env": {
              "test": {
                "baseTestConfig": true,
              },
            },
            "array": [
              "b",
            ],
            "baseConfig": true,
            "colors": {
              "primary": "base_primary",
              "text": "base_text",
            },
          },
          "configFile": "<path>/fixture/base/config.ts",
          "cwd": "<path>/fixture/base",
        },
        {
          "config": {
            "devConfig": true,
          },
          "configFile": "<path>/fixture/config.dev.ts",
          "cwd": "<path>/fixture",
        },
        {
          "config": {
            "npmConfig": true,
          },
          "configFile": "<path>/fixture/node_modules/c12-npm-test/config.ts",
          "cwd": "<path>/fixture/node_modules/c12-npm-test",
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

    expect(transformPaths(config)).toMatchInlineSnapshot(`
      {
        "array": [
          "a",
        ],
        "colors": {
          "primary": "user_primary",
        },
        "configFile": true,
        "devConfig": true,
        "npmConfig": true,
        "overriden": false,
        "theme": "./theme",
      }
    `);
  });
});
