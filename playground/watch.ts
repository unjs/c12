import { fileURLToPath } from "node:url";
import { watchConfig } from "../src";

const r = (path: string) => fileURLToPath(new URL(path, import.meta.url));

async function main() {
  const fixtureDir = r("../test/fixture");
  const config = await watchConfig({
    cwd: fixtureDir,
    dotenv: true,
    packageJson: ["c12", "c12-alt"],
    globalRc: true,
    envName: "test",
    extend: {
      extendKey: ["theme", "extends"],
    },
    onChange: ({ config, path, type }) => {
      console.log("[watcher]", type, path);
      console.log(config.config);
    },
  });
  console.log("initial config", config.config, config.layers);
  console.log("watching config files:", config.watchingFiles);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch(console.error);
