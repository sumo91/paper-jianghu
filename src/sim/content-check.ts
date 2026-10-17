import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { GAME_CONTENT } from "../data/content-bundle.ts";
import { validateContent, runContentMatrix } from "../core/content-pipeline.ts";
import { APP_VERSION, CONTENT_VERSION, SAVE_SCHEMA_VERSION } from "../data/content-version.ts";

const validation = validateContent(GAME_CONTENT);
const matrix = runContentMatrix(GAME_CONTENT);
const ok = validation.ok && matrix.ok;

const table = (headers: string[], rows: Array<Array<string | number>>) => [
  `| ${headers.join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.join(" | ")} |`),
].join("\n");

const report = `# Content Pipeline, Validation & Simulator v1 报告

> 生成时间：${new Date().toISOString()}  
> app：${APP_VERSION} · content：${CONTENT_VERSION} · save schema：${SAVE_SCHEMA_VERSION}  
> 结论：${ok ? "通过" : "失败"}  
> 长模拟：100h \`npm run sim:v1\`、500h \`npm run sim:economy\`（manual/nightly，不阻塞 PR 快检）。

## 0. 结论

- **内容校验：${validation.ok ? "通过" : "失败"}；channels ${validation.checks.length}。**
- **Balance matrix：${matrix.ok ? "通过" : "失败"}；${matrix.rows.length} 格（15 图 × 4 builds），总胜 ${matrix.totalWins}。**
- **dominant build：${matrix.dominantBuild}，dominant share ${(matrix.dominantShare * 100).toFixed(1)}%（阈值 ≤60%）。**
- **无不可通地图：${matrix.unwinnableMaps.length === 0 ? "是" : matrix.unwinnableMaps.join(", ")}；hybrid 合法：${matrix.hybridValid ? "是" : "否"}。**
- 快检只跑内容 + 矩阵；100h/500h 是手动/夜间长跑，不进入 PR 阻塞路径。
- 无 CMS/后端；内容、schema、报告都在仓库。

## 1. 校验层

${table(
    ["层", "结果", "错误", "警告"],
    validation.checks.map((entry) => [
      entry.name,
      entry.ok ? "通过" : "失败",
      entry.errors.length,
      entry.warnings.length,
    ]),
  )}

${validation.errors.length > 0 ? `### 错误\n\n${validation.errors.map((error) => `- ${error}`).join("\n")}` : ""}

${validation.warnings.length > 0 ? `### 警告\n\n${validation.warnings.map((warning) => `- ${warning}`).join("\n")}` : ""}

## 2. Balance Matrix

${table(
    ["Build", "胜", "总", "胜率"],
    Object.entries(matrix.perBuild).map(([build, value]) => [
      build,
      value.wins,
      value.total,
      `${(value.rate * 100).toFixed(1)}%`,
    ]),
  )}

${table(
    ["地图", "Build", "结果", "回合", "残血"],
    matrix.rows.map((row) => [
      row.mapName,
      row.build,
      row.win ? "胜" : "负",
      row.rounds,
      `${Math.round(row.hpPct * 100)}%`,
    ]),
  )}

## 3. 版本与存档

- app / content / save schema：${APP_VERSION} / ${CONTENT_VERSION} / ${SAVE_SCHEMA_VERSION}。
- 存档 envelope 记录 content version + schema version + seed。
- 未知/改名 ID 由 \`recoverSave\` 迁移或隔离，不白屏；见 \`tests/content-pipeline.test.ts\`。
- PWA 更新需使用同一 release manifest 的 app/content 版本（#12）。

## 4. 验收口径

- schema/引用/world/build/event/economy/cross-reference 各层校验；无效内容失败并给上下文。
- 3 starter kits + hybrid × 15 图矩阵；无不可通地图；dominant share ≤60%。
- 100h/500h 长跑使用 \`resolveBattle\` + headless sim，报告带版本/seed。
- 内容改名/缺失 ID 有迁移/隔离，不崩溃。
- CI 快检：typecheck → content:check → tests → build。
`;

const out = resolve("reports");
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/content-v1.md`, report);
writeFileSync(`${out}/content-v1.json`, JSON.stringify({
  generatedAt: new Date().toISOString(),
  versions: { app: APP_VERSION, content: CONTENT_VERSION, save: SAVE_SCHEMA_VERSION },
  validation,
  matrix,
  ok,
}, null, 2));
writeFileSync(`${out}/content-v1.csv`, [
  "map_id,map,build,win,rounds,hp_pct",
  ...matrix.rows.map((row) => [row.mapId, row.mapName, row.build, row.win ? 1 : 0, row.rounds, row.hpPct.toFixed(4)].join(",")),
].join("\n"));
writeFileSync(`${out}/release-manifest.json`, JSON.stringify({
  appVersion: APP_VERSION,
  contentVersion: CONTENT_VERSION,
  saveSchemaVersion: SAVE_SCHEMA_VERSION,
  generatedAt: new Date().toISOString(),
}, null, 2));

console.log(`content:check ${ok ? "PASS" : "FAIL"} — checks ${validation.checks.length}, matrix ${matrix.rows.length}, dominant ${matrix.dominantBuild} ${(matrix.dominantShare * 100).toFixed(1)}%`);
if (!ok) {
  for (const error of validation.errors) console.error(`- ${error}`);
  if (!matrix.hybridValid) console.error("- hybrid loadout invalid");
  for (const map of matrix.unwinnableMaps) console.error(`- unwinnable map: ${map}`);
  if (matrix.dominantShare > 0.6) console.error(`- dominant share ${matrix.dominantShare}`);
  process.exitCode = 1;
}
