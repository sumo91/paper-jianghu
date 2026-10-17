import type { BuildId } from "../core/types.ts";
import type {
  CodexEntryDefV1,
  EndgameContentV1,
  LadderOpponentSeedV1,
  LadderStyle,
  TournamentRulesetV1,
} from "../core/endgame.ts";
import type { Element } from "../core/combat-v1.ts";
import { WORLD_CONTENT_V1 } from "./world-v1.ts";
import { FACTION_EVENT_CONTENT } from "./factions-events-v1.ts";
import { COMBAT_CONTENT } from "./combat-v1.ts";
import { COMPANION_CONTENT } from "./companions-v1.ts";

const SURNAMES = [
  "岳", "雷", "沈", "顾", "玄", "无", "陆", "苏", "谢", "雨",
  "陈", "阿", "钱", "黑", "苍", "燕", "柳", "墨", "叶", "白",
];
const GIVEN = ["沧澜", "长风", "青", "临", "十三"];
const FACTIONS = ["faction_wulin", "faction_wudang", "faction_shuyuan", "faction_caobang", "faction_shoumu"];
const TITLES = ["听雨", "断刀", "云外", "孤鸿", "问心", "折梅", "照夜", "沉沙", "归舟", "无咎"];
const BARBS = [
  "你的剑，还差一场雨。",
  "江湖不是擂台，擂台却最像江湖。",
  "我见过你这样的眼神，后来他归隐了。",
  "先手不是快，是知道对方要做什么。",
  "你的名字，我记下了。",
  "别急着赢，先想好怎么输。",
  "这一招我练了十年，你呢？",
  "山高水长，榜上见。",
  "你带的同伴，比你有意思。",
  "输给我，不丢人。",
];
const BUILDS: BuildId[] = ["taiji", "pojun", "xuanyin"];
const STYLES: LadderStyle[] = ["gang", "rou", "kuai", "gui"];
const ELEMENTS: Element[] = ["yin", "yang", "gang", "rou", "taiji"];

function topOpponents(): LadderOpponentSeedV1[] {
  const result: LadderOpponentSeedV1[] = [];
  for (const [surnameIndex, surname] of SURNAMES.entries()) {
    for (const [givenIndex, given] of GIVEN.entries()) {
      const index = surnameIndex * GIVEN.length + givenIndex;
      result.push({
        name: `${surname}${given}`,
        factionId: FACTIONS[index % FACTIONS.length],
        buildId: BUILDS[index % BUILDS.length],
        style: STYLES[index % STYLES.length],
        element: ELEMENTS[index % ELEMENTS.length],
        title: TITLES[index % TITLES.length],
        barb: BARBS[index % BARBS.length],
      });
    }
  }
  return result;
}

const CODEX: CodexEntryDefV1[] = [];

for (const region of WORLD_CONTENT_V1.regions) {
  CODEX.push({ id: `codex_region_${region.id}`, category: "region", title: region.name, sourceHint: "江湖 · 地方志" });
}
for (const map of WORLD_CONTENT_V1.maps) {
  CODEX.push({ id: `codex_map_${map.id}`, category: "map", title: map.name, sourceHint: "第 10 层首领首通" });
}
for (const npc of Object.values(FACTION_EVENT_CONTENT.npcs)) {
  CODEX.push({ id: `codex_npc_${npc.id}`, category: "npc", title: npc.name, sourceHint: `${npc.mapId} · ${npc.role}` });
}
for (const skill of Object.values(COMBAT_CONTENT.skills)) {
  CODEX.push({ id: `codex_art_${skill.id}`, category: "martial_art", title: skill.name, sourceHint: "门派/首领/事件/残页" });
}
for (const art of Object.values(COMBAT_CONTENT.innerArts)) {
  CODEX.push({ id: `codex_inner_${art.id}`, category: "inner_art", title: art.name, sourceHint: "门派/首领/奇遇" });
}
for (const heart of Object.values(COMBAT_CONTENT.hearts)) {
  CODEX.push({ id: `codex_heart_${heart.id}`, category: "heart", title: heart.name, sourceHint: "事件/门派/心法注解" });
}
for (const keystone of Object.values(COMBAT_CONTENT.keystones)) {
  CODEX.push({ id: `codex_keystone_${keystone.id}`, category: "keystone", title: keystone.name, sourceHint: "经脉/事件" });
}
for (const monster of Object.values(WORLD_CONTENT_V1.normals)) {
  CODEX.push({ id: `codex_monster_${monster.id}`, category: "monster", title: monster.name, sourceHint: "地图普通遭遇" });
}
for (const elite of Object.values(WORLD_CONTENT_V1.elites)) {
  CODEX.push({ id: `codex_elite_${elite.id}`, category: "elite", title: elite.name, sourceHint: "地图精英遭遇" });
}
for (const boss of Object.values(WORLD_CONTENT_V1.bosses)) {
  CODEX.push({ id: `codex_boss_${boss.id}`, category: "boss", title: boss.name, sourceHint: "第 10 层首领首通" });
}
for (const event of Object.values(FACTION_EVENT_CONTENT.events)) {
  CODEX.push({ id: `codex_event_${event.id}`, category: "event", title: event.title, sourceHint: "事件链/奇遇" });
}
for (const companion of Object.values(COMPANION_CONTENT.companions)) {
  CODEX.push({ id: `codex_companion_${companion.id}`, category: "companion", title: companion.name, sourceHint: `${companion.region} · 招募` });
}

