import type { RegionId } from "../core/types.ts";
import type {
  EventChoiceV1,
  EventCondition,
  EventDefV1,
  EventEffect,
  FactionDefV1,
  FactionEventContentV1,
  FactionShopSkuV1,
  NpcDefV1,
} from "../core/factions-events.ts";
import { COMBAT_CONTENT, STARTER_GEAR } from "./combat-v1.ts";
import { WORLD_CONTENT_V1 } from "./world-v1.ts";

function faction(
  id: string,
  name: string,
  region: RegionId,
  stance: string,
  specialty: string,
  rivalId: string,
  rivalName: string,
  minRealm: number,
  inviteFlag: string,
  exclusiveRewards: string[],
): FactionDefV1 {
  return { id, name, region, stance, specialty, rivalId, rivalName, minRealm, inviteFlag, exclusiveRewards, shopIds: [] };
}

export const FACTIONS_V1: Record<string, FactionDefV1> = {
  faction_wulin: faction("faction_wulin", "武林盟", "zhongyuan", "以擂台与盟约维持中原秩序", "刚猛外功、反击与名望", "rival_court", "朝廷鹰犬/六扇门", 0, "invite_faction_wulin", ["破军刀法", "中原豪侠套", "擂台称号"]),
  faction_wudang: faction("faction_wudang", "武当", "wudang", "守中致柔，剑与道并重", "太极剑、招架与内力循环", "rival_sword", "入世剑宗", 1, "invite_faction_wudang", ["太极剑", "武当清修套", "金顶剑穗"]),
  faction_shuyuan: faction("faction_shuyuan", "清流书院", "xihu", "以清议与家风对抗世家", "柔劲、会心与身法", "rival_clans", "四大世家", 1, "invite_faction_shuyuan", ["落英剑法", "西湖烟雨套", "画舫诗帖"]),
  faction_caobang: faction("faction_caobang", "漕帮", "yangzhou", "码头规矩，义气与生意并存", "刀法、毒与资源", "rival_salt", "盐商商会", 0, "invite_faction_caobang", ["分筋错骨手", "扬州商路套", "漕运令"]),
  faction_shoumu: faction("faction_shoumu", "守墓人", "hanyue", "守地宫旧约，不问江湖是非", "阴劲、封穴与反伤", "rival_tomb", "盗墓者", 2, "invite_faction_shoumu", ["玄阴经", "汉越守墓套", "守灵剑魄"]),
};

function setShopIds(): void {
  for (const id of Object.keys(FACTIONS_V1)) FACTIONS_V1[id].shopIds = [];
  for (const shop of Object.values(SHOPS_V1)) {
    if (FACTIONS_V1[shop.factionId]) FACTIONS_V1[shop.factionId].shopIds.push(shop.id);
  }
}

function npc(
  id: string,
  name: string,
  region: RegionId,
  factionId: string,
  role: string,
  mapId: string,
  personalThread: string,
  gifts: string[],
): NpcDefV1 {
  return {
    id,
    name,
    region,
    factionId,
    role,
    mapId,
    personalThread,
    gifts,
    dialogue: {
      stranger: `${name}打量了你一眼，只说了句“江湖路远”。`,
      acquaintance: `${name}记得你上次没有多问，这次愿意多说两句。`,
      trust: `${name}把一件旧事交到你手上，语气比从前轻。`,
      confidant: `${name}没有再试探，只问你是否愿意走完这条路。`,
      lifeDeath: `${name}把后背留给了你。`,
    },
  };
}

