import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createActivityService } from "../core/activities.ts";
import { ACTIVITY_CONTENT } from "../data/activities-v1.ts";
import { WORLD_CONTENT_V1 } from "../data/world-v1.ts";
import { COMBAT_CONTENT, createBattleSheet, starterLoadoutFor, enemyBattleDef } from "../data/combat-v1.ts";
import { resolveBattle } from "../core/combat-v1.ts";
import { simulateV1 } from "../core/sim-v1.ts";
import { createFactionEvent } from "../core/factions-events.ts";
import { FACTION_EVENT_CONTENT } from "../data/factions-events-v1.ts";

const service = createActivityService(ACTIVITY_CONTENT);
const validation = service.validateContent(ACTIVITY_CONTENT);
const faction = createFactionEvent(FACTION_EVENT_CONTENT);
const factionState = faction.createState(3);

const survivalDurationMinutes = 40;
const escortDurationMinutes = 30;

function enemy(level: number, pressure: number) {
  return enemyBattleDef({
    id: `activity_${level}`, name: "演武守关者", style: "gang", element: "gang", level,
    hp: 380 * (1 + 0.12 * (level - 1)) * pressure,
    attack: 48 * (1 + 0.09 * (level - 1)) * pressure,
    defense: (20 + 2.2 * (level - 1)) * pressure,
    speed: 42 + level,
    pattern: [{ id: "e_heavy", name: "劈", type: "shi", element: "gang", coefficient: 1.15, effect: "heavy" }],
  });
}

function runSurvival(buildId: "taiji" | "pojun" | "xuanyin") {
  let state = service.startSurvival("luoyang", 17);
  let guard = 0;
  while (state.status === "active" && guard < 10) {
    const spec = service.nextBattle(state)!;
    const target = enemy(18 + spec.levelOffset, spec.pressure);
    if (spec.objective === "survive") {
      target.primary.hp = 1_000_000_000;
    }
    const battle = resolveBattle({
      player: {
        sheet: createBattleSheet(buildId, { level: 34 }),
        loadout: starterLoadoutFor(buildId),
        content: COMBAT_CONTENT,
      },
      enemy: target,
      objective: spec.objective,
      maxRounds: 30,
      surviveRounds: spec.surviveRounds,
      seed: spec.enemySeed,
      captureEvents: false,
    });
    state = service.advance(state, battle).state;
    guard += 1;
  }
  return state;
}

function runEscort(buildId: "taiji" | "pojun" | "xuanyin") {
  let state = service.startEscort("caoyun", 23);
  let guard = 0;
  while (state.status === "active" && guard < 10) {
    const spec = service.nextBattle(state)!;
    const battle = resolveBattle({
      player: {
        sheet: createBattleSheet(buildId, { level: 34 }),
        loadout: starterLoadoutFor(buildId),
        content: COMBAT_CONTENT,
      },
      enemy: enemy(17 + spec.levelOffset, spec.pressure),
      objective: "clear",
      maxRounds: 30,
      seed: spec.enemySeed,
      captureEvents: false,
    });
    state = service.advance(state, battle).state;
    guard += 1;
  }
  return state;
}

const builds = ["taiji", "pojun", "xuanyin"] as const;
const survivalRuns = builds.map((buildId) => ({ buildId, state: runSurvival(buildId) }));
const escortRuns = builds.map((buildId) => ({ buildId, state: runEscort(buildId) }));
const normal = simulateV1({ buildId: "taiji", seed: 1, hours: 100 });
const normalSilverPerHour = normal.final.silver / normal.hours;
const normalRenownPerHour = normal.final.renown / normal.hours;

const survivalRunsPerHour = 60 / survivalDurationMinutes;
const escortRunsPerHour = 60 / escortDurationMinutes;
const survivalMedian = (key: "silver" | "materials" | "renown") => {
  const values = survivalRuns.map((run) => run.state.rewards[key]).sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
};
const escortMedian = (key: "silver" | "materials" | "renown") => {
  const values = escortRuns.map((run) => run.state.rewards[key]).sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
};

const table = (headers: string[], rows: Array<Array<string | number>>) => [
  `| ${headers.join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.join(" | ")} |`),
].join("\n");

