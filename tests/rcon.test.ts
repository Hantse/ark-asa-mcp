import { describe, expect, it } from "vitest";

import { AsaRconClient } from "../src/rcon.js";

const multiServerConfig = {
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
      timeoutMs: 10000,
      maxResponseChars: 20000,
    },
  ],
};

describe("AsaRconClient", () => {
  it("lists servers without exposing passwords", () => {
    const client = new AsaRconClient(multiServerConfig);

    expect(client.listServers()).toEqual([
      {
        serverName: "azer",
        host: "10.0.0.1",
        port: 27020,
      },
      {
        serverName: "island",
        host: "10.0.0.2",
        port: 27021,
      },
    ]);
  });

  it("requires serverName when multiple servers are configured without a default", async () => {
    const client = new AsaRconClient(multiServerConfig);

    await expect(client.execute(undefined, "ListPlayers")).rejects.toThrow(
      "serverName is required. Available servers: azer, island.",
    );
  });

  it("rejects unknown server names before opening an RCON connection", async () => {
    const client = new AsaRconClient(multiServerConfig);

    await expect(client.execute("missing", "ListPlayers")).rejects.toThrow(
      'Unknown serverName "missing". Available servers: azer, island.',
    );
  });
});
