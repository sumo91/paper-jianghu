# Factions, NPCs & Events v1 内容验证报告

> 生成时间：2026-10-17T20:04:32.331Z  
> 规则 seam：`FactionEventService`  
> 状态：schema + 验证集；完整 50–60 事件文本仍属于内容生产。

## 0. 结论

- **内容校验：通过。**
- 门派 5 / 5；NPC 20 / 20；事件 21；商店 10；事件链 1。
- 完整“中原旧盟”链已端到端跑通：ev_zy_arena:wulin → ev_zy_letter:deliver → ev_zy_lei:spar → ev_zy_plot:protect → ev_zy_end:accept。
- 离线事件模拟：解析 3 个；待决上限 3/3。
- 随机事件模拟：触发 4 次；无红点堆叠（pending ≤3）。
- 事件文本目标仍为 50–60；本报告使用较小的验证集，符合 spec 允许的 v1 范围。

## 1. 内容计数

| 项目 | 数量 |
| --- | --- |
| 门派 | 5 |
| NPC | 20 |
| 事件 | 21 |
| 门派商店 | 10 |
| 事件链 | 1 |
| 离线事件 | 6 |
| 随机旅行事件 | 4 |

## 2. 地区事件覆盖

| 地区 | 事件数 |
| --- | --- |
| zhongyuan | 8 |
| wudang | 3 |
| xihu | 4 |
| yangzhou | 3 |
| hanyue | 3 |

## 3. 中原链

1. ev_zy_arena:wulin
2. ev_zy_letter:deliver
3. ev_zy_lei:spar
4. ev_zy_plot:protect
5. ev_zy_end:accept

- 结束时 flag：invite_faction_wulin / zy_arena_helped_wulin / zy_letter_delivered / zy_lei_sparred / zy_final
- 称号：中原旧盟
- 物品：td_luoyang_seal
- 声望：faction_wulin=48 / rival_court=0
- NPC：npc_lei=60 / npc_yue=10 / npc_shen=8
- 事件日志：5 条

## 4. 离线与随机事件约束

- 离线待决最多 3；本模拟峰值 3。
- 随机事件有 4 小时冷却，且同一事件有 cooldown/once 控制；本模拟触发 4 次。
- 事件选择全部原子写入；失败效果回滚（见 `tests/factions-events-v1.test.ts`）。
- 江湖帖 inbox 记录事件/门派/离线，不堆独立 tab 红点。

## 5. 验收口径

- join/switch 原子；改换门派 rank 清零、旧声望下降、已学武学保留。
- 声望 0–100 夹紧；帮一方会自动压低对立面声望。
- NPC 关系 5 档影响对话/任务，并跨门派持久。
- 事件 1–3 选择、每项都有系统效果；失败效果回滚。
- 链 flag 门禁、无 dead-end；内容校验拒绝缺 speaker/effect/结局。
- 门派商店 rank 门禁、确定性库存、购买原子。
- save/load 恢复 faction/NPC/flags/pending/cooldowns/inbox/shop。
