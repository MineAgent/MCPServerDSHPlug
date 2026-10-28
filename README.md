<!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->
<!-- Copyright (C) 2026 MineAgent -->

# MCPServerDSHPlug

把 [MCPServer](https://github.com/MineAgent/MCPServer) 这个独立的 MCP stdio 程序
接进 DeepSeek Harness 的「**MC 模式**」与「**MC 模式+**」。

它是 DSH 的 **bundle**：一个 npm 包，`package.json` 里声明 `dsh.bundle.patch`，
profile 加载时把 `cordis.patch.yml` 这一层叠到组合上。它是**配置型 bundle**：
包里没有插件模块，只有两份 preset 声明。

## 它做两件事

1. **声明两个模式**：两个 `@deepseek-ai/dsh-agent-preset` 声明——`id: mc`
   （「MC 模式」）、`id: mc-plus`（「MC 模式+」，标准模式 ∪ MC 模式）。
2. **在这两个模式的 scope 里接入 MCPServer**：各自的插件表里挂一行
   `@deepseek-ai/dsh-mcp-client`，用 stdio 启动 `bin/minecraft-mcp-bridge.mjs`，
   于是选了这两个模式的 Agent 出现 14 个 `mcp__minecraft__*` 工具
   （status / help / player / inventory / world / chat / sounds / screenshot /
   cursor / control / op / baritone / killaura / request），其他模式完全看不到这些工具。
   「MC 模式+」在这 14 个之外还有标准模式的全部工具，系统提示词与标准模式相同。

MCP 客户端放在 preset 里而不是宿主全局层，是因为 `dsh-mcp-client` 把工具注册在
挂载它的 scope 上：preset 自己挂载的工具只在选中该 preset 的 Agent 面前出现。
这比「全局注册 + 在每个模式里逐个 deny」更稳——以后新增的模式不会漏网，也不需要
在别处维护一份隐藏名单。宿主全局层不再有任何 Minecraft 相关行。

## 仓库结构（bundle 规范）

```
package.json        声明 dsh.bundle.patch 与显示元数据（无需 main/exports）
cordis.patch.yml    这一层：preset-mc 与 preset-mc-plus 两份声明（各含 mcp-client 行）
LICENSE             代码与配置许可（GPL-3.0-only）
LICENSE.CC-BY-NC-SA-4.0  文档许可
```

## 依赖

- DSH（`dsh` CLI 或 Desktop），profile 例如 `web`；安装用
  `dsh plugin --profile <name> add <包>`
- Node.js ≥ 20（默认用 `/usr/bin/node`）
- [MCPServer](https://github.com/MineAgent/MCPServer)：
  ```sh
  git clone git@github.com:MineAgent/MCPServer.git
  cd MCPServer && npx --yes pnpm@12 install
  ```
- 游戏侧：`.minecraft/mods` 里加载 `httpdprovider` + `mcctl` +
  `advanced-info-fetch` + `craftcmd`，共享 HTTP 服务监听 `127.0.0.1:3420`
  （游戏窗口标题会带 ` - 3420`）
- 可选：`mgbaritoneconnector` + Baritone（`/bt`）、`killaura`（`/ka`）

## 安装

```sh
# 本地目录
dsh plugin --profile web add ./MCPServerDSHPlug

# 或直接从 GitHub
dsh plugin --profile web add github:MineAgent/MCPServerDSHPlug
```

然后把入口路径指过去，两种方式任选：

- 给 DSH 进程设环境变量 `MC_BRIDGE_BIN=/path/to/MCPServer/bin/minecraft-mcp-bridge.mjs`
- 或直接改 `cordis.patch.yml` 里 `mcp-minecraft` 那行 `args` 的默认值

验证这一层被加载：

```sh
dsh --profile web --dump-config | grep -A10 'mcp-minecraft'
```

装好后，在一个**新建**任务里选「MC 模式」，调 `mcp__minecraft__status`：游戏没开时
会返回一句可读的中文错误，说明桥通了。其他模式（标准 / PTC / 极简 / 创造）的工具表里
没有 `mcp__minecraft__*`。

## MC 模式

`preset-mc` 与标准 / PTC / 极简 / 创造并列，`order: 5`。它和别的模式有两处不同：

**工具面由 preset 自己的插件表决定**：这套部署里工具本来就挂在 preset 上，
宿主全局层是空的，所以 MC 模式能用什么完全等于下面这份清单，没有继承来的工具
需要再过滤。最终可调用：

```
mcp__minecraft__*（14 个，preset 自己挂载的 mcp-client 提供）
todo_write  create_goal  get_goal  update_goal  exit_plan_mode  ask_user_question
```

> 14 个工具里，`baritone` 对应 `/bt/`，`killaura` 对应 `/ka/*`；
> 以后新增的 endpoint 可以先用 `help` 看说明，再用通用的 `request` 调用。

`create_goal` / `get_goal` / `update_goal`（`dsh-tool-goal`）、`ask_user_question`
（`dsh-tool-ask-user`）、`todo_write`（`dsh-tool-todo`）、`exit_plan_mode`
（`dsh-plan-mode`）在宿主层都是 `disabled` 的，所以 preset 里逐个挂载；
`mcp__minecraft__*` 来自 preset 自己挂载的 mcp-client。

**系统提示词整段替换**（`@deepseek-ai/dsh-persona`，`complete: true` +
`includeRuntimeContext: false`）：宿主基线提示词、工作目录、运行时上下文、工具引导
都不会追加，会话的系统提示词就是 patch 里那段 prefix，只留「节奏」和「任务」两节；
每个工具怎么用由工具自己的说明负责，玩法交给用户在对话里说。

## MC 模式+

`preset-mc-plus`（`id: mc-plus`，显示名「MC 模式+」，`order: 8`）是标准模式与
MC 模式的并集：

- **工具面** = 标准模式的全部插件 + `mcp__minecraft__*`（14 个）。
- **系统提示词** = 标准模式的提示词，一字不改。

`plugins` 就是 shipped `@deepseek-ai/dsh-web-app/presets/standard.patch.yml` 里那份
清单的完整副本（21 行，`name` / `disabled` / `config` 逐字相同），另加一行
`mcp-minecraft`。这份副本不会自动跟随 `dsh-web-app` 升级，standard 的清单若增减，
这里要跟着同步。

`persona` 只写标准模式那句 `prefix: You are a coding agent powered by the
{{model}} model.`，**不设** `complete`，也**不设 `suffix`**——当前 DSH 只注册
`provider` / `model`，没有 `{{cwd}}`；工作目录由 `working-directory` 服务作为
运行时上下文提供。写 `{{cwd}}` 会在提示词装配阶段抛
`unknown prompt variable "{{cwd}}"`，本轮直接失败。不设置后，宿主基线提示词、
工具引导、运行时上下文照常追加，与标准模式逐字一致，不掺任何 MC 专属文字；
游戏怎么用由各个 `mcp__minecraft__*` 工具自己的说明负责。

代价：preset 的子插件在 profile 加载时就挂载，所以多这一行会多出一个 `mcp-client`
和它拉起的第二个 `minecraft-mcp-bridge` 进程。桥只做 stdio↔HTTP 代理、不占端口，
多一个进程没有副作用；想清掉多余的桥，重启 DSH 进程。

## 改了之后怎么生效

bundle 的 `cordis.patch.yml` 没有 HMR 监听，改完要重新加载这一层：

```sh
dsh plugin --profile web remove dsh-minecraft-bridge-bundle
dsh plugin --profile web add ./MCPServerDSHPlug
```

在 DSH 里也可以用插件管理器把该 bundle 先禁用再启用。注意：包已安装时
`plugin_manager install_bundle` 会因为安装源不一致报 `ambiguous-install`，
用开关（`set_bundle`）切换即可。

## 参考

- 打包与安装（官方）：<https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md>
- bundle 与 profile 的区别：bundle 是「贡献一层配置的 npm 包」，profile 是
  「哪些 bundle、按什么顺序组成一套可运行组合」；层序为
  bundle 补丁（按 `dsh.profile.bundles` 顺序）→ profile 自己的
  `cordis.patch.yml` → `$DSH_HOME/cordis.patch.yml` → `--patch` 覆盖，
  后面的层按行 id 覆盖前面的层，且**整段**替换该行的 `config`。

## 许可证

- **代码与配置**（`cordis.patch.yml`、`package.json`）：
  GPL-3.0-only，见 [LICENSE](LICENSE)
- **文档**（`README.md` 及其他 `.md`）：CC BY-NC-SA 4.0，
  见 [LICENSE.CC-BY-NC-SA-4.0](LICENSE.CC-BY-NC-SA-4.0)

两份许可都要求保留署名；文档许可另外限制商业使用，且衍生文档需同样方式共享。