export const NPCS_V1: Record<string, NpcDefV1> = Object.fromEntries([
  // 中原
  npc("npc_yue", "岳沧澜", "zhongyuan", "faction_wulin", "盟主", "luoyang", "武林盟与六扇门的旧盟约", ["旧盟帖", "断刀"]),
  npc("npc_lei", "雷震", "zhongyuan", "faction_wulin", "擂主", "luoyang", "雷家擂台欠下的一条命", ["护腕", "烈酒"]),
  npc("npc_shen", "沈青", "zhongyuan", "rival_court", "捕头", "huanghe", "六扇门追查的漕银案", ["腰牌", "案卷"]),
  npc("npc_luo", "洛七", "zhongyuan", "faction_wulin", "镖师", "biaoju", "黑风寨之后失散的镖队", ["镖旗", "平安扣"]),
  // 武当
  npc("npc_xuanwei", "玄微", "wudang", "faction_wudang", "执剑长老", "jinding", "剑冢里那封没有署名的信", ["剑穗", "清茶"]),
  npc("npc_wujiu", "无咎", "wudang", "faction_wudang", "剑冢老人", "jianzhong", "守了四十年的剑冢旧事", ["旧剑谱", "松子"]),
  npc("npc_gu", "顾长风", "wudang", "faction_wudang", "剑客", "jiejianchi", "入世剑宗与武当的分歧", ["剑穗", "酒葫芦"]),
  npc("npc_qinghe", "清和", "wudang", "faction_wudang", "知客", "jinding", "金顶云海下失踪的香客", ["云纹帕", "山茶"]),
  // 西湖
  npc("npc_lu", "陆清和", "xihu", "faction_shuyuan", "山长", "huxinting", "书院与四大世家的联姻", ["诗帖", "湖笔"]),
  npc("npc_su", "苏晚", "xihu", "faction_shuyuan", "画舫主人", "duanqiao", "画舫上那场没有下完的棋", ["旧琴弦", "雨前茶"]),
  npc("npc_xie", "谢临", "xihu", "rival_clans", "世家少主", "gushan", "世家联姻背后的账", ["玉佩", "梅枝"]),
  npc("npc_yu", "雨师", "xihu", "faction_shuyuan", "说书人", "huxinting", "西湖水底那口旧钟", ["醒木", "旧话本"]),
  // 扬州
  npc("npc_chen", "陈四海", "yangzhou", "faction_caobang", "漕帮舵主", "caoyun", "码头那批不该来的货", ["船牌", "烈酒"]),
  npc("npc_ayuan", "阿沅", "yangzhou", "faction_caobang", "船娘", "caoyun", "盐船夜里多出的一盏灯", ["平安符", "莲子"]),
  npc("npc_qian", "钱万金", "yangzhou", "rival_salt", "盐商总管", "yanchang", "盐引背后的官商线", ["金算盘", "雪盐"]),
  npc("npc_hei", "黑七", "yangzhou", "faction_caobang", "暗器手", "heishi", "黑市里失踪的机关图", ["柳叶镖", "黑铁"]),
  // 汉越墓
  npc("npc_cangbo", "苍伯", "hanyue", "faction_shoumu", "守墓人", "mudao", "地宫长明灯为何不灭", ["灯油", "古铜钉"]),
  npc("npc_wumian", "无面", "hanyue", "faction_shoumu", "守墓人", "digong", "无面者在地宫守的是谁", ["面具", "机关齿"]),
  npc("npc_jianling", "墓中剑灵", "hanyue", "faction_shoumu", "剑灵", "zhumu", "越王剑魄与旧约", ["剑魄", "古玉"]),
  npc("npc_daomu", "盗墓头目", "hanyue", "rival_tomb", "盗墓者", "digong", "盗墓者为何知道地宫机关", ["洛阳铲", "墓图"]),
].map((entry) => [entry.id, entry]));

function shop(
  id: string,
  factionId: string,
  rank: FactionShopSkuV1["rank"],
  name: string,
  description: string,
  price: FactionShopSkuV1["price"],
  extras: { artId?: string; itemId?: string; stock?: number } = {},
): FactionShopSkuV1 {
  return { id, factionId, rank, name, description, price, stock: extras.stock ?? 1, artId: extras.artId, itemId: extras.itemId };
}

