export default {
  logLevel: "info",
  nested: { a: 1, b: 1, c: 1 },
  $production: { logLevel: "error", nested: { b: 2 } },
  $prerender: { logLevel: "silent" },
  $env: {
    production: { nested: { c: 2 } },
    prerender: { nested: { a: 3 } },
  },
};
