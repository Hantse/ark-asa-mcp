# Agent Guide

This repository contains a Node.js MCP server for Ark: Survival Ascended RCON administration.

## Mission

Expose a focused Model Context Protocol tool surface for ASA server operators. The MCP client talks to this server over stdio, and this server opens short-lived RCON connections to the selected ASA host when a tool is invoked.

## Current Tool Surface

- `asa_list_servers`: list configured RCON targets without exposing passwords.
- `asa_list_commands`: list the built-in command catalog.
- `asa_describe_command`: describe one catalog command.
- `asa_run_command`: execute a command catalog entry by `commandId` and typed arguments.
- `asa_config_list_servers`: list servers from `config.json` without exposing passwords.
- `asa_config_upsert_server`: create or update a server in `config.json`.
- `asa_config_remove_server`: remove a server from `config.json`.
- `asa_config_set_default_server`: set the default server in `config.json`.
- `asa_rcon_command`: execute one raw, single-line RCON command.
- `asa_list_players`: execute `ListPlayers` and return raw output plus best-effort parsed players.
- `asa_broadcast`: execute `Broadcast <message>`.
- `asa_save_world`: execute `SaveWorld`.
- `asa_get_game_log`: execute `GetGameLog`.

## Operating Principles

- Keep real RCON credentials in local `config.json` files or environment variables only.
- Commit `config.example.json`, but never commit a real `config.json`.
- Support multiple named ASA servers through `config.json`.
- Prefer catalog commands over raw RCON when a matching `commandId` exists.
- Keep catalog entries descriptive enough that an agent can understand purpose, arguments, and risk.
- Require explicit `serverName` routing whenever a deployment has multiple servers and no default.
- Keep the `.exe` release path friendly for users who do not know Git or npm.
- Prefer `ark-asa-mcp configure` for local password entry; config-writing MCP tools are useful but the MCP client can see supplied passwords.
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

Configuration is loaded once at startup from `src/config.ts`. Multi-server config is read from `config.json` by default, or from `ARK_ASA_CONFIG_PATH` when a custom path is provided.

`src/index.ts` routes CLI arguments. With no arguments, it starts the MCP stdio server. With `configure`, it launches the interactive config wizard.

## Development Checklist

Before opening a PR, run:

```bash
npm run typecheck
npm test
npm run build
```

When adding tools, add focused tests for command validation or parsing behavior. Avoid requiring a live ASA server in automated tests.

For release packaging changes, also keep `.github/workflows/release.yml`, `scripts/package-win.mjs`, and `docs/README-USER.md` aligned.