export const SHOPS_V1: Record<string, FactionShopSkuV1> = {
  shop_wulin_entry: shop("shop_wulin_entry", "faction_wulin", "entry", "破军刀法·真传", "武林盟入门后可换的刀法。", { silver: 500 }, { artId: "pojun_lipi" }),
  shop_wulin_elder: shop("shop_wulin_elder", "faction_wulin", "elder", "擂主印", "长老级信物。", { renown: 200, silver: 1000 }, { itemId: "td_luoyang_seal" }),
  shop_wudang_entry: shop("shop_wudang_entry", "faction_wudang", "entry", "白鹤亮翅·真传", "武当入门剑式。", { silver: 500 }, { artId: "taiji_baihe" }),
  shop_wudang_elder: shop("shop_wudang_elder", "faction_wudang", "elder", "金顶剑穗", "长老级信物。", { renown: 200 }, { itemId: "td_jinding_tassel" }),
  shop_shuyuan_entry: shop("shop_shuyuan_entry", "faction_shuyuan", "entry", "太极推手·真传", "清流书院的调和之法。", { silver: 500 }, { artId: "taiji_tuishou" }),
  shop_shuyuan_elder: shop("shop_shuyuan_elder", "faction_shuyuan", "elder", "谢临诗帖", "书院清议的凭据。", { renown: 200 }, { itemId: "td_huxinting_poem" }),
  shop_caobang_entry: shop("shop_caobang_entry", "faction_caobang", "entry", "血战八方·真传", "漕帮的拼命刀法。", { silver: 500 }, { artId: "pojun_xuezhan" }),
  shop_caobang_elder: shop("shop_caobang_elder", "faction_caobang", "elder", "漕运令", "漕帮长老的信物。", { renown: 200 }, { itemId: "td_caoyun_tally" }),
  shop_shoumu_entry: shop("shop_shoumu_entry", "faction_shoumu", "entry", "封穴手·真传", "守墓人的封穴手法。", { silver: 500 }, { artId: "xuanyin_fengxue" }),
  shop_shoumu_elder: shop("shop_shoumu_elder", "faction_shoumu", "elder", "墓道铜钉", "守墓人长老的信物。", { renown: 200 }, { itemId: "td_mudao_nail" }),
};

setShopIds();

function choice(id: string, text: string, effects: EventEffect[]): EventChoiceV1 {
  return { id, text, effects };
}

function event(def: EventDefV1): EventDefV1 {
  return { once: true, cooldownHours: 48, weight: 1, ...def };
}

function cond(...conditions: EventCondition[]): EventCondition[] {
  return conditions;
}

const INVITES: EventDefV1[] = [
  event({
    id: "ev_invite_wulin", title: "擂台下的武林帖", speakerId: "npc_yue", locationMapId: "luoyang", region: "zhongyuan",
    trigger: { kind: "regionEntry", region: "zhongyuan" }, conditions: cond(),
    text: "擂台散了，有人把一张烫金帖子按在桌上，说武林盟缺一个不怕事的人。",
    choices: [
      choice("accept", "接下帖子，去武林盟看看。", [
        { kind: "flag", flag: "invite_faction_wulin" },
        { kind: "reputation", factionId: "faction_wulin", delta: 5 },
      ]),
      choice("decline", "把帖子推回去，先看看风向。", [{ kind: "npcRelationship", npcId: "npc_yue", delta: 2 }]),
    ],
  }),
  event({
    id: "ev_invite_wudang", title: "金顶的云", speakerId: "npc_qinghe", locationMapId: "jinding", region: "wudang",
    trigger: { kind: "regionEntry", region: "wudang" }, conditions: cond(),
    text: "知客递来一盏清茶，说金顶的云会散，但山门愿意为守规矩的人留一条路。",
    choices: [
      choice("accept", "接下武当的入门帖。", [
        { kind: "flag", flag: "invite_faction_wudang" },
        { kind: "reputation", factionId: "faction_wudang", delta: 5 },
      ]),
      choice("decline", "谢过清茶，暂不入山门。", [{ kind: "npcRelationship", npcId: "npc_qinghe", delta: 2 }]),
    ],
  }),
  event({
    id: "ev_invite_shuyuan", title: "画舫上的清议", speakerId: "npc_lu", locationMapId: "huxinting", region: "xihu",
    trigger: { kind: "regionEntry", region: "xihu" }, conditions: cond(),
    text: "山长把一张空白诗笺推过来，说清流书院不看出身，只看你肯不肯为一句真话落笔。",
    choices: [
      choice("accept", "在诗笺上落下名字。", [
        { kind: "flag", flag: "invite_faction_shuyuan" },
        { kind: "reputation", factionId: "faction_shuyuan", delta: 5 },
      ]),
      choice("decline", "把诗笺还回去。", [{ kind: "npcRelationship", npcId: "npc_lu", delta: 2 }]),
    ],
  }),
  event({
    id: "ev_invite_caobang", title: "码头上的船牌", speakerId: "npc_chen", locationMapId: "caoyun", region: "yangzhou",
    trigger: { kind: "regionEntry", region: "yangzhou" }, conditions: cond(),
    text: "舵主把一块旧船牌拍在货箱上，说漕帮不养闲人，但肯为讲义气的人留一条船。",
    choices: [
      choice("accept", "接过船牌。", [
        { kind: "flag", flag: "invite_faction_caobang" },
        { kind: "reputation", factionId: "faction_caobang", delta: 5 },
      ]),
      choice("decline", "把船牌推回去。", [{ kind: "npcRelationship", npcId: "npc_chen", delta: 2 }]),
    ],
  }),
  event({
    id: "ev_invite_shoumu", title: "长明灯下的旧约", speakerId: "npc_cangbo", locationMapId: "mudao", region: "hanyue",
    trigger: { kind: "regionEntry", region: "hanyue" }, conditions: cond(),
    text: "苍伯把一盏长明灯放在你面前，说守墓人不求香火，只求有人记得地宫里的旧约。",
    choices: [
      choice("accept", "接下守墓人的旧约。", [
        { kind: "flag", flag: "invite_faction_shoumu" },
        { kind: "reputation", factionId: "faction_shoumu", delta: 5 },
      ]),
      choice("decline", "把灯留在原处。", [{ kind: "npcRelationship", npcId: "npc_cangbo", delta: 2 }]),
    ],
  }),
];

