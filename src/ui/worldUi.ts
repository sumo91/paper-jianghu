import type { RegionId } from "../core/types.ts";
import type { WorldMapDefV1 } from "../core/world-v1.ts";
import {
  BOSSES_V1,
  ELITES_V1,
  MAP_MODIFIERS_V1,
  MAPS_V1,
  NORMALS_V1,
  TARGET_DROPS_V1,
} from "../data/world-v1.ts";
import type { TargetDropDefV1, MapModifierDefV1, BossDefV1 } from "../core/world-v1.ts";

export function mapsForRegion(region: RegionId): WorldMapDefV1[] {
  return MAPS_V1.filter((map) => map.region === region);
}

export interface UiEnemy {
  id: string;
  name: string;
  style: string;
  element: string;
  boss: boolean;
  hpMult: number;
  kind: "normal" | "elite" | "boss";
}

export function enemiesForMap(map: WorldMapDefV1): UiEnemy[] {
  const normals = map.normalPool.map((id) => {
    const unit = NORMALS_V1[id];
    return {
      id,
      name: unit?.name ?? id,
      style: unit?.style ?? "gang",
      element: unit?.element ?? "gang",
      boss: false,
      hpMult: unit?.hpMult ?? 1,
      kind: "normal" as const,
    };
  });
  const elites = map.eliteIds.map((id) => {
    const unit = ELITES_V1[id];
    return {
      id,
      name: unit?.name ?? id,
      style: unit?.style ?? "gang",
      element: unit?.element ?? "gang",
      boss: false,
      hpMult: unit?.hpMult ?? 2,
      kind: "elite" as const,
    };
  });
  const boss = BOSSES_V1[map.bossId];
  return [
    ...normals,
    ...elites,
    ...(boss
      ? [{
          id: boss.id,
          name: boss.name,
          style: boss.style,
          element: boss.element,
          boss: true,
          hpMult: boss.hpMult,
          kind: "boss" as const,
        }]
      : []),
  ];
}

export function targetDropsForMap(map: WorldMapDefV1): TargetDropDefV1[] {
  return map.targetDrops
    .map((id) => TARGET_DROPS_V1[id])
    .filter((target): target is TargetDropDefV1 => Boolean(target));
}

export function modifiersForMap(map: WorldMapDefV1): MapModifierDefV1[] {
  return map.modifiers
    .map((id) => MAP_MODIFIERS_V1[id])
    .filter((modifier): modifier is MapModifierDefV1 => Boolean(modifier));
}

export function bossForMap(map: WorldMapDefV1): BossDefV1 | undefined {
  return BOSSES_V1[map.bossId];
}
