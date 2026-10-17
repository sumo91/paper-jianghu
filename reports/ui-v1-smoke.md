# UI/UX, Settings & PWA v1 验证报告

> 生成时间：2026-10-18  
> 验证方式：生产构建 + PWA 结构检查 + 静态布局/可访问性断言。  
> 环境：本机无 Playwright/Chromium，因此 1600×900 / 844×390 的逐像素截图 smoke 未自动执行；以构建产物、CSS token 与 PWA 结构检查替代，人工 smoke 清单见下。

## 0. 结论

- `npm run build` 通过；`dist/index.html` 已链接 manifest，图标/Service Worker 均存在。
- `npm run pwa:check` PASS：manifest、sw、icons、app shell、14px 正文、16:9 stage、44px 触控、safe-area、orientation、reduced-motion、settings drawer。
- 设置抽屉已接入：字号 S/M/L、减少动效、静音说明、保存状态、导出/导入、重开、恢复存档导出、版本信息。
- 会话已接：顶部资源/等级、当前地图/层/行止、止行/续行、离线归来报告、战报摘要、人物属性/装备、武学 6 槽、行囊最近掉落。
- PWA update 提示：行止中禁用刷新；停止后可更新。安装入口在设置中。
- 江湖 tab 仍为静态内容预览；实时 faction/endgame 面板留给后续内容 UI 增量。

## 1. 尺寸与排版

| 项目 | 结果 |
| --- | --- |
| Stage 16:9 | CSS `aspect-ratio: 16 / 9` |
| 1600×900 | 生产构建 + CSS token 检查；未自动截图 |
| 844×390 | `--fs-md` ≥14px；元数据 ≥12px；触控 ≥44px |
| 安全区 | bottom/safe-area-inset 使用 |
| 竖屏 | orientation hint，可“仍要继续” |
| 减少动效 | prefers-reduced-motion + 设置项 |
| 字号 | S/M/L data-text-size |

## 2. 设置与存档

- 自动保存状态：已保存/保存中/保存失败。
- 导出：下载 `jianghu-save-YYYY-MM-DD.json`。
- 导入：文件读取 → schema 校验 → 失败保留原存档并提示。
- 重开：二次确认，默认太极 starter kit。
- 坏档：保留 `jianghu-session-v1-recovery`，设置内可下载恢复存档。
- 版本：app/content/save schema 在设置中展示。

## 3. PWA

| 项目 | 状态 |
| --- | --- |
| manifest | standalone, landscape, 192/512/maskable icons |
| service worker | app-shell precache, navigation fallback, runtime cache, SKIP_WAITING |
| offline shell | navigation fallback to cached index.html |
| update prompt | 行止中禁用刷新，停止后可更新 |
| install | beforeinstallprompt → 设置内安装入口 |
| 本地存档 | localStorage，无账号/后端 |

## 4. 可访问性

- 按钮/地图热点/页签均有 `aria-label` 或可读文本；焦点可见；图标按钮有标签。
- 设置弹层 `role=dialog`、`aria-modal`、Escape 关闭、打开时聚焦关闭按钮。
- 关键触控目标在 ≤900px/≤500px 高度下 ≥44px。
- 正文 14px 下限；不以 hover-only 承载必要信息。
- 颜色仍为纸墨/朱砂/金；未引入新视觉语言。

## 5. 人工 smoke 清单（待有浏览器环境执行）

1. 1600×900：打开、切五 tab、收起/展开信息台、设置抽屉、导出/导入。
2. 844×390：正文可读、触控不误点、底栏不被 safe-area 遮挡。
3. 行止 30s：资源/场次/战报更新；刷新页面恢复同局。
4. 离线 8h：回来显示报告；止行后更新提示可刷新。
5. 断网刷新：app shell 可打开；恢复网络后更新。
6. 坏档导入：显示错误且原存档不被覆盖。
