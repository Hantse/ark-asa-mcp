export type ParsedPlayer = {
  index: number;
  name: string;
  id?: string;
  raw: string;
};

export function sanitizeRconCommand(command: string): string {
  const sanitized = command.trim();

  if (!sanitized) {
    throw new Error("RCON command must not be empty.");
  }

  if (/[\r\n]/.test(sanitized)) {
    throw new Error("RCON command must be a single line.");
  }

  return sanitized;
}

export function buildBroadcastCommand(message: string): string {
  const sanitizedMessage = sanitizeRconMessage(message);

  return `Broadcast ${sanitizedMessage}`;
}

export function sanitizeRconMessage(message: string): string {
  const sanitized = message.trim().replace(/\s+/g, " ");

  if (!sanitized) {
    throw new Error("Message must not be empty.");
  }

  if (/[\r\n]/.test(message)) {
    throw new Error("Message must be a single line.");
  }

  return sanitized;
}

export function truncateResponse(response: string, maxChars: number): { text: string; truncated: boolean } {
  if (response.length <= maxChars) {
    return {
      text: response,
      truncated: false,
    };
  }

  return {
    text: response.slice(0, maxChars),
    truncated: true,
  };
}

export function parseListPlayersResponse(response: string): ParsedPlayer[] {
  return response
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parsePlayerLine)
    .filter((player): player is ParsedPlayer => player !== undefined);
}

function parsePlayerLine(line: string): ParsedPlayer | undefined {
  const match = line.match(/^(\d+)\.\s*(.+?)(?:,\s*(.+))?$/);

  if (!match) {
    return undefined;
  }

  const [, index, name, id] = match;

  return {
    index: Number.parseInt(index, 10),
    name: name.trim(),
    id: id?.trim(),
    raw: line,
  };
}
