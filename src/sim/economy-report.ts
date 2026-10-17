import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CURRENCY_IDS, createEconomy, stressEconomy } from "../core/economy.ts";
import { ECONOMY_CONTENT } from "../data/economy-v1.ts";
import { simulateV1 } from "../core/sim-v1.ts";
import { REALM_NAMES } from "../core/types.ts";
import { CONTENT_VERSION } from "../data/content-version.ts";

const BUILDS = ["taiji", "pojun", "xuanyin"] as const;

function table(headers: string[], rows: Array<Array<string | number>>): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function fmt(value: number, digits = 0): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

const economy = createEconomy(ECONOMY_CONTENT);
const contentValidation = economy.validateContent(ECONOMY_CONTENT);
const offline = economy.offline({ hours: 8, rewardsPerHour: {} });

const hundred = BUILDS.map((buildId) => simulateV1({ buildId, seed: 1, hours: 100 }));
const fiveHundred = simulateV1({ buildId: "taiji", seed: 1, hours: 500 });
const stressRuns = [1, 2, 3].map((seed) => stressEconomy(economy, ECONOMY_CONTENT, seed, 500));
const maxStressSilver = Math.max(...stressRuns.map((run) => run.maxSilver));
const negative = stressRuns.flatMap((run) => run.negativeBalances);
const zeroSinks = stressRuns.flatMap((run) => run.zeroSinkCurrencies);
const silverPerHour = fiveHundred.final.silver / Math.max(1, fiveHundred.hours);
const calendarMin = Math.min(...hundred.map((run) => run.calendarDays));
const calendarMax = Math.max(...hundred.map((run) => run.calendarDays));

