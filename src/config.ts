import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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

export type LoadConfigOptions = {
  configPath?: string;
  cwd?: string;
  fileExists?: (path: string) => boolean;
  readFile?: (path: string) => string;
};

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const DEFAULT_CONFIG_FILE = "config.json";
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 27020;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_CHARS = 20_000;

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: LoadConfigOptions = {},
): AppConfig {
  const envDefaultServerName = readFirstEnv(env, "ARK_ASA_DEFAULT_SERVER", "ARK_DEFAULT_SERVER");
  const envTimeoutMs = readIntegerEnv(
    env,
    DEFAULT_TIMEOUT_MS,
    "ARK_ASA_RCON_TIMEOUT_MS",
    "ARK_RCON_TIMEOUT_MS",
  );
  const envMaxResponseChars = readIntegerEnv(
    env,
    DEFAULT_MAX_RESPONSE_CHARS,
    "ARK_ASA_RCON_MAX_RESPONSE_CHARS",
    "ARK_RCON_MAX_RESPONSE_CHARS",
  );
  const configFile = readConfigFile(env, options);

  if (configFile) {
    return loadConfigFromFile(
      configFile.content,
      configFile.path,
      envDefaultServerName,
      envTimeoutMs,
      envMaxResponseChars,
    );
  }

  return loadConfigFromEnvironment(env, envDefaultServerName, envTimeoutMs, envMaxResponseChars);
}

function readConfigFile(
  env: NodeJS.ProcessEnv,
  options: LoadConfigOptions,
): { path: string; content: string } | undefined {
  const fileExists = options.fileExists ?? existsSync;
  const readFile = options.readFile ?? ((path: string) => readFileSync(path, "utf8"));
  const configuredPath =
    options.configPath ?? readFirstEnv(env, "ARK_ASA_CONFIG_PATH", "ARK_CONFIG_PATH");
  const configPath = resolve(options.cwd ?? process.cwd(), configuredPath ?? DEFAULT_CONFIG_FILE);
  const hasExplicitPath = configuredPath !== undefined;

  if (!fileExists(configPath)) {
    if (hasExplicitPath) {
      throw new ConfigError(`Config file not found: ${configPath}`);
    }

    return undefined;
  }

  try {
    return {
      path: configPath,
      content: readFile(configPath),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new ConfigError(`Failed to read config file ${configPath}: ${message}`);
  }
}

function loadConfigFromFile(
  content: string,
  configPath: string,
  envDefaultServerName: string | undefined,
  envTimeoutMs: number,
  envMaxResponseChars: number,
): AppConfig {
  const parsed = parseJson(content, configPath);
  const root = Array.isArray(parsed) ? undefined : assertRecord(parsed, configPath);
  const serversInput = root ? root.servers : parsed;
  const defaultServerName =
    (root ? readStringField(root, "defaultServerName") ?? readStringField(root, "defaultServer") : undefined) ??
    envDefaultServerName;
  const timeoutMs = root
    ? readPositiveIntegerField(root, "timeoutMs", envTimeoutMs, `${configPath}.timeoutMs`)
    : envTimeoutMs;
  const maxResponseChars = root
    ? readPositiveIntegerField(
        root,
        "maxResponseChars",
        envMaxResponseChars,
        `${configPath}.maxResponseChars`,
      )
    : envMaxResponseChars;

  if (!Array.isArray(serversInput) || serversInput.length === 0) {
    throw new ConfigError(`${configPath}.servers must be a non-empty array.`);
  }

  const servers = parseServersArray(
    serversInput,
    `${configPath}.servers`,
    timeoutMs,
    maxResponseChars,
  );

  validateDefaultServer(defaultServerName, servers);

  return {
    servers,
    defaultServerName,
  };
}

function loadConfigFromEnvironment(
  env: NodeJS.ProcessEnv,
  envDefaultServerName: string | undefined,
  envTimeoutMs: number,
  envMaxResponseChars: number,
): AppConfig {
  const serversJson = readFirstEnv(env, "ARK_ASA_RCON_SERVERS", "ARK_RCON_SERVERS");

  if (serversJson) {
    const parsed = parseJson(serversJson, "ARK_ASA_RCON_SERVERS");

    if (!Array.isArray(parsed)) {
      throw new ConfigError("ARK_ASA_RCON_SERVERS must be a non-empty JSON array.");
    }

    const servers = parseServersArray(
      parsed,
      "ARK_ASA_RCON_SERVERS",
      envTimeoutMs,
      envMaxResponseChars,
    );

    validateDefaultServer(envDefaultServerName, servers);

    return {
      servers,
      defaultServerName: envDefaultServerName,
    };
  }

  const serverName =
    readFirstEnv(env, "ARK_ASA_RCON_SERVER_NAME", "ARK_RCON_SERVER_NAME") ??
    envDefaultServerName ??
    "default";
  const host = readFirstEnv(env, "ARK_ASA_RCON_HOST", "ARK_RCON_HOST") ?? DEFAULT_HOST;
  const port = readIntegerEnv(env, DEFAULT_PORT, "ARK_ASA_RCON_PORT", "ARK_RCON_PORT");
  const password = readFirstEnv(env, "ARK_ASA_RCON_PASSWORD", "ARK_RCON_PASSWORD");

  if (!password) {
    throw new ConfigError(
      "Missing RCON configuration. Create config.json, set ARK_ASA_CONFIG_PATH, or set ARK_ASA_RCON_PASSWORD before starting ark-asa-mcp.",
    );
  }

  return {
    servers: [
      {
        serverName,
        host,
        port,
        password,
        timeoutMs: envTimeoutMs,
        maxResponseChars: envMaxResponseChars,
      },
    ],
    defaultServerName: serverName,
  };
}

function parseJson(content: string, label: string): unknown {
  try {
    return JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new ConfigError(`${label} must be valid JSON: ${message}`);
  }
}

function parseServersArray(
  values: unknown[],
  label: string,
  defaultTimeoutMs: number,
  defaultMaxResponseChars: number,
): RconServerConfig[] {
  if (values.length === 0) {
    throw new ConfigError(`${label} must be a non-empty array.`);
  }

  const servers = values.map((server, index) =>
    normalizeServerConfig(server, index, label, defaultTimeoutMs, defaultMaxResponseChars),
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
  label: string,
  defaultTimeoutMs: number,
  defaultMaxResponseChars: number,
): RconServerConfig {
  const itemLabel = `${label}[${index}]`;

  if (!isRecord(value)) {
    throw new ConfigError(`${itemLabel} must be an object.`);
  }

  const serverName = readStringField(value, "serverName") ?? readStringField(value, "name");
  const host = readStringField(value, "host") ?? DEFAULT_HOST;
  const password = readStringField(value, "password");
  const port = readPositiveIntegerField(value, "port", DEFAULT_PORT, `${itemLabel}.port`);
  const timeoutMs = readPositiveIntegerField(
    value,
    "timeoutMs",
    defaultTimeoutMs,
    `${itemLabel}.timeoutMs`,
  );
  const maxResponseChars = readPositiveIntegerField(
    value,
    "maxResponseChars",
    defaultMaxResponseChars,
    `${itemLabel}.maxResponseChars`,
  );

  if (!serverName) {
    throw new ConfigError(`${itemLabel}.serverName is required.`);
  }

  if (!password) {
    throw new ConfigError(`${itemLabel}.password is required.`);
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
      `Default server "${defaultServerName}" does not match any configured serverName.`,
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

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new ConfigError(`${label} must be a JSON object or an array of servers.`);
  }

  return value;
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
