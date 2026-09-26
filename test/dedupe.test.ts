import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "pathe";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/index.ts";

type Config = { items?: string[]; extends?: unknown; _extends?: unknown };

let root: string;

const downloadTemplate = vi.hoisted(() =>
  vi.fn(async (_source: string, { dir }: { dir: string }) => {
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(dir, { recursive: true });
    await writeFile(`${dir}/test.config.mjs`, 'export default { items: ["remote"] }');
    return { dir };
  }),
);
vi.mock("giget", () => ({ downloadTemplate }));

async function layer(dir: string, name: string, extendsList: unknown[] = []) {
  await mkdir(join(root, dir), { recursive: true });
  await writeFile(
    join(root, dir, "test.config.mjs"),
    `export default ${JSON.stringify({ extends: extendsList, items: [name] })}`,
  );
}

async function pkg(dir: string, name: string, extendsList: unknown[] = []) {
  await layer(dir, name, extendsList);
  await writeFile(
    join(root, dir, "package.json"),
    JSON.stringify({ name, exports: { ".": "./test.config.mjs" } }),
  );
}

async function link(target: string, path: string) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await symlink(join(root, target), join(root, path), "dir");
}

const load = (dir: string, dedupe?: boolean) =>
  loadConfig<Config>({
    cwd: join(root, dir),
    name: "test",
    extend: dedupe === undefined ? undefined : { dedupe },
  });

const layerItems = (layers: { config?: Config | null }[] = []) =>
  layers.map((l) => l.config?.items?.[0]).filter(Boolean);

beforeAll(async () => {
  root = realpathSync(await mkdtemp(join(tmpdir(), "c12-dedupe-")));

  await pkg(".pnpm/layer-c@1.0.0/node_modules/layer-c", "c");
  await link(".pnpm/layer-c@1.0.0/node_modules/layer-c", "node_modules/layer-c");

  await layer("diamond/a", "a", ["layer-c"]);
  await layer("diamond/b", "b", ["layer-c"]);
  await layer("diamond", "root", ["./a", "./b"]);

  await layer("mixed/a", "a", ["layer-c"]);
  await layer("mixed/b", "b", ["../../node_modules/layer-c/test.config.mjs"]);
  await layer("mixed/d", "d", ["../../.pnpm/layer-c@1.0.0/node_modules/layer-c"]);
  await layer("mixed", "root", [
    "./a",
    "./b",
    "../node_modules/layer-c",
    ["layer-c", { meta: { name: "ignored" } }],
    "./d",
  ]);

  await pkg("copies/b/node_modules/layer-c", "c2");
  await layer("copies/a", "a", ["layer-c"]);
  await layer("copies/b", "b", ["layer-c"]);
  await layer("copies", "root", ["./a", "./b"]);

  await layer("nuxt/layers/auth", "auth");
  await mkdir(join(root, "nuxt/layers/bare/app"), { recursive: true });
  await link("nuxt/layers/bare", "nuxt/bare-link");
  await layer("nuxt", "root");

  await layer("cycle/a", "a", ["../b"]);
  await layer("cycle/b", "b", ["../"]);

  await mkdir(join(root, "remote/a/node_modules"), { recursive: true });
  await layer("remote/a", "a", ["gh:org/remote-layer"]);
  await layer("remote/b", "b", ["gh:org/remote-layer"]);
  await layer("remote", "root", ["./a", "./b"]);
  await layer("cycle", "root", ["./a"]);
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("extends dedupe", () => {
  it("dedupes a package-name diamond", async () => {
    const { config, layers } = await load("diamond");
    expect(config.items).toEqual(["root", "a", "c", "b"]);
    expect(layerItems(layers)).toEqual(["root", "a", "c", "b"]);
  });

  it("dedupes different spellings of the same symlinked layer", async () => {
    const { config, layers } = await load("mixed");
    expect(config.items).toEqual(["root", "a", "c", "b", "d"]);
    expect(layerItems(layers)).toEqual(["root", "a", "c", "b", "d"]);
  });

  it("keeps distinct copies of a package", async () => {
    const { layers } = await load("copies");
    expect(layerItems(layers)).toEqual(["root", "a", "c", "b", "c2"]);
  });

  it("stops cyclic extends back to the root config", async () => {
    const { layers } = await load("cycle");
    expect(layerItems(layers)).toEqual(["root", "a", "b"]);
  });

  it("dedupes layers returned by a custom resolver", async () => {
    const { layers } = await loadConfig<Config>({
      cwd: join(root, "diamond"),
      name: "test",
      resolve: (id) =>
        id.startsWith("virtual")
          ? {
              config: { items: [id] },
              configFile: `${id.split(":")[0]}.config.ts`,
              cwd: join(root, "virtual"),
            }
          : null,
      overrides: { extends: ["virtual", "virtual:again", "virtual2"] },
    });
    expect(layerItems(layers)).toEqual(["root", "virtual", "virtual2", "a", "c", "b"]);
  });

  it("dedupes extends of a main config returned by a custom resolver", async () => {
    const main = {
      config: { items: ["main"], extends: ["self"] },
      configFile: "main.config.ts",
      cwd: join(root, "virtual"),
    };
    const { layers } = await loadConfig<Config>({
      cwd: join(root, "virtual"),
      name: "test",
      resolve: (id) => (id === "." || id === "self" ? structuredClone(main) : null),
    });
    expect(layerItems(layers)).toEqual(["main"]);
  });

  it("dedupes remote sources extended from different directories", async () => {
    const { layers } = await load("remote");
    expect(layerItems(layers)).toEqual(["root", "a", "remote", "b"]);
    expect(downloadTemplate).toHaveBeenCalledOnce();
  });

  it("dedupes resolver layers without a config file by cwd", async () => {
    const { layers } = await loadConfig<Config>({
      cwd: join(root, "nuxt"),
      name: "test",
      extend: { extendKey: ["_extends", "extends"] },
      resolve: (id) => {
        if (!id.startsWith("~~/")) {
          return null;
        }
        const cwd = join(root, "nuxt", id.slice(3));
        const items = [id.includes("bare") ? "bare" : "auth"];
        return { config: { items }, cwd, source: id };
      },
      overrides: {
        _extends: ["layers/auth/", "~~/layers/bare"],
        extends: ["~~/layers/auth", "~~/bare-link", "~~/layers/bare/"],
      },
    });
    expect(layerItems(layers)).toEqual(["root", "auth", "bare"]);
  });

  it("can be disabled", async () => {
    const { config } = await load("diamond", false);
    expect(config.items).toEqual(["root", "a", "c", "b", "c"]);
  });
});