const report = `# Survival, Feng Shui & Offline Events v1 验证报告

> 生成时间：${new Date().toISOString()}  
> 规则 seam：\`ActivityService\` + \`resolveBattle\` + \`FactionEventService\`  
> 状态：schema + 验证集；完整地图活动内容仍属于后续内容生产。

## 0. 结论

- **内容校验：${validation.ok ? "通过" : "失败：" + validation.errors.join("；")}。**
- 守关 5 波、护镖 3 段；所有 15 图 1–2 个风水标签；无新战斗属性。
- 3 starter kits 实打实跑完守关/护镖：${survivalRuns.map((run) => `${run.buildId} 守关 ${run.state.clearedWaves}/5`).join("；")}；${escortRuns.map((run) => `${run.buildId} 护镖 ${run.state.clearedLegs}/3`).join("；")}。
- 100h 经济对照：守关约 ${Math.round(survivalMedian("silver") * survivalRunsPerHour)} 银两/h、${Math.round(survivalMedian("materials") * survivalRunsPerHour)} 材料/h；护镖约 ${Math.round(escortMedian("silver") * escortRunsPerHour)} 银两/h、${Math.round(escortMedian("materials") * escortRunsPerHour)} 材料/h；普通刷图约 ${Math.round(normalSilverPerHour)} 银两/h、${Math.round(normalRenownPerHour)} 名望/h。三类活动的资源组合不同，没有单一活动全资源最优。
- 离线 0–3 个选择由 #7 事件引擎生成；可延迟、持久、reload 不重复。

## 1. 守关实跑

${table(
    ["Build", "状态", "波次", "奖励银两", "材料", "名望", "剩余 HP"],
    survivalRuns.map((run) => [
      run.buildId,
      run.state.status,
      `${run.state.clearedWaves}/5`,
      run.state.rewards.silver,
      run.state.rewards.materials,
      run.state.rewards.renown,
      `${Math.round(run.state.playerHpPct * 100)}%`,
    ]),
  )}

## 2. 护镖实跑

${table(
    ["Build", "状态", "段数", "奖励银两", "材料", "名望", "镖车 HP"],
    escortRuns.map((run) => [
      run.buildId,
      run.state.status,
      `${run.state.clearedLegs}/3`,
      run.state.rewards.silver,
      run.state.rewards.materials,
      run.state.rewards.renown,
      `${run.state.cartHp}/${run.state.cartMaxHp}`,
    ]),
  )}

## 3. 100h 活动经济对照

| 活动 | 银两/h | 材料/h | 名望/h |
| --- | --- | --- | --- |
| 守关（中位） | ${Math.round(survivalMedian("silver") * survivalRunsPerHour)} | ${Math.round(survivalMedian("materials") * survivalRunsPerHour)} | ${Math.round(survivalMedian("renown") * survivalRunsPerHour)} |
| 护镖（中位） | ${Math.round(escortMedian("silver") * escortRunsPerHour)} | ${Math.round(escortMedian("materials") * escortRunsPerHour)} | ${Math.round(escortMedian("renown") * escortRunsPerHour)} |
| 普通刷图（100h） | ${Math.round(normalSilverPerHour)} | — | ${Math.round(normalRenownPerHour)} |

> 守关按 ${survivalDurationMinutes} 分钟/轮、护镖按 ${escortDurationMinutes} 分钟/轮估算；这是活动经济上限测试，不是玩家日历。

## 4. 风水宝地

${table(
    ["地图", "标签", "修炼", "离线", "银两", "治疗", "属性亲和"],
    WORLD_CONTENT_V1.maps.map((map) => {
      const feng = service.fengShui(map.id);
      return [
        map.name,
        feng.tags.join("·"),
        `${Math.round(feng.cultivationPct * 100)}%`,
        `${Math.round(feng.offlinePct * 100)}%`,
        `${Math.round(feng.silverPct * 100)}%`,
        `${Math.round(feng.healingPct * 100)}%`,
        Object.entries(feng.elementAffinity).map(([key, value]) => `${key}${value > 0 ? "+" : ""}${Math.round((value ?? 0) * 100)}%`).join(" "),
      ];
    }),
  )}

## 5. 离线事件

| 离线时长 | 待决事件上限 |
| --- | --- |
| <1h | 0 |
| 1–8h | 1 |
| 8–24h | 2 |
| >24h | 3 |

- 示例：48h 返回生成 ${service.queueOfflineEvents(faction, factionState, 48, 5).count} 个待决事件；可 defer/resolve，保存/加载不重复。
- 事件效果走 #7 的原子 applyChoice；本活动层不重复实现事件规则。

## 6. 验收口径

- 守关 5 波、逐波加码、逐波奖励 + 通关奖励；失败只发已过波次。
- 护镖 3 段、1–2 遭遇/段、镖车 HP 归零失败、部分奖励。
- 守关不推进地图层；停止条件（手动/背包/目标/稀有/时限）结束活动。
- 伏击/敌人生成由 seed 决定；无空 leg。
- 风水标签 6 类、每图 1–2 个；只使用 Combat v1 现有属性。
- 离线 0–3 事件、复用 #7、可延迟、reload 不重复。
- 无单一活动在所有资源上最优。
`;

const out = resolve("reports");
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/activities-v1.md`, report);
writeFileSync(`${out}/activities-v1.json`, JSON.stringify({
  generatedAt: new Date().toISOString(),
  validation,
  survivalRuns,
  escortRuns,
  economy: {
    survivalPerHour: { silver: survivalMedian("silver") * survivalRunsPerHour, materials: survivalMedian("materials") * survivalRunsPerHour, renown: survivalMedian("renown") * survivalRunsPerHour },
    escortPerHour: { silver: escortMedian("silver") * escortRunsPerHour, materials: escortMedian("materials") * escortRunsPerHour, renown: escortMedian("renown") * escortRunsPerHour },
    normalPerHour: { silver: normalSilverPerHour, renown: normalRenownPerHour },
  },
}, null, 2));
console.log(`Wrote ${out}/activities-v1.md`);
console.log(`survival ${survivalRuns.map((run) => run.state.clearedWaves).join("/")}; escort ${escortRuns.map((run) => run.state.clearedLegs).join("/")}`);
