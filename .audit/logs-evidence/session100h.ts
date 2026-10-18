import { JianghuSession } from "../../src/core/session.ts";
const builds = ["taiji", "pojun", "xuanyin"] as const;
for (const buildId of builds) {
  const session = JianghuSession.newGame(buildId, 1, 0);
  let now = 0;
  let realm5At: number | null = null;
  for (let hour = 1; hour <= 100; hour += 1) {
    now += 3600 * 1000;
    const result = session.advanceTo(now, { offline: false });
    if (realm5At === null && result.snapshot.realm >= 5) realm5At = hour;
  }
  const s = session.snapshot();
  console.log(`${buildId} level=${s.level} realm=${s.realm} realm5=${realm5At}h mapsCleared=${s.mapsCleared} fights=${s.fights} wins=${s.wins} losses=${s.losses} silver=${s.silver} gearScore=${Math.round(s.gearScore)}`);
}
