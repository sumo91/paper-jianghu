import { useEffect, useMemo, useState } from "react";
import type { RegionId } from "../core/types.ts";
import type { WorldMapDefV1 } from "../core/world-v1.ts";
import { REALM_NAMES } from "../core/types.ts";
import { dangerFor, eliteChanceFor, levelForLayer, recommendedRealmFor } from "../core/world-v1.ts";
import background from "../../concept/jianghu-16x9.webp";
import {
  ACTIVITY_TITLES,
  ELEMENT_LABELS,
  GAME,
  MOVE_TYPE_LABELS,
  REGION_BY_ID,
  REGIONS,
  SLOT_LABELS,
  STYLE_LABELS,
  type RegionUi,
} from "./gameData.ts";
import {
  bossForMap,
  enemiesForMap,
  FENGSHUI_LABELS,
  fengShuiForMap,
  mapById,
  mapsForRegion,
  modifiersForMap,
  npcsForMap,
  targetDropsForMap,
} from "./worldUi.ts";
import { hasRecoverySave, readRecoverySave, useJianghuSession } from "./sessionStore.ts";
import { SettingsDrawer } from "./SettingsDrawer.tsx";
import { StartScreen } from "./StartScreen.tsx";
import { applyUiSettings, loadUiSettings, saveUiSettings, type UiSettings } from "./settings.ts";
import { applyUpdate, promptInstall, registerPwa, type InstallPromptEvent } from "./pwa.ts";

type TabId = "map" | "character" | "martial" | "bag" | "jianghu";

const TABS: Array<{ id: TabId; label: string; seal: string }> = [
  { id: "map", label: "地图", seal: "舆" },
  { id: "character", label: "人物", seal: "侠" },
  { id: "martial", label: "武学", seal: "武" },
  { id: "bag", label: "行囊", seal: "囊" },
  { id: "jianghu", label: "江湖", seal: "江" },
];

