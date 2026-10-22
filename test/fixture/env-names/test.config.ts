export default {
  logLevel: "info",
  nested: { a: 1, b: 1, c: 1 },
  plugins: ["base"],
  $production: { logLevel: "error", nested: { b: 2 }, plugins: ["prod"] },
  $prerender: { logLevel: "silent", plugins: ["prerender"] },
  $env: {
    production: { nested: { c: 2 } },
    prerender: { nested: { a: 3 } },
  },
};
