import { buildBroadcastCommand, sanitizeRconCommand } from "./commands.js";

export type CommandDanger = "safe" | "admin" | "destructive";
export type CommandCategory = "base" | "plugin" | "custom";
export type CommandArgumentType = "string" | "integer" | "number" | "boolean";

export type CommandArgumentDefinition = {
  type: CommandArgumentType;
  description: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
};

export type CommandCatalogEntry = {
  id: string;
  label: string;
  description: string;
  category: CommandCategory;
  danger: CommandDanger;
  rconTemplate: string;
  args?: Record<string, CommandArgumentDefinition>;
  examples?: Array<Record<string, unknown>>;
  notes?: string[];
};

export type CommandCatalogSummary = Omit<CommandCatalogEntry, "rconTemplate" | "args" | "examples"> & {
  args: string[];
};

export const BASE_COMMAND_CATALOG: CommandCatalogEntry[] = [
  {
    id: "list_players",
    label: "List players",
    description: "Lists players currently known to the ASA server through RCON.",
    category: "base",
    danger: "safe",
    rconTemplate: "ListPlayers",
    notes: ["The response is raw RCON output. The MCP server also best-effort parses player rows."],
  },
  {
    id: "get_game_log",
    label: "Get game log",
    description: "Reads available ASA game log lines through RCON.",
    category: "base",
    danger: "safe",
    rconTemplate: "GetGameLog",
  },
  {
    id: "broadcast",
    label: "Broadcast message",
    description: "Sends a visible server-wide message to connected players.",
    category: "base",
    danger: "safe",
    rconTemplate: "Broadcast {message}",
    args: {
      message: {
        type: "string",
        description: "Message to show to connected players.",
        required: true,
        minLength: 1,
        maxLength: 512,
      },
    },
    examples: [{ message: "Server restart in 5 minutes" }],
  },
  {
    id: "save_world",
    label: "Save world",
    description: "Requests an immediate world save.",
    category: "base",
    danger: "admin",
    rconTemplate: "SaveWorld",
    notes: ["Useful before restarts, updates, or maintenance."],
  },
];

export function listCommandCatalog(): CommandCatalogSummary[] {
  return BASE_COMMAND_CATALOG.map((entry) => ({
    id: entry.id,
    label: entry.label,
    description: entry.description,
    category: entry.category,
    danger: entry.danger,
    notes: entry.notes,
    args: Object.keys(entry.args ?? {}),
  }));
}

export function getCommandCatalogEntry(commandId: string): CommandCatalogEntry {
  const normalizedCommandId = commandId.trim();
  const command = BASE_COMMAND_CATALOG.find((entry) => entry.id === normalizedCommandId);

  if (!command) {
    throw new Error(
      `Unknown commandId "${normalizedCommandId}". Available commands: ${BASE_COMMAND_CATALOG.map((entry) => entry.id).join(", ")}.`,
    );
  }

  return command;
}

export function buildCatalogCommand(
  commandId: string,
  args: Record<string, unknown> = {},
): { command: CommandCatalogEntry; rconCommand: string } {
  const command = getCommandCatalogEntry(commandId);

  if (command.id === "broadcast") {
    return {
      command,
      rconCommand: buildBroadcastCommand(readRequiredStringArg(command, args, "message")),
    };
  }

  const rconCommand = command.rconTemplate.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, argName) =>
    stringifyArg(command, args, argName),
  );

  return {
    command,
    rconCommand: sanitizeRconCommand(rconCommand),
  };
}

function stringifyArg(
  command: CommandCatalogEntry,
  args: Record<string, unknown>,
  argName: string,
): string {
  const definition = command.args?.[argName];

  if (!definition) {
    throw new Error(`Command "${command.id}" has no argument named "${argName}".`);
  }

  const value = args[argName];

  if (value === undefined || value === null || value === "") {
    if (definition.required) {
      throw new Error(`Command "${command.id}" requires argument "${argName}".`);
    }

    return "";
  }

  switch (definition.type) {
    case "string":
      return validateStringArg(command, definition, argName, value);
    case "integer":
      return String(validateNumberArg(command, definition, argName, value, true));
    case "number":
      return String(validateNumberArg(command, definition, argName, value, false));
    case "boolean":
      return validateBooleanArg(command, argName, value) ? "true" : "false";
  }
}

function readRequiredStringArg(
  command: CommandCatalogEntry,
  args: Record<string, unknown>,
  argName: string,
): string {
  const definition = command.args?.[argName];

  if (!definition) {
    throw new Error(`Command "${command.id}" has no argument named "${argName}".`);
  }

  return validateStringArg(command, definition, argName, args[argName]);
}

function validateStringArg(
  command: CommandCatalogEntry,
  definition: CommandArgumentDefinition,
  argName: string,
  value: unknown,
): string {
  if (value === undefined || value === null || value === "") {
    if (definition.required) {
      throw new Error(`Command "${command.id}" requires argument "${argName}".`);
    }

    return "";
  }

  if (typeof value !== "string") {
    throw new Error(`Command "${command.id}" argument "${argName}" must be a string.`);
  }

  const normalizedValue = value.trim().replace(/\s+/g, " ");

  if (definition.required && !normalizedValue) {
    throw new Error(`Command "${command.id}" requires argument "${argName}".`);
  }

  if (definition.minLength !== undefined && normalizedValue.length < definition.minLength) {
    throw new Error(
      `Command "${command.id}" argument "${argName}" must be at least ${definition.minLength} characters.`,
    );
  }

  if (definition.maxLength !== undefined && normalizedValue.length > definition.maxLength) {
    throw new Error(
      `Command "${command.id}" argument "${argName}" must be at most ${definition.maxLength} characters.`,
    );
  }

  if (/[\r\n]/.test(value)) {
    throw new Error(`Command "${command.id}" argument "${argName}" must be a single line.`);
  }

  return normalizedValue;
}

function validateNumberArg(
  command: CommandCatalogEntry,
  definition: CommandArgumentDefinition,
  argName: string,
  value: unknown,
  integerOnly: boolean,
): number {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed) || (integerOnly && !Number.isInteger(parsed))) {
    throw new Error(
      `Command "${command.id}" argument "${argName}" must be ${integerOnly ? "an integer" : "a number"}.`,
    );
  }

  if (definition.minimum !== undefined && parsed < definition.minimum) {
    throw new Error(
      `Command "${command.id}" argument "${argName}" must be at least ${definition.minimum}.`,
    );
  }

  if (definition.maximum !== undefined && parsed > definition.maximum) {
    throw new Error(
      `Command "${command.id}" argument "${argName}" must be at most ${definition.maximum}.`,
    );
  }

  return parsed;
}

function validateBooleanArg(command: CommandCatalogEntry, argName: string, value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Command "${command.id}" argument "${argName}" must be a boolean.`);
  }

  return value;
}
