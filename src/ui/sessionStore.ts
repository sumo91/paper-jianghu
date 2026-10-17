import { useEffect, useSyncExternalStore } from "react";
import { JianghuSession, type JianghuCommand, type OfflineReportV1, type SessionSnapshotV1 } from "../core/session.ts";

const STORAGE_KEY = "jianghu-session-v1";
const SAVE_INTERVAL_MS = 10_000;

let session: JianghuSession | null = null;
let snapshot: SessionSnapshotV1 | null = null;
let lastSaveAt = 0;
let lastOfflineReport: OfflineReportV1 | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function boot(): void {
  if (session) return;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      try {
        session = JianghuSession.load(raw, Date.now());
      } catch {
        // Preserve the raw bad save for recovery/export instead of overwriting it.
        try {
          localStorage.setItem(`${STORAGE_KEY}-recovery`, raw);
        } catch {
          // ignore storage failures
        }
        session = null;
      }
    }
  } catch {
    session = null;
  }
  if (!session) session = JianghuSession.newGame("taiji", Date.now() % 1_000_000, Date.now());
  snapshot = session.snapshot();
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
  try {
    localStorage.setItem(STORAGE_KEY, session!.save());
    lastSaveAt = Date.now();
  } catch {
    // Storage can be unavailable (private mode); the session still runs in memory.
  }
}

export function advanceSession(): void {
  boot();
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

export function resetSession(buildId: "taiji" | "pojun" | "xuanyin" = "taiji"): SessionSnapshotV1 {
  session = JianghuSession.newGame(buildId, Date.now() % 1_000_000, Date.now());
  snapshot = session.snapshot();
  saveSession();
  notify();
  return snapshot!;
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
  };
}
