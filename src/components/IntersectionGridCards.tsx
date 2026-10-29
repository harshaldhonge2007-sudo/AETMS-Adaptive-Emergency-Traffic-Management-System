import React from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Radio,
  Siren,
  Timer,
} from 'lucide-react';
import { IntersectionState } from '../types/traffic';

interface Props {
  intersections: IntersectionState[];
}

export const IntersectionGridCards: React.FC<Props> = ({ intersections }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {intersections.map((inter) => {
        const isNSGreen = inter.currentPhase === 'NS_GREEN';
        const isEWGreen = inter.currentPhase === 'EW_GREEN';
        const isYellow = inter.currentPhase.includes('YELLOW');
        const isAllRed = inter.currentPhase === 'ALL_RED';

        const totalQueue =
          inter.queues.NORTH +
          inter.queues.SOUTH +
          inter.queues.EAST +
          inter.queues.WEST;

        return (
          <div
            key={inter.id}
            className={`rounded-xl border p-3.5 transition-all flex flex-col justify-between backdrop-blur-sm ${
              inter.isEmergencyPreempted
                ? 'bg-rose-950/20 border-rose-500/60 shadow-lg shadow-rose-950/30'
                : inter.hasAccident
                ? 'bg-amber-950/20 border-amber-500/50'
                : 'bg-slate-900/70 border-slate-800/90'
            }`}
          >
            {/* Title & Phase indicator */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-slate-800 text-emerald-400 border border-slate-700">
                  {inter.id}
                </span>
                <span className="text-xs font-semibold text-slate-200 truncate">
                  {inter.name.split(' ')[0]}
                </span>
              </div>

              {inter.isEmergencyPreempted ? (
                <span className="flex items-center gap-1 text-[10px] font-bold text-rose-400 uppercase bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30 animate-pulse">
                  <Siren className="w-3 h-3" /> Preempted
                </span>
              ) : inter.hasAccident ? (
                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 uppercase bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                  <AlertTriangle className="w-3 h-3" /> Crash
                </span>
              ) : (
                <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                  <Timer className="w-3 h-3 text-slate-500" />
                  <span>
                    {Math.ceil(Math.max(0, inter.phaseDuration - inter.phaseTimer))}s
                  </span>
                </div>
              )}
            </div>

            {/* Current Active Phase Badge */}
            <div className="flex items-center justify-between bg-slate-950/80 rounded-lg px-2.5 py-1.5 border border-slate-800/80 mb-3">
              <span className="text-[11px] text-slate-400">Active Phase:</span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isAllRed
                      ? 'bg-red-500 animate-pulse'
                      : isYellow
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                  }`}
                />
                <span
                  className={`text-xs font-mono font-bold ${
                    isAllRed
                      ? 'text-red-400'
                      : isYellow
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {inter.currentPhase.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Real-time Dynamic Controller Reason */}
            {inter.activeControlReason && (
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-300 bg-emerald-950/40 px-2 py-1 rounded-md border border-emerald-500/20 mb-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="truncate">{inter.activeControlReason}</span>
              </div>
            )}

            {/* Live Queue Counts by Approach */}
            <div className="grid grid-cols-4 gap-1.5 text-center text-xs mb-2">
              <div
                className={`p-1.5 rounded-lg border flex flex-col items-center ${
                  isNSGreen
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                    : 'bg-slate-950 border-slate-800/80 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-0.5 text-[10px] font-semibold">
                  <ArrowDown className="w-2.5 h-2.5" /> N
                </div>
                <span className="font-mono font-bold text-xs">{inter.queues.NORTH}</span>
              </div>

              <div
                className={`p-1.5 rounded-lg border flex flex-col items-center ${
                  isNSGreen
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                    : 'bg-slate-950 border-slate-800/80 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-0.5 text-[10px] font-semibold">
                  <ArrowUp className="w-2.5 h-2.5" /> S
                </div>
                <span className="font-mono font-bold text-xs">{inter.queues.SOUTH}</span>
              </div>

              <div
                className={`p-1.5 rounded-lg border flex flex-col items-center ${
                  isEWGreen
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                    : 'bg-slate-950 border-slate-800/80 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-0.5 text-[10px] font-semibold">
                  <ArrowRight className="w-2.5 h-2.5" /> W
                </div>
                <span className="font-mono font-bold text-xs">{inter.queues.WEST}</span>
              </div>

              <div
                className={`p-1.5 rounded-lg border flex flex-col items-center ${
                  isEWGreen
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                    : 'bg-slate-950 border-slate-800/80 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-0.5 text-[10px] font-semibold">
                  <ArrowLeft className="w-2.5 h-2.5" /> E
                </div>
                <span className="font-mono font-bold text-xs">{inter.queues.EAST}</span>
              </div>
            </div>

            {/* Coordination Platoon Pill */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span className="flex items-center gap-1">
                <Radio className="w-3 h-3 text-cyan-400" />
                <span>Platoons Sync:</span>
              </span>
              <span className="font-mono text-slate-200">
                {inter.incomingPlatoons.length > 0 ? (
                  <strong className="text-cyan-400">
                    {inter.incomingPlatoons.reduce((acc, p) => acc + p.vehicleCount, 0)} cars
                  </strong>
                ) : (
                  'Clear'
                )}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
