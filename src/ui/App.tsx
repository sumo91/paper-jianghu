import { useMemo, useState } from "react";
import type { GearItem, GearSlot, MapDef, RegionId } from "../core/types.ts";
import { REALM_NAMES } from "../core/types.ts";
import background from "../../concept/jianghu-16x9.webp";
import {
  ACTIVITY_TITLES,
  ELEMENT_LABELS,
  enemiesForMap,
  GAME,
  MAP_DROPS,
  MAP_MODIFIERS,
  mapsForRegion,
  MOVE_TYPE_LABELS,
  REGION_BY_ID,
  REGIONS,
  SLOT_LABELS,
  STYLE_LABELS,
  type RegionUi,
} from "./gameData.ts";
import { itemScore } from "../core/stats.ts";

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
  const [currentRegion, setCurrentRegion] = useState<RegionId>("yangzhou");
  const [selectedMapId, setSelectedMapId] = useState("heishi");
  const [currentMapId, setCurrentMapId] = useState("heishi");
  const [currentLayer, setCurrentLayer] = useState(GAME.currentLayer);
  const [notice, setNotice] = useState<string | null>(null);

  const selected = REGION_BY_ID[selectedRegion];
  const current = REGION_BY_ID[currentRegion];
  const regionMaps = mapsForRegion(selectedRegion);
  const selectedMap = regionMaps.find((map) => map.id === selectedMapId) ?? regionMaps[0];
  const currentMap = mapsForRegion(currentRegion).find((map) => map.id === currentMapId) ?? GAME.currentMap;
  const sheet = GAME.sheet;
  const activityTitle = ACTIVITY_TITLES[currentRegion];

  const mapEnemies = useMemo(() => enemiesForMap(selectedMap), [selectedMap]);
  const gear = useMemo(
    () =>
      GAME.gearSlots
        .map((slot) => ({ slot, item: GAME.character.gear[slot] }))
        .filter((entry): entry is { slot: GearSlot; item: GearItem } => Boolean(entry.item)),
    [sheet],
  );

  function chooseRegion(id: RegionId) {
    setSelectedRegion(id);
    const first = mapsForRegion(id)[0];
    if (first) setSelectedMapId(first.id);
    setTab("map");
  }

  function chooseMap(map: MapDef) {
    setSelectedMapId(map.id);
  }

  function travel() {
    const samePlace = selectedRegion === currentRegion && selectedMap.id === currentMapId;
    if (samePlace) {
      setNotice("继续行止：风景未变，江湖又近了一步");
    } else {
      setCurrentRegion(selectedRegion);
      setCurrentMapId(selectedMap.id);
      setCurrentLayer(1);
      setNotice(`已启程：${selected.name} · ${selectedMap.name}`);
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
                <Resource label="银两" value={GAME.resources.silver} icon="银" />
                <Resource label="修为" value={GAME.resources.cultivation} icon="修" />
                <Resource label="名望" value={GAME.resources.renown} icon="名" />
                <span className="rank-chip">天机榜 #{GAME.resources.rank}</span>
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
          </div>

          <section className={`bottom-hud ${panelOpen ? "paper" : "overlay"}`} aria-label="当前行止">
            <div className="identity-card">
              <div className="seal-avatar">沈</div>
              <div className="identity-copy">
                <div className="identity-top">
                  <strong>{"沈砚"}</strong>
                  <span className="realm-pill">{REALM_NAMES[GAME.character.realm]} · {GAME.sheet.build.shortName}</span>
                </div>
                <p>同伴 · 柳青 <span className="bond">羁绊 8</span></p>
              </div>
            </div>

            <div className="activity-card">
              <div className="eyebrow">此刻 · {current.name} / {currentMap.name}</div>
              <div className="activity-title-row">
                <h2>{activityTitle}</h2>
                <span className="level-chip">第 {currentLayer} 层</span>
              </div>
              <div className="activity-meta">
                <span>行止：自动挑战</span>
                <span>已留 {GAME.farm.elapsed}</span>
                <span>{GAME.farm.fights} 战 / {GAME.farm.wins} 胜</span>
              </div>
              <div className="thin-progress"><span /></div>
            </div>

            <div className="action-card">
              <button className="ghost-button" onClick={() => setTab("jianghu")}>江湖帖 · 2</button>
              <button className="primary-button" onClick={travel}>
                {selectedRegion === currentRegion && selectedMap.id === currentMapId ? "续行止" : "启程"}
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
                  <p>案头 · v0.6 基线</p>
                </div>
              </div>
              <button className="collapse" onClick={() => setPanelOpen(false)} aria-label="收起信息台">⟩</button>
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
                  enemies={mapEnemies}
                  onChooseMap={chooseMap}
                  onStart={travel}
                  isCurrent={selectedRegion === currentRegion && selectedMap.id === currentMapId}
                />
              )}
              {tab === "character" && <CharacterTab gear={gear} />}
              {tab === "martial" && <MartialTab />}
              {tab === "bag" && <BagTab />}
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

