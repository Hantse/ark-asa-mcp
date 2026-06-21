import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { ConfigStore, summarizeServers } from "./config-store.js";
import { SERVER_NAME, SERVER_VERSION } from "./server.js";

export async function runCli(args: string[]): Promise<number> {
  const [command] = args;

  switch (command) {
    case "configure":
      if (args.includes("--help") || args.includes("-h")) {
        printConfigureHelp();
        return 0;
      }

      if (args.length > 1) {
        runConfigureFromArgs(args.slice(1));
        return 0;
      }

      await runConfigureWizard();
      return 0;
    case "config:list":
      printConfigList();
      return 0;
    case "--help":
    case "-h":
    case "help":
      printHelp();
      return 0;
    case "--version":
    case "-v":
    case "version":
      console.log(`${SERVER_NAME} ${SERVER_VERSION}`);
      return 0;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      return 1;
  }
}

function runConfigureFromArgs(args: string[]): void {
  const options = parseOptions(args);
  const store = new ConfigStore();
  const result = store.upsertServer({
    serverName: readOption(options, "server-name", "serverName") ?? "",
    host: readOption(options, "host"),
    port: readIntegerOption(options, "port"),
    password: readOption(options, "password"),
    timeoutMs: readIntegerOption(options, "timeout-ms", "timeoutMs"),
    maxResponseChars: readIntegerOption(options, "max-response-chars", "maxResponseChars"),
    makeDefault: Boolean(options.default),
  });

  console.log(`Saved config to ${result.configPath}`);
  printServerSummaries(summarizeServers(result.config.servers), result.config.defaultServerName);
}

async function runConfigureWizard(): Promise<void> {
  const store = new ConfigStore();
  const rl = createInterface({ input, output });

  try {
    console.log(`${SERVER_NAME} configuration`);
    console.log(`Config file: ${store.getConfigPathForDisplay()}`);

    const serverName = await askRequired(rl, "Server name");
    const host = await askWithDefault(rl, "RCON host", "127.0.0.1");
    const port = Number.parseInt(await askWithDefault(rl, "RCON port", "27020"), 10);
    const password = await askRequired(rl, "RCON password");
    const makeDefaultAnswer = await askWithDefault(rl, "Make this the default server? (Y/n)", "Y");
    const result = store.upsertServer({
      serverName,
      host,
      port,
      password,
      makeDefault: !/^n/i.test(makeDefaultAnswer),
    });

    console.log(`Saved ${serverName} to ${result.configPath}`);
    console.log("Configured servers:");
    printServerSummaries(summarizeServers(result.config.servers), result.config.defaultServerName);
  } finally {
    rl.close();
  }
}

function printConfigList(): void {
  const store = new ConfigStore();
  const result = store.listServers();

  console.log(`Config file: ${result.configPath}`);
  printServerSummaries(result.servers, result.defaultServerName);
}

function printServerSummaries(
  servers: ReturnType<typeof summarizeServers>,
  defaultServerName: string | undefined,
): void {
  for (const server of servers) {
    const marker = server.serverName === defaultServerName ? " default" : "";

    console.log(
      `- ${server.serverName}${marker}: ${server.host}:${server.port} password=${server.passwordConfigured ? "set" : "missing"}`,
    );
  }
}

async function askRequired(
  rl: ReturnType<typeof createInterface>,
  label: string,
): Promise<string> {
  while (true) {
    const answer = (await rl.question(`${label}: `)).trim();

    if (answer) {
      return answer;
    }

    console.log(`${label} is required.`);
  }
}

async function askWithDefault(
  rl: ReturnType<typeof createInterface>,
  label: string,
  defaultValue: string,
): Promise<string> {
  const answer = (await rl.question(`${label} [${defaultValue}]: `)).trim();

  return answer || defaultValue;
}

function printHelp(): void {
  console.log(`${SERVER_NAME} ${SERVER_VERSION}`);
  console.log("");
  console.log("Usage:");
  console.log("  ark-asa-mcp              Start the MCP stdio server");
  console.log("  ark-asa-mcp configure    Create or update config.json interactively");
  console.log("  ark-asa-mcp configure --server-name azer --host 127.0.0.1 --port 27020 --password secret --default");
  console.log("  ark-asa-mcp config:list  List configured servers without passwords");
  console.log("  ark-asa-mcp --version    Print version");
}

function printConfigureHelp(): void {
  console.log("Usage:");
  console.log("  ark-asa-mcp configure");
  console.log("  ark-asa-mcp configure --server-name azer --host 127.0.0.1 --port 27020 --password secret --default");
}

function parseOptions(args: string[]): Record<string, string | boolean> {
  const options: Record<string, string | boolean> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const nextValue = args[index + 1];

    if (!nextValue || nextValue.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = nextValue;
    index += 1;
  }

  return options;
}

function readOption(
  options: Record<string, string | boolean>,
  ...names: string[]
): string | undefined {
  for (const name of names) {
    const value = options[name];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function readIntegerOption(
  options: Record<string, string | boolean>,
  ...names: string[]
): number | undefined {
  const value = readOption(options, ...names);

  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${names[0]} must be a positive integer.`);
  }

  return parsed;
}
