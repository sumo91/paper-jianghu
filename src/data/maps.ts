import type { MapDef } from "../core/types.ts";

function map(
  id: string,
  name: string,
  region: MapDef["region"],
  tier: number,
  unlockRealm: number,
  enemyIds: string[],
  eliteId: string,
  bossId: string,
): MapDef {
  return { id, name, region, tier, unlockRealm, enemyIds, eliteId, bossId };
}

export const MAPS: MapDef[] = [
  map("luoyang", "洛阳擂台", "zhongyuan", 1, 0, ["e_gang_blade", "e_gang_brawler", "e_rou_sword"], "e_elite_gold", "boss_lei"),
  map("caoyun", "漕运码头", "yangzhou", 1, 0, ["e_gang_blade", "e_kuai_thief", "e_gui_water"], "e_elite_river", "boss_chen"),
  map("huanghe", "黄河渡口", "zhongyuan", 2, 1, ["e_kuai_thief", "e_gui_water", "e_rou_sword"], "e_elite_river", "boss_he"),
  map("jinding", "武当金顶", "wudang", 2, 1, ["e_rou_sword", "e_rou_guard", "e_kuai_assassin"], "e_elite_sword", "boss_xuanwei"),
  map("duanqiao", "西湖断桥", "xihu", 2, 1, ["e_kuai_thief", "e_gui_water", "e_rou_sword"], "e_elite_court", "boss_lake"),
  map("yanchang", "扬州盐场", "yangzhou", 2, 1, ["e_gang_blade", "e_gui_water", "e_kuai_thief"], "e_elite_gold", "boss_qian"),
  map("biaoju", "镖局古道", "zhongyuan", 3, 2, ["e_gang_blade", "e_gang_brawler", "e_kuai_assassin"], "e_elite_gold", "boss_heifeng"),
  map("jiejianchi", "解剑池", "wudang", 3, 2, ["e_rou_sword", "e_kuai_assassin", "e_rou_guard"], "e_elite_sword", "boss_swordpool"),
  map("huxinting", "湖心亭", "xihu", 3, 2, ["e_rou_guard", "e_kuai_assassin", "e_gui_water"], "e_elite_court", "boss_xie"),
  map("heishi", "黑市", "yangzhou", 3, 2, ["e_kuai_assassin", "e_gui_water", "e_gang_brawler"], "e_elite_court", "boss_blackmarket"),
  map("jianzhong", "后山剑冢", "wudang", 4, 3, ["e_rou_sword", "e_gui_puppet", "e_kuai_assassin"], "e_elite_sword", "boss_swordtomb"),
  map("gushan", "孤山梅林", "xihu", 4, 3, ["e_kuai_assassin", "e_gui_water", "e_rou_sword"], "e_elite_court", "boss_meilin"),
  map("mudao", "汉越墓道", "hanyue", 4, 3, ["e_gui_puppet", "e_gui_cultivator", "e_rou_guard"], "e_elite_tomb", "boss_tombgeneral"),
  map("digong", "地宫", "hanyue", 5, 4, ["e_gui_puppet", "e_gui_cultivator", "e_kuai_assassin"], "e_elite_tomb", "boss_stoneking"),
  map("zhumu", "主墓", "hanyue", 6, 5, ["e_gui_puppet", "e_gui_cultivator", "e_rou_sword"], "e_elite_tomb", "boss_yuewang"),
];

export const MAPS_BY_ID: Record<string, MapDef> = Object.fromEntries(
  MAPS.map((m) => [m.id, m]),
);

export function getMap(id: string): MapDef {
  const found = MAPS_BY_ID[id];
  if (!found) throw new Error(`Unknown map: ${id}`);
  return found;
}

export const REGION_NAMES: Record<MapDef["region"], string> = {
  zhongyuan: "中原",
  wudang: "武当",
  xihu: "西湖",
  yangzhou: "扬州",
  hanyue: "汉越墓",
};