function n(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(Math.round(value));
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function tag(value: string): string {
  return value.length <= 2 ? value : value;
}

function rarityClass(rarity: string): string {
  return `rarity-${rarity}`;
}

function initialTab(): TabId {
  if (typeof window === "undefined") return "map";
  const hash = window.location.hash.replace("#", "");
  return TABS.some((item) => item.id === hash) ? (hash as TabId) : "map";
}

function App() {
  const [panelOpen, setPanelOpen] = useState(true);
  const [tab, setTab] = useState<TabId>(initialTab);
  const [selectedRegion, setSelectedRegion] = useState<RegionId>("yangzhou");
  const [selectedMapId, setSelectedMapId] = useState("heishi");
  const [notice, setNotice] = useState<string | null>(null);
  const {
    snapshot, dispatch, reset, offlineReport, dismissOffline, saveStatus, exportSave, importSave,
    entryOpen, hasSave, corruptSave, fixture, continueGame, startNewGame,
  } = useJianghuSession();
  const [settings, setSettings] = useState<UiSettings>(() => loadUiSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [orientationDismissed, setOrientationDismissed] = useState(false);

  useEffect(() => {
    applyUiSettings(settings);
    saveUiSettings(settings);
  }, [settings]);

  useEffect(() => registerPwa({
    onUpdateReady: () => setUpdateReady(true),
    onInstallAvailable: (event) => setInstallPrompt(event),
  }), []);

  const selected = REGION_BY_ID[selectedRegion];
  const currentMap = mapById(snapshot.mapId);
  const currentRegion = currentMap.region;
  const current = REGION_BY_ID[currentRegion];
  const currentLayer = snapshot.mapLayer;
  const regionMaps = mapsForRegion(selectedRegion);
  const selectedMap = regionMaps.find((map) => map.id === selectedMapId) ?? regionMaps[0];
  const activityTitle = ACTIVITY_TITLES[currentRegion];

  const mapEnemies = useMemo(() => enemiesForMap(selectedMap), [selectedMap]);


  function chooseRegion(id: RegionId) {
    setSelectedRegion(id);
    const first = mapsForRegion(id)[0];
    if (first) setSelectedMapId(first.id);
    setTab("map");
  }

  function chooseMap(map: WorldMapDefV1) {
    setSelectedMapId(map.id);
  }

  function travel() {
    try {
      const samePlace = selectedMap.id === snapshot.mapId;
      if (samePlace) {
        dispatch({ type: "setActivity", mapId: selectedMap.id, layer: snapshot.mapLayer, mode: "clear" });
        setNotice("继续行止：江湖又近了一步");
      } else {
        dispatch({ type: "travel", mapId: selectedMap.id });
        setNotice(`已启程：${selected.name} · ${selectedMap.name}`);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "无法启程");
    }
    setTab("map");
    window.setTimeout(() => setNotice(null), 2200);
  }

  return (
    <div className="app-shell">
      <div className={`stage ${panelOpen ? "with-panel" : "no-panel"}`}>
        <main className="map-pane">
          <div className="map-art">
            <img src={background} alt="一纸江湖·山河舆图" />
            <div className="map-wash" />
            <div className="top-hud">
              <div className="resource-bar" aria-label="资源">
                <Resource label="银两" value={snapshot.silver} icon="银" />
                <Resource label="修为" value={snapshot.cultivation} icon="修" />
                <Resource label="名望" value={snapshot.renown} icon="名" />
                <span className="rank-chip">第 {snapshot.level} 级 · {snapshot.active ? "行止中" : "已停"}</span>
              </div>
            </div>

            <div className="map-caption">
              <span>山河舆图</span>
              <i />
              <span>未时 · 晴</span>
            </div>

            <div className="map-hotspots" aria-label="江湖地点">
              {REGIONS.map((region) => (
                <button
                  key={region.id}
                  className={`hotspot ${selectedRegion === region.id ? "selected" : ""}`}
                  style={{ left: `${region.x}%`, top: `${region.y}%` }}
                  onClick={() => chooseRegion(region.id)}
                  aria-label={`前往${region.name}`}
                  title={`${region.name} · ${region.theme}`}
                >
                  <span className="hotspot-ring" />
                </button>
              ))}
              <div
                className="current-pin"
                style={{
                  left: `${REGION_BY_ID[currentRegion].mx}%`,
                  top: `${REGION_BY_ID[currentRegion].my}%`,
                }}
                aria-label={`当前在${current.name}`}
              >
                <span className="pin-core" />
                <span className="pin-label">{"沈砚"}</span>
              </div>
            </div>

            {notice && <div className="toast">{notice}</div>}
            {offlineReport && (
              <div className="offline-banner" role="status">
                <div>
                  <strong>江湖归来 · 离线 {offlineReport.elapsedHours.toFixed(1)}h</strong>
                  <span>
                    {offlineReport.fights} 战 / {offlineReport.wins} 胜 · +{n(offlineReport.silver)} 银两 · +{n(offlineReport.renown)} 名望
                    {offlineReport.stoppedBy ? ` · 因${offlineReport.stoppedBy}停下` : ""}
                  </span>
                </div>
                <button onClick={dismissOffline}>收下</button>
              </div>
            )}
          </div>

          <section className={`bottom-hud ${panelOpen ? "paper" : "overlay"}`} aria-label="当前行止">
            <div className="identity-card">
              <div className="seal-avatar">沈</div>
              <div className="identity-copy">
                <div className="identity-top">
                  <strong>{snapshot.playerName}</strong>
                  <span className="realm-pill">{snapshot.realmName} · {snapshot.buildName}</span>
                </div>
                <p>同伴 · 柳青 <span className="bond">羁绊 8</span></p>
              </div>
            </div>

            <div className="activity-card">
              <div className="eyebrow">此刻 · {current.name} / {snapshot.mapName}</div>
              <div className="activity-title-row">
                <h2>{activityTitle}</h2>
                <span className="level-chip">第 {currentLayer} 层</span>
              </div>
              <div className="activity-meta">
                <span>行止：{snapshot.active ? (snapshot.mode === "clear" ? "自动挑战" : snapshot.mode === "survive" ? "守关" : "护镖") : "已停止"}</span>
                <span>已留 {snapshot.elapsedHours.toFixed(1)}h</span>
                <span>{snapshot.fights} 战 / {snapshot.wins} 胜</span>
              </div>
              <div className="thin-progress"><span /></div>
              {!fixture && <TutorialSlip snapshot={snapshot} dispatch={dispatch} />}
              <div className="objective-line">
                {!snapshot.milestones.firstWin
                  ? "第一个目标：打赢第 1 层"
                  : !snapshot.milestones.firstBossAttempt
                    ? "下一个目标：设行止，推到第 10 层首领"
                    : snapshot.milestones.firstBossKill
                      ? "下一个目标：首通下一张图 / 找一个门派钩子"
                      : "下一个目标：调整配置，拿下第一个首领"}
              </div>
              {snapshot.lastBattle && (
                <details className="battle-report">
                  <summary>最近战报 · {snapshot.lastBattle.enemyName} · {snapshot.lastBattle.outcome === "win" ? "胜" : snapshot.lastBattle.outcome === "timeout" ? "限" : "负"} · {snapshot.lastBattle.rounds} 回合</summary>
                  <div className="battle-report-stats">
                    伤害 {n(snapshot.lastBattle.damageDealt)} / 承伤 {n(snapshot.lastBattle.damageTaken)} / 残血 {Math.round(snapshot.lastBattle.playerHpPct * 100)}%
                  </div>
                  <pre>{snapshot.lastBattle.log.slice(-6).join("\n")}</pre>
                </details>
              )}
            </div>

            <div className="action-card">
              <button className="ghost-button" onClick={() => dispatch({ type: snapshot.active ? "stop" : "resume" })}>
                {snapshot.active ? "止行" : "续行"}
              </button>
              <button className="primary-button" onClick={travel}>
                {selectedMap.id === snapshot.mapId ? "续行止" : "启程"}
                <span>›</span>
              </button>
              <button className="ghost-button small" onClick={() => setPanelOpen((open) => !open)}>
                {panelOpen ? "展卷" : "收台"}
              </button>
            </div>
          </section>
        </main>

        {panelOpen ? (
          <aside className="info-panel" aria-label="江湖信息台">
            <header className="panel-header">
              <div className="panel-title">
                <span className="panel-seal">纸</span>
                <div>
                  <strong>江湖信息台</strong>
                  <p>{fixture ? "开发者 fixture · 不写入玩家存档" : `实时会话 · ${saveStatus === "saved" ? "已保存" : saveStatus === "saving" ? "保存中" : "保存失败"}`}</p>
                </div>
              </div>
              <div className="panel-header-actions">
                <button className="settings-button" onClick={() => setSettingsOpen(true)} aria-label="打开设置">设</button>
                <button className="collapse" onClick={() => setPanelOpen(false)} aria-label="收起信息台">⟩</button>
              </div>
            </header>

            <nav className="tab-bar" aria-label="信息台页面">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  className={`tab-button ${tab === item.id ? "active" : ""}`}
                  onClick={() => setTab(item.id)}
                >
                  <span>{item.seal}</span>
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="panel-scroll">
              {tab === "map" && (
                <MapTab
                  selected={selected}
                  current={current}
                  maps={regionMaps}
                  selectedMap={selectedMap}
                  currentMap={currentMap}
                  currentLayer={currentLayer}
                  liveFights={snapshot.fights}
                  liveWins={snapshot.wins}
                  liveElapsedHours={snapshot.elapsedHours}
                  liveSilver={snapshot.silver}
                  liveTargetDrops={snapshot.targetDrops}
                  enemies={mapEnemies}
                  onChooseMap={chooseMap}
                  onStart={travel}
                  isCurrent={selectedMap.id === snapshot.mapId}
                />
              )}
              {tab === "character" && <CharacterTab snapshot={snapshot} />}
              {tab === "martial" && <MartialTab snapshot={snapshot} />}
              {tab === "bag" && <BagTab snapshot={snapshot} />}
              {tab === "jianghu" && <JianghuTab />}
            </div>
          </aside>
        ) : (
          <button className="reopen-tab" onClick={() => setPanelOpen(true)} aria-label="展开信息台">
            <span>展卷</span>
            <i>‹</i>
          </button>
        )}
      </div>
      <div className={`orientation-hint ${orientationDismissed ? "dismissed" : ""}`} role="status">
        <strong>请横屏游玩</strong>
        <span>一纸江湖按 16:9 横屏设计；竖屏只保留提示，不改变存档。</span>
        <button onClick={() => setOrientationDismissed(true)}>仍要继续</button>
      </div>

      {updateReady && (
        <div className="update-banner" role="status">
          <div>
            <strong>新卷已到</strong>
            <span>{snapshot.active ? "行止中，先止行再更新，避免战斗状态丢失。" : "刷新后使用新版本；当前存档会保留。"}</span>
          </div>
          <button disabled={snapshot.active} onClick={() => applyUpdate()}>刷新</button>
          <button onClick={() => setUpdateReady(false)}>稍后</button>
        </div>
      )}

      <StartScreen
        open={entryOpen}
        hasSave={hasSave}
        corrupt={corruptSave}
        recoveryRaw={readRecoverySave()}
        onContinue={continueGame}
        onStart={startNewGame}
        onImport={importSave}
        onExportRecovery={() => {}}
      />

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        snapshot={snapshot}
        saveStatus={saveStatus}
        settings={settings}
        onSettingsChange={setSettings}
        onExport={exportSave}
        onImport={importSave}
        onReset={(buildId) => { reset(buildId); setSettingsOpen(false); }}
        installAvailable={Boolean(installPrompt)}
        onInstall={() => { void promptInstall().then((outcome) => { if (outcome === "accepted") setInstallPrompt(null); }); }}
        recoveryAvailable={hasRecoverySave()}
        recoveryRaw={readRecoverySave()}
      />

      <p className="stage-hint">横屏 · 16:9 · 江湖信息台默认展开</p>
    </div>
  );
}

function Resource({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <span className="resource">
      <i>{icon}</i>
      <span>
        <small>{label}</small>
        <b>{n(value)}</b>
      </span>
    </span>
  );
}

function TutorialSlip({ snapshot, dispatch }: { snapshot: ReturnType<typeof useJianghuSession>["snapshot"]; dispatch: ReturnType<typeof useJianghuSession>["dispatch"] }) {
  if (snapshot.fixture || snapshot.tutorial.skipped) return null;
  const steps = [
    { id: "map", text: "地图上的红印是地区，当前标记是你所在的位置。" },
    { id: "panel", text: "右侧信息台有地图/人物/武学/行囊/江湖五页。" },
    { id: "activity", text: "在地图页选层，点“续行止/启程”开始自动战斗。" },
    { id: "loadout", text: "武学页可查看 6 个主动槽、心法与优先级。" },
    { id: "boss", text: "第 10 层是地图首领，也是第一个大目标。" },
  ];
  const next = steps.find((step) => !snapshot.tutorial.completed.includes(step.id));
  if (!next) return null;
  return (
    <div className="tutorial-slip" role="note">
      <div>
        <strong>入门 · {snapshot.tutorial.completed.length + 1}/{steps.length}</strong>
        <span>{next.text}</span>
      </div>
      <div className="tutorial-actions">
        <button onClick={() => dispatch({ type: "tutorialStep", step: next.id })}>知道了</button>
        <button onClick={() => dispatch({ type: "skipTutorial" })}>跳过</button>
      </div>
    </div>
  );
}

function MapTab(props: {
  selected: RegionUi;
  current: RegionUi;
  maps: WorldMapDefV1[];
  selectedMap: WorldMapDefV1;
  currentMap: WorldMapDefV1;
  currentLayer: number;
  liveFights: number;
  liveWins: number;
  liveElapsedHours: number;
  liveSilver: number;
  liveTargetDrops: number;
  enemies: ReturnType<typeof enemiesForMap>;
  onChooseMap: (map: WorldMapDefV1) => void;
  onStart: () => void;
  isCurrent: boolean;
}) {
  const { selected, current, maps, selectedMap, currentMap, currentLayer, liveFights, liveWins, liveElapsedHours, liveSilver, liveTargetDrops, enemies, onChooseMap, onStart, isCurrent } = props;
  const drops = targetDropsForMap(selectedMap);
  const modifiers = modifiersForMap(selectedMap);
  const recommendedRealm = recommendedRealmFor(selectedMap);
  const boss = bossForMap(selectedMap);
  const eliteChance = eliteChanceFor(selectedMap, 8);
  const fengShui = fengShuiForMap(selectedMap.id);
  return (
    <div className="tab-content map-tab">
      <div className="region-heading">
        <div>
          <div className="eyebrow">地方志 · {selected.theme}</div>
          <h2>{selected.name}<small> / {selected.faction}</small></h2>
        </div>
        <span className="seal-chip">{selected.rival}</span>
      </div>
      <p className="flavor">{selected.flavor}</p>

      <div className="map-switcher">
        {maps.map((map) => (
          <button
            key={map.id}
            className={selectedMap.id === map.id ? "active" : ""}
            onClick={() => onChooseMap(map)}
          >
            <b>{map.name}</b>
            <small>{map.tier} 图 · 10 层</small>
          </button>
        ))}
      </div>

      <div className="ledger-card">
        <div className="ledger-top">
          <span className="eyebrow">{isCurrent ? "正在行止" : "尚未抵达"}</span>
          <span className="danger">{isCurrent ? `第 ${currentLayer} 层` : "可启程"}</span>
        </div>
        <div className="ledger-map-row">
          <h3>{selectedMap.name}</h3>
          <span className="thin-tag">{selectedMap.orderInRegion} / 3 · 10 层</span>
        </div>
        <div className="ledger-stats">
          <div><small>推荐境界</small><b>{REALM_NAMES[recommendedRealm]}</b></div>
          <div><small>首领层</small><b>Lv.{levelForLayer(selectedMap, 10)}</b></div>
          <div><small>危险</small><b>{dangerFor(selectedMap, 10)}</b></div>
          <div><small>精英率</small><b>{Math.round(eliteChance * 100)}%</b></div>
        </div>
        <div className="goal-line">
          <span>首领 · {boss?.name ?? selectedMap.bossId} · {boss?.phases.length ?? 0} 阶段</span>
          <span className="mini-progress"><i style={{ width: "30%" }} /></span>
        </div>
        <div className="ledger-stats">
          <div><small>已刷</small><b>{isCurrent ? `${liveElapsedHours.toFixed(1)}h` : "—"}</b></div>
          <div><small>战斗</small><b>{isCurrent ? liveFights : "—"}</b></div>
          <div><small>胜率</small><b>{isCurrent ? `${liveFights > 0 ? Math.round((liveWins / liveFights) * 100) : 0}%` : "—"}</b></div>
          <div><small>银两</small><b>{isCurrent ? n(liveSilver) : "—"}</b></div>
        </div>
        <div className="goal-line">
          <span>目标掉落 · 已追踪 {liveTargetDrops} 个</span>
          <span className="mini-progress"><i style={{ width: "30%" }} /></span>
        </div>
        {isCurrent && (
          <button className="inline-start" onClick={onStart}>继续行止 <span>›</span></button>
        )}
        {!isCurrent && (
          <button className="inline-start" onClick={onStart}>从{current.name}启程至此 <span>›</span></button>
        )}
      </div>

      <SectionTitle title="此地凶险" note={`${modifiers.length} 个词缀`} />
      <div className="monster-list">
        {enemies.map((enemy) => (
          <div className="monster-row" key={enemy.id}>
            <span className={`style-dot ${enemy.style}`} />
            <span className="monster-name">{enemy.name}</span>
            <span className={`thin-tag ${enemy.style}`}>{STYLE_LABELS[enemy.style]}</span>
            <span className="monster-level">{enemy.kind === "boss" ? "首领" : enemy.kind === "elite" ? "精英" : `Lv.${levelForLayer(selectedMap, 8)}`}</span>
          </div>
        ))}
      </div>
      <div className="modifier-list">
        {modifiers.map((modifier) => (
          <span key={modifier.id} title={modifier.description} className={`modifier-${modifier.tone}`}>
            {modifier.name}
          </span>
        ))}
      </div>
      <div className="goal-line">
        <span>风水 · {fengShui.tags.map((tag) => FENGSHUI_LABELS[tag] ?? tag).join("·")} · 修炼 +{Math.round(fengShui.cultivationPct * 100)}% · 离线 +{Math.round(fengShui.offlinePct * 100)}%</span>
        <span className="mini-progress"><i style={{ width: "65%" }} /></span>
      </div>
      <div className="activity-choice-row">
        <span>守关 · 5 波生存</span>
        <span>护镖 · 3 段路程</span>
        <span>离线 · 0–3 事件</span>
      </div>
      <div className="goal-line">
        <span>停止条件 · 首领失败 / 目标掉落 / 背包满 / 时限</span>
        <span className="mini-progress"><i style={{ width: "65%" }} /></span>
      </div>

      <SectionTitle title="可能掉落" note="目标可追踪" />
      <div className="drop-grid">
        {drops.map((drop, index) => (
          <div className="drop-row" key={drop.id}>
            <span className={`drop-glyph g${index % 5}`}>物</span>
            <span>{drop.name}</span>
            <em>{drop.source === "normal" ? "普通" : drop.source === "elite" ? "精英" : "首领"} · {Math.round(drop.chance * 100)}%</em>
          </div>
        ))}
      </div>

      <SectionTitle title="此地有人" note="关系会改变对话、任务与价格" />
      <div className="npc-row">
        {(npcsForMap(selectedMap.id).length > 0
          ? npcsForMap(selectedMap.id).map((npc) => ({ id: npc.id, name: npc.name, hint: `${npc.role} · ${npc.personalThread}` }))
          : selected.npcs.map((npc, index) => ({ id: `${npc}-${index}`, name: npc, hint: "本地人物" }))
        ).map((npc) => (
          <span key={npc.id} className="npc-chip" title={npc.hint}>{npc.name}</span>
        ))}
      </div>

    </div>
  );
}

function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="section-title">
      <span>{title}</span>
      {note && <small>{note}</small>}
    </div>
  );
}

