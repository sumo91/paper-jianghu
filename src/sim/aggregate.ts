import type { SimResult, SimSnapshot } from "../core/types.ts";

export const TARGET_HOURS = [1, 4, 8, 12, 24, 48, 72, 100];
export const STYLE_NAMES: Record<string, string> = {
  gang: "刚",
  rou: "柔",
  kuai: "快",
  gui: "诡",
};

export interface SnapshotMedian {
  hours: number;
  level: number;
  realm: number;
  gearScore: number;
  silver: number;
  renown: number;
  winRate: number;
  roundsAvg: number;
  mapTier: number;
  mapLayer: number;
  highestLayer: number;
}

export interface BuildAggregate {
  buildId: string;
  buildName: string;
  runs: number;
  snapshots: SnapshotMedian[];
  medianLevel: number;
  medianRealm: number;
  medianGearScore: number;
  medianSilver: number;
  medianRenown: number;
  medianFights: number;
  medianLosses: number;
  medianRounds: number;
  medianWinRate: number;
  medianStall: number;
  medianMaxTier: number;
  medianMaxLayer: number;
  fightsPerHour: number;
  winsByStyle: Record<string, number>;
  fightsByStyle: Record<string, number>;
  winRateByStyle: Record<string, number>;
  realmMedian: Record<string, number | null>;
  realmReached: Record<string, number>;
  rarityCounts: Record<string, number>;
  survivalFights: number;
  survivalWins: number;
  survivalShare: number;
  survivalWinRate: number;
}

