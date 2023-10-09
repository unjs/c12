export default {
  theme: "./theme",
  extends: [["gh:unjs/c12/test/fixture#main", { userMeta: 123 }]],
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
};