function CharacterTab({ snapshot }: { snapshot: ReturnType<typeof useJianghuSession>["snapshot"] }) {
  const { titles } = GAME;
  const gear = snapshot.gear;
  return (
    <div className="tab-content">
      <div className="character-banner">
        <div className="seal-avatar big">沈</div>
        <div>
          <div className="eyebrow">侠客 · {snapshot.realmName}</div>
          <h2>沈砚 <small>{snapshot.buildName}</small></h2>
          <p>等级 {snapshot.level} · 称号：{titles[0]} · 本局 {snapshot.elapsedHours.toFixed(1)}h</p>
        </div>
        <div className="score-box"><small>装备分</small><b>{n(snapshot.gearScore)}</b></div>
      </div>

      <SectionTitle title="属性" note="实时会话" />
      <div className="stat-grid">
        <Stat label="气血" value={n(snapshot.stats.hp)} />
        <Stat label="攻击" value={n(snapshot.stats.attack)} />
        <Stat label="防御" value={n(snapshot.stats.defense)} />
        <Stat label="身法" value={n(snapshot.stats.speed)} />
        <Stat label="会心" value={`${Math.round(snapshot.stats.crit * 100)}%`} />
        <Stat label="内力" value={n(snapshot.stats.innerMax)} />
      </div>

      <SectionTitle title="兵器与行头" note={`${gear.length} / 6`} />
      <div className="gear-list">
        {(Object.keys(SLOT_LABELS) as Array<keyof typeof SLOT_LABELS>).map((slot) => {
          const entry = gear.find((g) => g.slot === slot);
          return (
            <div className={`gear-row ${entry ? rarityClass(entry.rarity) : "empty"}`} key={slot}>
              <span className="gear-slot">{SLOT_LABELS[slot]}</span>
              <span className="gear-name">{entry?.name ?? "未装备"}{entry && entry.refine > 0 ? ` +${entry.refine}` : ""}</span>
              <span className="gear-score">{entry ? n(entry.score) : "—"}</span>
            </div>
          );
        })}
      </div>

      <SectionTitle title="同伴与身份" />
      <div className="companion-card">
        <div className="companion-avatar">柳</div>
        <div>
          <b>柳青 · 医女</b>
          <p>羁绊 8 · 回春：恢复气血并解一个负面</p>
        </div>
        <span className="bond-chip">同行</span>
      </div>
      <div className="title-row">
        {titles.map((title) => <span key={title} className="title-chip">{title}</span>)}
      </div>

    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="stat-cell"><small>{label}</small><b>{value}</b></div>;
}

function MartialTab({ snapshot }: { snapshot: ReturnType<typeof useJianghuSession>["snapshot"] }) {
  const loadout = snapshot.loadout;
  const moves = loadout.moves.map((id) => COMBAT_CONTENT.skills[id]).filter(Boolean);
  const ultimate = COMBAT_CONTENT.skills[loadout.ultimateId];
  const light = COMBAT_CONTENT.skills[loadout.lightSkillId];
  const inner = COMBAT_CONTENT.innerArts[loadout.innerArtId];
  const hearts = loadout.hearts.map((id) => COMBAT_CONTENT.hearts[id]).filter(Boolean);
  const keystones = loadout.keystones.map((id) => COMBAT_CONTENT.keystones[id]).filter(Boolean);
  const preset = COMBAT_CONTENT.priorityPresets?.[loadout.priorityPresetId];
  return (
    <div className="tab-content">
      <div className="region-heading">
        <div>
          <div className="eyebrow">武学谱 · 实时装配</div>
          <h2>{snapshot.buildName}<small> / 六主动槽</small></h2>
        </div>
        <span className="seal-chip">{preset?.name ?? "优先级"}</span>
      </div>
      <div className="inner-art-card">
        <span className="inner-seal">内</span>
        <div>
          <small>主修内功</small>
          <b>{inner?.name ?? loadout.innerArtId}</b>
          <p>{inner?.description ?? "内功"}</p>
        </div>
        <span className="mastery">{snapshot.level} 级</span>
      </div>

      <SectionTitle title="装配主动" note="4 招 + 1 绝技 + 1 轻功" />
      <div className="move-list">
        {[...moves, ultimate, light].filter(Boolean).map((move, index) => (
          <div className={`move-card ${index === 4 ? "ultimate" : ""} ${index === 5 ? "light" : ""}`} key={move.id}>
            <span className={`move-type type-${move.type}`}>{MOVE_TYPE_LABELS[move.type]}</span>
            <div className="move-copy">
              <b>{move.name}</b>
              <small>{ELEMENT_LABELS[move.element]} · {move.tag === "starter" ? "起手" : move.tag === "chase" ? "追击" : move.tag === "finisher" ? "终结" : "功能"} · CD {move.cooldown}</small>
            </div>
            <div className="move-cost"><small>内力</small><b>{move.cost}</b></div>
            <span className="move-index">{index === 4 ? "绝" : index === 5 ? "轻" : index + 1}</span>
          </div>
        ))}
      </div>

      <SectionTitle title="心法" note="4 槽 · 一对一绑定" />
      <div className="heart-list">
        {hearts.map((heart, index) => (
          <div className="heart-row" key={heart.id}>
            <span className="heart-mark">诀</span>
            <div><b>{heart.name}</b><small>{heart.description} · {loadout.heartTargets?.[index] ?? "未绑定"}</small></div>
          </div>
        ))}
      </div>

      <SectionTitle title="经脉奇穴" note="2 槽" />
      <div className="keystone-row">
        {keystones.map((keystone) => <span key={keystone.id} className="keystone">{keystone.name}</span>)}
      </div>

      <SectionTitle title="自动优先级" note={preset?.name ?? "preset"} />
      <div className="priority-list">
        {(preset?.rules ?? []).slice(0, 6).map((rule) => (
          <span key={rule.id}>{rule.note ?? rule.id} → {rule.action.kind === "basic" ? "普攻" : COMBAT_CONTENT.skills[rule.action.skillId]?.name ?? rule.action.skillId}</span>
        ))}
      </div>
    </div>
  );
}

function BagTab({ snapshot }: { snapshot: ReturnType<typeof useJianghuSession>["snapshot"] }) {
  return (
    <div className="tab-content">
      <div className="region-heading">
        <div><div className="eyebrow">行囊 · 随身之物</div><h2>家当</h2></div>
        <span className="seal-chip">{snapshot.divineItems} 件神装</span>
      </div>
      <div className="currency-grid">
        <div><small>银两</small><b>{n(snapshot.silver)}</b></div>
        <div><small>修为</small><b>{n(snapshot.cultivation)}</b></div>
        <div><small>名望</small><b>{n(snapshot.renown)}</b></div>
      </div>
      <SectionTitle title="最近掉落" note="实时会话" />
      <div className="loot-list">
        {snapshot.recentLoot.length === 0 && <p className="empty-state">还没有掉落。设一次行止，回来再看。</p>}
        {snapshot.recentLoot.map((entry, index) => (
          <div className="loot-row" key={`${entry}-${index}`}>
            <span className="loot-glyph">物</span>
            <div><b>{entry}</b><small>最近拾取</small></div>
          </div>
        ))}
      </div>
      <SectionTitle title="当前装备" note={`${snapshot.gear.length} / 6`} />
      <div className="loot-list">
        {snapshot.gear.map((item) => (
          <div className={`loot-row ${rarityClass(item.rarity)}`} key={item.id}>
            <span className="loot-glyph">装</span>
            <div><b>{item.name}{item.refine > 0 ? ` +${item.refine}` : ""}</b><small>{SLOT_LABELS[item.slot as keyof typeof SLOT_LABELS]} · 评分 {n(item.score)}</small></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function JianghuTab() {
  const { factions, goals, letters } = GAME;
  return (
    <div className="tab-content">
      <div className="region-heading">
        <div><div className="eyebrow">江湖 · 人与事</div><h2>江湖簿</h2></div>
        <span className="seal-chip">天机榜 #{GAME.resources.rank}</span>
      </div>

      <SectionTitle title="下一目标" />
      <div className="goal-list">
        {goals.map((goal) => (
          <div className="goal-card" key={goal.label}>
            <div className="goal-top"><b>{goal.label}</b><span>{goal.value}</span></div>
            <div className="goal-bar"><i style={{ width: pct(goal.progress) }} /></div>
            <small>{goal.note}</small>
          </div>
        ))}
      </div>

      <SectionTitle title="门派声望" note="选择会改变价格、任务与结局" />
      <div className="rep-list">
        {factions.map((faction) => (
          <div className="rep-row" key={faction.name}>
            <span className="rep-name">{faction.name}<small>{faction.region}</small></span>
            <span className="rep-level">{faction.level}</span>
            <span className="rep-bar"><i className={faction.tone} style={{ width: pct(faction.value) }} /></span>
          </div>
        ))}
      </div>

      <SectionTitle title="江湖帖" note="2 封未读" />
      <div className="letter-list">
        {letters.map((letter) => (
          <button className={`letter-row ${letter.unread ? "unread" : ""}`} key={letter.title}>
            <span className="letter-seal">{letter.from.slice(0, 1)}</span>
            <span><b>{letter.title}</b><small>{letter.from} · {letter.time}</small></span>
            {letter.unread && <em />}
          </button>
        ))}
      </div>

    </div>
  );
}

export default App;
