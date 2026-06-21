import { Rcon } from "rcon-client";

import { sanitizeRconCommand, truncateResponse } from "./commands.js";
import type { RconConfig } from "./config.js";

export type RconExecutionResult = {
  command: string;
  response: string;
  truncated: boolean;
};

export class AsaRconClient {
  constructor(private readonly config: RconConfig) {}

  async execute(command: string): Promise<RconExecutionResult> {
    const sanitizedCommand = sanitizeRconCommand(command);
    const client = new Rcon({
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      timeout: this.config.timeoutMs,
    });

    try {
      await client.connect();
      const response = await client.send(sanitizedCommand);
      const normalizedResponse = typeof response === "string" ? response : String(response ?? "");
      const truncated = truncateResponse(normalizedResponse, this.config.maxResponseChars);

      return {
        command: sanitizedCommand,
        response: truncated.text,
        truncated: truncated.truncated,
      };
    } finally {
      client.end();
    }
  }
}