const ZHONGYUAN_CHAIN: EventDefV1[] = [
  event({
    id: "ev_zy_arena", title: "擂台边的两种规矩", speakerId: "npc_lei", locationMapId: "luoyang", region: "zhongyuan",
    trigger: { kind: "regionEntry", region: "zhongyuan" }, conditions: cond(),
    chainId: "chain_zhongyuan", chainStep: 1,
    text: "擂台边，武林盟要拿人，六扇门要拿案。雷震看着你，问这一场该按谁的规矩收场。",
    choices: [
      choice("wulin", "帮武林盟稳住擂台。", [
        { kind: "flag", flag: "zy_arena_helped_wulin" },
        { kind: "reputation", factionId: "faction_wulin", delta: 10 },
        { kind: "npcRelationship", npcId: "npc_lei", delta: 10 },
        { kind: "currency", currency: "silver", delta: 60 },
      ]),
      choice("court", "把案卷交给六扇门。", [
        { kind: "flag", flag: "zy_arena_helped_court" },
        { kind: "reputation", factionId: "rival_court", delta: 10 },
        { kind: "reputation", factionId: "faction_wulin", delta: -8 },
        { kind: "npcRelationship", npcId: "npc_shen", delta: 10 },
      ]),
      choice("neutral", "两边都不帮，先救台下的人。", [
        { kind: "flag", flag: "zy_arena_neutral" },
        { kind: "npcRelationship", npcId: "npc_luo", delta: 6 },
      ]),
    ],
  }),
  event({
    id: "ev_zy_letter", title: "没有署名的信", speakerId: "npc_yue", locationMapId: "huanghe", region: "zhongyuan",
    trigger: { kind: "offlineReturn" }, conditions: cond({ kind: "flag", flag: "zy_arena_helped_wulin" }),
    chainId: "chain_zhongyuan", chainStep: 2,
    text: "岳沧澜托人带来一封没有署名的信，信里只有黄河渡口和一句“有人不想让镖路通”。",
    choices: [
      choice("deliver", "把信送到渡口。", [
        { kind: "flag", flag: "zy_letter_delivered" },
        { kind: "npcRelationship", npcId: "npc_yue", delta: 10 },
        { kind: "reputation", factionId: "faction_wulin", delta: 6 },
      ]),
      choice("burn", "把信烧了，免得更多人卷进来。", [
        { kind: "flag", flag: "zy_letter_burned" },
        { kind: "npcRelationship", npcId: "npc_luo", delta: 8 },
      ]),
    ],
  }),
  event({
    id: "ev_zy_lei", title: "雷震的旧伤", speakerId: "npc_lei", locationMapId: "luoyang", region: "zhongyuan",
    trigger: { kind: "npcRelationship", npcId: "npc_lei", level: "trust" },
    conditions: cond({ kind: "flag", flag: "zy_letter_delivered" }),
    chainId: "chain_zhongyuan", chainStep: 3,
    text: "雷震解开衣襟，旧伤下压着一枚六扇门的铜扣。他说当年那场擂台，自己也不是干干净净。",
    choices: [
      choice("spar", "陪他打完这场迟到的擂台。", [
        { kind: "flag", flag: "zy_lei_sparred" },
        { kind: "npcRelationship", npcId: "npc_lei", delta: 15 },
        { kind: "art", artId: "pojun_lipi" },
      ]),
      choice("listen", "听完，不追问。", [
        { kind: "flag", flag: "zy_lei_listened" },
        { kind: "npcRelationship", npcId: "npc_lei", delta: 8 },
        { kind: "currency", currency: "renown", delta: 20 },
      ]),
    ],
  }),
  event({
    id: "ev_zy_plot", title: "镖路尽头的账", speakerId: "npc_shen", locationMapId: "biaoju", region: "zhongyuan",
    trigger: { kind: "offlineReturn" }, conditions: cond({ kind: "flag", flag: "zy_lei_sparred" }),
    chainId: "chain_zhongyuan", chainStep: 4,
    text: "沈青把一册账放在桌上，说黑风寨只是刀，真正想断镖路的人在更上面。你要不要翻开？",
    choices: [
      choice("protect", "把账册压下，先保镖路。", [
        { kind: "flag", flag: "zy_final" },
        { kind: "reputation", factionId: "faction_wulin", delta: 12 },
        { kind: "npcRelationship", npcId: "npc_shen", delta: 8 },
      ]),
      choice("expose", "把账册抄送六扇门。", [
        { kind: "flag", flag: "zy_final" },
        { kind: "reputation", factionId: "rival_court", delta: 12 },
        { kind: "reputation", factionId: "faction_wulin", delta: -6 },
      ]),
    ],
  }),
  event({
    id: "ev_zy_end", title: "中原的下一页", speakerId: "npc_yue", locationMapId: "biaoju", region: "zhongyuan",
    trigger: { kind: "offlineReturn" }, conditions: cond({ kind: "flag", flag: "zy_final" }),
    chainId: "chain_zhongyuan", chainStep: 5, chainEnd: true,
    text: "镖路重新通了。岳沧澜没有谢你，只把一枚旧盟印放在桌上，说中原的下一页该由你来写。",
    choices: [
      choice("accept", "收下旧盟印。", [
        { kind: "title", title: "中原旧盟" },
        { kind: "reputation", factionId: "faction_wulin", delta: 10 },
        { kind: "item", itemId: "td_luoyang_seal" },
      ]),
    ],
  }),
];

