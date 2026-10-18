import { NARRATIVE_ENABLED } from "./features.ts";

export type TabId = "map" | "character" | "martial" | "bag" | "jianghu";

export const TABS: Array<{ id: TabId; label: string; seal: string }> = [
  { id: "map", label: "地图", seal: "舆" },
  { id: "character", label: "人物", seal: "侠" },
  { id: "martial", label: "武学", seal: "武" },
  { id: "bag", label: "行囊", seal: "囊" },
  ...(NARRATIVE_ENABLED ? [{ id: "jianghu" as const, label: "江湖", seal: "江" }] : []),
];
