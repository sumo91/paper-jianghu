import type { CompanionContentV1, CompanionDefV1, GiftDefV1 } from "../core/companions.ts";

const GIFTS: GiftDefV1[] = [
  { id: "gift_wine", name: "烈酒", description: "刀客与剑客都懂的一口烈酒。", value: 16 },
  { id: "gift_herb", name: "药草", description: "医女会仔细收好的药草。", value: 14 },
  { id: "gift_gear", name: "机关齿", description: "机关师看一眼就知道缺哪一枚。", value: 16 },
  { id: "gift_book", name: "旧话本", description: "说书人翻到卷边的话本。", value: 14 },
  { id: "gift_casefile", name: "案卷", description: "捕快不肯离手的旧案卷。", value: 16 },
  { id: "gift_lotus", name: "莲子", description: "船娘在船头晒干的莲子。", value: 12 },
  { id: "gift_lampoil", name: "灯油", description: "守墓人长明灯用的灯油。", value: 14 },
  { id: "gift_plum", name: "梅枝", description: "西湖边折下的一枝梅。", value: 12 },
];

function companion(
  id: string,
  name: string,
  role: CompanionDefV1["role"],
  region: CompanionDefV1["region"],
  description: string,
  sourceKinds: CompanionDefV1["sourceKinds"],
  requiredRealm: number,
  assist: CompanionDefV1["assist"],
  support: CompanionDefV1["support"],
  giftPreferenceId: string,
  questTitle: string,
  questDescription: string,
  questFlag: string,
  outcomes: CompanionDefV1["personalQuest"]["outcomes"],
  extras: Partial<CompanionDefV1> = {},
): CompanionDefV1 {
  return {
    id,
    name,
    role,
    region,
    description,
    sourceKinds,
    requiredRealm,
    assist,
    support,
    giftPreferenceId,
    personalQuest: {
      id: `quest_${id}`,
      title: questTitle,
      description: questDescription,
      requiredBond: 6,
      flag: questFlag,
      outcomes,
    },
    major: true,
    ...extras,
  };
}

