import { createDefineConfig } from "../../src";
import type { SourceOptions } from "../../src";

const defineConfig = createDefineConfig();

export default defineConfig({
  theme: "./theme",
  extends: [
    ["c12-npm-test"],
    ["gh:unjs/c12/test/fixture/_github#main", { giget: {} }],
  ] as [string, SourceOptions][] /* TODO: Auto type */,
  $test: {
    extends: ["./config.dev"],
    envConfig: true,
  },
  colors: {
    primary: "user_primary",
  },
  configFile: true,
  overriden: false,
  // foo: "bar",
  // x: "123",
  array: ["a"],
});
