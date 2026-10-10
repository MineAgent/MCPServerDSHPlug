// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 MineAgent
/**
 * MC 模式：把 preset 从全局层继承到的工具裁剪成白名单。
 *
 * 这个模块是 preset 侧插件（在 bundle 的 cordis.patch.yml 里，`preset-mc` 声明
 * 通过包名引用本包）。它跑在 preset 的 scope 上，`ctx.tools.restrict()` 的
 * 限制只作用于该 scope 继承来的**全局**工具；preset 自己挂载的工具（tool-goal、
 * tool-ask-user）留在 preset 层，照常可见。
 *
 * 用 deny 而不是 allow 的原因：`allow` 会把 preset 自己注册的工具一并隐藏
 * （agent scope 解析 preset 层时同样跑 admits 检查），而且 allow 只能点名全局
 * 工具。deny 只影响点到的名字，正好用来削掉全局层里多出来的工具。
 *
 * 名单在挂载时按当时的全局工具表算出来：以后宿主新增的全局工具会自动被隐藏，
 * 白名单里的名字即使暂时不存在也不会报错。
 */

/** Cordis 插件名（Loader 诊断用）。 */
export const name = 'mc-mode-tools';

/** 需要 tools 服务。 */
export const inject = ['tools'];

/** 保留的命名空间：Minecraft 桥的全部工具。 */
const KEEP_PREFIX = 'mcp__minecraft__';

/** 保留的具体工具名。 */
const KEEP_NAMES = new Set([
	'todo_write',
	'create_goal',
	'get_goal',
	'update_goal',
	'exit_plan_mode',
	'ask_user_question',
]);

/** PTC 的保留传输名，restrict() 拒绝点名它。 */
const RESERVED = 'run_code';

/**
 * 计算并落地本次裁剪。
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx preset 作用域上下文
 */
export function apply(ctx) {
	const globals = ctx.tools
		.schemas() // 不带 scope：只看全局层
		.map((schema) => schema.name);
	if (globals.length === 0) {
		// 本部署的全局层一定有工具（检索、资源、插件管理…）。空表说明这次的读取有问题，
		// 与其静默放行全部继承工具，不如让 preset 挂载失败、在名单里显示出来。
		throw new Error('mc-mode: 读到的全局工具表为空，白名单裁剪未生效');
	}

	const denied = globals.filter((tool) => tool !== RESERVED && !tool.startsWith(KEEP_PREFIX) && !KEEP_NAMES.has(tool));
	if (denied.length === 0) return;
	ctx.tools.restrict({ deny: denied });
	ctx.logger?.info?.(`mc-mode: 隐藏 ${denied.length} 个全局工具：${denied.join(', ')}`);
}
