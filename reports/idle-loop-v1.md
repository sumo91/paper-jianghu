# Idle-first Base Loop 验证报告（#15）

> 生成时间：2026-10-18T04:10:10.014Z  
> 口径：连续在线 10/30/60 分钟；自动战斗、掉落、升级、学招、换装、换地点全部走真实 `JianghuSession`。  
> 叙事开关：`NARRATIVE_ENABLED=false`；隐藏江湖/门派/NPC/同伴剧情/终局入口，不删除代码。

## 0. 结论

- 无存档直接进入 1 级自动挂机；默认沈砚/太极/洛阳，不再走四步向导。
- 首屏可见等级、XP 条、资源、场次、最近战报、掉落/升级提示。
- 10 分钟：三套 starter kit 均 ≥3 次可见成长（等级+掉落），≥1 掉落。
- 30 分钟：三套均 ≥5 次成长，均获得至少 1 个可学招式；可学习、可装配、可手动换装。
- 换地图自动开始：travel 后 active=true，layer=1。
- 离线 8h 只显示数字总结（时间/场次/等级/掉落/银两），无事件选择/信件。
- 100h 三套宗师验收仍通过。

## 1. 10 / 30 分钟指标

| Build | 10m 等级 | 10m 掉落 | 10m 成长 | 30m 等级 | 30m 掉落 | 30m 成长 | 30m 可学招式 | 30m 已学 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 太极反伤 | 4 | 7 | 10 | 10 | 15 | 24 | common_liuhe、common_guixi | taiji_tuishou、common_liuhe |
| 破军爆发 | 2 | 4 | 5 | 5 | 9 | 13 | common_liuhe | pojun_xuezhan、common_liuhe |
| 玄阴封穴 | 3 | 5 | 7 | 4 | 6 | 9 | common_liuhe、common_guixi | xuanyin_yinfeng、common_liuhe |

## 2. 招式装配与换装

| Build | 装配后 4 招 | 换装 | 最后提示 |
| --- | --- | --- | --- |
| 太极反伤 | taiji_yunshou / taiji_lanque / taiji_baihe / common_liuhe | 成功 | 已装配 六合式 |
| 破军爆发 | pojun_lipi / pojun_hengsao / pojun_zhan / common_liuhe | 成功 | 已装配 六合式 |
| 玄阴封穴 | xuanyin_zhi / xuanyin_fengxue / xuanyin_shigu / common_liuhe | 成功 | 已装配 六合式 |

## 3. 换地点

| Build | 目标地图 | active | layer | 31m 场次 |
| --- | --- | --- | --- | --- |
| 太极反伤 | caoyun | true | 3 | 44 |
| 破军爆发 | caoyun | true | 3 | 45 |
| 玄阴封穴 | caoyun | true | 3 | 37 |

## 4. 叙事隐藏清单

- 隐藏：江湖 tab、门派声望、NPC 关系、江湖帖、同伴剧情、终局/天机榜/武林大会/江湖志、事件选择、故事化标题、地图 flavor/NPC 行、完整四步向导。
- 保留：地图、资源、等级/XP、装备/掉落、武学/装配、行囊、战报、自动行止、离线数字总结。
- 恢复方式：把 `src/ui/features.ts` 的 `NARRATIVE_ENABLED` 改回 true；代码未删除。

## 5. 真人试玩检查（需你执行）

1. 打开首页，是否无需填写表单就已在挂机？
2. 10 分钟内是否至少看到 3 次“升级/换装/掉落”提示？
3. 30 分钟内是否拿到并装配至少 1 个新招式？
4. 换地图后是否自动开打，不需要再点“开始”？
5. 关掉 8 小时回来，是否只看到数字总结、没有剧情选择？
6. 如果以上任何一项为否，先调掉落/升级/招式节奏，不要恢复叙事。
