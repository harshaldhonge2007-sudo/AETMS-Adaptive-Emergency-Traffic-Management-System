import React, { useState } from 'react';
import {
  Table,
  CheckCircle,
  TrendingDown,
  Layers,
  Download,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ExperimentSummaryRow } from '../types/traffic';

interface Props {
  data?: ExperimentSummaryRow[];
}

export const ExperimentResultsTable: React.FC<Props> = ({ data }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [comparisonBaseline, setComparisonBaseline] = useState<'default' | 'tuned'>('default');

  if (!data || data.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-center text-xs text-slate-400">
        Run <code className="text-emerald-400 font-mono">npm run experiments</code> to generate empirical Monte Carlo benchmark data.
      </div>
    );
  }

  const handleDownloadCSV = () => {
    const headers = 'Scenario,Fixed_15s_Mean,Fixed_15s_Std,Fixed_25s_Mean,Fixed_25s_Std,QueuePressure_Mean,QueuePressure_Std,Webster_Mean,Webster_Std,Gain_vs_15s_Pct,Gain_vs_25s_Pct,ThroughputPerMin\n';
    const rows = data
      .map(
        (r) =>
          `${r.scenario},${r.fixedDefaultDelay},${r.fixedDefaultStd},${r.fixedTunedDelay},${r.fixedTunedStd},${r.queuePressureDelay},${r.queuePressureStd},${r.websterDelay},${r.websterStd},${r.websterImprovementVsDefault},${r.websterImprovementVsTuned},${r.throughputPerMin}`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'results.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h3 className="text-base font-semibold text-white">
              Headless Monte Carlo Benchmark Results
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              20 Seeds × 9 Scenarios (720 Runs)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Empirical measurements without canvas rendering: True Webster vs. Queue Pressure vs. Fixed Baselines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Baseline Toggle */}
          <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-xs">
            <button
              onClick={() => setComparisonBaseline('default')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                comparisonBaseline === 'default'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              vs. 15s Default
            </button>
            <button
              onClick={() => setComparisonBaseline('tuned')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                comparisonBaseline === 'tuned'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              vs. 25s Tuned
            </button>
          </div>

          <button
            onClick={handleDownloadCSV}
            title="Download complete results.csv"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                <th className="py-2.5 px-3">Scenario</th>
                <th className="py-2.5 px-3">Fixed Baseline (15s)</th>
                <th className="py-2.5 px-3">Tuned Fixed (25s)</th>
                <th className="py-2.5 px-3">Queue Pressure</th>
                <th className="py-2.5 px-3 text-emerald-400">Webster (Ours)</th>
                <th className="py-2.5 px-3 text-right">
                  {comparisonBaseline === 'default' ? '% Delay Reduction (vs 15s)' : '% Delay Reduction (vs 25s)'}
                </th>
                <th className="py-2.5 px-3 text-right">Throughput</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {data.map((row) => {
                const gain =
                  comparisonBaseline === 'default'
                    ? row.websterImprovementVsDefault
                    : row.websterImprovementVsTuned;

                const isPositive = gain > 0;

                return (
                  <tr key={row.scenario} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-sans font-semibold text-slate-200">
                      {row.scenario.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {row.fixedDefaultDelay} <span className="text-[10px] text-slate-600">± {row.fixedDefaultStd}s</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {row.fixedTunedDelay} <span className="text-[10px] text-slate-600">± {row.fixedTunedStd}s</span>
                    </td>
                    <td className="py-2.5 px-3 text-sky-400">
                      {row.queuePressureDelay} <span className="text-[10px] text-slate-600">± {row.queuePressureStd}s</span>
                    </td>
                    <td className="py-2.5 px-3 text-emerald-300 font-bold">
                      {row.websterDelay} <span className="text-[10px] text-emerald-600">± {row.websterStd}s</span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-bold ${
                          isPositive
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {isPositive ? `▼ +${gain}%` : `▲ ${gain}%`}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300 font-medium">
                      {row.throughputPerMin} <span className="text-[10px] text-slate-500">trips/min</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-3 px-1">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Values represent empirical arithmetic mean ± sample standard deviation over 20 seeded trials per scenario. Completed trips measure departure delay (travel time minus free-flow time) with no survivorship bias.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
