import { useRef, useState, type ReactElement } from "react";
import { STARTER_KITS } from "../data/combat-v1.ts";
import { WORLD_CONTENT_V1 } from "../data/world-v1.ts";

type StartStep = "entry" | "name" | "kit" | "map" | "confirm";
type BuildId = "taiji" | "pojun" | "xuanyin";

interface StartScreenProps {
  open: boolean;
  hasSave: boolean;
  corrupt: boolean;
  recoveryRaw: string | null;
  onContinue: () => void;
  onStart: (options: { buildId: BuildId; playerName: string; mapId: string; skipTutorial: boolean }) => void;
  onImport: (serialized: string) => { ok: boolean; error?: string };
  onExportRecovery: () => void;
}

const KIT_COPY: Record<BuildId, { playstyle: string; strength: string; weakness: string; sample: string }> = {
  taiji: {
    playstyle: "架招、反伤、借力打力",
    strength: "最稳的首小时；低气血也能靠招架与回春撑住。",
    weakness: "爆发较低，打高防目标需要破招与连招。",
    sample: "云手 → 揽雀尾 → 四两拨千斤",
  },
  pojun: {
    playstyle: "破甲、爆发、斩杀",
    strength: "清层快，首领半血后斩杀线高。",
    weakness: "身板薄，遇到快攻或反震要换配置。",
    sample: "力劈华山 → 横扫千军 → 万军取首",
  },
  xuanyin: {
    playstyle: "封穴、叠毒、身法",
    strength: "控制和持续伤害强，适合打高血量首领。",
    weakness: "需要时间叠毒，遇到高状态抵抗会变慢。",
    sample: "玄阴指 → 封穴手 → 万蛊噬心",
  },
};

const START_MAPS = ["luoyang", "caoyun"] as const;

