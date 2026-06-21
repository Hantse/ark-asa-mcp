import { Rcon } from "rcon-client";

import { sanitizeRconCommand, truncateResponse } from "./commands.js";
import type { AppConfig, RconServerConfig } from "./config.js";

export type RconExecutionResult = {
  serverName: string;
  command: string;
  response: string;
  truncated: boolean;
};

export type RconServerSummary = {
  serverName: string;
  host: string;
  port: number;
};

export class AsaRconClient {
  constructor(private config: AppConfig) {}

  updateConfig(config: AppConfig): void {
    this.config = config;
  }

  listServers(): RconServerSummary[] {
    return this.config.servers.map((server) => ({
      serverName: server.serverName,
      host: server.host,
      port: server.port,
    }));
  }

  async execute(serverName: string | undefined, command: string): Promise<RconExecutionResult> {
    const server = this.resolveServer(serverName);
    const sanitizedCommand = sanitizeRconCommand(command);
    const client = new Rcon({
      host: server.host,
      port: server.port,
      password: server.password,
      timeout: server.timeoutMs,
    });

    try {
      await client.connect();
      const response = await client.send(sanitizedCommand);
      const normalizedResponse = typeof response === "string" ? response : String(response ?? "");
      const truncated = truncateResponse(normalizedResponse, server.maxResponseChars);

      return {
        serverName: server.serverName,
        command: sanitizedCommand,
        response: truncated.text,
        truncated: truncated.truncated,
      };
    } finally {
      client.end();
    }
  }

  private resolveServer(serverName: string | undefined): RconServerConfig {
    const requestedServerName = serverName?.trim();

    if (requestedServerName) {
      const server = this.config.servers.find((candidate) => candidate.serverName === requestedServerName);

      if (!server) {
        throw new Error(
          `Unknown serverName "${requestedServerName}". Available servers: ${this.availableServerNames()}.`,
        );
      }

      return server;
    }

    if (this.config.defaultServerName) {
      const defaultServer = this.config.servers.find(
        (server) => server.serverName === this.config.defaultServerName,
      );

      if (defaultServer) {
        return defaultServer;
      }
    }

    if (this.config.servers.length === 1) {
      return this.config.servers[0];
    }

    if (this.config.servers.length === 0) {
      throw new Error(
        "No ASA RCON servers are configured. Run ark-asa-mcp configure or call asa_config_upsert_server first.",
      );
    }

    throw new Error(`serverName is required. Available servers: ${this.availableServerNames()}.`);
  }

  private availableServerNames(): string {
    return this.config.servers.map((server) => server.serverName).join(", ");
  }
}
