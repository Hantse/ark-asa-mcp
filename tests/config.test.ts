import { describe, expect, it } from "vitest";

import { ConfigError, loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("loads multiple named RCON servers from config.json", () => {
    const config = loadConfig(
      {},
      {
        cwd: "/ark",
        fileExists: (path) => path.endsWith("config.json"),
        readFile: () =>
          JSON.stringify({
            defaultServerName: "azer",
            servers: [
              {
                serverName: "azer",
                host: "10.0.0.1",
                password: "secret-a",
              },
              {
                serverName: "island",
                host: "10.0.0.2",
                port: 27021,
                password: "secret-b",
                timeoutMs: 5000,
                maxResponseChars: 1000,
              },
            ],
          }),
      },
    );

    expect(config).toEqual({
      defaultServerName: "azer",
      servers: [
        {
          serverName: "azer",
          host: "10.0.0.1",
          port: 27020,
          password: "secret-a",
          timeoutMs: 10000,
          maxResponseChars: 20000,
        },
        {
          serverName: "island",
          host: "10.0.0.2",
          port: 27021,
          password: "secret-b",
          timeoutMs: 5000,
          maxResponseChars: 1000,
        },
      ],
    });
  });

  it("supports an explicit config file path", () => {
    const config = loadConfig(
      {
        ARK_ASA_CONFIG_PATH: "D:/ark/asa-config.json",
      },
      {
        fileExists: (path) => path.endsWith("asa-config.json"),
        readFile: () =>
          JSON.stringify({
            servers: [{ serverName: "azer", password: "secret-a" }],
          }),
      },
    );

    expect(config.servers[0]?.serverName).toBe("azer");
  });

  it("allows environment defaults for config file values", () => {
    const config = loadConfig(
      {
        ARK_ASA_DEFAULT_SERVER: "island",
        ARK_ASA_RCON_TIMEOUT_MS: "15000",
        ARK_ASA_RCON_MAX_RESPONSE_CHARS: "5000",
      },
      {
        cwd: "/ark",
        fileExists: (path) => path.endsWith("config.json"),
        readFile: () =>
          JSON.stringify({
            servers: [
              { serverName: "azer", password: "secret-a" },
              { serverName: "island", password: "secret-b" },
            ],
          }),
      },
    );

    expect(config.defaultServerName).toBe("island");
    expect(config.servers[0]?.timeoutMs).toBe(15000);
    expect(config.servers[0]?.maxResponseChars).toBe(5000);
  });

  it("keeps ARK_ASA_RCON_SERVERS as an environment fallback", () => {
    const config = loadConfig(
      {
        ARK_ASA_RCON_SERVERS: JSON.stringify([{ serverName: "azer", password: "secret-a" }]),
        ARK_ASA_DEFAULT_SERVER: "azer",
      },
      {
        fileExists: () => false,
      },
    );

    expect(config.defaultServerName).toBe("azer");
    expect(config.servers[0]?.serverName).toBe("azer");
  });

  it("keeps legacy single-server environment support", () => {
    const config = loadConfig(
      {
        ARK_ASA_RCON_SERVER_NAME: "legacy",
        ARK_ASA_RCON_HOST: "10.0.0.3",
        ARK_ASA_RCON_PORT: "27022",
        ARK_ASA_RCON_PASSWORD: "secret",
      },
      {
        fileExists: () => false,
      },
    );

    expect(config.servers).toEqual([
      {
        serverName: "legacy",
        host: "10.0.0.3",
        port: 27022,
        password: "secret",
        timeoutMs: 10000,
        maxResponseChars: 20000,
      },
    ]);
    expect(config.defaultServerName).toBe("legacy");
  });

  it("rejects duplicate server names", () => {
    expect(() =>
      loadConfig(
        {},
        {
          fileExists: () => true,
          readFile: () =>
            JSON.stringify({
              servers: [
                { serverName: "azer", password: "secret-a" },
                { serverName: "azer", password: "secret-b" },
              ],
            }),
        },
      ),
    ).toThrow(ConfigError);
  });

  it("rejects a default server that is not configured", () => {
    expect(() =>
      loadConfig(
        {},
        {
          fileExists: () => true,
          readFile: () =>
            JSON.stringify({
              defaultServerName: "missing",
              servers: [{ serverName: "azer", password: "secret" }],
            }),
        },
      ),
    ).toThrow('Default server "missing" does not match any configured serverName');
  });

  it("throws when an explicit config path does not exist", () => {
    expect(() =>
      loadConfig(
        {
          ARK_ASA_CONFIG_PATH: "./missing.json",
        },
        {
          cwd: "/ark",
          fileExists: () => false,
        },
      ),
    ).toThrow("Config file not found:");
  });
});