const ENDINGS = [
  ["ending_lone", "孤身归隐", "独自走完五地区后归隐。"],
  ["ending_wulin", "武林旧盟", "与武林盟走到最后。"],
  ["ending_wudang", "剑在云外", "把剑留在武当金顶。"],
  ["ending_shuyuan", "一字师", "清流书院为你留了一页。"],
  ["ending_caobang", "江湖一船", "漕帮的船灯照到很远。"],
  ["ending_shoumu", "长明不灭", "守墓人记住了你的名字。"],
  ["ending_sword", "天下第一剑", "以剑问鼎天机榜。"],
  ["ending_poison", "蛊中客", "玄阴一脉有了新的传说。"],
  ["ending_guard", "守关人", "你成了别人口中的守关者。"],
  ["ending_open_sect", "开宗", "归隐后留下一个未完成的门派。"],
] as const;
for (const [id, title, sourceHint] of ENDINGS) {
  CODEX.push({ id: `codex_${id}`, category: "ending", title, sourceHint });
}

function tournament(
  id: string,
  name: string,
  description: string,
  cosmeticReward: string,
  modifiers: TournamentRulesetV1["modifiers"],
): TournamentRulesetV1 {
  return { id, name, description, cosmeticReward, modifiers };
}

const TOURNAMENTS: Record<string, TournamentRulesetV1> = {
  tournament_sword: tournament(
    "tournament_sword", "武林大会·剑会",
    "剑法伤害 +20%，治疗效果 -30%；比谁能在无回气的情况下走得更远。",
    "题跋·剑会",
    [
      { id: "tour_sword_damage", name: "剑会·剑意", scope: "player", description: "剑法伤害 +20%", effects: [{ target: "player", stat: "damageDealtPct", mode: "add", value: 0.2 }] },
      { id: "tour_sword_heal", name: "剑会·禁疗", scope: "player", description: "治疗效果 -30%", effects: [{ target: "player", stat: "healingPct", mode: "add", value: -0.3 }] },
    ],
  ),
  tournament_inner: tournament(
    "tournament_inner", "武林大会·内息会",
    "回合回内力 -50%，招架减伤 +10%；比的是资源循环而不是爆发。",
    "题跋·内息",
    [
      { id: "tour_inner_regen", name: "内息会·枯竭", scope: "player", description: "回合回内力 -50%", effects: [{ target: "player", stat: "innerRegen", mode: "scale", value: -0.5 }] },
      { id: "tour_inner_guard", name: "内息会·守中", scope: "player", description: "招架减伤 +10%", effects: [{ target: "player", stat: "guardReduction", mode: "add", value: 0.1 }] },
    ],
  ),
};

export const ENDGAME_CONTENT: EndgameContentV1 = {
  ladderSize: 500,
  topOpponents: topOpponents(),
  nameParts: {
    surnames: SURNAMES,
    givenNames: ["青", "白", "秋", "寒", "行", "舟", "石", "灯", "风", "雪", "远", "归"],
    factions: FACTIONS,
    titles: TITLES,
    barbs: BARBS,
  },
  codex: CODEX,
  tournaments: TOURNAMENTS,
  season: { weeks: 8, softResetPercent: 0.2, softResetPlaces: 100, epochMs: Date.UTC(2026, 0, 1) },
  retire: { requiredRealm: 5, keepArts: 1, keepCompanions: 1, keepTitles: 1 },
  challengeCost: 50,
  tianjiCap: 5000,
};
