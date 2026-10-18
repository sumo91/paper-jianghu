# Content Pipeline, Validation & Simulator v1 报告

> 生成时间：2026-10-18T04:10:50.988Z  
> app：0.1.0 · content：content-v1.0.0 · save schema：1  
> 结论：通过  
> 长模拟：100h `npm run sim:v1`、500h `npm run sim:economy`（manual/nightly，不阻塞 PR 快检）。

## 0. 结论

- **内容校验：通过；channels 10。**
- **Balance matrix：通过；60 格（15 图 × 4 builds），总胜 44。**
- **dominant build：taiji，dominant share 34.1%（阈值 ≤60%）。**
- **无不可通地图：是；hybrid 合法：是。**
- 快检只跑内容 + 矩阵；100h/500h 是手动/夜间长跑，不进入 PR 阻塞路径。
- 无 CMS/后端；内容、schema、报告都在仓库。

## 1. 校验层

| 层 | 结果 | 错误 | 警告 |
| --- | --- | --- | --- |
| combat | 通过 | 0 | 0 |
| itemization | 通过 | 0 | 0 |
| progression | 通过 | 0 | 0 |
| world | 通过 | 0 | 0 |
| economy | 通过 | 0 | 0 |
| factions | 通过 | 0 | 1 |
| companions | 通过 | 0 | 0 |
| activities | 通过 | 0 | 0 |
| endgame | 通过 | 0 | 0 |
| cross-references | 通过 | 0 | 0 |



### 警告

- factions: 事件数量低于 50–60 的目标，但 v1 允许较小验证集

## 2. Balance Matrix

| Build | 胜 | 总 | 胜率 |
| --- | --- | --- | --- |
| taiji | 15 | 15 | 100.0% |
| pojun | 6 | 15 | 40.0% |
| xuanyin | 8 | 15 | 53.3% |
| hybrid | 15 | 15 | 100.0% |

| 地图 | Build | 结果 | 回合 | 残血 |
| --- | --- | --- | --- | --- |
| 洛阳擂台 | taiji | 胜 | 20 | 86% |
| 洛阳擂台 | pojun | 负 | 16 | 0% |
| 洛阳擂台 | xuanyin | 胜 | 22 | 23% |
| 洛阳擂台 | hybrid | 胜 | 20 | 86% |
| 黄河渡口 | taiji | 胜 | 23 | 75% |
| 黄河渡口 | pojun | 负 | 20 | 0% |
| 黄河渡口 | xuanyin | 负 | 25 | 0% |
| 黄河渡口 | hybrid | 胜 | 23 | 75% |
| 镖局古道 | taiji | 胜 | 28 | 75% |
| 镖局古道 | pojun | 负 | 19 | 0% |
| 镖局古道 | xuanyin | 负 | 30 | 6% |
| 镖局古道 | hybrid | 胜 | 28 | 75% |
| 漕运码头 | taiji | 胜 | 22 | 98% |
| 漕运码头 | pojun | 负 | 21 | 0% |
| 漕运码头 | xuanyin | 胜 | 29 | 21% |
| 漕运码头 | hybrid | 胜 | 22 | 98% |
| 扬州盐场 | taiji | 胜 | 24 | 86% |
| 扬州盐场 | pojun | 负 | 21 | 0% |
| 扬州盐场 | xuanyin | 负 | 26 | 0% |
| 扬州盐场 | hybrid | 胜 | 24 | 86% |
| 黑市 | taiji | 胜 | 26 | 99% |
| 黑市 | pojun | 负 | 24 | 0% |
| 黑市 | xuanyin | 负 | 30 | 44% |
| 黑市 | hybrid | 胜 | 26 | 99% |
| 武当金顶 | taiji | 胜 | 24 | 91% |
| 武当金顶 | pojun | 负 | 21 | 0% |
| 武当金顶 | xuanyin | 胜 | 26 | 28% |
| 武当金顶 | hybrid | 胜 | 24 | 91% |
| 解剑池 | taiji | 胜 | 25 | 100% |
| 解剑池 | pojun | 胜 | 19 | 64% |
| 解剑池 | xuanyin | 胜 | 28 | 63% |
| 解剑池 | hybrid | 胜 | 25 | 100% |
| 后山剑冢 | taiji | 胜 | 29 | 100% |
| 后山剑冢 | pojun | 胜 | 19 | 35% |
| 后山剑冢 | xuanyin | 负 | 30 | 61% |
| 后山剑冢 | hybrid | 胜 | 29 | 100% |
| 西湖断桥 | taiji | 胜 | 20 | 88% |
| 西湖断桥 | pojun | 负 | 21 | 0% |
| 西湖断桥 | xuanyin | 负 | 30 | 5% |
| 西湖断桥 | hybrid | 胜 | 20 | 88% |
| 湖心亭 | taiji | 胜 | 20 | 92% |
| 湖心亭 | pojun | 胜 | 20 | 37% |
| 湖心亭 | xuanyin | 胜 | 23 | 50% |
| 湖心亭 | hybrid | 胜 | 20 | 92% |
| 孤山梅林 | taiji | 胜 | 28 | 95% |
| 孤山梅林 | pojun | 胜 | 20 | 32% |
| 孤山梅林 | xuanyin | 胜 | 23 | 55% |
| 孤山梅林 | hybrid | 胜 | 28 | 95% |
| 汉越墓道 | taiji | 胜 | 18 | 94% |
| 汉越墓道 | pojun | 胜 | 17 | 15% |
| 汉越墓道 | xuanyin | 胜 | 21 | 39% |
| 汉越墓道 | hybrid | 胜 | 18 | 94% |
| 地宫 | taiji | 胜 | 22 | 99% |
| 地宫 | pojun | 胜 | 16 | 48% |
| 地宫 | xuanyin | 胜 | 22 | 61% |
| 地宫 | hybrid | 胜 | 22 | 99% |
| 主墓 | taiji | 胜 | 24 | 76% |
| 主墓 | pojun | 负 | 18 | 0% |
| 主墓 | xuanyin | 负 | 26 | 0% |
| 主墓 | hybrid | 胜 | 24 | 76% |

## 3. 版本与存档

- app / content / save schema：0.1.0 / content-v1.0.0 / 1。
- 存档 envelope 记录 content version + schema version + seed。
- 未知/改名 ID 由 `recoverSave` 迁移或隔离，不白屏；见 `tests/content-pipeline.test.ts`。
- PWA 更新需使用同一 release manifest 的 app/content 版本（#12）。

## 4. 验收口径

- schema/引用/world/build/event/economy/cross-reference 各层校验；无效内容失败并给上下文。
- 3 starter kits + hybrid × 15 图矩阵；无不可通地图；dominant share ≤60%。
- 100h/500h 长跑使用 `resolveBattle` + headless sim，报告带版本/seed。
- 内容改名/缺失 ID 有迁移/隔离，不崩溃。
- CI 快检：typecheck → content:check → tests → build。
