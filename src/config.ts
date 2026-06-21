export type AppConfig = {
  servers: RconServerConfig[];
  defaultServerName?: string;
};

export type RconServerConfig = {
  serverName: string;
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

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const defaultServerName = readFirstEnv(env, "ARK_ASA_DEFAULT_SERVER", "ARK_DEFAULT_SERVER");
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
  const serversJson = readFirstEnv(env, "ARK_ASA_RCON_SERVERS", "ARK_RCON_SERVERS");

  if (serversJson) {
    const servers = parseServersJson(serversJson, timeoutMs, maxResponseChars);

    validateDefaultServer(defaultServerName, servers);

    return {
      servers,
      defaultServerName,
    };
  }

  const serverName =
    readFirstEnv(env, "ARK_ASA_RCON_SERVER_NAME", "ARK_RCON_SERVER_NAME") ??
    defaultServerName ??
    "default";
  const host = readFirstEnv(env, "ARK_ASA_RCON_HOST", "ARK_RCON_HOST") ?? DEFAULT_HOST;
  const port = readIntegerEnv(env, DEFAULT_PORT, "ARK_ASA_RCON_PORT", "ARK_RCON_PORT");
  const password = readFirstEnv(env, "ARK_ASA_RCON_PASSWORD", "ARK_RCON_PASSWORD");

  if (!password) {
    throw new ConfigError(
      "Missing RCON configuration. Set ARK_ASA_RCON_SERVERS or ARK_ASA_RCON_PASSWORD before starting ark-asa-mcp.",
    );
  }

  return {
    servers: [
      {
        serverName,
        host,
        port,
        password,
        timeoutMs,
        maxResponseChars,
      },
    ],
    defaultServerName: serverName,
  };
}

function parseServersJson(
  rawValue: string,
  defaultTimeoutMs: number,
  defaultMaxResponseChars: number,
): RconServerConfig[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawValue);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new ConfigError(`ARK_ASA_RCON_SERVERS must be valid JSON: ${message}`);
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new ConfigError("ARK_ASA_RCON_SERVERS must be a non-empty JSON array.");
  }

  const servers = parsed.map((server, index) =>
    normalizeServerConfig(server, index, defaultTimeoutMs, defaultMaxResponseChars),
  );
  const duplicateServerName = findDuplicateServerName(servers);

  if (duplicateServerName) {
    throw new ConfigError(`Duplicate RCON serverName "${duplicateServerName}".`);
  }

  return servers;
}

function normalizeServerConfig(
  value: unknown,
  index: number,
  defaultTimeoutMs: number,
  defaultMaxResponseChars: number,
): RconServerConfig {
  if (!isRecord(value)) {
    throw new ConfigError(`ARK_ASA_RCON_SERVERS[${index}] must be an object.`);
  }

  const serverName = readStringField(value, "serverName") ?? readStringField(value, "name");
  const host = readStringField(value, "host") ?? DEFAULT_HOST;
  const password = readStringField(value, "password");
  const port = readPositiveIntegerField(value, "port", DEFAULT_PORT, `ARK_ASA_RCON_SERVERS[${index}].port`);
  const timeoutMs = readPositiveIntegerField(
    value,
    "timeoutMs",
    defaultTimeoutMs,
    `ARK_ASA_RCON_SERVERS[${index}].timeoutMs`,
  );
  const maxResponseChars = readPositiveIntegerField(
    value,
    "maxResponseChars",
    defaultMaxResponseChars,
    `ARK_ASA_RCON_SERVERS[${index}].maxResponseChars`,
  );

  if (!serverName) {
    throw new ConfigError(`ARK_ASA_RCON_SERVERS[${index}].serverName is required.`);
  }

  if (!password) {
    throw new ConfigError(`ARK_ASA_RCON_SERVERS[${index}].password is required.`);
  }

  return {
    serverName,
    host,
    port,
    password,
    timeoutMs,
    maxResponseChars,
  };
}

function validateDefaultServer(
  defaultServerName: string | undefined,
  servers: RconServerConfig[],
): void {
  if (!defaultServerName) {
    return;
  }

  if (!servers.some((server) => server.serverName === defaultServerName)) {
    throw new ConfigError(
      `ARK_ASA_DEFAULT_SERVER "${defaultServerName}" does not match any configured serverName.`,
    );
  }
}

function findDuplicateServerName(servers: RconServerConfig[]): string | undefined {
  const seen = new Set<string>();

  for (const server of servers) {
    if (seen.has(server.serverName)) {
      return server.serverName;
    }

    seen.add(server.serverName);
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringField(value: Record<string, unknown>, fieldName: string): string | undefined {
  const fieldValue = value[fieldName];

  if (typeof fieldValue !== "string") {
    return undefined;
  }

  const trimmed = fieldValue.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function readPositiveIntegerField(
  value: Record<string, unknown>,
  fieldName: string,
  fallback: number,
  label: string,
): number {
  const fieldValue = value[fieldName];

  if (fieldValue === undefined || fieldValue === null || fieldValue === "") {
    return fallback;
  }

  const parsed =
    typeof fieldValue === "number" ? fieldValue : Number.parseInt(String(fieldValue), 10);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new ConfigError(`${label} must be a positive integer.`);
  }

  return parsed;
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
