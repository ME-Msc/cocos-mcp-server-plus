# Cocos MCP Server Plus

[English](README.md)

Cocos MCP Server Plus 是一个面向 Cocos Creator 3.8.6+ 的扩展插件。它在 Cocos Creator 编辑器内部启动一个 HTTP MCP 服务，让 Claude、Cursor、Trae、Windsurf、VS Code Copilot 等 MCP 客户端可以通过标准 MCP 协议操作编辑器。

这个服务必须在 Cocos Creator 内运行，不是独立的 `npx` MCP server。

## 主要特性

- 使用 action 分组工具，避免 MCP 客户端 80/100 工具数量上限。
- 支持场景、节点、组件、预制体、资源、项目、调试、偏好设置、场景视图、广播和参数验证等操作。
- 默认 HTTP MCP 地址为 `http://127.0.0.1:3000/mcp`。
- 内置工具管理面板，可以启用或禁用分组工具。
- 自动规范化 MCP schema，兼容对 array `items` 要求严格的客户端。
- 改进脚本挂载、场景保存、打开和创建流程，并提供更清晰的错误信息。

## 环境要求

- Cocos Creator 3.8.6 或更高版本。
- 可以在扩展目录执行 `npm install` 和 `npm run build`。
- 支持 HTTP MCP 配置的 MCP 客户端。

暂不支持 Cocos Creator 2.x 和较旧的 3.x 版本，除非后续专门做兼容。

## 在 Cocos Creator 中安装

1. 将本目录复制到 Cocos Creator 项目的 `extensions/` 目录下。

```text
YourProject/
  assets/
  extensions/
    cocos-mcp-server-plus/
      package.json
      source/
      dist/
```

2. 在扩展目录安装依赖。

```bash
cd YourProject/extensions/cocos-mcp-server-plus
npm install
```

3. 构建扩展。

```bash
npm run build
```

4. 重启 Cocos Creator，或刷新扩展。

5. 打开 `Extension > Cocos MCP Server`，设置端口并启动服务。

如果 Cocos 控制台出现 `methods undefined`、`openPanel` 不存在或面板空白，通常是扩展依赖未安装。请在扩展目录运行 `npm install`，然后重载 Cocos Creator。

## MCP 客户端配置

默认地址：

```text
http://127.0.0.1:3000/mcp
```

Claude CLI：

```bash
claude mcp add --transport http cocos-creator http://127.0.0.1:3000/mcp
```

Cursor、Trae、Windsurf、VS Code Copilot 类配置：

```json
{
  "mcpServers": {
    "cocos-creator": {
      "url": "http://127.0.0.1:3000/mcp"
    }
  }
}
```

Claude Desktop 类配置：

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

如果你在插件面板里修改了端口，请把配置里的 `3000` 改成实际端口。

## 使用流程

1. 用 Cocos Creator 打开你的游戏项目。
2. 打开 `Extension > Cocos MCP Server`。
3. 点击 `Start Server`。
4. 在 MCP 客户端中连接 `http://127.0.0.1:<port>/mcp`。
5. 让 AI 先读取当前场景，例如：`List the current scene hierarchy and available nodes.`

使用期间 Cocos Creator 编辑器需要保持打开。

## 工具分组

插件对外暴露的是带 `action` 参数的分组工具，不再把每个编辑器操作都暴露成独立 MCP 工具。这样可以规避客户端的工具数量限制。

核心分组包括：

- `scene_management`：获取、列出、打开、保存、创建、另存和关闭场景。
- `scene_hierarchy`：读取场景层级。
- `node_lifecycle`、`node_query`、`node_transform`：创建、查找、检查、移动、删除和变换节点。
- `component_manage`、`component_query`、`component_property`、`component_script`：增删组件、查询组件、设置属性和挂载脚本。
- `prefab_browse`、`prefab_lifecycle`、`prefab_instance`：查询、创建、更新、复制、实例化和还原预制体。
- `project_manage`、`project_asset`、`project_build`：运行/构建项目、刷新资源、操作构建和预览服务。
- `debug_console`、`debug_logs`：读取日志、运行调试脚本、验证场景。
- `asset_manage`、`asset_analyze`：高级资源导入删除、依赖分析和清单导出。
- `scene_view_control`、`reference_image_manage`、`reference_image_view`：控制场景视图和参考图。
- `preferences_manage`、`server_info`、`broadcast_message`、`validation_utils`。

调用示例：

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

## 开发

```bash
npm install
npm run build
npm run watch
```

项目结构：

```text
source/
  main.ts                 扩展主进程
  mcp-server.ts           HTTP MCP 传输和工具暴露
  scene.ts                scene 进程辅助方法
  tools/                  编辑器工具实现和 grouped tool 路由
  panels/                 Cocos Creator 扩展面板
static/                   面板模板、样式和图标
i18n/                     Cocos 扩展文本
```

新增能力时，优先给现有分组工具增加 action，而不是新增大量顶层 MCP 工具。

## 常见问题

- 服务无法启动：检查端口是否被占用。
- MCP 客户端连接失败：确认插件面板显示服务运行中，并且 URL 以 `/mcp` 结尾。
- 工具数量超限：在工具管理面板重置或迁移配置，只启用 grouped tools。
- schema 校验错误：重新构建扩展，确保 `dist/` 中包含 schema 规范化逻辑。
- 挂载脚本出现 `missingScript`：等待 Cocos TypeScript 编译完成，再用 `db://assets/scripts/MyScript.ts` 这类资源路径调用 `component_script`。
- 场景创建或保存失败：如果当前 Cocos 版本没有暴露对应 scene 消息，请先在 Cocos 编辑器内手动创建场景，再用 `scene_management.open` 打开。

## 开发记录

- 将 MCP 工具体系稳定为 action 分组工具。
- 增加严格客户端需要的 schema 规范化。
- 补齐面板消息的 kebab-case 和 camelCase 别名。
- 改进自定义脚本挂载验证。
- 场景创建、保存、打开优先走 Cocos 编辑器 API。
- 重写 README，使文档更接近国际化开源项目结构。

## 许可状态

当前仓库没有包含标准 `LICENSE` 文件。在正式添加许可证前，本项目不能被视为标准开源授权项目。请将其视为 source-available 代码；重新分发或商业使用前需要确认授权。
