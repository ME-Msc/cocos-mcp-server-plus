# Cocos MCP Server Plus

[中文文档](README.ZH.md)

Cocos MCP Server Plus is a Cocos Creator 3.8.6+ extension that exposes editor operations through an HTTP MCP endpoint. It lets MCP clients such as Claude, Cursor, Trae, Windsurf, and VS Code Copilot interact with the Cocos Creator editor while the editor is open.

The server runs inside Cocos Creator. It is not a standalone `npx` MCP server.

## Highlights

- Action-based MCP tools grouped by domain, keeping the exposed tool count below common client limits.
- Scene, node, component, prefab, asset, project, debug, preferences, scene view, broadcast, and validation operations.
- HTTP MCP endpoint at `http://127.0.0.1:3000/mcp` by default.
- Tool manager panel for enabling or disabling grouped tools.
- Schema normalization for stricter MCP clients that reject incomplete array schemas.
- Safer script attachment and scene save/open/create flows with verification and actionable errors.

## Requirements

- Cocos Creator 3.8.6 or later.
- Node.js and npm available to install extension dependencies. Cocos Creator usually bundles Node.js, but your shell may still need Node/npm on `PATH` for local builds.
- An MCP client that supports streamable HTTP or HTTP MCP server configuration.

Cocos Creator 2.x and older 3.x versions are not supported unless compatibility work is added later.

## Installation In Cocos Creator

1. Copy this folder into your Cocos Creator project under `extensions/`.

```text
YourProject/
  assets/
  extensions/
    cocos-mcp-server-plus/
      package.json
      source/
      dist/
```

2. Install dependencies inside the extension folder.

```bash
cd YourProject/extensions/cocos-mcp-server-plus
npm install
```

3. Build the extension.

```bash
npm run build
```

4. Reload Cocos Creator or refresh extensions.

5. Open `Extension > Cocos MCP Server`, choose a port, and start the server.

If Cocos logs `methods undefined`, `openPanel` not found, or a blank panel, run `npm install` in the extension folder and reload Cocos Creator.

## MCP Client Configuration

Default endpoint:

```text
http://127.0.0.1:3000/mcp
```

Claude CLI:

```bash
claude mcp add --transport http cocos-creator http://127.0.0.1:3000/mcp
```

Cursor, Trae, Windsurf, VS Code Copilot-style configuration:

```json
{
  "mcpServers": {
    "cocos-creator": {
      "url": "http://127.0.0.1:3000/mcp"
    }
  }
}
```

Claude Desktop-style configuration:

```json
{
  "mcpServers": {
    "cocos-creator": {
      "type": "http",
      "url": "http://127.0.0.1:3000/mcp"
    }
  }
}
```

Use the port configured in the Cocos extension panel if you changed it from `3000`.

## How To Use In Cocos

1. Open your game project in Cocos Creator.
2. Open `Extension > Cocos MCP Server`.
3. Click `Start Server`.
4. In your MCP client, connect to `http://127.0.0.1:<port>/mcp`.
5. Ask the AI assistant to inspect or modify the Cocos scene. A good first request is: `List the current scene hierarchy and available nodes.`

The editor must stay open while the MCP client is using the tools.

## Tool Groups

The extension exposes grouped tools with an `action` argument instead of a separate MCP tool for every editor operation. This avoids client limits such as 80 or 100 tools.

Core groups include:

- `scene_management`: get, list, open, save, create, save as, and close scenes.
- `scene_hierarchy`: read scene hierarchy.
- `node_lifecycle`, `node_query`, `node_transform`: create, find, inspect, move, delete, and transform nodes.
- `component_manage`, `component_query`, `component_property`, `component_script`: add/remove components, inspect components, set properties, and attach scripts.
- `prefab_browse`, `prefab_lifecycle`, `prefab_instance`: inspect, create, update, duplicate, instantiate, and revert prefabs.
- `project_manage`, `project_asset`, `project_build`: run/build project, refresh assets, and operate build or preview tools.
- `debug_console`, `debug_logs`: inspect logs, run debug scripts, and validate scenes.
- `asset_manage`, `asset_analyze`: import/delete advanced assets, inspect dependencies, and export manifests.
- `scene_view_control`, `reference_image_manage`, `reference_image_view`: control scene view and reference images.
- `preferences_manage`, `server_info`, `broadcast_message`, `validation_utils`.

Example tool call:

```json
{
  "tool": "node_lifecycle",
  "arguments": {
    "action": "create",
    "name": "Player",
    "parentUuid": "scene-or-parent-uuid",
    "nodeType": "2DNode"
  }
}
```

## Development

```bash
npm install
npm run build
npm run watch
```

Project layout:

```text
source/
  main.ts                 Extension main process
  mcp-server.ts           HTTP MCP transport and tool exposure
  scene.ts                Scene-process helper methods
  tools/                  Editor tool implementations and grouped tool router
  panels/                 Cocos Creator extension panels
static/                   Panel templates, styles, and icon
i18n/                     Cocos extension labels
```

When adding a tool, prefer adding it to an existing grouped tool action before creating a new top-level MCP tool.

## Troubleshooting

- Server does not start: check whether the configured port is already in use.
- MCP client cannot connect: confirm the Cocos panel shows the server as running and that the client URL ends with `/mcp`.
- Tool limit errors: reset or migrate the tool configuration in the panel so only grouped tools are enabled.
- Invalid schema errors: rebuild the extension so schema normalization is present in `dist/`.
- Script attachment reports `missingScript`: wait for Cocos TypeScript compilation to finish, then call `component_script` with the script asset path such as `db://assets/scripts/MyScript.ts`.
- Scene create/save issues: prefer creating scenes through the Cocos editor if your exact Cocos version does not expose the required scene messages.

## Development Log

- Stabilized MCP exposure with grouped action-based tools.
- Added schema normalization for strict MCP clients.
- Improved panel message aliases for kebab-case and camelCase callers.
- Improved custom script attachment verification.
- Reworked scene create/save/open flows to prefer Cocos editor APIs.
- Modernized documentation for international open-source usage.

## License Status

This repository currently does not include a standard `LICENSE` file. Until one is added, usage, redistribution, and commercial use are not granted by a standard open-source license. Treat the code as source-available and confirm permission before redistributing or using it commercially.
