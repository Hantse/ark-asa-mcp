export type RconConfig = {
  host: string;
  port: number;
  password: string;
  timeoutMs: number;
  maxResponseChars: number;
};

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 27020;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_CHARS = 20_000;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RconConfig {
  const host = readFirstEnv(env, "ARK_ASA_RCON_HOST", "ARK_RCON_HOST") ?? DEFAULT_HOST;
  const port = readIntegerEnv(env, DEFAULT_PORT, "ARK_ASA_RCON_PORT", "ARK_RCON_PORT");
  const password = readFirstEnv(env, "ARK_ASA_RCON_PASSWORD", "ARK_RCON_PASSWORD");
  const timeoutMs = readIntegerEnv(
    env,
    DEFAULT_TIMEOUT_MS,
    "ARK_ASA_RCON_TIMEOUT_MS",
    "ARK_RCON_TIMEOUT_MS",
  );
  const maxResponseChars = readIntegerEnv(
    env,
    DEFAULT_MAX_RESPONSE_CHARS,
    "ARK_ASA_RCON_MAX_RESPONSE_CHARS",
    "ARK_RCON_MAX_RESPONSE_CHARS",
  );

  if (!password) {
    throw new ConfigError(
      "Missing ARK_ASA_RCON_PASSWORD. Set it in the MCP server environment before starting ark-asa-mcp.",
    );
  }

  return {
    host,
    port,
    password,
    timeoutMs,
    maxResponseChars,
  };
}

function readFirstEnv(env: NodeJS.ProcessEnv, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = env[name]?.trim();

    if (value) {
      return value;
    }
  }

  return undefined;
}

function readIntegerEnv(env: NodeJS.ProcessEnv, fallback: number, ...names: string[]): number {
  const rawValue = readFirstEnv(env, ...names);

  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new ConfigError(`${names[0]} must be a positive integer.`);
  }

  return parsed;
}
