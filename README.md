# ark-asa-mcp

`ark-asa-mcp` is a Node.js Model Context Protocol server for Ark: Survival Ascended servers that expose RCON.

It lets an MCP client run common ASA administration commands through a small, typed tool surface while keeping the RCON connection details in environment variables.

## Features

- MCP stdio server built with `@modelcontextprotocol/sdk`.
- RCON command execution against an Ark: Survival Ascended server.
- Convenience tools for listing players, broadcasting messages, saving the world, and reading the game log.
- Centralized configuration through environment variables.
- Unit-tested command helpers for input validation and output shaping.

## Requirements

- Node.js 20 or newer.
- An Ark: Survival Ascended server with RCON enabled.
- The server RCON host, port, and password.

## Install

```bash
npm install
npm run build
```

## Configuration

Copy `.env.example` for local development, or set the same values in your MCP client configuration.

```bash
ARK_ASA_RCON_HOST=127.0.0.1
ARK_ASA_RCON_PORT=27020
ARK_ASA_RCON_PASSWORD=change-me
ARK_ASA_RCON_TIMEOUT_MS=10000
ARK_ASA_RCON_MAX_RESPONSE_CHARS=20000
```

`ARK_RCON_*` aliases are also accepted for host, port, password, timeout, and max response size.

## MCP Client Example

```json
{
  "mcpServers": {
    "ark-asa": {
      "command": "node",
      "args": ["D:/Repositories/ark-asa-mcp/dist/index.js"],
      "env": {
        "ARK_ASA_RCON_HOST": "127.0.0.1",
        "ARK_ASA_RCON_PORT": "27020",
        "ARK_ASA_RCON_PASSWORD": "change-me"
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
        "ARK_ASA_RCON_HOST": "127.0.0.1",
        "ARK_ASA_RCON_PORT": "27020",
        "ARK_ASA_RCON_PASSWORD": "change-me"
      }
    }
  }
}
```

## Tools

| Tool | Purpose |
| --- | --- |
| `asa_rcon_command` | Runs a raw RCON command. |
| `asa_list_players` | Runs `ListPlayers` and returns raw plus parsed player entries. |
| `asa_broadcast` | Runs `Broadcast <message>`. |
| `asa_save_world` | Runs `SaveWorld`. |
| `asa_get_game_log` | Runs `GetGameLog`. |

## Development

```bash
npm run typecheck
npm test
npm run build
```

The package entry point is `src/index.ts`. Build output is written to `dist/`.

## Security Notes

RCON has server administrator authority. Treat the RCON password like a production secret, avoid committing `.env` files, and only expose this MCP server to clients you trust.

The raw command tool intentionally supports arbitrary single-line RCON commands. Newline characters are rejected to prevent accidental command batching.
