import { describe, expect, it } from "vitest";

import {
  buildBroadcastCommand,
  parseListPlayersResponse,
  sanitizeRconCommand,
  truncateResponse,
} from "../src/commands.js";

describe("sanitizeRconCommand", () => {
  it("trims a valid command", () => {
    expect(sanitizeRconCommand("  ListPlayers  ")).toBe("ListPlayers");
  });

  it("rejects an empty command", () => {
    expect(() => sanitizeRconCommand("   ")).toThrow("must not be empty");
  });

  it("rejects multiline commands", () => {
    expect(() => sanitizeRconCommand("ListPlayers\nSaveWorld")).toThrow("single line");
  });
});

describe("buildBroadcastCommand", () => {
  it("builds a single-line broadcast command", () => {
    expect(buildBroadcastCommand(" Server restart in 5 minutes ")).toBe(
      "Broadcast Server restart in 5 minutes",
    );
  });

  it("normalizes repeated whitespace", () => {
    expect(buildBroadcastCommand("Server   restart\tsoon")).toBe("Broadcast Server restart soon");
  });
});

describe("truncateResponse", () => {
  it("returns the original response when it fits", () => {
    expect(truncateResponse("abc", 3)).toEqual({ text: "abc", truncated: false });
  });

  it("truncates oversized responses", () => {
    expect(truncateResponse("abcdef", 3)).toEqual({ text: "abc", truncated: true });
  });
});

describe("parseListPlayersResponse", () => {
  it("parses common ListPlayers output", () => {
    expect(parseListPlayersResponse("0. Alice, 76561198000000000\n1. Bob, 123456789")).toEqual([
      {
        index: 0,
        name: "Alice",
        id: "76561198000000000",
        raw: "0. Alice, 76561198000000000",
      },
      {
        index: 1,
        name: "Bob",
        id: "123456789",
        raw: "1. Bob, 123456789",
      },
    ]);
  });

  it("ignores lines that are not player rows", () => {
    expect(parseListPlayersResponse("No Players Connected")).toEqual([]);
  });
});
