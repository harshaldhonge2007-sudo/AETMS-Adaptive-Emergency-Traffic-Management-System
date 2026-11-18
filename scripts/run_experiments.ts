import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SimulationEngine } from '../src/engine/SimulationEngine.ts';
import { ControlMode, ExperimentRunResult, ExperimentSummaryRow, WeatherType } from '../src/types/traffic.ts';

interface ScenarioDef {
  name: string;
  density: number;
  weather?: WeatherType;
  accident?: { intersectionId: string; approach: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' };
  emergencyIntervalSec?: number;
}

const SCENARIOS: ScenarioDef[] = [
  { name: 'LOW_TRAFFIC', density: 0.5 },
  { name: 'NORMAL_TRAFFIC', density: 1.0 },
  { name: 'RUSH_HOUR', density: 1.6 },
  { name: 'HEAVY_GRID', density: 2.2 },
  { name: 'RAIN_WEATHER', density: 1.0, weather: 'RAIN' },
  { name: 'FOG_WEATHER', density: 1.0, weather: 'FOG' },
  { name: 'STORM_WEATHER', density: 1.0, weather: 'STORM' },
  { name: 'ACCIDENT_I1', density: 1.0, accident: { intersectionId: 'I1', approach: 'NORTH' } },
  { name: 'EMERGENCY_PRIORITY', density: 1.0, emergencyIntervalSec: 35 },
];

const SEED_COUNT = 20;
const SIMULATION_DURATION_SEC = 120; // 120 simulation seconds per run
const DT = 0.1; // 100ms physics steps (1200 ticks per run)

function runSingleExperiment(
  scenario: ScenarioDef,
  seed: number,
  mode: ControlMode,
  tunedFixedGreen?: number
): ExperimentRunResult {
  const engine = new SimulationEngine({
    seed,
    controlMode: mode,
    tunedFixedGreen: tunedFixedGreen ?? (mode === 'FIXED' ? 15 : undefined),
  });

  engine.trafficDensityFactor = scenario.density;
  if (scenario.weather) {
    engine.setWeather(scenario.weather);
  }
  if (scenario.accident) {
    engine.triggerAccident(scenario.accident.intersectionId, scenario.accident.approach);
  }

  let nextEmergencyTime = scenario.emergencyIntervalSec ?? Infinity;
  const totalSteps = Math.round(SIMULATION_DURATION_SEC / DT);

  for (let step = 0; step < totalSteps; step++) {
    if (engine.simTime >= nextEmergencyTime) {
      engine.spawnEmergencyVehicle('ROUTE_NORTH_SOUTH');
      nextEmergencyTime += scenario.emergencyIntervalSec ?? Infinity;
    }
    engine.update(DT);
  }

  const completed = engine.completedTrips;
  const delays = completed.map((t) => t.delay).sort((a, b) => a - b);
  const avgDelay = delays.length > 0 ? delays.reduce((s, d) => s + d, 0) / delays.length : 0;
  const p95Idx = Math.min(delays.length - 1, Math.floor(delays.length * 0.95));
  const p95Delay = delays.length > 0 ? delays[p95Idx] : 0;

  let totalQueue = 0;
  for (const inter of engine.intersections.values()) {
    totalQueue += inter.queues.NORTH + inter.queues.SOUTH + inter.queues.EAST + inter.queues.WEST;
  }

  let emTravel: number | undefined;
  if (engine.emergencyManager.completedEmergencyTrips.length > 0) {
    const emSum = engine.emergencyManager.completedEmergencyTrips.reduce((s, r) => s + (r.travelTime || 0), 0);
    emTravel = emSum / engine.emergencyManager.completedEmergencyTrips.length;
  }

  return {
    scenario: scenario.name,
    seed,
    mode,
    completedTrips: completed.length,
    avgDelay: Number(avgDelay.toFixed(2)),
    p95Delay: Number(p95Delay.toFixed(2)),
    maxQueue: totalQueue,
    throughputPerMin: Number(((completed.length / SIMULATION_DURATION_SEC) * 60).toFixed(1)),
    emergencyTravelTime: emTravel ? Number(emTravel.toFixed(2)) : undefined,
  };
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function stdDev(nums: number[], m: number): number {
  if (nums.length <= 1) return 0;
  const variance = nums.reduce((s, n) => s + Math.pow(n - m, 2), 0) / (nums.length - 1);
  return Math.sqrt(variance);
}

export function runAllExperiments(): { summary: ExperimentSummaryRow[]; allRuns: ExperimentRunResult[] } {
  const allRuns: ExperimentRunResult[] = [];
  const summary: ExperimentSummaryRow[] = [];

  console.log(`Starting Headless Batch Runner: ${SCENARIOS.length} scenarios × ${SEED_COUNT} seeds × 4 controller modes`);
  console.log(`Total runs = ${SCENARIOS.length * SEED_COUNT * 4}. Simulating ${SIMULATION_DURATION_SEC}s per run...`);

  for (const sc of SCENARIOS) {
    const defaultFixedDelays: number[] = [];
    const tunedFixedDelays: number[] = [];
    const queuePressureDelays: number[] = [];
    const websterDelays: number[] = [];
    const throughputs: number[] = [];

    for (let s = 1; s <= SEED_COUNT; s++) {
      const seed = s * 101;

      // 1. Fixed Default (15s)
      const rFixedDef = runSingleExperiment(sc, seed, 'FIXED', 15);
      allRuns.push(rFixedDef);
      defaultFixedDelays.push(rFixedDef.avgDelay);

      // 2. Fixed Tuned (25s)
      const rFixedTuned = runSingleExperiment(sc, seed, 'FIXED', 25);
      allRuns.push({ ...rFixedTuned, mode: 'FIXED' });
      tunedFixedDelays.push(rFixedTuned.avgDelay);

      // 3. Queue Pressure Heuristic
      const rQP = runSingleExperiment(sc, seed, 'QUEUE_PRESSURE');
      allRuns.push(rQP);
      queuePressureDelays.push(rQP.avgDelay);

      // 4. True Webster
      const rWebster = runSingleExperiment(sc, seed, 'WEBSTER');
      allRuns.push(rWebster);
      websterDelays.push(rWebster.avgDelay);
      throughputs.push(rWebster.throughputPerMin);
    }

    const mFixedDef = mean(defaultFixedDelays);
    const sFixedDef = stdDev(defaultFixedDelays, mFixedDef);

    const mTuned = mean(tunedFixedDelays);
    const sTuned = stdDev(tunedFixedDelays, mTuned);

    const mQP = mean(queuePressureDelays);
    const sQP = stdDev(queuePressureDelays, mQP);

    const mWebster = mean(websterDelays);
    const sWebster = stdDev(websterDelays, mWebster);

    const gainVsDefault = mFixedDef > 0 ? ((mFixedDef - mWebster) / mFixedDef) * 100 : 0;
    const gainVsTuned = mTuned > 0 ? ((mTuned - mWebster) / mTuned) * 100 : 0;

    summary.push({
      scenario: sc.name,
      fixedDefaultDelay: Number(mFixedDef.toFixed(2)),
      fixedDefaultStd: Number(sFixedDef.toFixed(2)),
      fixedTunedDelay: Number(mTuned.toFixed(2)),
      fixedTunedStd: Number(sTuned.toFixed(2)),
      queuePressureDelay: Number(mQP.toFixed(2)),
      queuePressureStd: Number(sQP.toFixed(2)),
      websterDelay: Number(mWebster.toFixed(2)),
      websterStd: Number(sWebster.toFixed(2)),
      websterImprovementVsDefault: Number(gainVsDefault.toFixed(1)),
      websterImprovementVsTuned: Number(gainVsTuned.toFixed(1)),
      throughputPerMin: Number(mean(throughputs).toFixed(1)),
    });
  }

  return { summary, allRuns };
}

// Main execution when invoked directly
const { summary, allRuns } = runAllExperiments();

// Output results.csv
const csvHeader = 'Scenario,Seed,Mode,CompletedTrips,AvgDelaySec,P95DelaySec,MaxQueue,ThroughputPerMin,EmergencyTravelSec\n';
const csvRows = allRuns
  .map(
    (r) =>
      `${r.scenario},${r.seed},${r.mode},${r.completedTrips},${r.avgDelay},${r.p95Delay},${r.maxQueue},${r.throughputPerMin},${r.emergencyTravelTime ?? ''}`
  )
  .join('\n');

const csvPath = path.resolve('results.csv');
fs.writeFileSync(csvPath, csvHeader + csvRows, 'utf-8');
console.log(`\nWritten detailed raw runs to ${csvPath}`);

// Write JSON artifact for React dashboard UI component
const jsonOutputDir = path.resolve('src/data');
if (!fs.existsSync(jsonOutputDir)) {
  fs.mkdirSync(jsonOutputDir, { recursive: true });
}
const jsonPath = path.join(jsonOutputDir, 'experiment_results.json');
fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf-8');
console.log(`Written React dashboard dataset to ${jsonPath}\n`);

// Display formatted Summary Table
console.log('='.repeat(110));
console.log('EMPIRICAL BENCHMARK SUMMARY (20 Seeds Monte Carlo Mean ± Std Dev)');
console.log('='.repeat(110));
console.log(
  'Scenario'.padEnd(20) +
    'Fixed (15s)'.padEnd(16) +
    'Fixed (25s)'.padEnd(16) +
    'Queue Pressure'.padEnd(18) +
    'Webster (Ours)'.padEnd(18) +
    'Gain vs 15s'.padEnd(12) +
    'Gain vs 25s'
);
console.log('-'.repeat(110));

for (const row of summary) {
  const fDef = `${row.fixedDefaultDelay} ± ${row.fixedDefaultStd}s`.padEnd(16);
  const fTuned = `${row.fixedTunedDelay} ± ${row.fixedTunedStd}s`.padEnd(16);
  const qp = `${row.queuePressureDelay} ± ${row.queuePressureStd}s`.padEnd(18);
  const web = `${row.websterDelay} ± ${row.websterStd}s`.padEnd(18);
  const gDef = `${row.websterImprovementVsDefault > 0 ? '+' : ''}${row.websterImprovementVsDefault}%`.padEnd(12);
  const gTuned = `${row.websterImprovementVsTuned > 0 ? '+' : ''}${row.websterImprovementVsTuned}%`;

  console.log(row.scenario.padEnd(20) + fDef + fTuned + qp + web + gDef + gTuned);
}
console.log('='.repeat(110));
