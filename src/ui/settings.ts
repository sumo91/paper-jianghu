export type TextSize = "S" | "M" | "L";

export interface UiSettings {
  textSize: TextSize;
  reducedMotion: boolean;
  sound: boolean;
}

const KEY = "jianghu-ui-settings-v1";

export function defaultSettings(): UiSettings {
  return { textSize: "M", reducedMotion: false, sound: false };
}

export function loadUiSettings(): UiSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw) as Partial<UiSettings>;
    return {
      textSize: parsed.textSize === "S" || parsed.textSize === "L" ? parsed.textSize : "M",
      reducedMotion: Boolean(parsed.reducedMotion),
      sound: Boolean(parsed.sound),
    };
  } catch {
    return defaultSettings();
  }
}

export function saveUiSettings(settings: UiSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable; the UI still works for this tab.
  }
}

export function applyUiSettings(settings: UiSettings): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.textSize = settings.textSize;
  document.documentElement.dataset.reducedMotion = settings.reducedMotion ? "true" : "false";
}
