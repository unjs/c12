import { fileURLToPath } from "node:url";
import { expect, it, describe, beforeAll } from "vitest";
import { normalize } from "pathe";
import {
  updateConfig,
  updateConfigRC,
  updateConfigUserRC,
} from "../src/update";
import { readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";

const r = (path: string) =>
  normalize(fileURLToPath(new URL(path, import.meta.url)));

describe("update config file", () => {
  const tmpDir = r("./.tmp");
  beforeAll(async () => {
    await rm(tmpDir, { recursive: true }).catch(() => {});
  });
  it("create new config", async () => {
    let onCreateFile;
    const res = await updateConfig({
      cwd: tmpDir,
      configFile: "foo.config",
      onCreate: ({ configFile }) => {
        onCreateFile = configFile;
        return "export default { test: true }";
      },
      onUpdate: (config) => {
        config.test2 = false;
      },
    });
    expect(res.created).toBe(true);
    expect(res.configFile).toBe(r("./.tmp/foo.config.ts"));
    expect(onCreateFile).toBe(r("./.tmp/foo.config.ts"));

    expect(existsSync(r("./.tmp/foo.config.ts"))).toBe(true);
    const contents = await readFile(r("./.tmp/foo.config.ts"), "utf8");
    expect(contents).toMatchInlineSnapshot(`
      "export default {
        test: true,
        test2: false
      };"
    `);
  });
  it("update existing in .config folder", async () => {
    const tmpDotConfig = r("./.tmp/.config");
    await mkdir(tmpDotConfig, { recursive: true });
    await writeFile(
      r("./.tmp/.config/foobar.ts"),
      "export default { test: true }",
    );
    const res = await updateConfig({
      cwd: tmpDir,
      configFile: "foobar.config",
      onCreate: () => {
        return "export default { test: true }";
      },
      onUpdate: (config) => {
        config.test2 = false;
      },
    });
    expect(res.created).toBe(false);
    expect(res.configFile).toBe(r("./.tmp/.config/foobar.ts"));

    expect(existsSync(r("./.tmp/.config/foobar.ts"))).toBe(true);
    const contents = await readFile(r("./.tmp/.config/foobar.ts"), "utf8");
    expect(contents).toMatchInlineSnapshot(`
      "export default {
        test: true,
        test2: false
      };"
    `);
  });
});

describe("update RC config file", () => {
  const tmpDir = r("./.tmp-rc");
  beforeAll(async () => {
    await rm(tmpDir, { recursive: true }).catch(() => {});
    await mkdir(tmpDir, { recursive: true });
  });

  it("create new RC config", async () => {
    const rcFile = ".testrc";
    const configPath = await updateConfigRC({
      name: rcFile,
      dir: tmpDir,
      onUpdate: (config) => {
        config.apiUrl = "https://api.example.com";
        config.enabled = true;
        config.port = 3000;
      },
    });

    expect(configPath).toBe(normalize(`${tmpDir}/${rcFile}`));
    expect(existsSync(configPath)).toBe(true);

    const contents = await readFile(configPath, "utf8");
    expect(contents).toContain('apiUrl="https://api.example.com"');
    expect(contents).toContain("enabled=true");
    expect(contents).toContain("port=3000");
  });

  it("update existing RC config", async () => {
    const rcFile = ".updaterc";
    const configPath = normalize(`${tmpDir}/${rcFile}`);

    // Create initial RC file
    await writeFile(configPath, "existing=true\nvalue=123\n");

    await updateConfigRC({
      name: rcFile,
      dir: tmpDir,
      onUpdate: (config) => {
        config.newValue = "added";
        config.value = 456; // Update existing value
      },
    });

    const contents = await readFile(configPath, "utf8");
    expect(contents).toContain("existing=true");
    expect(contents).toContain('newValue="added"');
    expect(contents).toContain("value=456");
  });

  it("support nested config with flattening", async () => {
    const rcFile = ".nestedrc";
    const configPath = await updateConfigRC({
      name: rcFile,
      dir: tmpDir,
      onUpdate: (config) => {
        config.database = {
          host: "localhost",
          port: 5432,
        };
        config.features = {
          auth: true,
          logging: false,
        };
      },
    });

    const contents = await readFile(configPath, "utf8");
    expect(contents).toContain('database.host="localhost"');
    expect(contents).toContain("database.port=5432");
    expect(contents).toContain("features.auth=true");
    expect(contents).toContain("features.logging=false");
  });

  it("support array values", async () => {
    const rcFile = ".arrayrc";
    const configPath = await updateConfigRC({
      name: rcFile,
      dir: tmpDir,
      onUpdate: (config) => {
        config.tags = ["tag1", "tag2", "tag3"];
      },
    });

    const contents = await readFile(configPath, "utf8");
    expect(contents).toContain('tags.0="tag1"');
    expect(contents).toContain('tags.1="tag2"');
    expect(contents).toContain('tags.2="tag3"');
  });

  it("throws error when name is missing", async () => {
    await expect(
      updateConfigRC({
        name: "",
        dir: tmpDir,
      }),
    ).rejects.toThrow("RC config file name is required");
  });
});

describe("update user RC config file", () => {
  const testRcName = ".c12-test-userrc";
  const configDir = process.env.XDG_CONFIG_HOME || homedir();
  const userConfigPath = normalize(`${configDir}/${testRcName}`);

  beforeAll(async () => {
    // Clean up any existing test file
    await rm(userConfigPath).catch(() => {});
  });

  it("create new user RC config", async () => {
    const configPath = await updateConfigUserRC({
      name: testRcName,
      onUpdate: (config) => {
        config.userToken = "secret-token";
        config.theme = "dark";
      },
    });

    expect(configPath).toBe(userConfigPath);
    expect(existsSync(configPath)).toBe(true);

    const contents = await readFile(configPath, "utf8");
    expect(contents).toContain('userToken="secret-token"');
    expect(contents).toContain('theme="dark"');

    // Cleanup
    await rm(userConfigPath).catch(() => {});
  });

  it("update existing user RC config", async () => {
    // Create initial RC file
    await writeFile(userConfigPath, "existing=true\n");

    const configPath = await updateConfigUserRC({
      name: testRcName,
      onUpdate: (config) => {
        config.newSetting = "value";
      },
    });

    const contents = await readFile(configPath, "utf8");
    expect(contents).toContain("existing=true");
    expect(contents).toContain('newSetting="value"');

    // Cleanup
    await rm(userConfigPath).catch(() => {});
  });

  it("throws error when name is missing", async () => {
    await expect(
      updateConfigUserRC({
        name: "",
      }),
    ).rejects.toThrow("RC config file name is required");
  });
});
