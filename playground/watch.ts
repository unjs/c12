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
    onWatch: (event) => {
      console.log("[watcher]", event.type, event.path);
    },
    acceptHMR({ oldConfig, newConfig, getDiff }) {
      const diff = getDiff();
      if (diff.length === 0) {
        console.log("No config changed detected!");
        return true; // No changes!
      }
    },
    onUpdate({ oldConfig, newConfig, getDiff }) {
      const diff = getDiff();
      console.log("Config updated:\n" + diff.map((i) => i.toJSON()).join("\n"));
    },
  });
  console.log("watching config files:", config.watchingFiles);
  console.log("initial config", config.config);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch(console.error);
