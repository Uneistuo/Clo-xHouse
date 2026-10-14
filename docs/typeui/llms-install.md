# Install TypeUI MCP

TypeUI is a hosted Streamable HTTP MCP server. Do not clone or build a local server for TypeUI.

## Server

- Name: `typeui`
- URL: `https://mcp.typeui.sh`
- Transport: Streamable HTTP

## OpenClaw

Save TypeUI as an OpenClaw-managed MCP server:

```bash
openclaw mcp set typeui '{"url":"https://mcp.typeui.sh","transport":"streamable-http","auth":"oauth"}'
```

Start the TypeUI OAuth flow:

```bash
openclaw mcp login typeui
```

OpenClaw prints an authorization URL. Open it, sign in with TypeUI, and authorize the connection. If OpenClaw asks you to finish with a code, pass it back to the same server:

```bash
openclaw mcp login typeui --code <code>
```

Check the saved server and live connection:

```bash
openclaw mcp status --verbose
openclaw mcp doctor typeui --probe
```

If OpenClaw is already running with cached MCP runtimes, reload MCP servers or restart the agent process:

```bash
openclaw mcp reload
```

Documentation: https://www.typeui.sh/docs/guides/openclaw

## OpenClaw ClawHub package

The ZIP-ready OpenClaw plugin package lives at:

```text
plugins/openclaw/typeui
```

After installing the plugin package, install TypeUI MCP with:

```bash
openclaw typeui install-mcp
```

OpenClaw agents can also call the plugin-provided `typeui_install_mcp` tool.

Validate it before upload:

```bash
clawhub package validate plugins/openclaw/typeui
clawhub package publish plugins/openclaw/typeui --dry-run
```

From the plugin folder, you can also inspect the files that will be included:

```bash
npm pack --dry-run
```

## Cline MCP config

Add this server to Cline MCP settings:

```json
{
  "mcpServers": {
    "typeui": {
      "url": "https://mcp.typeui.sh",
      "type": "streamableHttp",
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

If Cline asks the user to authenticate, tell them to sign in with their TypeUI account.

## Verification

After installation, Cline should be able to use TypeUI tools for:

- browsing available design systems
- browsing UI prompts
- generating layout variations
- downloading TypeUI Pro resources for authenticated Pro users

Documentation: https://www.typeui.sh/docs/guides/cline