function download(name: string, text: string): void {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function StartScreen(props: StartScreenProps): ReactElement | null {
  const { open, hasSave, corrupt, recoveryRaw, onContinue, onStart, onImport, onExportRecovery } = props;
  const [step, setStep] = useState<StartStep>("entry");
  const [name, setName] = useState("沈砚");
  const [buildId, setBuildId] = useState<BuildId>("taiji");
  const [mapId, setMapId] = useState<string>("luoyang");
  const [skipTutorial, setSkipTutorial] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  function beginNew(): void {
    if (hasSave && !window.confirm("开始新游戏会覆盖当前存档。请先导出备份。确定继续？")) return;
    setError(null);
    setStep("name");
  }

  function nextFromName(): void {
    if (!/^[\u4e00-\u9fa5]{1,8}$/.test(name.trim())) {
      setError("姓名需为 1–8 个中文字符");
      return;
    }
    setError(null);
    setStep("kit");
  }

  async function importFile(file: File): Promise<void> {
    const text = await file.text();
    const result = onImport(text);
    if (!result.ok) setError(`导入失败：${result.error ?? "未知错误"}`);
  }

  const kit = STARTER_KITS[buildId];
  const map = WORLD_CONTENT_V1.maps.find((entry) => entry.id === mapId)!;

  return (
    <div className="start-screen" role="dialog" aria-modal="true" aria-labelledby="start-title">
      <div className="start-paper">
        <header className="start-header">
          <span className="panel-seal">纸</span>
          <div>
            <span className="eyebrow">武侠 · 放置 · 16:9</span>
            <h1 id="start-title">一纸江湖</h1>
          </div>
        </header>

        {step === "entry" && (
          <div className="start-body">
            <p className="start-lead">孤身入江湖。先选一条路，再让时间替你走。</p>
            {corrupt && (
              <div className="start-error" role="alert">
                存档无法读取。原始存档已保留，可先导出恢复存档，再开新局。
                <button onClick={() => { if (recoveryRaw) download("jianghu-recovery-save.json", recoveryRaw); else onExportRecovery(); }}>导出恢复存档</button>
              </div>
            )}
            <div className="start-actions">
              {hasSave && <button className="start-primary" onClick={onContinue}>继续上局</button>}
              <button className={hasSave ? "" : "start-primary"} onClick={beginNew}>新游戏</button>
              <button onClick={() => fileRef.current?.click()}>导入存档</button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importFile(file);
                event.currentTarget.value = "";
              }} />
            </div>
            <p className="start-foot">本地存档 · 无账号 · 无付费战力 · 中文 v1</p>
            {error && <div className="start-error" role="alert">{error}</div>}
          </div>
        )}

        {step === "name" && (
          <div className="start-body">
            <div className="start-step">1 / 4 · 留名</div>
            <label className="start-field">
              <span>侠名</span>
              <input value={name} maxLength={8} onChange={(event) => setName(event.target.value)} aria-label="侠名" autoFocus />
            </label>
            <p className="start-hint">1–8 个中文字符，默认沈砚。出身、性别、外貌留待后续。</p>
            {error && <div className="start-error" role="alert">{error}</div>}
            <div className="start-actions">
              <button onClick={() => setStep("entry")}>返回</button>
              <button className="start-primary" onClick={nextFromName}>下一步 · 选 starter kit</button>
            </div>
          </div>
        )}

        {step === "kit" && (
          <div className="start-body wide">
            <div className="start-step">2 / 4 · 选择起手</div>
            <div className="kit-grid" role="radiogroup" aria-label="Starter kit">
              {(Object.keys(KIT_COPY) as BuildId[]).map((id) => {
                const copy = KIT_COPY[id];
                const kitData = STARTER_KITS[id];
                return (
                  <button
                    key={id}
                    className={`kit-card ${buildId === id ? "selected" : ""}`}
                    onClick={() => setBuildId(id)}
                    role="radio"
                    aria-checked={buildId === id}
                  >
                    <span className="kit-seal">{id === "taiji" ? "太" : id === "pojun" ? "破" : "玄"}</span>
                    <b>{kitData.name}</b>
                    <small>{copy.playstyle}</small>
                    <span className="kit-sample">{copy.sample}</span>
                    <p><strong>强：</strong>{copy.strength}</p>
                    <p><strong>弱：</strong>{copy.weakness}</p>
                  </button>
                );
              })}
            </div>
            <div className="start-actions">
              <button onClick={() => setStep("name")}>返回</button>
              <button className="start-primary" onClick={() => setStep("map")}>下一步 · 选起始地图</button>
            </div>
          </div>
        )}

        {step === "map" && (
          <div className="start-body">
            <div className="start-step">3 / 4 · 起始地图</div>
            <div className="map-choice" role="radiogroup" aria-label="起始地图">
              {START_MAPS.map((id) => {
                const entry = WORLD_CONTENT_V1.maps.find((candidate) => candidate.id === id)!;
                return (
                  <button
                    key={id}
                    className={`map-choice-card ${mapId === id ? "selected" : ""}`}
                    onClick={() => setMapId(id)}
                    role="radio"
                    aria-checked={mapId === id}
                  >
                    <b>{entry.name}</b>
                    <small>{entry.region} · tier {entry.tier} · 10 层</small>
                    <span>{entry.firstClear.log}</span>
                  </button>
                );
              })}
            </div>
            <div className="start-actions">
              <button onClick={() => setStep("kit")}>返回</button>
              <button className="start-primary" onClick={() => setStep("confirm")}>下一步 · 确认</button>
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="start-body">
            <div className="start-step">4 / 4 · 入江湖</div>
            <div className="start-summary">
              <div><small>侠名</small><b>{name}</b></div>
              <div><small>起手</small><b>{kit.name}</b></div>
              <div><small>起始</small><b>{map.name}</b></div>
              <div><small>难度</small><b>{buildId === "taiji" ? "稳" : buildId === "pojun" ? "快" : "巧"}</b></div>
            </div>
            <label className="start-check">
              <input type="checkbox" checked={skipTutorial} onChange={(event) => setSkipTutorial(event.target.checked)} />
              <span>跳过引导提示（可稍后在设置/重开时重看）</span>
            </label>
            <p className="start-hint">确认后创建 1 级会话：starter gear、200 银两、第一个目标“打赢第一层”。</p>
            <div className="start-actions">
              <button onClick={() => setStep("map")}>返回</button>
              <button className="start-primary" onClick={() => onStart({ buildId, playerName: name.trim(), mapId, skipTutorial })}>入江湖</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
