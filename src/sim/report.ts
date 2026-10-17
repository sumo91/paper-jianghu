import { writeFileSync } from "node:fs";
import type { AggregateReport, BuildAggregate } from "./aggregate.ts";
import type { SimResult } from "../core/types.ts";
import { REALM_NAMES } from "../core/types.ts";
import { csvForResults, STYLE_NAMES } from "./aggregate.ts";

const COLORS: Record<string, string> = {
  taiji: "#2F6252",
  pojun: "#A83A2D",
  xuanyin: "#3E6A86",
};

function fmt(value: number, digits = 1): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function table(headers: string[], rows: Array<Array<string | number>>): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function lineChart(
  title: string,
  labels: string[],
  series: Array<{ name: string; color: string; values: number[] }>,
  yMax: number,
  yLabel: string,
): string {
  const width = 960;
  const height = 410;
  const left = 64;
  const right = 28;
  const top = 82;
  const bottom = 54;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const x = (index: number) => left + (labels.length <= 1 ? 0 : (index / (labels.length - 1)) * plotW);
  const y = (value: number) => top + plotH - (value / Math.max(1, yMax)) * plotH;
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const gy = top + plotH * (1 - ratio);
      return `<line x1="${left}" y1="${gy}" x2="${width - right}" y2="${gy}" stroke="#E5DCCB" stroke-width="1"/>` +
        `<text x="${left - 10}" y="${gy + 4}" text-anchor="end" font-size="11" fill="#6E756D">${Math.round(yMax * ratio)}</text>`;
    })
    .join("");
  const xLabels = labels
    .map((label, index) => `<text x="${x(index)}" y="${height - 20}" text-anchor="middle" font-size="11" fill="#5F6B64">${label}</text>`)
    .join("");
  const paths = series
    .map((s) => {
      const points = s.values
        .map((value, index) => `${x(index)},${y(value)}`)
        .join(" ");
      const dots = s.values
        .map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="3.2" fill="${s.color}"/>`)
        .join("");
      return `<polyline points="${points}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
    })
    .join("");
  const legend = series
    .map((s, i) => `<circle cx="${left + 4 + i * 128}" cy="58" r="4" fill="${s.color}"/><text x="${left + 14 + i * 128}" y="62" font-size="12" fill="#1F3A32">${s.name}</text>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#FBF7EC"/>
  <text x="${left}" y="22" font-size="16" font-weight="700" fill="#1F3A32">${title}</text>
  <text x="${left}" y="40" font-size="11" fill="#6E756D">${yLabel}</text>
  ${legend}
  ${grid}
  <line x1="${left}" y1="${top + plotH}" x2="${width - right}" y2="${top + plotH}" stroke="#8A7A5B" stroke-width="1"/>
  ${xLabels}
  ${paths}
</svg>`;
}

function barChartWinRate(builds: BuildAggregate[]): string {
  const width = 960;
  const height = 440;
  const left = 64;
  const right = 24;
  const top = 72;
  const bottom = 60;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const styles = Object.keys(STYLE_NAMES);
  const groupW = plotW / styles.length;
  const barW = Math.min(44, (groupW - 24) / builds.length);
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const gy = top + plotH * (1 - ratio);
      return `<line x1="${left}" y1="${gy}" x2="${width - right}" y2="${gy}" stroke="#E5DCCB"/>` +
        `<text x="${left - 10}" y="${gy + 4}" text-anchor="end" font-size="11" fill="#6E756D">${Math.round(ratio * 100)}%</text>`;
    })
    .join("");
  const bars = styles
    .map((style, styleIndex) => {
      const groupX = left + styleIndex * groupW + groupW / 2;
      const group = builds
        .map((build, buildIndex) => {
          const value = build.winRateByStyle[style] ?? 0;
          const barH = value * plotH;
          const bx = groupX - (builds.length * barW) / 2 + buildIndex * barW;
          return `<rect x="${bx}" y="${top + plotH - barH}" width="${barW - 4}" height="${barH}" fill="${COLORS[build.buildId] ?? "#555"}" opacity="0.9"/>` +
            `<text x="${bx + (barW - 4) / 2}" y="${top + plotH - barH - 6}" text-anchor="middle" font-size="10" fill="#1F3A32">${Math.round(value * 100)}</text>`;
        })
        .join("");
      return group + `<text x="${groupX}" y="${height - 24}" text-anchor="middle" font-size="13" fill="#1F3A32">${STYLE_NAMES[style]}</text>`;
    })
    .join("");
  const legend = builds
    .map((build, i) => `<rect x="${left + i * 148}" y="42" width="12" height="12" fill="${COLORS[build.buildId] ?? "#555"}"/><text x="${left + 18 + i * 148}" y="52" font-size="12" fill="#1F3A32">${build.buildName}</text>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#FBF7EC"/>
  <text x="${left}" y="20" font-size="16" font-weight="700" fill="#1F3A32">按敌人行为流派的胜率</text>
  ${legend}
  ${grid}
  ${bars}
</svg>`;
}

