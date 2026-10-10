<!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->
<!-- Copyright (C) 2026 MineAgent -->

# MCPServerDSHPlug

把 [MCPServer](https://github.com/MineAgent/MCPServer) 这个独立的 MCP stdio 程序
接进 DeepSeek Harness，并附带一个只保留游戏控制能力的「**MC 模式**」。

它是 DSH 的 **bundle**：一个 npm 包，`package.json` 里声明 `dsh.bundle.patch`，
profile 加载时把 `cordis.patch.yml` 这一层叠到组合上。仓库里没有构建步骤，
`index.js` 就是纯 JavaScript。

## 它做两件事

1. **接入 MCPServer**：插入一行 `@deepseek-ai/dsh-mcp-client`，用 stdio 启动
   `bin/minecraft-mcp-bridge.mjs`，于是 DSH 里出现 11 个 `mcp__minecraft__*` 工具
   （status / help / player / inventory / world / chat / sounds / screenshot /
   cursor / control / op）。
2. **声明 MC 模式**：一个 `@deepseek-ai/dsh-agent-preset` 声明（`id: mc`，
   显示名「MC 模式」）+ 预设侧插件 `mc-mode-tools`。

## 仓库结构（bundle 规范）

```
package.json        声明 dsh.bundle.patch、dsh.bundle 的补丁文件与显示元数据
cordis.patch.yml    这一层：mcp-client 行 + preset-mc 声明
index.js            供 patch 行按包名引用的插件模块（mc-mode-tools）
LICENSE             代码许可（GPL-3.0-only）
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
dsh --profile web --dump-config | grep -A8 'mcp-minecraft'
```

装好后在 DSH 里调 `mcp__minecraft__status`：游戏没开时会返回一句可读的中文错误，
说明桥通了。

## MC 模式

`preset-mc` 与标准 / PTC / 极简 / 创造并列，`order: 5`。它和别的模式有两处不同：

**工具面收窄成白名单**（`index.js` 的 `mc-mode-tools`）：挂载时读一次全局工具表，
把白名单以外的全局工具用 `tools.restrict({ deny })` 隐藏。最终可调用：

```
mcp__minecraft__*（11 个）
todo_write  create_goal  get_goal  update_goal  exit_plan_mode  ask_user_question
```

用 `deny` 而不是 `allow`：`allow` 会把 preset 自己注册的工具一并隐藏，而且只能
点名全局工具；`deny` 只削全局层。名单在挂载时算出来，宿主以后新增的全局工具会
自动被隐藏；全局表读成空表时插件直接抛错，让问题在插件列表里现形。

`create_goal` / `get_goal` / `update_goal`（`dsh-tool-goal`）、`ask_user_question`
（`dsh-tool-ask-user`）、`todo_write`（`dsh-tool-todo`）、`exit_plan_mode`
（`dsh-plan-mode`）在宿主层都是 `disabled` 的，所以 preset 里逐个挂载。

**系统提示词整段替换**（`@deepseek-ai/dsh-persona`，`complete: true` +
`includeRuntimeContext: false`）：宿主基线提示词、工作目录、运行时上下文、工具引导
都不会追加，会话的系统提示词就是 patch 里那段 prefix，只留「节奏」和「任务」两节；
每个工具怎么用由工具自己的说明负责，玩法交给用户在对话里说。

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

- **代码与配置**（`index.js`、`cordis.patch.yml`、`package.json`）：
  GPL-3.0-only，见 [LICENSE](LICENSE)
- **文档**（`README.md` 及其他 `.md`）：CC BY-NC-SA 4.0，
  见 [LICENSE.CC-BY-NC-SA-4.0](LICENSE.CC-BY-NC-SA-4.0)

两份许可都要求保留署名；文档许可另外限制商业使用，且衍生文档需同样方式共享。
