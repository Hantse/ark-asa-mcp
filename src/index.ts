#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./config.js";
import { AsaRconClient } from "./rcon.js";
import { registerArkAsaTools } from "./tools.js";

const SERVER_NAME = "ark-asa-mcp";
const SERVER_VERSION = "0.1.0";

async function main(): Promise<void> {
  const config = loadConfig();
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  registerArkAsaTools(server, new AsaRconClient(config));

  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`[${SERVER_NAME}] ${message}`);
  process.exit(1);
});