function writeCharts(aggregate: AggregateReport, outDir: string, prefix: string): void {
  const labels = aggregate.builds[0]?.snapshots.map((s) => `${s.hours}h`) ?? [];
  const levelSeries = aggregate.builds.map((build) => ({
    name: build.buildName,
    color: COLORS[build.buildId] ?? "#555",
    values: build.snapshots.map((s) => s.level),
  }));
  const gearSeries = aggregate.builds.map((build) => ({
    name: build.buildName,
    color: COLORS[build.buildId] ?? "#555",
    values: build.snapshots.map((s) => s.gearScore),
  }));
  const levelMax = 63;
  const gearMax = Math.max(50, Math.ceil(Math.max(...gearSeries.flatMap((s) => s.values)) / 50) * 50);
  writeFileSync(`${outDir}/${prefix}-level.svg`, lineChart("等级曲线：中位数（3 seeds）", labels, levelSeries, levelMax, "等级"));
  writeFileSync(`${outDir}/${prefix}-gear.svg`, lineChart("装备评分曲线：中位数（3 seeds）", labels, gearSeries, gearMax, "装备评分"));
  writeFileSync(`${outDir}/${prefix}-winrate.svg`, barChartWinRate(aggregate.builds));
}

function buildRealmRows(build: BuildAggregate): string[] {
  return Array.from({ length: 6 }, (_, i) => {
    const realm = i + 1;
    const time = build.realmMedian[String(realm)];
    const reached = build.realmReached[String(realm)] ?? 0;
    return `${time === null ? "—" : `${fmt(time)}h`} (${reached}/${build.runs})`;
  });
}

