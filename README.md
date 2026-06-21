# ark-asa-mcp

`ark-asa-mcp` is a Node.js Model Context Protocol server for Ark: Survival Ascended servers that expose RCON.

It lets an MCP client run common ASA administration commands through a small, typed tool surface while keeping one or more RCON server definitions in a local `config.json` file.

## Features

- MCP stdio server built with `@modelcontextprotocol/sdk`.
- RCON command execution against one or more named Ark: Survival Ascended servers.
- Per-tool `serverName` routing when multiple servers are configured.
- Convenience tools for listing players, broadcasting messages, saving the world, and reading the game log.
- Centralized configuration through `config.json`.
- Unit-tested command helpers for input validation and output shaping.

## Requirements

- Node.js 20 or newer.
- One or more Ark: Survival Ascended servers with RCON enabled.
- The RCON host, port, and password for each configured server.

## Install

```bash
npm install
npm run build
```

## Configuration

Copy `config.example.json` to `config.json` and edit the server definitions for your ASA hosts. The local `config.json` file is ignored by Git because it contains RCON passwords.

```json
{
  "defaultServerName": "azer",
  "timeoutMs": 10000,
  "maxResponseChars": 20000,
  "servers": [
    {
      "serverName": "azer",
      "host": "127.0.0.1",
      "port": 27020,
      "password": "change-me"
    },
    {
      "serverName": "island",
      "host": "127.0.0.2",
      "port": 27020,
      "password": "change-me-too"
    }
  ]
}
```

By default, `ark-asa-mcp` reads `config.json` from the process working directory. You can point to another file with `ARK_ASA_CONFIG_PATH`:

```bash
ARK_ASA_CONFIG_PATH=D:/Repositories/ark-asa-mcp/config.json
```

Each server object supports:

| Field | Required | Default | Notes |
| --- | --- | --- | --- |
| `serverName` | yes | none | Stable name used by MCP tools, such as `azer`. |
| `host` | no | `127.0.0.1` | ASA RCON host. |
| `port` | no | `27020` | ASA RCON port. |
| `password` | yes | none | ASA RCON password. |
| `timeoutMs` | no | top-level `timeoutMs` or `10000` | Per-server timeout override. |
| `maxResponseChars` | no | top-level `maxResponseChars` or `20000` | Per-server response cap. |

`defaultServerName` is optional. If it is not set and only one server is configured, tools can omit `serverName`. If more than one server is configured, tools should pass `serverName`.

Environment fallback is still available for simple or containerized deployments:

```bash
ARK_ASA_RCON_SERVER_NAME=azer
ARK_ASA_RCON_HOST=127.0.0.1
ARK_ASA_RCON_PORT=27020
ARK_ASA_RCON_PASSWORD=change-me
```

`ARK_ASA_RCON_SERVERS` and `ARK_RCON_*` aliases are still accepted as fallbacks when no config file exists.

## MCP Client Example

```json
{
  "mcpServers": {
    "ark-asa": {
      "command": "node",
      "args": ["D:/Repositories/ark-asa-mcp/dist/index.js"],
      "env": {
        "ARK_ASA_CONFIG_PATH": "D:/Repositories/ark-asa-mcp/config.json"
      }
    }
  }
}
```

For development, you can point the command at `tsx`:

```json
{
  "mcpServers": {
    "ark-asa-dev": {
      "command": "npx",
      "args": ["tsx", "D:/Repositories/ark-asa-mcp/src/index.ts"],
      "env": {
        "ARK_ASA_CONFIG_PATH": "D:/Repositories/ark-asa-mcp/config.json"
      }
    }
  }
}
```

## Tools

| Tool | Purpose |
| --- | --- |
| `asa_list_servers` | Lists configured ASA RCON servers without exposing passwords. |
| `asa_rcon_command` | Runs a raw RCON command. |
| `asa_list_players` | Runs `ListPlayers` and returns raw plus parsed player entries. |
| `asa_broadcast` | Runs `Broadcast <message>`. |
| `asa_save_world` | Runs `SaveWorld`. |
| `asa_get_game_log` | Runs `GetGameLog`. |

Server-bound tools accept an optional `serverName` argument. It becomes required when multiple servers are configured and no default server is set.

## Development

```bash
npm run typecheck
npm test
npm run build
```

The package entry point is `src/index.ts`. Build output is written to `dist/`.

## Security Notes

RCON has server administrator authority. Treat every RCON password like a production secret, avoid committing `.env` files, and only expose this MCP server to clients you trust.

The raw command tool intentionally supports arbitrary single-line RCON commands. Newline characters are rejected to prevent accidental command batching.