export interface AggregateReport {
  hours: number;
  seeds: number[];
  builds: BuildAggregate[];
  generatedAt: string;
  modelVersion: string;
  policy: string;
  version: string;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function nearestSnapshot(result: SimResult, target: number): SimSnapshot | null {
  if (result.snapshots.length === 0) return null;
  let best = result.snapshots[0];
  for (const snapshot of result.snapshots) {
    if (Math.abs(snapshot.hours - target) < Math.abs(best.hours - target)) best = snapshot;
  }
  return best;
}

function medianSnapshot(results: SimResult[], target: number): SnapshotMedian {
  const snapshots = results
    .map((result) => nearestSnapshot(result, target))
    .filter((snapshot): snapshot is SimSnapshot => snapshot !== null);
  return {
    hours: target,
    level: median(snapshots.map((s) => s.level)),
    realm: median(snapshots.map((s) => s.realm)),
    gearScore: median(snapshots.map((s) => s.gearScore)),
    silver: median(snapshots.map((s) => s.silver)),
    renown: median(snapshots.map((s) => s.renown)),
    winRate: median(snapshots.map((s) => s.winRate)),
    roundsAvg: median(snapshots.map((s) => s.roundsAvg)),
    mapTier: median(snapshots.map((s) => s.highestMapTier)),
    mapLayer: median(snapshots.map((s) => s.mapLayer)),
    highestLayer: median(snapshots.map((s) => s.highestLayer)),
  };
}

export function aggregateBuild(results: SimResult[]): BuildAggregate {
  if (results.length === 0) throw new Error("aggregateBuild: no results");
  const first = results[0];
  const winsByStyle: Record<string, number> = {};
  const fightsByStyle: Record<string, number> = {};
  for (const result of results) {
    for (const [style, count] of Object.entries(result.winsByStyle)) {
      winsByStyle[style] = (winsByStyle[style] ?? 0) + count;
    }
    for (const [style, count] of Object.entries(result.fightsByStyle)) {
      fightsByStyle[style] = (fightsByStyle[style] ?? 0) + count;
    }
  }
  const winRateByStyle: Record<string, number> = {};
  for (const style of Object.keys(fightsByStyle)) {
    winRateByStyle[style] = fightsByStyle[style] > 0 ? winsByStyle[style] / fightsByStyle[style] : 0;
  }

  const realmMedian: Record<string, number | null> = {};
  const realmReached: Record<string, number> = {};
  for (let realm = 1; realm <= 6; realm += 1) {
    const times = results
      .map((result) => result.realmTimes[String(realm)])
      .filter((time): time is number => typeof time === "number");
    realmReached[String(realm)] = times.length;
    realmMedian[String(realm)] = times.length > 0 ? median(times) : null;
  }

  const rarityCounts: Record<string, number> = {};
  for (const result of results) {
    for (const [slot, desc] of Object.entries(result.gear)) {
      if (desc === "—") continue;
      const rarity = desc.slice(0, 1);
      rarityCounts[rarity] = (rarityCounts[rarity] ?? 0) + 1;
      void slot;
    }
  }

  const survivalFights = results.reduce((sum, result) => sum + result.survivalFights, 0);
  const survivalWins = results.reduce((sum, result) => sum + result.survivalWins, 0);
  const totalFights = results.reduce((sum, result) => sum + result.totalFights, 0);

  return {
    buildId: first.buildId,
    buildName: first.buildName,
    runs: results.length,
    snapshots: TARGET_HOURS.map((hours) => medianSnapshot(results, hours)),
    medianLevel: median(results.map((r) => r.final.level)),
    medianRealm: median(results.map((r) => r.final.realm)),
    medianGearScore: median(results.map((r) => r.final.gearScore)),
    medianSilver: median(results.map((r) => r.final.silver)),
    medianRenown: median(results.map((r) => r.final.renown)),
    medianFights: median(results.map((r) => r.totalFights)),
    medianLosses: median(results.map((r) => r.totalLosses)),
    medianRounds: median(results.map((r) => r.final.roundsAvg)),
    medianWinRate: median(results.map((r) => r.final.winRate)),
    medianStall: median(results.map((r) => r.timeStalledHours)),
    medianMaxTier: median(results.map((r) => r.maxMapTier)),
    medianMaxLayer: median(results.map((r) => r.maxMapLayer)),
    fightsPerHour: median(results.map((r) => r.totalFights / Math.max(0.001, r.hours))),
    winsByStyle,
    fightsByStyle,
    winRateByStyle,
    realmMedian,
    realmReached,
    rarityCounts,
    survivalFights,
    survivalWins,
    survivalShare: totalFights > 0 ? survivalFights / totalFights : 0,
    survivalWinRate: survivalFights > 0 ? survivalWins / survivalFights : 0,
  };
}

export function aggregateReport(
  results: SimResult[],
  seeds: number[],
  hours: number,
  version = "0.6.0",
): AggregateReport {
  const buildIds = [...new Set(results.map((r) => r.buildId))];
  const builds = buildIds.map((buildId) =>
    aggregateBuild(results.filter((r) => r.buildId === buildId)),
  );
  return {
    hours,
    seeds,
    builds,
    generatedAt: new Date().toISOString(),
    modelVersion: version,
    policy: results[0]?.policy ?? "balanced",
    version,
  };
}

export function csvForResults(results: SimResult[]): string {
  const header = [
    "build",
    "seed",
    "hours",
    "level",
    "realm",
    "layer",
    "gear_score",
    "highest_map_tier",
    "highest_map_layer",
    "silver",
    "renown",
    "fights",
    "losses",
    "recent_win_rate",
    "avg_rounds",
    "max_stall_hours",
    "survival_fights",
    "survival_wins",
    "policy",
  ].join(",");
  const rows = results.map((r) =>
    [
      r.buildId,
      r.seed,
      r.hours.toFixed(2),
      r.final.level,
      r.final.realm,
      r.final.layer,
      r.final.gearScore,
      r.maxMapTier,
      r.maxMapLayer,
      r.final.silver,
      r.final.renown,
      r.totalFights,
      r.totalLosses,
      r.final.winRate.toFixed(3),
      r.final.roundsAvg.toFixed(2),
      r.timeStalledHours.toFixed(2),
      r.survivalFights,
      r.survivalWins,
      r.policy,
    ].join(","),
  );
  return [header, ...rows].join("\n");
}
