export default {
  theme: "./theme",
  extends: ["c12-npm-test"],
  $test: {
    extends: ["./config.env"],
  },
  colors: {
    primary: "user_primary",
  },
  configFile: true,
  overriden: false,
  array: ["a"],
};
