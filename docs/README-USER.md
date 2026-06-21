# Ark ASA MCP User Setup

This package is for users who do not want to install Git, Node.js, or npm.

## Files

- `ark-asa-mcp.exe`: the MCP server.
- `config.example.json`: example server configuration.
- `README-USER.md`: this guide.

## Configure Servers

Copy `config.example.json` to `config.json`, then edit `config.json`:

```json
{
  "defaultServerName": "azer",
  "servers": [
    {
      "serverName": "azer",
      "host": "127.0.0.1",
      "port": 27020,
      "password": "change-me"
    }
  ]
}
```

You can also run:

```powershell
.\ark-asa-mcp.exe configure
```

The real `config.json` should stay on your machine because it contains RCON passwords.

## Codex Or Claude Configuration

Point your MCP client at the executable:

```json
{
  "mcpServers": {
    "ark-asa": {
      "command": "C:/Tools/ark-asa-mcp/ark-asa-mcp.exe"
    }
  }
}
```

If your `config.json` is somewhere else, pass its path:

```json
{
  "mcpServers": {
    "ark-asa": {
      "command": "C:/Tools/ark-asa-mcp/ark-asa-mcp.exe",
      "env": {
        "ARK_ASA_CONFIG_PATH": "C:/Users/you/AppData/Roaming/ark-asa-mcp/config.json"
      }
    }
  }
}
```

## Useful Commands

```powershell
.\ark-asa-mcp.exe configure
.\ark-asa-mcp.exe configure --server-name azer --host 127.0.0.1 --port 27020 --password change-me --default
.\ark-asa-mcp.exe config:list
.\ark-asa-mcp.exe --version
```
