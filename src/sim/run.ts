import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { aggregateReport } from "./aggregate.ts";
import { writeReport } from "./report.ts";
import { simulate } from "../core/sim.ts";

function argValue(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const hours = Number(argValue("hours", "100"));
const seedsArg = argValue("seeds", "1,2,3");
const seeds = seedsArg.split(",").map((seed) => Number(seed.trim())).filter((seed) => Number.isFinite(seed));
const builds = ["taiji", "pojun", "xuanyin"];
const policyArg = argValue("policy", "aggressive");
const aggressive = policyArg !== "balanced";
const outDir = resolve(argValue("out", "reports"));

if (!Number.isFinite(hours) || hours <= 0) {
  throw new Error(`Invalid --hours: ${hours}`);
}
if (seeds.length === 0) {
  throw new Error("No valid seeds");
}

mkdirSync(outDir, { recursive: true });
const results = [];

console.log(`一纸江湖 balance sim: ${builds.length} builds × ${seeds.length} seeds × ${hours}h · ${aggressive ? "aggressive" : "balanced"} bot`);
for (const buildId of builds) {
  for (const seed of seeds) {
    const started = Date.now();
    const result = simulate({ buildId, seed, hours, aggressive });
    results.push(result);
    console.log(
      `  ${result.buildName.padEnd(4)} seed=${seed} level=${result.final.level} realm=${result.final.realm} ` +
        `tier=${result.maxMapTier} fights=${result.totalFights} losses=${result.totalLosses} ` +
        `gear=${result.final.gearScore} (${Date.now() - started}ms)`,
    );
  }
}

const aggregate = aggregateReport(results, seeds, hours);
writeReport(outDir, aggregate, results);
console.log(`\nWrote ${outDir}/balance-v0.6.md`);
console.log(`Snapshots: ${aggregate.builds.map((b) => `${b.buildName} ${b.snapshots.map((s) => `${s.hours}h:L${s.level}`).join(" ")}`).join("\n")}`);
