#!/usr/bin/env node

import { runCli } from "./cli.js";
import { SERVER_NAME, startMcpServer } from "./server.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    process.exitCode = await runCli(args);
    return;
  }

  await startMcpServer();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`[${SERVER_NAME}] ${message}`);
  process.exit(1);
});
