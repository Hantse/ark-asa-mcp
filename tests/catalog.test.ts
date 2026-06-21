import { describe, expect, it } from "vitest";

import { buildCatalogCommand, getCommandCatalogEntry, listCommandCatalog } from "../src/catalog.js";

describe("command catalog", () => {
  it("lists base commands without exposing raw templates", () => {
    expect(listCommandCatalog()).toContainEqual({
      id: "broadcast",
      label: "Broadcast message",
      description: "Sends a visible server-wide message to connected players.",
      category: "base",
      danger: "safe",
      args: ["message"],
    });
  });

  it("describes a command by id", () => {
    expect(getCommandCatalogEntry("save_world")).toMatchObject({
      id: "save_world",
      danger: "admin",
      rconTemplate: "SaveWorld",
    });
  });

  it("builds a no-argument command", () => {
    expect(buildCatalogCommand("list_players")).toMatchObject({
      rconCommand: "ListPlayers",
      command: {
        id: "list_players",
      },
    });
  });

  it("builds a command with arguments", () => {
    expect(
      buildCatalogCommand("broadcast", {
        message: " Restart   in 5 minutes ",
      }),
    ).toMatchObject({
      rconCommand: "Broadcast Restart in 5 minutes",
      command: {
        id: "broadcast",
      },
    });
  });

  it("rejects missing required arguments", () => {
    expect(() => buildCatalogCommand("broadcast")).toThrow('requires argument "message"');
  });

  it("rejects unknown command ids", () => {
    expect(() => buildCatalogCommand("unknown")).toThrow('Unknown commandId "unknown"');
  });
});
