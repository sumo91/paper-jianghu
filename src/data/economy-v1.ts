import type { CurrencyId, EconomyContent } from "../core/economy.ts";

const CURRENCIES: EconomyContent["currencies"] = {
  silver: {
    id: "silver",
    sources: ["战斗掉落", "回收", "悬赏", "地图结算", "离线"],
    sinks: ["淬炼", "洗练", "洗点", "药", "赶路", "门派商店", "打造材料"],
    cap: "无硬上限，靠消耗控制",
  },
  cultivation: {
    id: "cultivation",
    sources: ["战斗", "离线", "首通", "事件"],
    sinks: ["境界层", "内功等级", "经脉"],
    cap: "按境界缩放",
  },
  renown: {
    id: "renown",
    sources: ["首领", "首通", "门派", "天机榜"],
    sinks: ["突破试炼", "地图/门派解锁", "部分武学"],
    cap: "每境界软门槛",
  },
  factionRep: {
    id: "factionRep",
    sources: ["门派任务", "门派选择"],
    sinks: ["门派等级", "门派商店", "门派武学"],
    cap: "每阶上限",
  },
  tianji: {
    id: "tianji",
    sources: ["天机榜", "武林大会"],
    sinks: ["外观", "称号", "收藏"],
    cap: "赛季上限",
    cosmeticOnly: true,
  },
  pages: {
    id: "pages",
    sources: ["地图", "首领", "事件"],
    sinks: ["合成武学"],
    cap: "99",
  },
  annotations: {
    id: "annotations",
    sources: ["事件", "门派"],
    sinks: ["心法升级"],
    cap: "99",
  },
  manuals: {
    id: "manuals",
    sources: ["门派", "首领", "奇遇"],
    sinks: ["内功升级"],
    cap: "99",
  },
  materials: {
    id: "materials",
    sources: ["回收", "首领", "地图"],
    sinks: ["淬炼", "洗练", "打造"],
    cap: "每类上限",
  },
  tokens: {
    id: "tokens",
    sources: ["同伴", "事件"],
    sinks: ["羁绊", "赠礼"],
    cap: "99",
  },
  pills: {
    id: "pills",
    sources: ["商店", "突破"],
    sinks: ["洗点", "突破"],
    cap: "99",
  },
};

export const ECONOMY_CONTENT: EconomyContent = {
  currencies: CURRENCIES,
  cultivationCaps: [800, 2000, 5000, 12000, 28000, 60000, 120000],
  offline: { rate: 0.5, capHours: 8, overflowRate: 0.2 },
  shop: {
    sku_potion: {
      id: "sku_potion",
      name: "回气丹",
      description: "突破/洗点用的基础丹药。",
      costs: { silver: 120 },
      grants: { pills: 1 },
      stock: 20,
      minRenown: 0,
      minRealm: 0,
    },
    sku_material: {
      id: "sku_material",
      name: "玄铁",
      description: "淬炼/洗练材料。",
      costs: { silver: 200 },
      grants: { materials: 5 },
      stock: 30,
      minRenown: 0,
      minRealm: 0,
    },
    sku_page: {
      id: "sku_page",
      name: "武学残页",
      description: "随机武学残页；不是付费战力。",
      costs: { silver: 600 },
      grants: { pages: 1 },
      stock: 8,
      minRenown: 100,
      minRealm: 1,
    },
    sku_annotation: {
      id: "sku_annotation",
      name: "心法注解",
      description: "心法升级材料。",
      costs: { silver: 400, materials: 2 },
      grants: { annotations: 1 },
      stock: 10,
      minRenown: 50,
      minRealm: 1,
    },
    sku_manual: {
      id: "sku_manual",
      name: "内功秘籍",
      description: "内功升级材料。",
      costs: { silver: 900, materials: 5 },
      grants: { manuals: 1 },
      stock: 5,
      minRenown: 150,
      minRealm: 2,
    },
    sku_title: {
      id: "sku_title",
      name: "题跋·听雨",
      description: "纯收藏称号，不提供战力。",
      costs: { tianji: 500 },
      stock: 1,
      minRenown: 0,
      minRealm: 0,
    },
  },
  priceVersion: "economy-v1",
  salvageFraction: 0.35,
};

export function currencyLabel(id: CurrencyId): string {
  return ECONOMY_CONTENT.currencies[id].id;
}
