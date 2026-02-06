import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadConfig } from "c12-v4";

const { config } = await loadConfig({ cwd: fileURLToPath(new URL("./", import.meta.url)) });

assert.deepEqual(config, { test: true });
