import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { RegionId } from "../core/types.ts";
import type { WorldMapDefV1 } from "../core/world-v1.ts";
import { REALM_NAMES } from "../core/types.ts";
import { COMBAT_CONTENT } from "../data/combat-v1.ts";
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
import { hasRecoverySave, readRecoverySave, useJianghuSession, type PulledBattleResult } from "./sessionStore.ts";
import { SettingsDrawer } from "./SettingsDrawer.tsx";
import { StartScreen } from "./StartScreen.tsx";
import { NARRATIVE_ENABLED } from "./features.ts";
import { TABS, type TabId } from "./tabs.ts";
import { applyUiSettings, loadUiSettings, saveUiSettings, type UiSettings } from "./settings.ts";
import { applyUpdate, promptInstall, registerPwa, type InstallPromptEvent } from "./pwa.ts";


const BATTLE_ANCHORS: Record<RegionId, { x: number; y: number }> = {
  zhongyuan: { x: 17, y: 35 },
  wudang: { x: 78, y: 22 },
  xihu: { x: 28, y: 66 },
  yangzhou: { x: 50, y: 66 },
  hanyue: { x: 78, y: 68 },
};

function n(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(Math.round(value));
}

function elapsedLabel(hours: number): string {
  const total = Math.max(0, Math.floor(hours * 3600));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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
    snapshot, dispatch, pullBattle, reset, offlineReport, dismissOffline, saveStatus, exportSave, importSave,
    entryOpen, hasSave, corruptSave, fixture, continueGame, startNewGame,
  } = useJianghuSession();
  const [settings, setSettings] = useState<UiSettings>(() => loadUiSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [orientationDismissed, setOrientationDismissed] = useState(false);
  const [battleLogOpen, setBattleLogOpen] = useState(false);
  const lastMapRef = useRef<string | null>(null);
  const [startWizardOpen, setStartWizardOpen] = useState(false);

  useEffect(() => {
    applyUiSettings(settings);
    saveUiSettings(settings);
  }, [settings]);

  useEffect(() => registerPwa({
    onUpdateReady: () => setUpdateReady(true),
    onInstallAvailable: (event) => setInstallPrompt(event),
  }), []);

  useEffect(() => {
    if (lastMapRef.current === snapshot.mapId) return;
    lastMapRef.current = snapshot.mapId;
    const activeMap = mapById(snapshot.mapId);
    setSelectedRegion(activeMap.region);
    setSelectedMapId(activeMap.id);
  }, [snapshot.mapId]);

  const selected = REGION_BY_ID[selectedRegion];
  const currentMap = mapById(snapshot.mapId);
  const currentRegion = currentMap.region;
  const current = REGION_BY_ID[currentRegion];
  const currentLayer = snapshot.mapLayer;
  const regionMaps = mapsForRegion(selectedRegion);
  const selectedMap = regionMaps.find((map) => map.id === selectedMapId) ?? regionMaps[0];
  const activityTitle = NARRATIVE_ENABLED ? ACTIVITY_TITLES[currentRegion] : "自动挂机";

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
          <div className={`map-art ${snapshot.active ? "battle-on" : ""}`}>
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
                <span className="pin-label">{snapshot.playerName}</span>
              </div>
              <BattleCluster key={snapshot.mapId} snapshot={snapshot} map={currentMap} region={current} panelOpen={panelOpen} pullBattle={pullBattle} />
            </div>

            {notice && <div className="toast">{notice}</div>}
            {offlineReport && (
              <div className="offline-banner" role="status">
                <div>
                  <strong>离线归来 · {offlineReport.effectiveHours.toFixed(1)}h 结算</strong>
                  <span>
                    {offlineReport.fights} 战 / {offlineReport.wins} 胜 · Lv.+{offlineReport.levels} · 掉落 {offlineReport.drops} · +{n(offlineReport.silver)} 银两
                    {offlineReport.stoppedBy ? ` · 因${offlineReport.stoppedBy}停下` : ""}
                  </span>
                </div>
                <button onClick={dismissOffline}>收下</button>
              </div>
            )}
          </div>

          {(snapshot.notice || snapshot.lastDrop || snapshot.pendingArts.length > 0) && (
            <div className="status-toast" role="status">
              {snapshot.pendingArts.length > 0 ? (
                <>
                  <span>获得招式：{snapshot.pendingArts.map((id) => COMBAT_CONTENT.skills[id]?.name ?? id).join("、")}</span>
                  <button onClick={() => dispatch({ type: "learnArt", artId: snapshot.pendingArts[0] })}>学习</button>
                </>
              ) : snapshot.lastDrop ? (
                <span>{snapshot.lastDrop.upgraded ? "已换装" : "新掉落"}：{snapshot.lastDrop.name} · 评分 {n(snapshot.lastDrop.score)}</span>
              ) : (
                <span>{snapshot.notice}</span>
              )}
            </div>
          )}

          <section className="status-bar" aria-label="行止状态">
            <div className="status-main">
              <span className={`status-dot ${snapshot.active ? "on" : "off"}`} />
              <strong>{snapshot.active ? (snapshot.mode === "clear" ? "自动挑战中" : snapshot.mode === "survive" ? "守关中" : "护镖中") : "已停止"}</strong>
              <span className="status-sep">·</span>
              <span>{current.name} / {snapshot.mapName} · 第 {currentLayer} 层</span>
              <span className="status-xp">
                <span>Lv.{snapshot.level}</span>
                <i><b style={{ width: `${Math.min(100, Math.round((snapshot.xp / Math.max(1, snapshot.xpToNext)) * 100))}%` }} /></i>
                <span>{snapshot.xp}/{snapshot.xpToNext}</span>
              </span>
              <span className="status-fights">{snapshot.fights} 战 / {snapshot.wins} 胜</span>
              <span className="status-time">行止 {elapsedLabel(snapshot.elapsedHours)}</span>
            </div>
            <div className="status-actions">
              <button
                className="status-speed"
                title="战斗速度（1× / 2× / 4×）"
                onClick={() => dispatch({ type: "setSpeed", speed: snapshot.speed === 1 ? 2 : snapshot.speed === 2 ? 4 : 1 })}
              >×{snapshot.speed}</button>
              <button onClick={() => setBattleLogOpen(true)} disabled={!snapshot.lastBattle}>战报</button>
              <button onClick={() => dispatch({ type: snapshot.active ? "stop" : "resume" })}>{snapshot.active ? "止行" : "续行"}</button>
              <button className="status-primary" onClick={travel}>
                {selectedMap.id === snapshot.mapId ? "继续" : "启程"}
                <span>›</span>
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
                  <strong>{NARRATIVE_ENABLED ? "江湖信息台" : "行止信息台"}</strong>
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
                  onChooseRegion={chooseRegion}
                  onStart={travel}
                  isCurrent={selectedMap.id === snapshot.mapId}
                />
              )}
              {tab === "character" && <CharacterTab snapshot={snapshot} />}
              {tab === "martial" && <MartialTab snapshot={snapshot} dispatch={dispatch} />}
              {tab === "bag" && <BagTab snapshot={snapshot} dispatch={dispatch} />}
              {tab === "jianghu" && NARRATIVE_ENABLED && <JianghuTab />}
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

      {battleLogOpen && snapshot.lastBattle && (
        <BattleLogDrawer snapshot={snapshot} onClose={() => setBattleLogOpen(false)} />
      )}

      <StartScreen
        open={startWizardOpen || (entryOpen && corruptSave)}
        hasSave={hasSave}
        corrupt={corruptSave}
        recoveryRaw={readRecoverySave()}
        onContinue={() => { continueGame(); setStartWizardOpen(false); }}
        onClose={() => setStartWizardOpen(false)}
        onStart={(options) => { startNewGame(options); setStartWizardOpen(false); }}
        onImport={(serialized) => {
          const result = importSave(serialized);
          if (result.ok) setStartWizardOpen(false);
          return result;
        }}
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
        onOpenStart={() => { setSettingsOpen(false); setStartWizardOpen(true); }}
        installAvailable={Boolean(installPrompt)}
        onInstall={() => { void promptInstall().then((outcome) => { if (outcome === "accepted") setInstallPrompt(null); }); }}
        recoveryAvailable={hasRecoverySave()}
        recoveryRaw={readRecoverySave()}
      />

      <p className="stage-hint">横屏 · 16:9 · 江湖信息台默认展开</p>
    </div>
  );
}