const REGION_EVENTS: EventDefV1[] = [
  event({
    id: "ev_wd_cloud", title: "云海里的剑鸣", speakerId: "npc_gu", locationMapId: "jinding", region: "wudang",
    trigger: { kind: "randomTravel", region: "wudang" }, conditions: cond(),
    once: false,
    text: "云海翻涌，剑鸣从崖下传来。顾长风说，入世剑宗又在金顶外试剑，这次不该再退。",
    choices: [
      choice("stand", "与武当并肩。", [
        { kind: "reputation", factionId: "faction_wudang", delta: 8 },
        { kind: "npcRelationship", npcId: "npc_gu", delta: 8 },
      ]),
      choice("watch", "先看清剑阵再动。", [
        { kind: "currency", currency: "silver", delta: 40 },
        { kind: "npcRelationship", npcId: "npc_xuanwei", delta: 4 },
      ]),
    ],
  }),
  event({
    id: "ev_wd_sword", title: "剑冢里的旧信", speakerId: "npc_xuanwei", locationMapId: "jianzhong", region: "wudang",
    trigger: { kind: "npcRelationship", npcId: "npc_xuanwei", level: "trust" }, conditions: cond(),
    text: "玄微把一封旧信递给你，信上没有署名，只有一句“剑冢之下，莫问来处”。",
    choices: [
      choice("open", "拆开旧信。", [
        { kind: "art", artId: "taiji_baihe" },
        { kind: "npcRelationship", npcId: "npc_xuanwei", delta: 10 },
      ]),
      choice("keep", "把信收好，先不问。", [
        { kind: "currency", currency: "renown", delta: 30 },
        { kind: "flag", flag: "wd_letter_kept" },
      ]),
    ],
  }),
  event({
    id: "ev_xh_rain", title: "断桥边的伞", speakerId: "npc_su", locationMapId: "duanqiao", region: "xihu",
    trigger: { kind: "randomTravel", region: "xihu" }, conditions: cond(),
    once: false,
    text: "雨把断桥洗得发亮，苏晚把一把伞递过来，说世家的人今晚要在画舫上谈一桩不该谈的婚事。",
    choices: [
      choice("help", "替书院送信。", [
        { kind: "reputation", factionId: "faction_shuyuan", delta: 8 },
        { kind: "npcRelationship", npcId: "npc_su", delta: 8 },
      ]),
      choice("listen", "先在桥边听完。", [
        { kind: "flag", flag: "xh_bridge_listened" },
        { kind: "currency", currency: "silver", delta: 30 },
      ]),
    ],
  }),
  event({
    id: "ev_xh_poem", title: "没有落款的诗", speakerId: "npc_lu", locationMapId: "huxinting", region: "xihu",
    trigger: { kind: "npcRelationship", npcId: "npc_lu", level: "trust" }, conditions: cond(),
    text: "山长把一首没有落款的诗放在你面前，说清流书院能教的都在这几句里，剩下的要你自己写。",
    choices: [
      choice("study", "留在书院抄完这首诗。", [
        { kind: "art", artId: "taiji_tuishou" },
        { kind: "npcRelationship", npcId: "npc_lu", delta: 10 },
      ]),
      choice("leave", "带着诗去江湖上看看。", [
        { kind: "flag", flag: "xh_poem_carried" },
        { kind: "currency", currency: "renown", delta: 25 },
      ]),
    ],
  }),
  event({
    id: "ev_yz_boat", title: "夜里的盐船", speakerId: "npc_ayuan", locationMapId: "caoyun", region: "yangzhou",
    trigger: { kind: "randomTravel", region: "yangzhou" }, conditions: cond(),
    once: false,
    text: "阿沅说盐船今夜多了一盏灯，漕帮的人不敢靠近，盐商的人却已经在码头等着。",
    choices: [
      choice("board", "上船看看。", [
        { kind: "reputation", factionId: "faction_caobang", delta: 8 },
        { kind: "npcRelationship", npcId: "npc_ayuan", delta: 8 },
      ]),
      choice("watch", "留在岸上记下船号。", [
        { kind: "flag", flag: "yz_boat_watched" },
        { kind: "currency", currency: "silver", delta: 35 },
      ]),
    ],
  }),
  event({
    id: "ev_yz_salt", title: "舵主的旧账", speakerId: "npc_chen", locationMapId: "heishi", region: "yangzhou",
    trigger: { kind: "npcRelationship", npcId: "npc_chen", level: "trust" }, conditions: cond(),
    text: "陈四海把一本旧账推过来，说漕帮欠盐商一条命，也欠码头一句真话。你要先还哪一笔？",
    choices: [
      choice("gang", "先还码头的真话。", [
        { kind: "reputation", factionId: "faction_caobang", delta: 10 },
        { kind: "item", itemId: "td_caoyun_tally" },
      ]),
      choice("salt", "先还盐商那条命。", [
        { kind: "reputation", factionId: "rival_salt", delta: 10 },
        { kind: "reputation", factionId: "faction_caobang", delta: -5 },
        { kind: "currency", currency: "silver", delta: 100 },
      ]),
    ],
  }),
  event({
    id: "ev_hy_tomb", title: "地宫里的灯", speakerId: "npc_wumian", locationMapId: "digong", region: "hanyue",
    trigger: { kind: "randomTravel", region: "hanyue" }, conditions: cond(),
    once: false,
    text: "无面提着一盏灯站在机关前，说再往下就不是盗墓者的路，而是守墓人守了太久的东西。",
    choices: [
      choice("descend", "跟无面下去。", [
        { kind: "reputation", factionId: "faction_shoumu", delta: 8 },
        { kind: "npcRelationship", npcId: "npc_wumian", delta: 8 },
      ]),
      choice("seal", "把机关重新封上。", [
        { kind: "flag", flag: "hy_tomb_sealed" },
        { kind: "currency", currency: "renown", delta: 25 },
      ]),
    ],
  }),
  event({
    id: "ev_hy_lantern", title: "长明灯的名字", speakerId: "npc_cangbo", locationMapId: "mudao", region: "hanyue",
    trigger: { kind: "npcRelationship", npcId: "npc_cangbo", level: "trust" }, conditions: cond(),
    text: "苍伯说长明灯上刻着一个名字，守墓人守的不是墓，是那个名字。你愿意记住它吗？",
    choices: [
      choice("remember", "记住这个名字。", [
        { kind: "art", artId: "xuanyin_fengxue" },
        { kind: "npcRelationship", npcId: "npc_cangbo", delta: 10 },
      ]),
      choice("ask", "先问这个名字是谁。", [
        { kind: "flag", flag: "hy_name_asked" },
        { kind: "currency", currency: "renown", delta: 30 },
      ]),
    ],
  }),
];

