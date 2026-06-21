# Agent Guide

This repository contains a Node.js MCP server for Ark: Survival Ascended RCON administration.

## Mission

Expose a focused Model Context Protocol tool surface for ASA server operators. The MCP client talks to this server over stdio, and this server opens short-lived RCON connections to the selected ASA host when a tool is invoked.

## Current Tool Surface

- `asa_list_servers`: list configured RCON targets without exposing passwords.
- `asa_rcon_command`: execute one raw, single-line RCON command.
- `asa_list_players`: execute `ListPlayers` and return raw output plus best-effort parsed players.
- `asa_broadcast`: execute `Broadcast <message>`.
- `asa_save_world`: execute `SaveWorld`.
- `asa_get_game_log`: execute `GetGameLog`.

## Operating Principles

- Keep RCON credentials in environment variables only.
- Support multiple named ASA servers through `ARK_ASA_RCON_SERVERS`.
- Require explicit `serverName` routing whenever a deployment has multiple servers and no default.
- Keep tool handlers small and move command formatting into testable helpers.
- Prefer explicit, single-purpose ASA tools for common workflows.
- Keep the raw command tool available for commands that do not yet have a dedicated wrapper.
- Return raw RCON output whenever parsing is best-effort.
- Never log the RCON password.

## Architecture Summary

The server has four layers:

1. MCP transport and server bootstrap in `src/index.ts`.
2. Tool registration in `src/tools.ts`.
3. ASA command helpers in `src/commands.ts`.
4. RCON target resolution and command execution in `src/rcon.ts`.

Configuration is loaded once at startup from `src/config.ts`. Multi-server config uses a JSON array where each object contains `serverName`, `host`, `port`, and `password`.

## Development Checklist

Before opening a PR, run:

```bash
npm run typecheck
npm test
npm run build
```

When adding tools, add focused tests for command validation or parsing behavior. Avoid requiring a live ASA server in automated tests.
