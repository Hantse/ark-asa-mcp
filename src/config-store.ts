import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  type AppConfig,
  ConfigError,
  type LoadConfigOptions,
  type RconServerConfig,
  findConfigPath,
  loadConfig,
  resolveConfigWritePath,
} from "./config.js";

export type ConfigServerInput = {
  serverName: string;
  host?: string;
  port?: number;
  password?: string;
  timeoutMs?: number;
  maxResponseChars?: number;
  makeDefault?: boolean;
};

export type ConfigServerSummary = {
  serverName: string;
  host: string;
  port: number;
  timeoutMs: number;
  maxResponseChars: number;
  passwordConfigured: boolean;
};

export type ConfigMutationResult = {
  configPath: string;
  config: AppConfig;
};

type EditableConfigDocument = {
  defaultServerName?: string;
  timeoutMs?: number;
  maxResponseChars?: number;
  servers: EditableServerDocument[];
};

type EditableServerDocument = {
  serverName: string;
  host?: string;
  port?: number;
  password?: string;
  timeoutMs?: number;
  maxResponseChars?: number;
};

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 27020;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_CHARS = 20_000;

export class ConfigStore {
  constructor(
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly options: LoadConfigOptions = {},
  ) {}

  load(): AppConfig {
    return loadConfig(this.env, this.options);
  }

  loadOrEmpty(): AppConfig {
    try {
      return this.load();
    } catch (error) {
      if (error instanceof ConfigError && error.message.startsWith("Missing RCON configuration.")) {
        return {
          servers: [],
        };
      }

      throw error;
    }
  }

  getConfigPathForDisplay(): string {
    return resolveConfigWritePath(this.env, this.options);
  }

  listServers(): { configPath: string; servers: ConfigServerSummary[]; defaultServerName?: string } {
    const config = this.loadOrEmpty();

    return {
      configPath: this.getConfigPathForDisplay(),
      defaultServerName: config.defaultServerName,
      servers: summarizeServers(config.servers),
    };
  }

  upsertServer(input: ConfigServerInput): ConfigMutationResult {
    const { configPath, document } = this.readEditableDocument();
    const serverName = normalizeName(input.serverName);
    const existingServer = document.servers.find((server) => server.serverName === serverName);

    if (!serverName) {
      throw new Error("serverName is required.");
    }

    if (!existingServer && !input.password?.trim()) {
      throw new Error("password is required when adding a new server.");
    }

    const nextServer: EditableServerDocument = {
      serverName,
      host: input.host?.trim() || existingServer?.host || DEFAULT_HOST,
      port: input.port ?? existingServer?.port ?? DEFAULT_PORT,
      password: input.password?.trim() || existingServer?.password,
      timeoutMs: input.timeoutMs ?? existingServer?.timeoutMs,
      maxResponseChars: input.maxResponseChars ?? existingServer?.maxResponseChars,
    };

    if (existingServer) {
      Object.assign(existingServer, stripUndefined(nextServer));
    } else {
      document.servers.push(stripUndefined(nextServer));
    }

    if (input.makeDefault || !document.defaultServerName) {
      document.defaultServerName = serverName;
    }

    return this.writeAndReload(configPath, document);
  }

  removeServer(serverName: string): ConfigMutationResult {
    const { configPath, document } = this.readEditableDocument();
    const normalizedServerName = normalizeName(serverName);
    const nextServers = document.servers.filter((server) => server.serverName !== normalizedServerName);

    if (nextServers.length === document.servers.length) {
      throw new Error(`Unknown serverName "${normalizedServerName}".`);
    }

    if (nextServers.length === 0) {
      throw new Error("Cannot remove the last configured server.");
    }

    document.servers = nextServers;

    if (document.defaultServerName === normalizedServerName) {
      document.defaultServerName = nextServers[0]?.serverName;
    }

    return this.writeAndReload(configPath, document);
  }

  setDefaultServer(serverName: string): ConfigMutationResult {
    const { configPath, document } = this.readEditableDocument();
    const normalizedServerName = normalizeName(serverName);

    if (!document.servers.some((server) => server.serverName === normalizedServerName)) {
      throw new Error(`Unknown serverName "${normalizedServerName}".`);
    }

    document.defaultServerName = normalizedServerName;

    return this.writeAndReload(configPath, document);
  }

  private readEditableDocument(): { configPath: string; document: EditableConfigDocument } {
    const configPath = resolveConfigWritePath(this.env, this.options);
    const existingConfigPath = findConfigPath(this.env, this.options);

    if (!existingConfigPath?.exists) {
      return {
        configPath,
        document: {
          timeoutMs: DEFAULT_TIMEOUT_MS,
          maxResponseChars: DEFAULT_MAX_RESPONSE_CHARS,
          servers: [],
        },
      };
    }

    const raw = JSON.parse(readFileSync(existingConfigPath.path, "utf8")) as unknown;
    const document = normalizeEditableDocument(raw);

    return {
      configPath: existingConfigPath.path,
      document,
    };
  }

  private writeAndReload(configPath: string, document: EditableConfigDocument): ConfigMutationResult {
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");

    return {
      configPath,
      config: loadConfig(this.env, {
        ...this.options,
        configPath,
      }),
    };
  }
}

export function summarizeServers(servers: RconServerConfig[]): ConfigServerSummary[] {
  return servers.map((server) => ({
    serverName: server.serverName,
    host: server.host,
    port: server.port,
    timeoutMs: server.timeoutMs,
    maxResponseChars: server.maxResponseChars,
    passwordConfigured: Boolean(server.password),
  }));
}

function normalizeEditableDocument(raw: unknown): EditableConfigDocument {
  if (Array.isArray(raw)) {
    return {
      timeoutMs: DEFAULT_TIMEOUT_MS,
      maxResponseChars: DEFAULT_MAX_RESPONSE_CHARS,
      servers: raw.map(normalizeEditableServer),
    };
  }

  if (!isRecord(raw)) {
    throw new Error("config.json must be a JSON object.");
  }

  const servers = raw.servers;

  if (!Array.isArray(servers)) {
    throw new Error("config.json servers must be an array.");
  }

  return stripUndefined({
    defaultServerName: readString(raw.defaultServerName) ?? readString(raw.defaultServer),
    timeoutMs: readPositiveInteger(raw.timeoutMs),
    maxResponseChars: readPositiveInteger(raw.maxResponseChars),
    servers: servers.map(normalizeEditableServer),
  });
}

function normalizeEditableServer(raw: unknown): EditableServerDocument {
  if (!isRecord(raw)) {
    throw new Error("Server config entries must be objects.");
  }

  const serverName = readString(raw.serverName) ?? readString(raw.name);

  if (!serverName) {
    throw new Error("Server config entries require serverName.");
  }

  return stripUndefined({
    serverName,
    host: readString(raw.host),
    port: readPositiveInteger(raw.port),
    password: readString(raw.password),
    timeoutMs: readPositiveInteger(raw.timeoutMs),
    maxResponseChars: readPositiveInteger(raw.maxResponseChars),
  });
}

function normalizeName(value: string): string {
  return value.trim();
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readPositiveInteger(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("Config numeric fields must be positive integers.");
  }

  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
