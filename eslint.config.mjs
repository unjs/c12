import unjs from "eslint-config-unjs";

// https://github.com/unjs/eslint-config
export default unjs({
  ignores: [],
  rules: {
    "unicorn/prevent-abbreviations": 0,
    "@typescript-eslint/no-non-null-assertion": 0,
  },
  markdown: {
    rules: {
      "unicorn/no-anonymous-default-export": 0,
    },
  },
});