function MapTab(props: {
  selected: RegionUi;
  current: RegionUi;
  maps: MapDef[];
  selectedMap: MapDef;
  currentMap: MapDef;
  currentLayer: number;
  enemies: ReturnType<typeof enemiesForMap>;
  onChooseMap: (map: MapDef) => void;
  onStart: () => void;
  isCurrent: boolean;
}) {
  const { selected, current, maps, selectedMap, currentMap, currentLayer, enemies, onChooseMap, onStart, isCurrent } = props;
  const drops = MAP_DROPS[selected.id];
  const modifiers = MAP_MODIFIERS[selectedMap.id] ?? [];
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
          <span className="thin-tag">漕运 · 商路</span>
        </div>
        <div className="ledger-stats">
          <div><small>已刷</small><b>{isCurrent ? GAME.farm.elapsed : "—"}</b></div>
          <div><small>战斗</small><b>{isCurrent ? GAME.farm.fights : "—"}</b></div>
          <div><small>胜率</small><b>{isCurrent ? `${Math.round((GAME.farm.wins / GAME.farm.fights) * 100)}%` : "—"}</b></div>
          <div><small>银两</small><b>{isCurrent ? n(GAME.farm.silver) : "—"}</b></div>
        </div>
        <div className="goal-line">
          <span>目标掉落 · {GAME.farm.goal}</span>
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
            <span className="monster-level">{enemy.boss ? "首领" : enemy.hpMult > 1.8 ? "精英" : `Lv.${selectedMap.tier * 9}`}</span>
          </div>
        ))}
      </div>
      <div className="modifier-list">
        {modifiers.map((modifier) => <span key={modifier}>{modifier}</span>)}
      </div>

      <SectionTitle title="可能掉落" note="目标可追踪" />
      <div className="drop-grid">
        {drops.map((drop, index) => (
          <div className="drop-row" key={drop}>
            <span className={`drop-glyph g${index % 5}`}>物</span>
            <span>{drop}</span>
            {index === 0 && <em>追踪</em>}
          </div>
        ))}
      </div>

      <SectionTitle title="此地有人" note="声望会影响态度与价格" />
      <div className="npc-row">
        {selected.npcs.map((npc) => (
          <span key={npc} className="npc-chip">{npc}</span>
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

function CharacterTab({ gear }: { gear: Array<{ slot: keyof typeof SLOT_LABELS; item: GearItem }> }) {
  const { sheet, character, titles } = GAME;
  return (
    <div className="tab-content">
      <div className="character-banner">
        <div className="seal-avatar big">沈</div>
        <div>
          <div className="eyebrow">侠客 · {REALM_NAMES[character.realm]}</div>
          <h2>沈砚 <small>{sheet.build.shortName}</small></h2>
          <p>称号：{titles[0]} · 剑意 {n(character.artMastery * 9 + 24)}</p>
        </div>
        <div className="score-box"><small>战力</small><b>{n(sheet.gearScore * 18 + 4200)}</b></div>
      </div>

      <SectionTitle title="属性" note="v0.6 快照" />
      <div className="stat-grid">
        <Stat label="气血" value={n(sheet.stats.hp)} />
        <Stat label="攻击" value={n(sheet.stats.attack)} />
        <Stat label="防御" value={n(sheet.stats.defense)} />
        <Stat label="身法" value={n(sheet.stats.speed)} />
        <Stat label="会心" value={`${Math.round(sheet.stats.crit * 100)}%`} />
        <Stat label="内力" value={n(sheet.stats.innerMax)} />
      </div>

      <SectionTitle title="兵器与行头" note={`${gear.length} / 6`} />
      <div className="gear-list">
        {GAME.gearSlots.map((slot) => {
          const entry = gear.find((g) => g.slot === slot);
          return (
            <div className={`gear-row ${entry ? rarityClass(entry.item.rarity) : "empty"}`} key={slot}>
              <span className="gear-slot">{SLOT_LABELS[slot]}</span>
              <span className="gear-name">{entry?.item.name ?? "未装备"}</span>
              <span className="gear-score">{entry ? n(itemScore(character.buildId, entry.item)) : "—"}</span>
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

function MartialTab() {
  const { build, sheet } = GAME;
  return (
    <div className="tab-content">
      <div className="region-heading">
        <div>
          <div className="eyebrow">武学谱 · 太极</div>
          <h2>{sheet.build.name}<small> / 以柔克刚</small></h2>
        </div>
        <span className="seal-chip">熟练 6</span>
      </div>
      <div className="inner-art-card">
        <span className="inner-seal">内</span>
        <div>
          <small>主修内功</small>
          <b>{GAME.innerArt}</b>
          <p>太极 · 招架成功回内力，低气血减伤</p>
        </div>
        <span className="mastery">8 层</span>
      </div>

      <SectionTitle title="装配招式" note="4 招 + 1 绝技" />
      <div className="move-list">
        {[...build.moves, build.ultimate].map((move, index) => (
          <div className={`move-card ${move.isUltimate ? "ultimate" : ""}`} key={move.id}>
            <span className={`move-type type-${move.type}`}>{MOVE_TYPE_LABELS[move.type]}</span>
            <div className="move-copy">
              <b>{move.name}</b>
              <small>{ELEMENT_LABELS[move.element]} · {move.tag === "starter" ? "起手" : move.tag === "chase" ? "追击" : move.tag === "finisher" ? "终结" : "功能"}</small>
            </div>
            <div className="move-cost"><small>内力</small><b>{move.cost}</b></div>
            <span className="move-index">{index === 4 ? "绝" : index + 1}</span>
          </div>
        ))}
      </div>

      <SectionTitle title="心法" note="辅助槽 · 改变招式行为" />
      <div className="heart-list">
        {build.heartMethods.map((heart) => (
          <div className="heart-row" key={heart.id}>
            <span className="heart-mark">诀</span>
            <div><b>{heart.name}</b><small>{heart.description}</small></div>
          </div>
        ))}
      </div>

      <SectionTitle title="经脉奇穴" note="2 / 6 已点" />
      <div className="keystone-row">
        {build.keystones.map((keystone) => (
          <span key={keystone.id} className="keystone">{keystone.name}</span>
        ))}
        <span className="keystone muted">+ 4 未点</span>
      </div>

      <SectionTitle title="自动优先级" note="预设 · 稳健" />
      <div className="priority-list">
        <span>敌方蓄力 → 云手</span>
        <span>借力 ≥ 3 → 四两拨千斤</span>
        <span>气血 &lt; 45% → 太极推手</span>
        <span>否则 → 白鹤亮翅</span>
      </div>
    </div>
  );
}

function BagTab() {
  const { resources } = GAME;
  return (
    <div className="tab-content">
      <div className="region-heading">
        <div><div className="eyebrow">行囊 · 随身之物</div><h2>家当</h2></div>
        <span className="seal-chip">拾取过滤 开</span>
      </div>
      <div className="currency-grid">
        <div><small>银两</small><b>{n(resources.silver)}</b></div>
        <div><small>修为</small><b>{n(resources.cultivation)}</b></div>
        <div><small>名望</small><b>{n(resources.renown)}</b></div>
      </div>
      <SectionTitle title="最近掉落" note="自动分解：上品以下" />
      <div className="loot-list">
        {GAME.recentLoot.map(({ item, description }) => (
          <div className={`loot-row ${rarityClass(item.rarity)}`} key={item.id}>
            <span className="loot-glyph">物</span>
            <div><b>{item.name}</b><small>{description}</small></div>
            <span className="loot-rarity">{item.rarity === "divine" ? "神" : item.rarity === "peerless" ? "绝" : item.rarity === "superb" ? "上" : "良"}</span>
          </div>
        ))}
      </div>
      <SectionTitle title="材料" />
      <div className="material-row">
        {["玄铁 × 8", "听雨残页 × 3", "心法注解 × 2", "同伴信物 × 1"].map((item) => <span key={item}>{item}</span>)}
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
