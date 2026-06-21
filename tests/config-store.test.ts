import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ConfigStore } from "../src/config-store.js";

let tempDirs: string[] = [];

describe("ConfigStore", () => {
  afterEach(() => {
    for (const tempDir of tempDirs) {
      rmSync(tempDir, { recursive: true, force: true });
    }

    tempDirs = [];
  });

  it("creates config.json and lists servers without passwords", () => {
    const tempDir = makeTempDir();
    const store = new ConfigStore({}, { cwd: tempDir });
    const result = store.upsertServer({
      serverName: "azer",
      host: "10.0.0.1",
      port: 27020,
      password: "secret",
      makeDefault: true,
    });

    expect(result.configPath).toBe(join(tempDir, "config.json"));
    expect(result.config.defaultServerName).toBe("azer");

    const listed = store.listServers();

    expect(listed.servers).toEqual([
      {
        serverName: "azer",
        host: "10.0.0.1",
        port: 27020,
        timeoutMs: 10000,
        maxResponseChars: 20000,
        passwordConfigured: true,
      },
    ]);
    expect(JSON.stringify(listed)).not.toContain("secret");
  });

  it("lists no servers before the first config is created", () => {
    const tempDir = makeTempDir();
    const store = new ConfigStore({}, { cwd: tempDir });

    expect(store.listServers()).toEqual({
      configPath: join(tempDir, "config.json"),
      defaultServerName: undefined,
      servers: [],
    });
  });

  it("preserves an existing password when updating a server", () => {
    const tempDir = makeTempDir();
    const store = new ConfigStore({}, { cwd: tempDir });

    store.upsertServer({
      serverName: "azer",
      host: "10.0.0.1",
      password: "secret",
    });
    store.upsertServer({
      serverName: "azer",
      host: "10.0.0.2",
    });

    const rawConfig = readFileSync(join(tempDir, "config.json"), "utf8");

    expect(rawConfig).toContain('"host": "10.0.0.2"');
    expect(rawConfig).toContain('"password": "secret"');
  });

  it("sets defaults and removes servers", () => {
    const tempDir = makeTempDir();
    const store = new ConfigStore({}, { cwd: tempDir });

    store.upsertServer({ serverName: "azer", password: "secret-a" });
    store.upsertServer({ serverName: "island", password: "secret-b" });

    expect(store.setDefaultServer("island").config.defaultServerName).toBe("island");

    const result = store.removeServer("island");

    expect(result.config.defaultServerName).toBe("azer");
    expect(result.config.servers).toHaveLength(1);
  });
});

function makeTempDir(): string {
  const tempDir = mkdtempSync(join(tmpdir(), "ark-asa-mcp-"));

  tempDirs.push(tempDir);

  return tempDir;
}
