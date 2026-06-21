import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { buildBroadcastCommand, parseListPlayersResponse } from "./commands.js";
import type { AsaRconClient, RconExecutionResult } from "./rcon.js";

type ToolPayload = Record<string, unknown>;

export function registerArkAsaTools(server: McpServer, rcon: AsaRconClient): void {
  server.registerTool(
    "asa_rcon_command",
    {
      title: "Run ASA RCON Command",
      description: "Run one raw Ark: Survival Ascended RCON command.",
      inputSchema: {
        command: z.string().min(1).describe("Single-line RCON command to execute."),
      },
    },
    async ({ command }) => runTool(() => rcon.execute(command)),
  );

  server.registerTool(
    "asa_list_players",
    {
      title: "List ASA Players",
      description: "Run ListPlayers and return raw output plus parsed player entries.",
      inputSchema: {},
    },
    async () =>
      runTool(async () => {
        const result = await rcon.execute("ListPlayers");

        return {
          ...result,
          players: parseListPlayersResponse(result.response),
        };
      }),
  );

  server.registerTool(
    "asa_broadcast",
    {
      title: "Broadcast ASA Message",
      description: "Broadcast a message to connected Ark: Survival Ascended players.",
      inputSchema: {
        message: z.string().min(1).max(512).describe("Message to broadcast to the ASA server."),
      },
    },
    async ({ message }) => runTool(() => rcon.execute(buildBroadcastCommand(message))),
  );

  server.registerTool(
    "asa_save_world",
    {
      title: "Save ASA World",
      description: "Run SaveWorld on the Ark: Survival Ascended server.",
      inputSchema: {},
    },
    async () => runTool(() => rcon.execute("SaveWorld")),
  );

  server.registerTool(
    "asa_get_game_log",
    {
      title: "Get ASA Game Log",
      description: "Run GetGameLog on the Ark: Survival Ascended server.",
      inputSchema: {},
    },
    async () => runTool(() => rcon.execute("GetGameLog")),
  );
}

async function runTool(operation: () => Promise<RconExecutionResult | ToolPayload>) {
  try {
    return textResult(await operation());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ error: message }, null, 2),
        },
      ],
    };
  }
}

function textResult(payload: RconExecutionResult | ToolPayload) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}
