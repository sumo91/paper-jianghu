import type {
  CharacterState,
  GearItem,
  GearSlot,
  MapDef,
  RegionId,
  SheetBuild,
} from "../core/types.ts";
import { GEAR_SLOTS, REALM_NAMES } from "../core/types.ts";
import { Rng } from "../core/rng.ts";
import { computeSheet, initialCharacter } from "../core/stats.ts";
import { describeItem, generateItem } from "../core/loot.ts";
import { getBuild } from "../data/builds.ts";
import { getEnemy } from "../data/enemies.ts";
import { getMap, MAPS, REGION_NAMES } from "../data/maps.ts";

export const STYLE_LABELS: Record<string, string> = {
  gang: "刚",
  rou: "柔",
  kuai: "快",
  gui: "诡",
};

export const SLOT_LABELS: Record<GearSlot, string> = {
  weapon: "兵器",
  head: "头冠",
  body: "衣袍",
  wrist: "护腕",
  feet: "鞋履",
  jade: "玉佩",
};

export const MOVE_TYPE_LABELS: Record<string, string> = {
  shi: "实",
  xu: "虚",
  jia: "架",
  qi: "气",
};

export const ELEMENT_LABELS: Record<string, string> = {
  yin: "阴",
  yang: "阳",
  gang: "刚",
  rou: "柔",
  taiji: "太极",
};

export interface RegionUi {
  id: RegionId;
  name: string;
  theme: string;
  conflict: string;
  flavor: string;
  faction: string;
  rival: string;
  npcs: string[];
  /** Hotspot centre, as a percentage of the map image. */
  x: number;
  y: number;
  /** Current-location marker, as a percentage of the map image. */
  mx: number;
  my: number;
}

export const REGIONS: RegionUi[] = [
  {
    id: "zhongyuan",
    name: "中原",
    theme: "天下之名",
    conflict: "武林盟 vs 朝廷鹰犬",
    flavor: "擂台上的胜负会被整个江湖记住。",
    faction: "武林盟",
    rival: "朝廷鹰犬",
    npcs: ["盟主·岳沧澜", "擂主·雷震", "捕头·沈青"],
    x: 5.2,
    y: 14.8,
    mx: 7.8,
    my: 28.5,
  },
  {
    id: "wudang",
    name: "武当",
    theme: "剑与道",
    conflict: "守旧道门 vs 入世剑宗",
    flavor: "云海之上，剑意比香火更先抵达。",
    faction: "武当",
    rival: "入世剑宗",
    npcs: ["执剑长老·玄微", "剑冢老人·无咎", "顾长风"],
    x: 88.9,
    y: 14.1,
    mx: 84.5,
    my: 13.0,
  },
  {
    id: "xihu",
    name: "西湖",
    theme: "人情与风雅",
    conflict: "世家联姻 vs 书院清流",
    flavor: "烟雨里的每一句寒暄，都可能是一封战书。",
    faction: "清流书院",
    rival: "四大世家",
    npcs: ["山长·陆清和", "画舫主人·苏晚", "世家少主·谢临"],
    x: 23.1,
    y: 64.2,
    mx: 23.5,
    my: 73.0,
  },
  {
    id: "yangzhou",
    name: "扬州",
    theme: "钱与消息",
    conflict: "漕帮 vs 盐商商会",
    flavor: "码头上的货船，比江湖上的传言更早抵达。",
    faction: "漕帮",
    rival: "盐商商会",
    npcs: ["舵主·陈四海", "船娘·阿沅", "盐商·钱万金"],
    x: 55.3,
    y: 63.1,
    mx: 50.1,
    my: 71.8,
  },
  {
    id: "hanyue",
    name: "汉越墓",
    theme: "禁地与古谱",
    conflict: "守墓人 vs 盗墓者",
    flavor: "地宫里的剑，已经等了太多年。",
    faction: "守墓人",
    rival: "盗墓者",
    npcs: ["苍伯", "无面", "墓中剑灵"],
    x: 84.0,
    y: 72.3,
    mx: 80.5,
    my: 78.0,
  },
];