const OFFLINE_EVENTS: EventDefV1[] = [
  event({
    id: "ev_offline_letter", title: "江湖帖里的旧信", speakerId: "npc_luo", locationMapId: "biaoju", region: "zhongyuan",
    trigger: { kind: "offlineReturn" }, conditions: cond(),
    cooldownHours: 24,
    text: "你回来时，江湖帖里多了一封旧信。信上只有一句：镖路的事还没完。",
    choices: [
      choice("read", "拆信。", [
        { kind: "currency", currency: "renown", delta: 15 },
        { kind: "npcRelationship", npcId: "npc_luo", delta: 5 },
      ]),
      choice("defer", "先放回帖子里。", [{ kind: "flag", flag: "offline_letter_deferred" }]),
    ],
  }),
  event({
    id: "ev_offline_rumor", title: "茶楼里的风声", speakerId: "npc_yu", locationMapId: "huxinting", region: "xihu",
    trigger: { kind: "offlineReturn" }, conditions: cond(),
    cooldownHours: 24,
    text: "茶楼里有人说西湖水底那口钟昨夜响了一声，说书人却把醒木按住了。",
    choices: [
      choice("listen", "留下听完。", [
        { kind: "npcRelationship", npcId: "npc_yu", delta: 6 },
        { kind: "flag", flag: "offline_rumor_heard" },
      ]),
      choice("leave", "付茶钱走人。", [{ kind: "currency", currency: "silver", delta: 25 }]),
    ],
  }),
  event({
    id: "ev_offline_bounty", title: "悬赏栏上的名字", speakerId: "npc_shen", locationMapId: "huanghe", region: "zhongyuan",
    trigger: { kind: "offlineReturn" }, conditions: cond(),
    cooldownHours: 24,
    text: "悬赏栏上多了一个名字，赏银不高，但落款是六扇门。沈青在远处看着你。",
    choices: [
      choice("take", "接下悬赏。", [
        { kind: "currency", currency: "silver", delta: 80 },
        { kind: "reputation", factionId: "rival_court", delta: 5 },
      ]),
      choice("tear", "把悬赏撕了。", [
        { kind: "reputation", factionId: "faction_wulin", delta: 5 },
        { kind: "flag", flag: "offline_bounty_torn" },
      ]),
    ],
  }),
];

export const EVENTS_V1: Record<string, EventDefV1> = Object.fromEntries(
  [...INVITES, ...ZHONGYUAN_CHAIN, ...REGION_EVENTS, ...OFFLINE_EVENTS].map((entry) => [entry.id, entry]),
);

const ARTS = [
  ...Object.keys(COMBAT_CONTENT.skills),
  ...Object.keys(COMBAT_CONTENT.innerArts),
  ...Object.keys(COMBAT_CONTENT.hearts),
  ...Object.keys(COMBAT_CONTENT.keystones),
];

const ITEMS = [
  ...Object.keys(STARTER_GEAR),
  ...Object.keys(WORLD_CONTENT_V1.targetDrops),
];

export const FACTION_EVENT_CONTENT: FactionEventContentV1 = {
  factions: FACTIONS_V1,
  npcs: NPCS_V1,
  events: EVENTS_V1,
  shops: SHOPS_V1,
  catalog: {
    arts: ARTS,
    items: ITEMS,
    maps: WORLD_CONTENT_V1.maps.map((map) => map.id),
    companions: Object.keys(COMBAT_CONTENT.companions),
  },
};
