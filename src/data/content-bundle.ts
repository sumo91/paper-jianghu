import type { CombatContent, Loadout } from "../core/combat-v1.ts";
import type { BuildId } from "../core/types.ts";
import type { ItemizationContent } from "../core/itemization.ts";
import type { BuildProgressionContent } from "../core/progression.ts";
import type { EconomyContent } from "../core/economy.ts";
import type { FactionEventContentV1 } from "../core/factions-events.ts";
import type { CompanionContentV1 } from "../core/companions.ts";
import type { ActivityContentV1 } from "../core/activities.ts";
import type { EndgameContentV1 } from "../core/endgame.ts";
import type { WorldContentV1 } from "../core/world-v1.ts";
import { COMBAT_CONTENT, STARTER_KITS, STARTER_GEAR } from "./combat-v1.ts";
import { ITEMIZATION_CONTENT } from "./item-v1.ts";
import { BUILD_PROGRESSION_CONTENT } from "./progression-v1.ts";
import { ECONOMY_CONTENT } from "./economy-v1.ts";
import { FACTION_EVENT_CONTENT } from "./factions-events-v1.ts";
import { COMPANION_CONTENT } from "./companions-v1.ts";
import { ACTIVITY_CONTENT } from "./activities-v1.ts";
import { ENDGAME_CONTENT } from "./endgame-v1.ts";
import { WORLD_CONTENT_V1 } from "./world-v1.ts";
import { CONTENT_VERSION } from "./content-version.ts";

export interface GameContentBundle {
  contentVersion: string;
  world: WorldContentV1;
  combat: CombatContent;
  itemization: ItemizationContent;
  starterGear: typeof STARTER_GEAR;
  starterKits: Record<BuildId, { loadout: Loadout }>;
  progression: BuildProgressionContent;
  economy: EconomyContent;
  factions: FactionEventContentV1;
  companions: CompanionContentV1;
  activities: ActivityContentV1;
  endgame: EndgameContentV1;
}

export const GAME_CONTENT: GameContentBundle = {
  contentVersion: CONTENT_VERSION,
  world: WORLD_CONTENT_V1,
  combat: COMBAT_CONTENT,
  itemization: ITEMIZATION_CONTENT,
  starterGear: STARTER_GEAR,
  starterKits: {
    taiji: { loadout: STARTER_KITS.taiji.loadout },
    pojun: { loadout: STARTER_KITS.pojun.loadout },
    xuanyin: { loadout: STARTER_KITS.xuanyin.loadout },
  },
  progression: BUILD_PROGRESSION_CONTENT,
  economy: ECONOMY_CONTENT,
  factions: FACTION_EVENT_CONTENT,
  companions: COMPANION_CONTENT,
  activities: ACTIVITY_CONTENT,
  endgame: ENDGAME_CONTENT,
};
