import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalize } from "pathe";
import { loadConfig } from "../src/index.ts";

const cwd = fileURLToPath(new URL("./fixture/relative-extends/", import.meta.url));

describe("explicit file extends", () => {
  it.each([
    ["nested relative", cwd, "./base/config.dev.ts"],
    ["same directory", `${cwd}base`, "./config.dev.ts"],
    ["absolute", cwd, `${cwd}base/config.dev.ts`],
  ])("loads %s paths and resolves their child layers", async (_name, root, source) => {
    const { config, layers } = await loadConfig<{
      explicit?: boolean;
      child?: boolean;
      extends?: string[];
    }>({
      cwd: root,
      overrides: { extends: [source] },
    });

    expect(config).toMatchObject({ explicit: true, child: true });
    const layer = layers?.find((layer) => layer.config?.explicit);
    expect(layer?.configFile).toBe(normalize(`${cwd}base/config.dev.ts`));
    expect(layer?.cwd).toBe(normalize(`${cwd}base`));
  });

  it("preserves directory extends", async () => {
    const { config } = await loadConfig({
      cwd,
      overrides: { extends: ["./base"] },
    });
    expect(config).toMatchObject({ directory: true });
  });
});