function HpRing({ pct }: { pct: number }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, pct));
  const arc = (clamped / 100) * circumference;
  return (
    <svg className="orb-hp-svg" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(35, 29, 22, .72)" strokeWidth="16" />
      <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(241, 228, 204, .62)" strokeWidth="10" />
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke="#c92f23"
        strokeWidth="10"
        strokeDasharray={`${arc} ${circumference}`}
        transform="rotate(-90 50 50)"
        style={{ transition: "stroke-dasharray 900ms linear" }}
      />
    </svg>
  );
}

type UiBattlePhase = "searching" | "encounter" | "fighting" | "result";

function BattleCluster(props: {
  snapshot: ReturnType<typeof useJianghuSession>["snapshot"];
  map: WorldMapDefV1;
  region: RegionUi;
  panelOpen: boolean;
  pullBattle: () => PulledBattleResult;
}) {
  const { snapshot, map, region, panelOpen, pullBattle } = props;
  const [phase, setPhase] = useState<UiBattlePhase>("searching");
  const [report, setReport] = useState<PulledBattleResult>(null);
  const [shownHp, setShownHp] = useState({ player: 100, enemy: 100 });
  const [damagePopup, setDamagePopup] = useState<{ key: number; amount: number } | null>(null);
  const speed = snapshot.speed || 1;
  const elite = enemiesForMap(map).find((enemy) => enemy.kind === "elite");
  const kind = report?.kind ?? (snapshot.mapLayer >= 10 ? "boss" : "normal");
  const kindLabel = kind === "boss" ? "首领" : kind === "elite" ? "精英" : "普通";
  const finalPlayerHp = report ? Math.max(0, Math.min(100, Math.round(report.playerHpPct * 100))) : 100;
  const finalEnemyHp = report ? Math.max(0, Math.min(100, Math.round(report.enemyHpPct * 100))) : 100;
  const timeline = report?.timeline ?? [];
  const roundCount = Math.max(1, timeline.length);
  const fightSeconds = Math.max(0.8, report?.seconds ?? 2);
  const roundSeconds = fightSeconds / roundCount;
  const playerFirst = report?.playerFirst ?? true;
  const singleBeat = Boolean(report && ((playerFirst && finalEnemyHp <= 0) || (!playerFirst && finalPlayerHp <= 0)));
  const enemyName = report?.enemyName ?? "";
  const enemyNames = enemyName.split(/[、,，]/).map((name) => name.trim()).filter(Boolean);
  const enemyLabel = enemyNames.length > 1 ? `${enemyNames[0]} 等 ${enemyNames.length} 人` : enemyName;
  const enemyVisible = phase !== "searching" && Boolean(report);
  const resultWin = report?.outcome === "win";
  const cssPhase = phase === "result" ? (resultWin ? "phase-victory" : "phase-defeat") : `phase-${phase}`;
  const phaseLabel = phase === "searching" ? "寻找对手" : phase === "encounter" ? "遇敌" : phase === "fighting" ? "交战"
    : report?.outcome === "win" ? "胜" : report?.outcome === "timeout" ? "限" : "负";
  const displayPlayerHp = phase === "searching" ? 100 : phase === "encounter" ? 100 : phase === "fighting" ? shownHp.player : finalPlayerHp;
  const displayEnemyHp = phase === "searching" ? 0 : phase === "encounter" ? 100 : phase === "fighting" ? shownHp.enemy : finalEnemyHp;
  const anchor = BATTLE_ANCHORS[region.id];
  const clamped = panelOpen && anchor.x > 60;
  const left = clamped ? 60 : anchor.x;

  useEffect(() => {
    if (!snapshot.active) return;
    let cancelled = false;
    const timers: number[] = [];
    const pushTimer = (fn: () => void, delay: number) => {
      const timer = window.setTimeout(fn, delay);
      timers.push(timer);
    };
    const startSearch = () => {
      if (cancelled) return;
      setPhase("searching");
      setReport(null);
      setShownHp({ player: 100, enemy: 100 });
      setDamagePopup(null);
      const searchMs = (1800 + Math.random() * 1800) / speed;
      pushTimer(() => {
        if (cancelled) return;
        const next = pullBattle();
        if (!next) {
          if (snapshot.active) pushTimer(startSearch, 500);
          return;
        }
        setReport(next);
        setShownHp({ player: 100, enemy: 100 });
        setPhase("encounter");
        pushTimer(() => {
          if (cancelled) return;
          setPhase("fighting");
          const rounds = Math.max(1, next.timeline?.length ?? 1);
          const durationMs = Math.max(800, next.seconds * 1000);
          const roundMs = durationMs / rounds;
          next.timeline?.forEach((entry, index) => {
            pushTimer(() => {
              if (cancelled) return;
              setShownHp({
                player: Math.round(entry.playerHpPct * 100),
                enemy: Math.round(entry.enemyHpPct * 100),
              });
              const amount = Math.max(entry.playerDamage, entry.enemyDamage);
              if (amount > 0) {
                setDamagePopup({ key: index + 1, amount });
                pushTimer(() => setDamagePopup(null), 760);
              }
            }, roundMs * (index + 1));
          });
          pushTimer(() => {
            if (cancelled) return;
            setShownHp({ player: Math.max(0, Math.round(next.playerHpPct * 100)), enemy: Math.max(0, Math.round(next.enemyHpPct * 100)) });
            setPhase("result");
            pushTimer(startSearch, 1600 / speed);
          }, durationMs);
        }, 800 / speed);
      }, searchMs);
    };
    startSearch();
    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [snapshot.active, snapshot.speed, snapshot.mapId, pullBattle]);

  if (!snapshot.active) return null;
  return (
    <div
      className={`battle-cluster kind-${kind} ${cssPhase} ${singleBeat ? "single-beat" : ""}`}
      data-first={playerFirst ? "player" : "enemy"}
      style={{ left: `${left}%`, top: `${anchor.y}%`, "--round-seconds": `${roundSeconds}s` } as CSSProperties}
      role="group"
      aria-label={phase === "searching" ? "自动行止中，寻找对手" : `${phaseLabel}：${enemyLabel}`}
    >
      <div className="cluster-duel">
        {phase === "searching" && (
          <>
            <span className="search-sweep" aria-hidden="true" />
            <span className="search-sweep sweep-two" aria-hidden="true" />
            <span className="search-beam" aria-hidden="true" />
            <span className="search-scan" aria-hidden="true" />
          </>
        )}
        {phase === "encounter" && (
          <>
            <span className="encounter-flash" aria-hidden="true" />
            <span className="encounter-alert" aria-hidden="true">!</span>
          </>
        )}
        {cssPhase === "phase-victory" && <span className="victory-burst" aria-hidden="true" />}
        {cssPhase === "phase-defeat" && <span className="defeat-fade" aria-hidden="true" />}
        <div className="combat-orb player" style={{ "--hp": `${displayPlayerHp}%` } as CSSProperties}>
          <span className="orb-frame"><span className="orb-figure">沈</span><HpRing pct={displayPlayerHp} /></span>
        </div>
        {phase === "fighting" && <span className="cluster-impact" />}
        {phase === "fighting" && damagePopup && (
          <span className="cluster-damage hit-pop" key={`${damagePopup.key}-${damagePopup.amount}`}>-{n(damagePopup.amount)}</span>
        )}
        {enemyVisible && (
          <div className="combat-orb enemy" style={{ "--hp": `${displayEnemyHp}%` } as CSSProperties}>
            <span className="orb-frame"><span className="orb-figure">敌</span><HpRing pct={displayEnemyHp} /></span>
            <span className="orb-name">{enemyLabel}<small>{kindLabel}</small></span>
          </div>
        )}
        {!enemyVisible && phase !== "searching" && <span className="cluster-waiting">接敌中</span>}
      </div>
      <span className={`cluster-outcome phase-label-${phase}`}>{phaseLabel}</span>
    </div>
  );
}

function BattleLogDrawer(props: {
  snapshot: ReturnType<typeof useJianghuSession>["snapshot"];
  onClose: () => void;
}) {
  const battle = props.snapshot.lastBattle;
  if (!battle) return null;
  return (
    <div className="battle-drawer-backdrop" onClick={props.onClose}>
      <section className="battle-drawer" role="dialog" aria-modal="true" aria-label="战斗战报" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <div className="eyebrow">战报 · 第 {battle.rounds} 回合 · {battle.outcome === "win" ? "胜" : battle.outcome === "timeout" ? "限" : "负"}</div>
            <h2>{battle.enemyName}</h2>
          </div>
          <button onClick={props.onClose} aria-label="关闭战报">×</button>
        </header>
        <div className="battle-drawer-stats">
          <span>伤害 <b>{n(battle.damageDealt)}</b></span>
          <span>承伤 <b>{n(battle.damageTaken)}</b></span>
          <span>残血 <b>{Math.round(battle.playerHpPct * 100)}%</b></span>
        </div>
        <pre>{battle.log.slice(-10).join("\n")}</pre>
      </section>
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
  if (!NARRATIVE_ENABLED || snapshot.fixture || snapshot.tutorial.skipped) return null;
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
  onChooseRegion: (region: RegionId) => void;
  onStart: () => void;
  isCurrent: boolean;
}) {
  const { selected, current, maps, selectedMap, currentMap, currentLayer, liveFights, liveWins, liveElapsedHours, liveSilver, liveTargetDrops, enemies, onChooseMap, onChooseRegion, onStart, isCurrent } = props;
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
          <div className="eyebrow">挂机地点 · {selected.name}</div>
          <h2>{selectedMap.name}<small> / 第 {currentLayer} 层</small></h2>
        </div>
        <span className="seal-chip">{isCurrent ? "行止中" : "可启程"}</span>
      </div>

      <div className="region-selector" aria-label="地区">
        {REGIONS.map((region) => (
          <button key={region.id} className={selected.id === region.id ? "active" : ""} onClick={() => onChooseRegion(region.id)}>
            {region.name}
          </button>
        ))}
      </div>

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
      {NARRATIVE_ENABLED && (
        <div className="activity-choice-row">
          <span>守关 · 5 波生存</span>
          <span>护镖 · 3 段路程</span>
          <span>离线 · 0–3 事件</span>
        </div>
      )}
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

      {NARRATIVE_ENABLED && (
        <>
          <SectionTitle title="此地有人" note="关系会改变对话、任务与价格" />
          <div className="npc-row">
            {(npcsForMap(selectedMap.id).length > 0
              ? npcsForMap(selectedMap.id).map((npc) => ({ id: npc.id, name: npc.name, hint: `${npc.role} · ${npc.personalThread}` }))
              : selected.npcs.map((npc, index) => ({ id: `${npc}-${index}`, name: npc, hint: "本地人物" }))
            ).map((npc) => (
              <span key={npc.id} className="npc-chip" title={npc.hint}>{npc.name}</span>
            ))}
          </div>
        </>
      )}

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
          <h2>{snapshot.playerName} <small>{snapshot.buildName}</small></h2>
          <p>等级 {snapshot.level} · 本局 {snapshot.elapsedHours.toFixed(1)}h · 装备分 {n(snapshot.gearScore)}</p>
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

      {NARRATIVE_ENABLED && (
        <>
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
        </>
      )}

    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="stat-cell"><small>{label}</small><b>{value}</b></div>;
}

function MartialTab({ snapshot, dispatch }: { snapshot: ReturnType<typeof useJianghuSession>["snapshot"]; dispatch: ReturnType<typeof useJianghuSession>["dispatch"] }) {
  const loadout = snapshot.loadout;
  const inner = COMBAT_CONTENT.innerArts[loadout.innerArtId];
  const hearts = loadout.hearts.map((id) => COMBAT_CONTENT.hearts[id]).filter(Boolean);
  const keystones = loadout.keystones.map((id) => COMBAT_CONTENT.keystones[id]).filter(Boolean);
  const preset = COMBAT_CONTENT.priorityPresets?.[loadout.priorityPresetId];
  const ownedMoves = snapshot.ownedMoves.map((id) => COMBAT_CONTENT.skills[id]).filter(Boolean);
  const ownedUltimates = snapshot.ownedUltimates.map((id) => COMBAT_CONTENT.skills[id]).filter(Boolean);
  const ownedLights = snapshot.ownedLights.map((id) => COMBAT_CONTENT.skills[id]).filter(Boolean);
  return (
    <div className="tab-content">
      <div className="region-heading">
        <div>
          <div className="eyebrow">武学 · 实时装配</div>
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

      {snapshot.pendingArts.length > 0 && (
        <div className="learn-panel">
          <div>
            <strong>获得新招式</strong>
            <span>{snapshot.pendingArts.map((id) => COMBAT_CONTENT.skills[id]?.name ?? id).join("、")} · 学习后可装配</span>
          </div>
          <button onClick={() => dispatch({ type: "learnArt", artId: snapshot.pendingArts[0] })}>学习</button>
        </div>
      )}

      <SectionTitle title="装配主动" note="4 招 + 1 绝技 + 1 轻功 · 可切换" />
      <div className="move-list">
        {[0, 1, 2, 3].map((index) => {
          const move = COMBAT_CONTENT.skills[loadout.moves[index]];
          return (
            <div className={`move-card ${move?.tag === "finisher" ? "ultimate" : ""}`} key={index}>
              <span className={`move-type type-${move?.type ?? "shi"}`}>{move ? MOVE_TYPE_LABELS[move.type] : "招"}</span>
              <div className="move-copy">
                <select
                  aria-label={`第 ${index + 1} 招`}
                  value={loadout.moves[index]}
                  onChange={(event) => dispatch({ type: "equipArt", slot: `move${index}`, artId: event.target.value })}
                >
                  {ownedMoves.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
                </select>
                <small>{move ? `${ELEMENT_LABELS[move.element]} · CD ${move.cooldown} · ${move.cost} 内力` : "未装备"}</small>
              </div>
              <span className="move-index">{index + 1}</span>
            </div>
          );
        })}
        {[
          { slot: "ultimate", label: "绝技", options: ownedUltimates, current: loadout.ultimateId, mark: "绝" },
          { slot: "light", label: "轻功", options: ownedLights, current: loadout.lightSkillId, mark: "轻" },
        ].map((entry) => (
          <div className={`move-card ${entry.slot === "ultimate" ? "ultimate" : "light"}`} key={entry.slot}>
            <span className={`move-type ${entry.slot === "ultimate" ? "type-qi" : "type-xu"}`}>{entry.label.slice(0, 1)}</span>
            <div className="move-copy">
              <select
                aria-label={entry.label}
                value={entry.current}
                onChange={(event) => dispatch({ type: "equipArt", slot: entry.slot, artId: event.target.value })}
              >
                {entry.options.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
              </select>
              <small>{entry.slot === "ultimate" ? "连击/内力条件" : "保命/位移"}</small>
            </div>
            <span className="move-index">{entry.mark}</span>
          </div>
        ))}
      </div>

      <SectionTitle title="已学招式" note={`${ownedMoves.length} 招`} />
      <div className="learned-moves">
        {ownedMoves.map((move) => <span key={move.id} className={loadout.moves.includes(move.id) ? "equipped" : ""}>{move.name}</span>)}
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
        {(preset?.rules ?? []).slice(0, 8).map((rule) => (
          <span key={rule.id}>{rule.note ?? rule.id} → {rule.action.kind === "basic" ? "普攻" : COMBAT_CONTENT.skills[rule.action.skillId]?.name ?? rule.action.skillId}</span>
        ))}
      </div>
    </div>
  );
}

function BagTab({ snapshot, dispatch }: { snapshot: ReturnType<typeof useJianghuSession>["snapshot"]; dispatch: ReturnType<typeof useJianghuSession>["dispatch"] }) {
  const bag = snapshot.bag;
  const equipped = bag.filter((item) => item.equipped);
  const spare = bag.filter((item) => !item.equipped);
  return (
    <div className="tab-content">
      <div className="region-heading">
        <div><div className="eyebrow">行囊 · 装备与掉落</div><h2>家当</h2></div>
        <span className="seal-chip">{snapshot.divineItems} 件神装</span>
      </div>
      <div className="currency-grid">
        <div><small>银两</small><b>{n(snapshot.silver)}</b></div>
        <div><small>修为</small><b>{n(snapshot.cultivation)}</b></div>
        <div><small>名望</small><b>{n(snapshot.renown)}</b></div>
      </div>
      {snapshot.lastDrop && (
        <div className="drop-compare">
          <strong>{snapshot.lastDrop.upgraded ? "已自动换装" : "新掉落"}</strong>
          <span>{snapshot.lastDrop.name} · 评分 {n(snapshot.lastDrop.score)} {snapshot.lastDrop.upgraded ? `（原 ${n(snapshot.lastDrop.previousScore)}）` : "（未替换）"}</span>
        </div>
      )}
      <SectionTitle title="当前装备" note={`${equipped.length} / 6`} />
      <div className="loot-list">
        {equipped.map((item) => (
          <div className={`loot-row ${rarityClass(item.rarity)}`} key={item.id}>
            <span className="loot-glyph">装</span>
            <div><b>{item.name}{item.refine > 0 ? ` +${item.refine}` : ""}</b><small>{SLOT_LABELS[item.slot as keyof typeof SLOT_LABELS]} · 评分 {n(item.score)}</small></div>
          </div>
        ))}
      </div>
      <SectionTitle title="行囊全部" note={`${spare.length} 件可换`} />
      <div className="loot-list">
        {spare.length === 0 && <p className="empty-state">暂无备用装备；挂机掉落会自动比较，升级才换。</p>}
        {spare.map((item) => (
          <div className={`loot-row ${rarityClass(item.rarity)}`} key={item.id}>
            <span className="loot-glyph">物</span>
            <div><b>{item.name}{item.refine > 0 ? ` +${item.refine}` : ""}</b><small>{SLOT_LABELS[item.slot as keyof typeof SLOT_LABELS]} · 评分 {n(item.score)}</small></div>
            <button className="equip-button" onClick={() => dispatch({ type: "equipItem", itemId: item.id })}>装备</button>
          </div>
        ))}
      </div>
      <SectionTitle title="最近掉落" note="实时" />
      <div className="loot-list">
        {snapshot.recentLoot.length === 0 && <p className="empty-state">还没有掉落。自动行止会持续产出。</p>}
        {snapshot.recentLoot.map((entry, index) => (
          <div className="loot-row" key={`${entry}-${index}`}>
            <span className="loot-glyph">记</span>
            <div><b>{entry}</b><small>最近拾取</small></div>
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