export const COMPANIONS_V1: Record<string, CompanionDefV1> = Object.fromEntries([
  companion(
    "comp_guchangfeng", "顾长风", "damage", "wudang",
    "剑客。话不多，剑比话快；在武当与入世剑宗之间选了自己的路。",
    ["story", "faction", "event"], 1,
    {
      name: "剑鸣", trigger: { kind: "enemyHpBelow", value: 0.5 }, cooldown: 3,
      effect: { kind: "damage", power: 0.75 }, description: "敌方半血以下时，顾长风补一剑。",
    },
    { name: "剑意相合", description: "攻击与会心提高。", mods: { attackPct: 0.05, crit: 0.03 } },
    "gift_wine", "剑鸣之后", "顾长风想回武当问清那封旧信的来处。", "quest_gu_done",
    [
      { id: "return", text: "他回武当，把剑穗挂回旧处。", flag: "gu_returned" },
      { id: "wander", text: "他把剑穗留给你，继续往江湖深处走。", flag: "gu_wandered" },
    ],
    { requiredFlag: "invite_faction_wudang", factionHook: "faction_wudang", npcId: "npc_gu" },
  ),
  companion(
    "comp_liuqing", "柳青", "support", "zhongyuan",
    "医女。药庐的灯总亮着，她记得每个来过的人。",
    ["story", "event"], 0,
    {
      name: "回春", trigger: { kind: "hpBelow", value: 0.45 }, cooldown: 3,
      effect: { kind: "heal", power: 0.08 }, description: "气血低于 45% 时，柳青为你回春。",
    },
    { name: "药庐灯火", description: "气血与治疗加成提高。", mods: { hpPct: 0.05, healBonus: 0.06 } },
    "gift_herb", "药庐的旧账", "柳青想找出当年没能救下的那个人。", "quest_liu_done",
    [
      { id: "save", text: "她救下了相似的人，终于肯放过自己。", flag: "liu_saved" },
      { id: "remember", text: "她把名字写进药簿，继续守灯。", flag: "liu_remembered" },
    ],
    { npcId: "npc_liu" },
  ),
  companion(
    "comp_moya", "墨鸦", "control", "yangzhou",
    "机关师。手指停在机关齿上时，比握刀更稳。",
    ["event", "faction"], 1,
    {
      name: "毒砂", trigger: { kind: "enemyCharging" }, cooldown: 4,
      effect: { kind: "control", power: 0.5 }, description: "敌方蓄力时，墨鸦撒出毒砂封穴。",
    },
    { name: "机关巧手", description: "身法与毒伤提高。", mods: { speedPct: 0.03, poisonDamage: 0.06 } },
    "gift_gear", "机关图的下半张", "墨鸦想找回黑市里丢失的机关图。", "quest_mo_done",
    [
      { id: "rebuild", text: "他把机关图重新拼好，收进袖中。", flag: "mo_rebuilt" },
      { id: "burn", text: "他烧掉下半张图，说有些机关不该再开。", flag: "mo_burned" },
    ],
    { npcId: "npc_hei" },
  ),
  companion(
    "comp_yushi", "雨师", "utility", "xihu",
    "说书人。醒木一拍，真假都在故事里。",
    ["faction", "event"], 1,
    {
      name: "醒木", trigger: { kind: "allyDebuffed" }, cooldown: 3,
      effect: { kind: "cleanse", power: 2 }, description: "你身上有负面时，雨师用醒木驱散。",
    },
    { name: "听雨", description: "状态抵抗与回合回内力提高。", mods: { statusResist: 0.08, innerRegen: 1 } },
    "gift_book", "没有下完的棋", "雨师想把画舫上那盘棋的结局讲完。", "quest_yu_done",
    [
      { id: "finish", text: "他补上了结局，台下有人落了泪。", flag: "yu_finished" },
      { id: "leave", text: "他把醒木留给你，说故事该由你讲。", flag: "yu_left" },
    ],
    { requiredFaction: "faction_shuyuan", factionHook: "faction_shuyuan", npcId: "npc_yu" },
  ),
  companion(
    "comp_shenqing", "沈青", "control", "zhongyuan",
    "捕快。腰牌旧了，案子却没旧。",
    ["faction", "event"], 1,
    {
      name: "锁穴", trigger: { kind: "everyRounds", value: 4 }, cooldown: 4,
      effect: { kind: "control", power: 0.4 }, description: "每 4 回合，沈青出手锁穴。",
    },
    { name: "六扇门旧案", description: "命中与会心提高。", mods: { hit: 0.04, crit: 0.02 } },
    "gift_casefile", "漕银案最后一页", "沈青想给六扇门的旧案一个交代。", "quest_shen_done",
    [
      { id: "close", text: "他把案卷合上，第一次没有写结案。", flag: "shen_closed" },
      { id: "open", text: "他把案卷交给你，说江湖比衙门更适合查它。", flag: "shen_opened" },
    ],
    { requiredFaction: "faction_wulin", factionHook: "faction_wulin", npcId: "npc_shen" },
  ),
  companion(
    "comp_ayuan", "阿沅", "support", "yangzhou",
    "船娘。她记得每条船的灯，也记得每盏灯等的人。",
    ["faction", "event"], 1,
    {
      name: "渡口灯", trigger: { kind: "hpBelow", value: 0.4 }, cooldown: 4,
      effect: { kind: "heal", power: 0.06 }, description: "气血低于 40% 时，阿沅点起渡口灯。",
    },
    { name: "水乡轻身", description: "闪避与身法提高。", mods: { evade: 0.04, speedPct: 0.03 } },
    "gift_lotus", "夜里多出的那盏灯", "阿沅想找到盐船上那盏灯的来处。", "quest_ayuan_done",
    [
      { id: "light", text: "她在船头多点了一盏灯，说给人留路。", flag: "ayuan_light" },
      { id: "dark", text: "她吹灭那盏灯，把船撑进雾里。", flag: "ayuan_dark" },
    ],
    { requiredFaction: "faction_caobang", factionHook: "faction_caobang", npcId: "npc_ayuan" },
  ),
  companion(
    "comp_cangbo", "苍伯", "tank", "hanyue",
    "守墓人。长明灯不灭，他也不走。",
    ["faction", "event"], 2,
    {
      name: "长明灯", trigger: { kind: "hpBelow", value: 0.5 }, cooldown: 4,
      effect: { kind: "heal", power: 0.1 }, description: "气血低于 50% 时，长明灯护住你。",
    },
    { name: "守墓旧约", description: "防御与招架减伤提高。", mods: { defensePct: 0.08, guardReduction: 0.04 } },
    "gift_lampoil", "灯上的名字", "苍伯想让你记住长明灯上那个名字。", "quest_cang_done",
    [
      { id: "remember", text: "你记住那个名字，苍伯第一次向你行礼。", flag: "cang_remembered" },
      { id: "forget", text: "你吹灭灯，苍伯没有说话。", flag: "cang_forgotten" },
    ],
    { requiredFaction: "faction_shoumu", factionHook: "faction_shoumu", npcId: "npc_cangbo" },
  ),
  companion(
    "comp_yanshisan", "燕十三", "damage", "zhongyuan",
    "刀客。他的刀很快，故事却总是慢半拍。",
    ["event", "ending"], 2,
    {
      name: "夺命刀", trigger: { kind: "enemyHpBelow", value: 0.4 }, cooldown: 4,
      effect: { kind: "damage", power: 1.0 }, description: "敌方残血时，燕十三补上夺命一刀。",
    },
    { name: "刀口舔血", description: "会心与反击增伤提高。", mods: { crit: 0.03, counterDamage: 0.1 } },
    "gift_wine", "刀客的最后一杯", "燕十三想在同行的路上找到值得喝完的那杯酒。", "quest_yan_done",
    [
      { id: "drink", text: "他把酒喝完，说这一路不算白走。", flag: "yan_drank" },
      { id: "leave", text: "他把酒留给你，转身走进风里。", flag: "yan_left" },
    ],
    { npcId: "npc_yan" },
  ),
].map((entry) => [entry.id, entry]));

export const COMPANION_GIFTS_V1: Record<string, GiftDefV1> = Object.fromEntries(
  GIFTS.map((gift) => [gift.id, gift]),
);

export const COMPANION_CONTENT: CompanionContentV1 = {
  companions: COMPANIONS_V1,
  gifts: COMPANION_GIFTS_V1,
};