export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<
  RegionId,
  RegionUi
>;

export function mapsForRegion(region: RegionId): MapDef[] {
  return MAPS.filter((map) => map.region === region);
}

export function makeSnapshotCharacter(): CharacterState {
  const character = initialCharacter("taiji");
  character.level = 46;
  character.realm = 5;
  character.layer = 1;
  character.xp = 18420;
  character.silver = 323511;
  character.renown = 31560;
  character.refineLevel = 6;
  character.companionBond = 8;
  character.innerArtLevel = 8;
  character.artMastery = 6;

  const rng = new Rng(20261018);
  const map = getMap("zhumu");
  const rarities = ["divine", "peerless", "peerless", "superb", "peerless", "superb"] as const;
  let rarityIndex = 0;
  for (const slot of GEAR_SLOTS) {
    let guard = 0;
    while (!character.gear[slot] && guard < 30) {
      const item = generateItem(map, 10, "boss", "taiji", rng, rarities[rarityIndex % rarities.length], true);
      rarityIndex += 1;
      if (item.slot === slot) character.gear[slot] = item;
      guard += 1;
    }
  }
  return character;
}

export interface RecentLoot {
  item: GearItem;
  description: string;
}

export function makeRecentLoot(): RecentLoot[] {
  const rng = new Rng(706);
  const map = getMap("heishi");
  return Array.from({ length: 5 }, (_, index) => {
    const item = generateItem(
      map,
      8,
      index < 2 ? "elite" : "normal",
      "taiji",
      rng,
      index === 0 ? "peerless" : "superb",
      false,
    );
    return { item, description: describeItem(item) };
  });
}

export interface FactionRep {
  name: string;
  region: string;
  level: string;
  value: number;
  tone: "jade" | "gold" | "red" | "ink";
}

const character = makeSnapshotCharacter();
const sheet: SheetBuild = computeSheet(character);
const build = getBuild("taiji");
const currentMap = getMap("heishi");
const currentLayer = 8;

export const GAME = {
  character,
  sheet,
  build,
  currentMap,
  currentLayer,
  currentRegion: REGION_BY_ID.yangzhou,
  recentLoot: makeRecentLoot(),
  resources: {
    silver: character.silver,
    cultivation: 4820,
    renown: character.renown,
    rank: 48,
  },
  farm: {
    region: "扬州",
    map: currentMap.name,
    layer: currentLayer,
    elapsed: "2h 13m",
    fights: 84,
    wins: 78,
    silver: 12840,
    pages: 3,
    goal: "分筋错骨手残页 3 / 10",
  },
  companions: [
    { name: "柳青", role: "医女", bond: 8, assist: "回春：恢复气血并解一个负面" },
    { name: "顾长风", role: "剑客", bond: 5, assist: "剑鸣：下一次剑招伤害 +20%" },
  ],
  titles: ["听雨剑客", "太极传人", "扬州漕帮·真传"],
  innerArt: "纯阳无极功",
  goals: [
    { label: "突破传说", value: "修为 18,420 / 32,000", progress: 0.58, note: "还需完成「天机问心」" },
    { label: "天机榜", value: "#48 → #32", progress: 0.74, note: "下一名：听雨楼主·柳三变" },
    { label: "太极套", value: "4 / 4", progress: 1, note: "四件套已激活：招架反伤" },
  ],
  factions: [
    { name: "漕帮", region: "扬州", level: "崇拜", value: 0.92, tone: "jade" as const },
    { name: "武林盟", region: "中原", level: "敬重", value: 0.72, tone: "gold" as const },
    { name: "武当", region: "武当", level: "友善", value: 0.54, tone: "ink" as const },
    { name: "清流书院", region: "西湖", level: "友善", value: 0.48, tone: "ink" as const },
    { name: "守墓人", region: "汉越墓", level: "相识", value: 0.26, tone: "red" as const },
  ],
  letters: [
    { from: "柳青", title: "药庐的灯还亮着", time: "昨夜", unread: true },
    { from: "漕帮·陈四海", title: "码头来了一批不该来的货", time: "今晨", unread: true },
    { from: "武当·玄微", title: "剑冢有一封你的旧信", time: "三日前", unread: false },
  ],
  mapStats: {
    heishi: {
      map: currentMap,
      monsters: [
        ...currentMap.enemyIds.map((id) => getEnemy(id)),
        getEnemy(currentMap.eliteId),
        getEnemy(currentMap.bossId),
      ],
      drops: ["分筋错骨手残页", "流云袖残页", "玄铁", "听雨佩", "稀有材料"],
      modifiers: ["黑市规矩：无法逃走", "无光：命中 -8%", "漕帮巡逻：精英出现率提高"],
    },
  },
  regionMaps: mapsForRegion("yangzhou"),
  realmName: REALM_NAMES[character.realm],
  styleLabels: STYLE_LABELS,
  slotLabels: SLOT_LABELS,
  moveTypeLabels: MOVE_TYPE_LABELS,
  elementLabels: ELEMENT_LABELS,
  gearSlots: GEAR_SLOTS,
};

