import { fileURLToPath } from "node:url";
import { loadConfig } from "../src";

const r = (path: string) => fileURLToPath(new URL(path, import.meta.url));

async function main() {
  const fixtureDir = r("./fixture");
  const config = await loadConfig({ cwd: fixtureDir, dotenv: true });
  console.log(config);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch(console.error);
