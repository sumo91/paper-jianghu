export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface PwaCallbacks {
  onUpdateReady: () => void;
  onInstallAvailable: (event: InstallPromptEvent) => void;
}

let deferredInstall: InstallPromptEvent | null = null;

export function registerPwa(callbacks: PwaCallbacks): () => void {
  if (typeof window === "undefined") return () => {};
  // Dev HMR must never be served through the production app-shell cache.
  if (import.meta.env.DEV) return () => {};
  const onBeforeInstall = (event: Event) => {
    event.preventDefault();
    deferredInstall = event as InstallPromptEvent;
    callbacks.onInstallAvailable(deferredInstall);
  };
  window.addEventListener("beforeinstallprompt", onBeforeInstall);

  let registration: ServiceWorkerRegistration | null = null;
  let timer: number | null = null;
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").then((value) => {
      registration = value;
      if (value.waiting) callbacks.onUpdateReady();
      value.addEventListener("updatefound", () => {
        const worker = value.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) callbacks.onUpdateReady();
        });
      });
      timer = window.setInterval(() => value.update().catch(() => {}), 10 * 60 * 1000);
    }).catch(() => {
      // PWA is progressive; a failed registration must not block the game.
    });
  }
  return () => {
    window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    if (timer !== null) window.clearInterval(timer);
    void registration;
  };
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredInstall) return "unavailable";
  await deferredInstall.prompt();
  const choice = await deferredInstall.userChoice;
  deferredInstall = null;
  return choice.outcome;
}

export function applyUpdate(): void {
  if (!("serviceWorker" in navigator)) {
    window.location.reload();
    return;
  }
  navigator.serviceWorker.getRegistration().then((registration) => {
    registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
    window.setTimeout(() => {
      if (!reloaded) window.location.reload();
    }, 1500);
  });
}