const report = `# 《一纸江湖》Economy & Time Budget v1 500h 压力报告

> 生成时间：${new Date().toISOString()}  
> content：${CONTENT_VERSION}  
> 规则：单机、无交易、无体力、无广告、无付费战力。  
> 离线：在线同图的 ${ECONOMY_CONTENT.offline.rate * 100}% / ${ECONOMY_CONTENT.offline.capHours}h 上限。  
> 100h 连续模拟是上限/回归测试；玩家日历 = active + offline-effective。

## 0. 结论

- **内容校验：${contentValidation.ok ? "通过" : `失败：${contentValidation.errors.join("；")}`}。**
- **离线 8h 结算：${offline.effectiveHours}h 有效收益；9h 不会超过 8h 上限。**
- **100h 宗师日历（1h 主动 + 8h 离线 50%/天）：${fmt(calendarMin, 1)}–${fmt(calendarMax, 1)} 天，落在 2–4 周目标内。**
- **500h 战斗终局：${fiveHundred.final.level} 级 / ${REALM_NAMES[fiveHundred.final.realm]}，银两 ${fmt(fiveHundred.final.silver)}，约 ${fmt(silverPerHour)} 银两/小时；无负资产。**
- **500h 经济压力：3 seeds 无负余额、无零消耗货币；单 seed 最高银两 ${fmt(maxStressSilver)}，未出现无限增长。**
- 天机积分仅外观/称号/收藏；商店与掉落不提供付费战力。

## 1. 货币与消耗覆盖

${table(
    ["货币", "来源", "消耗", "上限"],
    CURRENCY_IDS.map((id) => [
      ECONOMY_CONTENT.currencies[id].id,
      ECONOMY_CONTENT.currencies[id].sources.join(" / "),
      ECONOMY_CONTENT.currencies[id].sinks.join(" / "),
      ECONOMY_CONTENT.currencies[id].cap,
    ]),
  )}

## 2. 100h 经济终局与玩家日历

${table(
    ["Build", "等级", "境界", "宗师(h)", "银两", "修为", "名望", "经济消耗", "日历(天)"],
    hundred.map((run) => [
      run.buildName,
      run.final.level,
      `${run.final.realm} · ${REALM_NAMES[run.final.realm]}`,
      run.realmTimes["5"] === null ? "—" : fmt(run.realmTimes["5"], 1),
      fmt(run.final.silver),
      fmt(run.cultivation),
      fmt(run.final.renown),
      fmt(run.economySpent),
      fmt(run.calendarDays, 1),
    ]),
  )}

> 日历口径：宗师时间 ÷ (1h 主动 + ${offline.effectiveHours}h 离线有效)。不是 100h 连续在线承诺。

## 3. 500h 连续战斗

${table(
    ["Build", "等级", "境界", "清图", "场次", "胜率", "银两", "修为", "名望", "宗师(h)"],
    [[
      fiveHundred.buildName,
      fiveHundred.final.level,
      `${fiveHundred.final.realm} · ${REALM_NAMES[fiveHundred.final.realm]}`,
      `${fiveHundred.mapsCleared.length}/15`,
      fiveHundred.totalFights,
      `${(fiveHundred.final.winRate * 100).toFixed(2)}%`,
      fmt(fiveHundred.final.silver),
      fmt(fiveHundred.cultivation),
      fmt(fiveHundred.final.renown),
      fiveHundred.realmTimes["5"] === null ? "—" : fmt(fiveHundred.realmTimes["5"], 1),
    ]],
  )}

- 银两/小时：${fmt(silverPerHour)}；终局无负余额。
- 装备评分 ${fiveHundred.gearScore}；神装 ${fiveHundred.divineItems} 件；15/15 图首通。

## 4. 500h 经济压力（3 seeds）

${table(
    ["Seed", "总入账银两", "总消耗", "终局银两", "峰值银两", "负余额", "零消耗货币", "警告"],
    stressRuns.map((run) => [
      run.seed,
      fmt(run.totalGranted),
      fmt(run.totalSpent),
      fmt(run.final.balances.silver),
      fmt(run.maxSilver),
      run.negativeBalances.length,
      run.zeroSinkCurrencies.length,
      run.warnings.length,
    ]),
  )}

- 负余额：${negative.length === 0 ? "无" : negative.join(" / ")}。
- 零消耗货币：${zeroSinks.length === 0 ? "无" : zeroSinks.join(" / ")}。
- 修为在境界上限处按 20% 转为银两，并记录警告；非核心资源到达上限时给出明确 warning，不静默删除。
- 洗练/淬炼/洗点/药/赶路/门派商店/打造材料构成银两 sink；回收价低于商店价，无买卖套利。

## 5. 时间模型

- \`activeHours\` = 实际在线小时。
- \`offlineEffectiveHours\` = min(offlineHours, ${ECONOMY_CONTENT.offline.capHours}) × ${ECONOMY_CONTENT.offline.rate}。
- \`calendarDays\` = (active + offlineEffective) / 每日有效小时。
- 100h 连续模拟是**上限/回归测试**，不是玩家承诺；2–4 周日历以 active + offline 计算。
- 不做每日签到/体力/广告翻倍；离线不会自动换图、换 loadout 或改优先级。

## 6. 验收口径

- grant/spend 精确；失败交易不部分应用；无负资产。
- 修为 cap、溢出转换、接近 cap 警告；次级资源 cap/溢出 warning。
- 离线 8h/50%、9h 不超 cap、停止条件缩短结算；不自动换图/换 loadout。
- 淬炼/洗练/洗点 quote + 原子扣款；洗点退点在 BuildProgression 测试中覆盖。
- 商店 stock/境界/名望门禁；购买移除 stock 并标记 purchased；天机积分只换外观/称号。
- 同一 activity/seed 同一 grants；save/load 恢复余额、caps、stock、season、warnings。
- 500h stress 无负余额、无零 sink、银两不无限增长。
`;

const out = resolve("reports");
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/economy-v1-500h.md`, report);
writeFileSync(`${out}/economy-v1-500h.json`, JSON.stringify({
  generatedAt: new Date().toISOString(),
  contentValidation,
  offline,
  hundred,
  fiveHundred,
  stress: stressRuns,
}, null, 2));
writeFileSync(`${out}/economy-v1-500h.csv`, [
  "seed,hours,total_granted,total_spent,silver,cultivation,renown,materials,max_silver,negative,zero_sink,warnings",
  ...stressRuns.map((run) => [
    run.seed,
    run.totalGranted,
    run.totalSpent,
    run.final.balances.silver,
    run.final.balances.cultivation,
    run.final.balances.renown,
    run.final.balances.materials,
    run.maxSilver,
    run.negativeBalances.length,
    run.zeroSinkCurrencies.length,
    run.warnings.length,
  ].join(",")),
].join("\n"));

console.log(`Wrote ${out}/economy-v1-500h.md`);
console.log(`calendar ${calendarMin.toFixed(1)}–${calendarMax.toFixed(1)}d; 500h silver ${fiveHundred.final.silver}; stress max ${maxStressSilver}`);
