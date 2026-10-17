import type { ActivityContentV1, FengShuiTag } from "../core/activities.ts";
import { WORLD_CONTENT_V1 } from "./world-v1.ts";

const WAVES: ActivityContentV1["waves"] = [
  { wave: 1, objective: "clear", levelOffset: 0, pressure: 1, reward: { silver: 80, materials: 2, renown: 2 } },
  { wave: 2, objective: "clear", levelOffset: 2, pressure: 1.15, reward: { silver: 120, materials: 3, renown: 3 } },
  { wave: 3, objective: "clear", levelOffset: 4, pressure: 1.3, reward: { silver: 180, materials: 5, renown: 5 } },
  { wave: 4, objective: "survive", levelOffset: 6, surviveRounds: 8, pressure: 1.45, reward: { silver: 250, materials: 8, renown: 8 } },
  { wave: 5, objective: "survive", levelOffset: 8, surviveRounds: 10, pressure: 1.6, reward: { silver: 350, materials: 12, renown: 12 } },
];

const LEGS: ActivityContentV1["legs"] = [
  { leg: 1, encounters: 1, ambushChance: 0.3, cartHp: 100, levelOffset: 1, reward: { silver: 100, materials: 4, renown: 4 } },
  { leg: 2, encounters: 2, ambushChance: 0.45, cartHp: 90, levelOffset: 3, reward: { silver: 180, materials: 8, renown: 8 } },
  { leg: 3, encounters: 2, ambushChance: 0.6, cartHp: 80, levelOffset: 5, finalBoss: true, reward: { silver: 300, materials: 15, renown: 15 } },
];

const TAGS: Record<FengShuiTag, ActivityContentV1["tagEffects"][FengShuiTag]> = {
  mountain: { cultivationPct: 0.2, offlinePct: 0.05, elementAffinity: { taiji: 0.1, yang: 0.1 } },
  forest: { cultivationPct: 0.15, offlinePct: 0.05, elementAffinity: { rou: 0.1, yin: 0.05 } },
  water: { cultivationPct: 0.08, offlinePct: 0.1, elementAffinity: { rou: 0.15, yin: 0.15, gang: -0.1 } },
  cave: { cultivationPct: 0.2, offlinePct: 0.1, healingPct: -0.15, elementAffinity: { yin: 0.15 } },
  snow: { cultivationPct: 0.18, offlinePct: 0.05, elementAffinity: { yang: 0.1, gang: 0.1 } },
  market: { cultivationPct: -0.05, offlinePct: 0.15, silverPct: 0.2, elementAffinity: {} },
};

const MAP_TAGS: Record<string, FengShuiTag[]> = {
  luoyang: ["mountain", "market"],
  huanghe: ["water", "mountain"],
  biaoju: ["forest", "mountain"],
  jinding: ["mountain", "snow"],
  jiejianchi: ["water", "mountain"],
  jianzhong: ["forest", "cave"],
  duanqiao: ["water", "market"],
  huxinting: ["water", "market"],
  gushan: ["forest", "water"],
  caoyun: ["water", "market"],
  yanchang: ["market", "water"],
  heishi: ["market", "cave"],
  mudao: ["cave"],
  digong: ["cave"],
  zhumu: ["cave", "snow"],
};

for (const map of WORLD_CONTENT_V1.maps) {
  if (!MAP_TAGS[map.id]) MAP_TAGS[map.id] = ["mountain"];
}

export const ACTIVITY_CONTENT: ActivityContentV1 = {
  mapIds: WORLD_CONTENT_V1.maps.map((map) => map.id),
  waves: WAVES,
  legs: LEGS,
  mapTags: MAP_TAGS,
  tagEffects: TAGS,
  survivalClearBonus: { silver: 500, materials: 25, renown: 30 },
  escortClearBonus: { silver: 450, materials: 30, renown: 25 },
  offlineEventCap: 3,
};
