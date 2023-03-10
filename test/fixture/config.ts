export default {
  theme: "./theme",
  extends: ["./config.dev", "c12-npm-test"],
  $test: {
    envConfig: true,
  },
  colors: {
    primary: "user_primary",
  },
  configFile: true,
  overriden: false,
  array: ["a"],
};
