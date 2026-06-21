import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

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
  applicationDir?: string;
  userConfigDir?: string;
  fileExists?: (path: string) => boolean;
  readFile?: (path: string) => string;
};

export type ConfigPathInfo = {
  path: string;
  explicit: boolean;
  exists: boolean;
};

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export const DEFAULT_CONFIG_FILE = "config.json";
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
  const configPath = findConfigPath(env, options);
  const readFile = options.readFile ?? ((path: string) => readFileSync(path, "utf8"));

  if (!configPath) {
    return undefined;
  }

  if (!configPath.exists) {
    if (configPath.explicit) {
      throw new ConfigError(`Config file not found: ${configPath.path}`);
    }

    return undefined;
  }

  try {
    return {
      path: configPath.path,
      content: readFile(configPath.path),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new ConfigError(`Failed to read config file ${configPath.path}: ${message}`);
  }
}

export function findConfigPath(
  env: NodeJS.ProcessEnv = process.env,
  options: LoadConfigOptions = {},
): ConfigPathInfo | undefined {
  const fileExists = options.fileExists ?? existsSync;
  const explicitPath =
    options.configPath ?? readFirstEnv(env, "ARK_ASA_CONFIG_PATH", "ARK_CONFIG_PATH");

  if (explicitPath) {
    const path = resolve(options.cwd ?? process.cwd(), explicitPath);

    return {
      path,
      explicit: true,
      exists: fileExists(path),
    };
  }

  for (const path of getImplicitConfigCandidates(env, options)) {
    if (fileExists(path)) {
      return {
        path,
        explicit: false,
        exists: true,
      };
    }
  }

  return undefined;
}

export function resolveConfigWritePath(
  env: NodeJS.ProcessEnv = process.env,
  options: LoadConfigOptions = {},
): string {
  const existingConfig = findConfigPath(env, options);

  if (existingConfig) {
    return existingConfig.path;
  }

  const explicitPath =
    options.configPath ?? readFirstEnv(env, "ARK_ASA_CONFIG_PATH", "ARK_CONFIG_PATH");

  if (explicitPath) {
    return resolve(options.cwd ?? process.cwd(), explicitPath);
  }

  const applicationDir = getApplicationDir(options);

  if (!isNodeRuntimeExecutable(process.execPath)) {
    return resolve(applicationDir, DEFAULT_CONFIG_FILE);
  }

  return resolve(options.cwd ?? process.cwd(), DEFAULT_CONFIG_FILE);
}

function getImplicitConfigCandidates(
  env: NodeJS.ProcessEnv,
  options: LoadConfigOptions,
): string[] {
  return uniquePaths([
    resolve(getApplicationDir(options), DEFAULT_CONFIG_FILE),
    resolve(options.cwd ?? process.cwd(), DEFAULT_CONFIG_FILE),
    resolve(getUserConfigDir(env, options), DEFAULT_CONFIG_FILE),
  ]);
}

function getApplicationDir(options: LoadConfigOptions): string {
  return options.applicationDir ?? dirname(process.execPath);
}

function getUserConfigDir(env: NodeJS.ProcessEnv, options: LoadConfigOptions): string {
  if (options.userConfigDir) {
    return options.userConfigDir;
  }

  const baseDir =
    env.APPDATA ??
    env.XDG_CONFIG_HOME ??
    (env.HOME ? resolve(env.HOME, ".config") : options.cwd ?? process.cwd());

  return resolve(baseDir, "ark-asa-mcp");
}

function isNodeRuntimeExecutable(path: string): boolean {
  return /^node(?:\.exe)?$/i.test(path.split(/[\\/]/).at(-1) ?? "");
}

function uniquePaths(paths: string[]): string[] {
  return Array.from(new Set(paths));
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
