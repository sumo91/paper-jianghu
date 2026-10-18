import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve("dist");
const errors = [];
const manifestPath = resolve(root, "manifest.webmanifest");
if (!existsSync(manifestPath)) errors.push("dist/manifest.webmanifest missing");
else {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const key of ["name", "short_name", "start_url", "display", "orientation", "theme_color", "icons"]) {
    if (!manifest[key]) errors.push(`manifest.${key} missing`);
  }
  if (manifest.display !== "standalone") errors.push("manifest.display must be standalone");
  if (!Array.isArray(manifest.icons) || manifest.icons.length < 2) errors.push("manifest.icons need at least 2 entries");
  for (const icon of manifest.icons ?? []) {
    const target = resolve(root, `.${icon.src}`);
    if (!existsSync(target)) errors.push(`manifest icon missing: ${icon.src}`);
  }
}
const swPath = resolve(root, "sw.js");
if (!existsSync(swPath)) errors.push("dist/sw.js missing");
else {
  const sw = readFileSync(swPath, "utf8");
  for (const needle of ["SKIP_WAITING", "fetch", "caches.open"]) {
    if (!sw.includes(needle)) errors.push(`sw.js missing ${needle}`);
  }
}
const features = readFileSync(resolve("src/ui/features.ts"), "utf8");
if (!/NARRATIVE_ENABLED\s*=\s*false/.test(features)) errors.push("NARRATIVE_ENABLED is not false");
const tabs = readFileSync(resolve("src/ui/tabs.ts"), "utf8");
if (!tabs.includes("NARRATIVE_ENABLED ?")) errors.push("narrative tab is not feature-gated");
const html = readFileSync(resolve(root, "index.html"), "utf8");
if (!html.includes("manifest.webmanifest")) errors.push("index.html does not link manifest");
if (!html.includes("viewport-fit=cover")) errors.push("index.html missing viewport-fit=cover");
const cssFile = html.match(/assets\/index-[^"]+\.css/)?.[0];
if (!cssFile) errors.push("built CSS not found");
else {
  const css = readFileSync(resolve(root, cssFile), "utf8");
  if (!css.includes("--fs-md:clamp(14px") && !css.includes("--fs-md: clamp(14px")) errors.push("core body font size is not >=14px");
  if (!css.includes("orientation-hint")) errors.push("orientation hint styles missing");
  if (!css.includes("prefers-reduced-motion")) errors.push("reduced-motion styles missing");
  if (!css.includes("aspect-ratio:16/9") && !css.includes("aspect-ratio: 16 / 9")) errors.push("16:9 stage missing");
  if (!css.includes("min-height:44px") && !css.includes("min-height: 44px")) errors.push("44px touch target missing");
  if (!css.includes("settings-drawer")) errors.push("settings drawer styles missing");
  if (!css.includes("safe-area-inset-bottom")) errors.push("safe-area styles missing");
  if (!css.includes("xp-bar")) errors.push("XP bar styles missing");
  if (!css.includes("learn-panel")) errors.push("learn/equip panel styles missing");
  if (!css.includes("art-drop")) errors.push("art drop styles missing");
}
const icons = ["icon-192.png", "icon-512.png", "icon-maskable-512.png"];
for (const icon of icons) if (!existsSync(resolve(root, "icons", icon))) errors.push(`dist/icons/${icon} missing`);
if (errors.length > 0) {
  console.error("pwa:check FAIL");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("pwa:check PASS — manifest, sw, icons, shell, 14px CSS, orientation, reduced motion");
}
