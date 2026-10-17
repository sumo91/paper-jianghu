# Endgame, Ranks & Seasons v1 验证报告

> 生成时间：2026-10-17T20:11:56.191Z  
> 规则 seam：`EndgameService`；挑战输入为 `BattleResult`，战斗仍由 `resolveBattle` 产生。  
> 状态：NPC-only；无 PvP/后端；top 100 手工种子 + 400 程序化榜位；江湖志 173 条验证集。

## 0. 结论

- **内容校验：通过。**
- 天机榜 500 名（top 100 手工种子）；本次模拟从第 500 名打到第 1 名，500 次挑战（499 次晋级胜 / 1 次首败）。
- 赛季 8 周；软重置后第 0 → 1 赛季名次 1 → 101，角色/装备/武学/同伴/江湖志保留。
- 武林大会规则「武林大会·剑会」：剑法伤害 +20%，治疗效果 -30%；比谁能在无回气的情况下走得更远。
- 江湖志 10/173（6%）；全收录后 complete。
- 归隐：保留 taiji_siliang / comp_liuqing / 听雨。
- 无真人 PvP、无后端排行榜、无付费战力；挑战失败保留名次并获得情报。

## 1. 天机榜 top 10

| 名次 | 姓名 | 门派 | Build | 流派 | 称号 | 奖励 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 岳沧澜 | faction_wulin | taiji | gang/yin | 听雨 | 15 天机 · 听雨·绝顶 |
| 2 | 岳长风 | faction_wudang | pojun | rou/yang | 断刀 | 14 天机 · 断刀·绝顶 |
| 3 | 岳青 | faction_shuyuan | xuanyin | kuai/gang | 云外 | 14 天机 · 云外·绝顶 |
| 4 | 岳临 | faction_caobang | taiji | gui/rou | 孤鸿 | 14 天机 · 孤鸿·绝顶 |
| 5 | 岳十三 | faction_shoumu | pojun | gang/taiji | 问心 | 14 天机 · 问心·绝顶 |
| 6 | 雷沧澜 | faction_wulin | xuanyin | rou/yin | 折梅 | 14 天机 · 折梅·绝顶 |
| 7 | 雷长风 | faction_wudang | taiji | kuai/yang | 照夜 | 14 天机 · 照夜·绝顶 |
| 8 | 雷青 | faction_shuyuan | pojun | gui/gang | 沉沙 | 14 天机 · 沉沙·绝顶 |
| 9 | 雷临 | faction_caobang | xuanyin | gang/rou | 归舟 | 14 天机 · 归舟·绝顶 |
| 10 | 雷十三 | faction_shoumu | taiji | rou/taiji | 无咎 | 14 天机 · 无咎·绝顶 |

## 2. 挑战与赛季

| 项目 | 结果 |
| --- | --- |
| 模拟挑战次数 | 500 |
| 胜利 | 499 |
| 失败 | 1 |
| 终局名次 | 1 |
| 首败情报 | 挑战失败，保留名次并获得情报；下次挑战费用降低 |
| 第 1 次软重置 | 1 → 101（第 1 赛季） |
| 第 2 次软重置 | 101 → 201（第 2 赛季） |
| 角色/装备/武学/同伴/江湖志 | 保留 |

## 3. 武林大会

| 规则 | Modifier | 奖励 |
| --- | --- | --- |
| 剑会·剑意 | 剑法伤害 +20% | 题跋·剑会 |
| 剑会·禁疗 | 治疗效果 -30% | 题跋·剑会 |

- 模拟胜场得分 30，天机 5，外观 题跋·剑会。
- 规则在进入前可见；只使用 Combat v1 的 BattleModifier，不引入第二套战斗引擎。

## 4. 江湖志

| 分类 | 已收录 | 总数 | 完成度 | tier |
| --- | --- | --- | --- | --- |
| region | 5 | 5 | 100% | complete |
| map | 5 | 15 | 33% | bronze |
| npc | 0 | 20 | 0% | empty |
| martial_art | 0 | 18 | 0% | empty |
| inner_art | 0 | 3 | 0% | empty |
| heart | 0 | 12 | 0% | empty |
| keystone | 0 | 6 | 0% | empty |
| monster | 0 | 30 | 0% | empty |
| elite | 0 | 10 | 0% | empty |
| boss | 0 | 15 | 0% | empty |
| event | 0 | 21 | 0% | empty |
| companion | 0 | 8 | 0% | empty |
| ending | 0 | 10 | 0% | empty |

- 总完成度 10/173（6%），tier=bronze。
- 未收录条目仍显示来源提示；收录幂等；跨赛季不重置。

## 5. 归隐 / 开宗接口

| 项目 | 结果 |
| --- | --- |
| 归隐条件 | realm ≥ 5 |
| 保留 | 1 门武学 / 1 名同伴羁绊 / 1 个称号 |
| 重置 | 等级/境界/装备/地图/门派 rank/其余武学 |
| 保留收藏 | 江湖志/赛季外观/天机积分 |
| 开宗 | 开宗立派接口已解锁；v1 不实现门派经营。 |

## 6. 验收口径

- 天机榜 500–1000 名、top 100 手工种子、确定生成；每名有 name/faction/build/title/intel。
- 只能挑战下一名；胜利晋级/奖励；失败保留名次+情报+下次费用降低。
- 奖励仅天机/称号/外观/图鉴，无唯一战力。
- 赛季 8 周软重置；角色/装备/武学/同伴/江湖志不被赛季重置。
- 武林大会独立规则/得分/外观奖励；规则可见；复用 BattleModifier。
- 江湖志 150+ 条、来源提示、幂等收录、分类/总完成度 tier。
- 归隐二次确认、境界门槛、精确保留 1 武学/1 羁绊/1 称号；开宗仅接口。
- save/load 恢复名次/赛季/江湖志/称号/锦标赛/legacy/scouting。
- 无后端/PvP 依赖。
