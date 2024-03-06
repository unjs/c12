export default {
  theme: "./theme",
  extends: [
    ["c12-npm-test"],
    ["gh:unjs/c12/test/fixture/_github#main", { giget: {} }],
  ],
  $test: {
    extends: ["./test.config.dev"],
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
  array2: ["a"],
};