export const MAP_DROPS: Record<RegionId, string[]> = {
  zhongyuan: ["破军刀法残页", "铁布衫残页", "名望", "刀 / 拳套", "突破材料"],
  wudang: ["太极剑残页", "纯阳无极功残页", "剑", "内功秘籍", "玄铁"],
  xihu: ["落英剑法残页", "听雨心法残页", "玉佩", "柔装", "画舫信物"],
  yangzhou: ["分筋错骨手残页", "流云袖残页", "银两", "暗器", "稀有材料"],
  hanyue: ["玄阴经残页", "封穴手残页", "古谱", "稀有材料", "绝装"],
};

export const ACTIVITY_TITLES: Record<RegionId, string> = {
  zhongyuan: "擂台下的看客，已经换过三拨",
  wudang: "云海翻涌，金顶的钟声比剑意更先到",
  xihu: "画舫上有人弹起旧曲，雨还没有停",
  yangzhou: "听雨楼里，有人说起了武当的旧事",
  hanyue: "地宫的灯又灭了一盏，深处有剑鸣",
};

export const MAP_MODIFIERS: Record<string, string[]> = {
  luoyang: ["车轮战：连续挑战不回复", "点到为止：气血低于 10% 自动退场"],
  caoyun: ["湿货：身法 -8%", "漕帮巡逻：精英出现率提高"],
  huanghe: ["风急：轻功效果 -10%", "落水：气血上限临时降低"],
  jinding: ["云海：命中 -8%", "剑阵：剑法伤害 +15%"],
  duanqiao: ["烟雨：柔属性 +10%", "湿滑：身法判定更严"],
  yanchang: ["烈日：内力回复 -10%", "盐毒：每回合损失气血"],
  biaoju: ["劫镖：首领提前出现", "夜行：会心 +10%"],
  jiejianchi: ["禁兵：兵器加成降低", "剑意：招架成功反击"],
  huxinting: ["雅集：声望获取 +15%", "暗流：NPC 态度变化"],
  heishi: ["黑市规矩：无法逃走", "无光：命中 -8%", "漕帮巡逻：精英出现率提高"],
  jianzhong: ["剑气：每 3 回合受一次剑伤", "失魂：控制抗性提高"],
  gushan: ["梅雨：持续伤害 +10%", "迷阵：先手判定随机"],
  mudao: ["墓毒：治疗效果 -20%", "阴气：阴属性伤害 +15%"],
  digong: ["机关：每 4 回合触发陷阱", "塌方：气血上限降低"],
  zhumu: ["诅咒：复活/治疗受限", "剑阵：首领获得护体"],
};

export function enemiesForMap(map: MapDef) {
  return [...map.enemyIds, map.eliteId, map.bossId].map((id) => getEnemy(id));
}
