import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { ConfigStore } from "./config-store.js";
import { AsaRconClient } from "./rcon.js";
import { registerArkAsaTools } from "./tools.js";

export const SERVER_NAME = "ark-asa-mcp";
export const SERVER_VERSION = "0.1.0";

export async function startMcpServer(): Promise<void> {
  const configStore = new ConfigStore();
  const config = configStore.loadOrEmpty();
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });
  const rcon = new AsaRconClient(config);

  registerArkAsaTools(server, rcon, configStore);

  await server.connect(new StdioServerTransport());
}
