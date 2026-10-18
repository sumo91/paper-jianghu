import { useEffect, useSyncExternalStore } from "react";
import { JianghuSession, type JianghuCommand, type OfflineReportV1, type SessionSnapshotV1 } from "../core/session.ts";

const STORAGE_KEY = "jianghu-session-v1";
const SAVE_INTERVAL_MS = 10_000;

let session: JianghuSession | null = null;
let snapshot: SessionSnapshotV1 | null = null;
let lastSaveAt = 0;
let lastOfflineReport: OfflineReportV1 | null = null;
let saveStatus: "saved" | "saving" | "error" = "saved";
let lastSavedAt = 0;
let entryOpen = true;
let hasSave = false;
let corruptSave = false;
let fixture = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function boot(): void {
  if (session) return;
  const isFixture = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("fixture") === "endgame";
  if (isFixture) {
    session = JianghuSession.devFixture(Date.now());
    fixture = true;
    entryOpen = false;
    snapshot = session.snapshot();
    return;
  }
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      try {
        session = JianghuSession.load(raw, Date.now());
        hasSave = true;
        entryOpen = false;
      } catch {
        // Preserve the raw bad save for recovery/export instead of overwriting it.
        try {
          localStorage.setItem(`${STORAGE_KEY}-recovery`, raw);
        } catch {
          // ignore storage failures
        }
        corruptSave = true;
        session = null;
      }
    }
  } catch {
    session = null;
  }
  if (!session) {
    session = JianghuSession.newGame("taiji", Date.now() % 1_000_000, Date.now());
    hasSave = false;
    entryOpen = false;
  }
  snapshot = session.snapshot();
  if (!entryOpen && !hasSave) {
    saveSession();
    hasSave = true;
  }
}

export function getSessionSnapshot(): SessionSnapshotV1 {
  boot();
  return snapshot!;
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function saveSession(): void {
  boot();
  if (entryOpen || fixture || !session) return;
  saveStatus = "saving";
  try {
    localStorage.setItem(STORAGE_KEY, session!.save());
    lastSaveAt = Date.now();
    lastSavedAt = lastSaveAt;
    saveStatus = "saved";
  } catch {
    saveStatus = "error";
    // Storage can be unavailable (private mode); the session still runs in memory.
  }
}

export function exportSession(): string {
  boot();
  return session!.save();
}

export function importSession(serialized: string): { ok: boolean; error?: string } {
  try {
    const next = JianghuSession.load(serialized, Date.now());
    session = next;
    snapshot = next.snapshot();
    entryOpen = false;
    hasSave = true;
    corruptSave = false;
    saveSession();
    notify();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "存档无法读取" };
  }
}

export function hasRecoverySave(): boolean {
  try {
    return Boolean(localStorage.getItem(`${STORAGE_KEY}-recovery`));
  } catch {
    return false;
  }
}

export function readRecoverySave(): string | null {
  try {
    return localStorage.getItem(`${STORAGE_KEY}-recovery`);
  } catch {
    return null;
  }
}

export function advanceSession(): void {
  boot();
  if (entryOpen || fixture || !session) return;
  const now = Date.now();
  const result = session!.advanceTo(now);
  snapshot = result.snapshot;
  if (result.offlineReport && result.offlineReport.fights > 0) lastOfflineReport = result.offlineReport;
  if (now - lastSaveAt >= SAVE_INTERVAL_MS) saveSession();
  notify();
}

export function dispatchSession(command: JianghuCommand): SessionSnapshotV1 {
  boot();
  snapshot = session!.dispatch(command);
  saveSession();
  notify();
  return snapshot!;
}

export function resetSession(
  buildId: "taiji" | "pojun" | "xuanyin" = "taiji",
  options: { playerName?: string; mapId?: string; skipTutorial?: boolean } = {},
): SessionSnapshotV1 {
  session = JianghuSession.newGame(buildId, Date.now() % 1_000_000, Date.now(), options);
  snapshot = session.snapshot();
  entryOpen = false;
  hasSave = true;
  corruptSave = false;
  saveSession();
  notify();
  return snapshot!;
}

export function continueGame(): SessionSnapshotV1 {
  boot();
  entryOpen = false;
  notify();
  return snapshot!;
}

export function startNewGame(options: {
  buildId?: "taiji" | "pojun" | "xuanyin";
  playerName?: string;
  mapId?: string;
  skipTutorial?: boolean;
}): SessionSnapshotV1 {
  return resetSession(options.buildId ?? "taiji", options);
}

export function isEntryOpen(): boolean {
  boot();
  return entryOpen;
}

export function getLastOfflineReport(): OfflineReportV1 | null {
  return lastOfflineReport;
}

export function dismissOfflineReport(): void {
  lastOfflineReport = null;
  notify();
}

export function useJianghuSession(): {
  snapshot: SessionSnapshotV1;
  dispatch: (command: JianghuCommand) => SessionSnapshotV1;
  reset: (buildId?: "taiji" | "pojun" | "xuanyin") => SessionSnapshotV1;
  offlineReport: OfflineReportV1 | null;
  dismissOffline: () => void;
  saveStatus: "saved" | "saving" | "error";
  lastSavedAt: number;
  exportSave: () => string;
  importSave: (serialized: string) => { ok: boolean; error?: string };
  entryOpen: boolean;
  hasSave: boolean;
  corruptSave: boolean;
  fixture: boolean;
  continueGame: () => SessionSnapshotV1;
  startNewGame: (options: { buildId?: "taiji" | "pojun" | "xuanyin"; playerName?: string; mapId?: string; skipTutorial?: boolean }) => SessionSnapshotV1;
} {
  const live = useSyncExternalStore(subscribeSession, getSessionSnapshot, getSessionSnapshot);
  useEffect(() => {
    boot();
    const timer = window.setInterval(advanceSession, 1000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") advanceSession();
      else saveSession();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", saveSession);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", saveSession);
    };
  }, []);
  return {
    snapshot: live,
    dispatch: dispatchSession,
    reset: resetSession,
    offlineReport: getLastOfflineReport(),
    dismissOffline: dismissOfflineReport,
    saveStatus,
    lastSavedAt,
    exportSave: exportSession,
    importSave: importSession,
    entryOpen,
    hasSave,
    corruptSave,
    fixture,
    continueGame,
    startNewGame,
  };
}
