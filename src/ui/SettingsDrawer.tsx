import { useEffect, useRef, useState, type ReactElement } from "react";
import type { SessionSnapshotV1 } from "../core/session.ts";
import { APP_VERSION, CONTENT_VERSION } from "../data/content-version.ts";
import type { TextSize, UiSettings } from "./settings.ts";

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  snapshot: SessionSnapshotV1;
  saveStatus: "saved" | "saving" | "error";
  settings: UiSettings;
  onSettingsChange: (settings: UiSettings) => void;
  onExport: () => string;
  onImport: (serialized: string) => { ok: boolean; error?: string };
  onReset: (buildId: "taiji" | "pojun" | "xuanyin") => void;
  installAvailable: boolean;
  onInstall: () => void;
  recoveryAvailable: boolean;
  recoveryRaw: string | null;
}

function download(name: string, text: string): void {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SettingsDrawer(props: SettingsDrawerProps): ReactElement | null {
  const {
    open, onClose, snapshot, saveStatus, settings, onSettingsChange, onExport, onImport, onReset,
    installAvailable, onInstall, recoveryAvailable, recoveryRaw,
  } = props;
  const closeRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [textSize, setTextSize] = useState<TextSize>(settings.textSize);

  useEffect(() => {
    setTextSize(settings.textSize);
  }, [settings.textSize]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function change(next: UiSettings): void {
    onSettingsChange(next);
    setMessage("设置已保存");
  }

  async function readFile(file: File): Promise<void> {
    const text = await file.text();
    const result = onImport(text);
    setMessage(result.ok ? "存档已导入" : `导入失败：${result.error ?? "未知错误"}`);
  }

  return (
    <div className="settings-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="settings-drawer" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header>
          <div>
            <span className="eyebrow">案头</span>
            <h2 id="settings-title">设置与存档</h2>
          </div>
          <button ref={closeRef} className="settings-close" onClick={onClose} aria-label="关闭设置">×</button>
        </header>

        <div className="settings-section">
          <h3>阅读</h3>
          <div className="settings-row">
            <span>正文字号</span>
            <div className="segmented" role="group" aria-label="正文字号">
              {(["S", "M", "L"] as TextSize[]).map((size) => (
                <button
                  key={size}
                  className={textSize === size ? "active" : ""}
                  onClick={() => {
                    setTextSize(size);
                    change({ ...settings, textSize: size });
                  }}
                  aria-pressed={textSize === size}
                >
                  {size === "S" ? "小" : size === "M" ? "中" : "大"}
                </button>
              ))}
            </div>
          </div>
          <label className="settings-row">
            <span>减少动效</span>
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(event) => change({ ...settings, reducedMotion: event.target.checked })}
            />
          </label>
          <label className="settings-row muted-row">
            <span>声音</span>
            <input type="checkbox" checked={false} disabled readOnly />
            <small>v1 静音/极简，不依赖声音</small>
          </label>
        </div>

        <div className="settings-section">
          <h3>存档</h3>
          <p className="settings-status">
            自动保存：{saveStatus === "saved" ? "已保存" : saveStatus === "saving" ? "保存中" : "保存失败"}
            {snapshot.active ? " · 行止中" : " · 已停止"}
          </p>
          <div className="settings-actions">
            <button onClick={() => download(`jianghu-save-${new Date().toISOString().slice(0, 10)}.json`, onExport())}>导出存档</button>
            <button onClick={() => fileRef.current?.click()}>导入存档</button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readFile(file);
                event.currentTarget.value = "";
              }}
            />
          </div>
          <div className="settings-actions">
            <button
              className="danger-button"
              onClick={() => {
                if (window.confirm("确定重开一局？当前存档会被新游戏覆盖；请先导出备份。")) {
                  onReset("taiji");
                  setMessage("已开始新的一局");
                }
              }}
            >
              重开一局
            </button>
            {recoveryAvailable && (
              <button
                onClick={() => {
                  if (recoveryRaw) download("jianghu-recovery-save.json", recoveryRaw);
                  setMessage("已下载恢复存档");
                }}
              >
                导出恢复存档
              </button>
            )}
          </div>
        </div>

        <div className="settings-section">
          <h3>应用</h3>
          <div className="settings-actions">
            <button onClick={onInstall} disabled={!installAvailable}>
              {installAvailable ? "安装到桌面" : "当前浏览器不支持安装提示"}
            </button>
          </div>
          <p className="settings-status">版本：{APP_VERSION} · 内容：{CONTENT_VERSION} · 中文 v1</p>
          <p className="settings-status">本地存档，无账号/无后端；导出后请自行保管。</p>
        </div>

        {message && <div className="settings-message" role="status">{message}</div>}
      </section>
    </div>
  );
}