function buildReport(aggregate: AggregateReport, prefix: string): string {
  const builds = aggregate.builds;
  const byLevel = [...builds].sort((a, b) => b.medianLevel - a.medianLevel);
  const fastest = byLevel[0];
  const slowest = byLevel[byLevel.length - 1];
  const levelGap = fastest.medianLevel > 0
    ? (fastest.medianLevel - slowest.medianLevel) / fastest.medianLevel
    : 0;
  const maxFph = Math.max(...builds.map((b) => b.fightsPerHour));
  const minFph = Math.min(...builds.map((b) => b.fightsPerHour));
  const speedGap = minFph > 0 ? maxFph / minFph : 0;
  const tank = builds.find((b) => b.buildId === "taiji");
  const glass = builds.find((b) => b.buildId === "pojun");
  const control = builds.find((b) => b.buildId === "xuanyin");
  const totalFinalGear = builds.reduce(
    (sum, build) => sum + Object.values(build.rarityCounts).reduce((a, b) => a + b, 0),
    0,
  );

  const finalRows = builds.map((b) => [
    b.buildName,
    fmt(b.medianLevel, 0),
    `${b.medianRealm} · ${REALM_NAMES[Math.floor(b.medianRealm)] ?? "—"}`,
    fmt(b.medianGearScore, 0),
    fmt(b.medianFights, 0),
    fmt(b.medianLosses, 0),
    pct(b.medianWinRate),
    fmt(b.medianRounds, 1),
    fmt(b.medianStall, 1),
    `${fmt(b.medianMaxTier, 0)} 图 / ${fmt(b.medianMaxLayer, 0)} 层`,
  ]);
  const realmRows = builds.map((b) => [
    b.buildName,
    ...Array.from({ length: 6 }, (_, i) => {
      const realm = i + 1;
      const time = b.realmMedian[String(realm)];
      const reached = b.realmReached[String(realm)] ?? 0;
      return `${time === null ? "—" : `${fmt(time)}h`} (${reached}/${b.runs})`;
    }),
  ]);
  const efficiencyRows = builds.map((b) => [
    b.buildName,
    fmt(b.fightsPerHour, 1),
    fmt(b.medianRounds, 1),
    fmt(b.medianSilver, 0),
    fmt(b.medianRenown, 0),
    Object.entries(b.rarityCounts).map(([rarity, count]) => `${rarity}:${count}`).join(" "),
    b.survivalFights > 0
      ? `${pct(b.survivalShare)} / ${pct(b.survivalWinRate)}`
      : "—",
  ]);
  const styleRows = builds.map((b) => [
    b.buildName,
    ...Object.keys(STYLE_NAMES).map((style) => `${pct(b.winRateByStyle[style] ?? 0)} (${b.fightsByStyle[style] ?? 0})`),
  ]);

  const findings: string[] = [];
  findings.push(
    `**玄阴没有追上。** 100h 中位等级：${builds.map((b) => `${b.buildName} ${fmt(b.medianLevel, 0)}`).join(" / ")}；等级差 ${fmt(levelGap * 100, 1)}%。${slowest.buildName}仍在最后，而且 100h 停在 ${control ? `${fmt(control.medianRealm, 0)} 境` : "—"}；只补气血/毒减伤没有解决它的核心问题。`,
  );
  findings.push(
    `**守关把太极推到了第一。** 太极守关占比 ${tank ? pct(tank.survivalShare) : "—"}，守关胜率 ${tank ? pct(tank.survivalWinRate) : "—"}，中位等级 ${tank ? fmt(tank.medianLevel, 0) : "—"}；它达到宗师 ${tank?.realmMedian["5"] ? `${fmt(tank.realmMedian["5"])}h` : "—"}。方向成立，但守关的 XP 权重可能偏高，下一步要把收益从“等级”挪到“装备/声望”。`,
  );
  findings.push(
    `**破军被压过头了。** 破军从 v0.2 的 48 级/宗师掉到 ${glass ? fmt(glass.medianLevel, 0) : "—"} 级/${glass ? `${fmt(glass.medianRealm, 0)} 境` : "—"}，总失败中位 ${glass ? fmt(glass.medianLosses, 0) : "—"} 场、近期胜率 ${glass ? pct(glass.medianWinRate) : "—"}。反震、装备门槛和试炼叠加在一起，惩罚超过了它的收益；“快”没有变成“有代价”，而是“被卡住”。`,
  );
  findings.push(
    `**试炼感悟是这轮最该保留的系统。** 破军和玄阴都曾在境界门口硬锁；试炼难度随失败下降后，曲线才重新动起来。它没有掩盖 build 差距，但避免了“一个 build 永远无法进入下一境”的死局。`,
  );
  findings.push(
    `**装备门槛生效，但长线仍不够。** 终局装备样本 ${totalFinalGear} 件中，破军已经只到上/绝、没有神装；太极和玄阴仍有较多神/绝。神装不能再靠普通首领刷，应该绑到深层首通、天机榜或武林大会。`,
  );
  findings.push(
    `**激进 bot 让问题更明显。** 当前策略是 3 连胜推层、层数上限为本境等级 +4、连败 4 次才退；近期胜率约 ${builds.map((b) => `${b.buildName} ${pct(b.medianWinRate)}`).join(" / ")}。这比 v0.1 的保守策略更接近“玩家会去试上限”，但仍不是极限打法。`,
  );

  const actions = [
    "**玄阴要重做，不是再加一点血**：把毒层做成“护体/回复/控制命中”的资源，或者给玄阴一个独立的控制/消耗玩法；只加 HP/防御已经被证明不够。",
    "**破军要回调，不是继续削**：反震从 8% 降到 4% 左右，或只在高阶层数生效；中阶装备门槛放宽一点，让破军能在 100h 内重新摸到宗师，但不要再回到 48 级一枝独秀。",
    "**太极的守关收益要从等级挪到装备/声望**：守关应成为坦系的“补装备/补声望”活动，而不是最快升级路径；否则它会把排行榜又拉成单极。",
    "**装备长线化**：保留 5 图/9 层的神装门槛；把传奇效果绑到深层首通、天机榜、武林大会，普通首领只出绝/上。",
    "**守关扩成真正的玩法**：从“撑 20 回合”扩成波次、护镖、守山门；让坦系有可展示的独立目标，而不是一个隐藏奖励。",
    "**暂不扩内容**：先把 3 套 build 的曲线跑平；当前问题都是系统问题，加事件/地图不会解决。",
  ];

  const caveats = [
    "只有 3 套 build；自动优先级是硬编码启发式，不是玩家真实决策。",
    "守关目前是“打不死的守关者 + 撑满 20 回合”，不是波次/护镖；它可以被纯防御策略利用。",
    "装备自动穿最优、自动淬炼、无套装收集选择；传奇效果仍未进入战斗（只有套装 2/4 件）。",
    "没有门派/声望/事件/同伴个人任务的长期影响；同伴只作为战斗被动的来源。",
    "战斗是回合制抽象：没有走位、控制链、驱散、属性抗性、首领多阶段机制；首领只有 50% 狂暴与 18% 单回合伤害封顶。",
    "机器人连续在线 100h、无操作损耗；真人会慢很多，所以曲线是“上限参考”，不是玩家日历。",
    "奖励按每场结算并加回合系数，不是真正的时间收益模型；这是 v0.3 的过渡方案。",
    "突破试炼失败会降难度；它避免硬锁，但也可能让“卡境界”的压力低于设计意图。",
  ];

  return `# 《一纸江湖》平衡模拟 v${aggregate.version}

> 生成时间：${aggregate.generatedAt}  
> 规模：${builds.length} 套 build × ${aggregate.seeds.length} seeds × ${aggregate.hours}h 连续模拟  
> 策略：${aggregate.policy} bot（3 连胜推层 / 本境等级 +4 上限 / 4 连败退层）  
> 模型：${aggregate.version} · 自动战斗 / 守关 / 反震 / 自动升级 / 自动装备 / 自动突破  
> 原始数据：\`${prefix}.json\`、\`${prefix}.csv\`

## 0. 先说结论

v0.3 的目标是“把玄阴拉回来，同时不把破军放出来”。结果只做到一半：**玄阴没有追上来，破军被反震/装备门槛/试炼压过头，只有太极稳定在宗师。** 这轮修好了“卡死”，但没有修好“谁最强”。

- 100h 中位等级：${builds.map((b) => `**${b.buildName} ${fmt(b.medianLevel, 0)}**`).join(" / ")}
- 最快/最慢刷图效率：**${fmt(speedGap, 2)}×**
- 太极守关占比：**${tank ? pct(tank.survivalShare) : "—"}**；守关胜率 **${tank ? pct(tank.survivalWinRate) : "—"}**
- 当前判断：**v0.3 没有通过验收。** 保留试炼感悟与装备门槛；下一轮不要继续加码削破军，而要重做玄阴的输出/保命结构，并把反震从“纯惩罚”改成“有应对的机制”。

## 1. 方法与本版改动

- 3 套 build：太极反伤、破军爆发、玄阴封穴。
- 3 个随机种子（${aggregate.seeds.join(", ")}），每套连续模拟 ${aggregate.hours} 小时。
- **奖励归一化**：单场 XP/银两乘以 \`1 + 0.02 × 回合数\`；装备掉率也随回合小幅提高。
- **守关**：太极每 5 场进入一次“撑满 20 回合”的守关；其他 build 不打守关。守关给 XP/银两/声望/装备，但不推进地图层。
- **反爆发**：首领获得“单回合伤害不超过最大气血 18%”的护体；反震 8% 伤害，但单次反震最多扣 3% 气血。
- **装备掉率**：普通/精英/首领全面下调；神装要求“首领 + 5 图以上 + 9 层以上”，绝装要求 3 图以上，避免早期满稀有。
- **试炼感悟**：连续突破失败会降低下一次试炼难度（最多 5 层），防止任何 build 被硬锁在境界门口。
- **玄阴修复**：基础气血/防御上调，毒经提供“按毒层减伤”。结果证明只补生存不够，它还需要输出/控制命中或独立活动。
- **机器人**：激进策略，3 连胜推层，层数上限为本境等级 +4，4 连败退层；v0.1 的保守策略结果仍保留在 [balance-v0.1.md](balance-v0.1.md)。
- 单场时间：10s + 2s × 回合数；首领额外 20s。这个时间只影响“每小时能打多少场”，不影响单场胜负。
- 限制：没有真人操作、事件/门派/同伴任务、走位与驱散、传奇效果；这是系统骨架测试。

## 2. 关键里程碑

${table(
    ["Build", "三流", "二流", "一流", "绝顶", "宗师", "传说"],
    realmRows,
  )}

> 格式：中位到达时间（到达人数 / 总 runs）。3 seeds 下，“—”表示没有种子到达该境界。

## 3. 100h 终局

${table(
    ["Build", "中位等级", "境界", "装备评分", "总场次", "总败场", "近期胜率", "平均回合", "最长停滞", "最高地图"],
    finalRows,
  )}

## 4. 刷图效率、产出与守关

${table(
    ["Build", "场次/小时", "平均回合", "银两", "名望", "终局稀有度（runs × 槽）", "守关占比 / 胜率"],
    efficiencyRows,
  )}

**解读**：场次/小时 × 每场奖励 = 实际成长速度；回合系数补偿了慢 build 的每场收益。守关是太极的独立收益来源，但它不应变成“唯一最优挂机点”。

## 5. 按敌人行为流派的胜率

${table(
    ["Build", "刚", "柔", "快", "诡"],
    styleRows,
  )}

> 括号内是该流派在全部 run 中的总样本场次；这是整段 100h 的总胜率，不是最近 50 场。

## 6. 曲线

![等级曲线](${prefix}-level.svg)

![装备评分](${prefix}-gear.svg)

![按流派胜率](${prefix}-winrate.svg)

## 7. 发现

${findings.map((item, i) => `${i + 1}. ${item}`).join("\n")}

## 8. 下一轮调整建议（按优先级）

${actions.map((item, i) => `${i + 1}. ${item}`).join("\n")}

## 9. 模型边界

${caveats.map((item) => `- ${item}`).join("\n")}

## 10. 数据说明

- \`${prefix}.json\`：完整聚合与每次 run 的终局/快照。
- \`${prefix}.csv\`：每次 run 的终局摘要。
- v0.2 基线：[balance-v0.2.md](balance-v0.2.md)；v0.1 基线：[balance-v0.1.md](balance-v0.1.md)。
- 本报告中的所有时间都是**连续模拟小时**，不是玩家日历；真人每天 1–2 小时，体感会慢 5–10 倍。
- 下一轮先改系统，再改内容；不要用更多事件去掩盖结构问题。
`;
}

export function writeReport(
  outDir: string,
  aggregate: AggregateReport,
  results: SimResult[],
  prefix = "balance-v0.3",
): string {
  writeCharts(aggregate, outDir, prefix);
  writeFileSync(`${outDir}/${prefix}.json`, JSON.stringify({ aggregate, runs: results }, null, 2));
  writeFileSync(`${outDir}/${prefix}.csv`, csvForResults(results));
  const report = buildReport(aggregate, prefix);
  writeFileSync(`${outDir}/${prefix}.md`, report);
  return report;
}
