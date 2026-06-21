import { describe, expect, it } from "vitest";

import { ConfigError, loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("loads multiple named RCON servers from JSON", () => {
    const config = loadConfig({
      ARK_ASA_RCON_SERVERS: JSON.stringify([
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
      ]),
      ARK_ASA_DEFAULT_SERVER: "azer",
    });

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

  it("keeps legacy single-server environment support", () => {
    const config = loadConfig({
      ARK_ASA_RCON_SERVER_NAME: "legacy",
      ARK_ASA_RCON_HOST: "10.0.0.3",
      ARK_ASA_RCON_PORT: "27022",
      ARK_ASA_RCON_PASSWORD: "secret",
    });

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
      loadConfig({
        ARK_ASA_RCON_SERVERS: JSON.stringify([
          { serverName: "azer", password: "secret-a" },
          { serverName: "azer", password: "secret-b" },
        ]),
      }),
    ).toThrow(ConfigError);
  });

  it("rejects a default server that is not configured", () => {
    expect(() =>
      loadConfig({
        ARK_ASA_DEFAULT_SERVER: "missing",
        ARK_ASA_RCON_SERVERS: JSON.stringify([{ serverName: "azer", password: "secret" }]),
      }),
    ).toThrow('ARK_ASA_DEFAULT_SERVER "missing" does not match any configured serverName');
  });
});
