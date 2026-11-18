import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Activity,
  ArrowDownRight,
  Clock,
  Gauge,
  Layers,
  ShieldCheck,
  Siren,
  TrendingUp,
} from 'lucide-react';
import { ControlMode, ExperimentSummaryRow, SimulationMetrics } from '../types/traffic';
import { ExperimentResultsTable } from './ExperimentResultsTable';
import experimentSummaryJson from '../data/experiment_results.json';

interface Props {
  metrics: SimulationMetrics[];
  mode: ControlMode;
  tunedBaselineDuration?: number;
}

export const AnalyticsDashboard: React.FC<Props> = ({
  metrics,
  mode,
  tunedBaselineDuration = 15,
}) => {
  const [showBatchModal, setShowBatchModal] = useState<boolean>(true);

  const latestMetric: SimulationMetrics = metrics[metrics.length - 1] || {
    timestamp: 0,
    avgWaitTime: 0,
    p95WaitTime: 0,
    maxWaitTime: 0,
    totalThroughput: 0,
    throughputPerMin: 0,
    activeVehiclesCount: 0,
    totalQueueLength: 0,
    fixedAvgWaitTime: 0,
    adaptiveEfficiencyDelta: 0,
    isBaselineReady: false,
  };

  const chartData = metrics.map((m) => ({
    time: `${m.timestamp.toFixed(0)}s`,
    avgWaitTime: m.avgWaitTime,
    fixedBaselineWait: m.fixedAvgWaitTime ?? null,
    queueLength: m.totalQueueLength,
    throughput: m.totalThroughput,
  }));

  const isReady = latestMetric.isBaselineReady ?? false;
  const gain = latestMetric.adaptiveEfficiencyDelta ?? 0;
  const isPositive = gain > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Real-time A/B Performance Card */}
      <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h2 className="text-base font-semibold text-white">
                Live A/B Performance Benchmark
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">
                Synchronized Twin Fixed Baseline
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Twin engines run identical arrival schedules on seed 42 to measure true empirical delay difference without survivorship bias.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Empirical Gain:</span>
            {isReady ? (
              <span
                className={`px-2.5 py-1 rounded-lg border font-bold font-mono text-xs flex items-center gap-1 ${
                  isPositive
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                }`}
              >
                <ArrowDownRight className="w-3.5 h-3.5" />
                {isPositive ? `▼ +${gain}% Delay Reduction` : `${gain}% vs Fixed`}
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 text-xs font-mono">
                Collecting data... ({latestMetric.totalThroughput}/5 trips)
              </span>
            )}
          </div>
        </div>

        {/* Status notice if collecting initial departures */}
        {!isReady && (
          <div className="bg-sky-950/40 border border-sky-800/60 rounded-xl p-3 text-xs text-sky-300 flex items-center justify-between">
            <span>
              ⏳ <strong>Empirical Baseline Initializing:</strong> Recording completed arterial trip departures. Once ≥ 5 vehicles exit, statistically valid A/B comparison metrics unlock.
            </span>
            <span className="font-mono text-xs font-bold text-sky-400">
              {latestMetric.totalThroughput}/5 Departures
            </span>
          </div>
        )}

        {/* Real Metric Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Average Delay */}
          <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Average Delay</span>
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {latestMetric.avgWaitTime}{' '}
              <span className="text-xs text-slate-400 font-normal">sec</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              {latestMetric.fixedAvgWaitTime
                ? `Fixed Baseline: ${latestMetric.fixedAvgWaitTime}s`
                : 'Measuring departures'}
            </span>
          </div>

          {/* Card 2: P95 Worst-case Delay */}
          <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
              <span>95th Percentile (P95)</span>
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {latestMetric.p95WaitTime}{' '}
              <span className="text-xs text-slate-400 font-normal">sec</span>
            </div>
            <span className="text-[10px] text-cyan-400 font-medium">
              Max Observed: {latestMetric.maxWaitTime}s
            </span>
          </div>

          {/* Card 3: Stopped Queue Length */}
          <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              <span>Stopped Queue</span>
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {latestMetric.totalQueueLength}{' '}
              <span className="text-xs text-slate-400 font-normal">cars</span>
            </div>
            <span className="text-[10px] text-indigo-400 font-medium">
              Truly stopped at stop lines
            </span>
          </div>

          {/* Card 4: Throughput per minute */}
          <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Throughput</span>
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {latestMetric.throughputPerMin}{' '}
              <span className="text-xs text-slate-400 font-normal">trips/min</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-medium">
              {latestMetric.totalThroughput} total trips completed
            </span>
          </div>
        </div>

        {/* Live Recharts Graph (Real Measured Adaptive vs Real Measured Fixed Baseline) */}
        <div className="h-60 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAdaptive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorFixed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} unit="s" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: '#f8fafc',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Area
                type="monotone"
                dataKey="avgWaitTime"
                name={`Active System (${mode}) Delay`}
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorAdaptive)"
              />
              {latestMetric.fixedAvgWaitTime !== undefined && (
                <Area
                  type="monotone"
                  dataKey="fixedBaselineWait"
                  name={`Measured Fixed Baseline (${tunedBaselineDuration}s)`}
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fillOpacity={1}
                  fill="url(#colorFixed)"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Headless Monte Carlo Batch Results Table */}
      <ExperimentResultsTable data={experimentSummaryJson as ExperimentSummaryRow[]} />
    </div>
  );
};
