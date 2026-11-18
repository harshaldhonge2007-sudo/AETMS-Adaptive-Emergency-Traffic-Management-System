import React from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Cpu,
  Gauge,
  RefreshCw,
  Siren,
  Sparkles,
  Zap,
} from 'lucide-react';
import { ControlMode } from '../types/traffic';

interface Props {
  mode: ControlMode;
  onToggleMode: (mode: ControlMode) => void;
  onOpenVivaModal: () => void;
  onReset: () => void;
  activeVehiclesCount: number;
  totalThroughput: number;
  isEmergencyActive: boolean;
  hasAccidents: boolean;
}

export const Header: React.FC<Props> = ({
  mode,
  onToggleMode,
  onOpenVivaModal,
  onReset,
  activeVehiclesCount,
  totalThroughput,
  isEmergencyActive,
  hasAccidents,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Brand & Project Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950">
            <Cpu className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                DEAM
                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Smart Traffic v2.0
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Dynamic, Emergency-Aware, Adaptive Traffic Management System
            </p>
          </div>
        </div>

        {/* Live Status Indicators */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          {/* Emergency Badge */}
          {isEmergencyActive && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/40 text-red-400 font-semibold animate-pulse">
              <Siren className="w-3.5 h-3.5 text-red-400" />
              <span>EMERGENCY PREEMPTION ACTIVE</span>
            </div>
          )}

          {/* Accident Badge */}
          {hasAccidents && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-400 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>HAZARD / ACCIDENT DETECTED</span>
            </div>
          )}

          {/* Active stats */}
          <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Vehicles: <strong className="text-white font-mono">{activeVehiclesCount}</strong>
              </span>
            </div>
            <span className="text-slate-600">|</span>
            <div>
              <span>
                Completed Trips: <strong className="text-white font-mono">{totalThroughput}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls & Mode Switch */}
        <div className="flex items-center gap-2">
          {/* 3-Way Mode Switch Button */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-950 border border-slate-800">
            <button
              onClick={() => onToggleMode('WEBSTER')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                mode === 'WEBSTER' || mode === 'ADAPTIVE'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Webster</span>
            </button>
            <button
              onClick={() => onToggleMode('QUEUE_PRESSURE')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                mode === 'QUEUE_PRESSURE'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>Pressure</span>
            </button>
            <button
              onClick={() => onToggleMode('FIXED')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                mode === 'FIXED'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Gauge className="w-3 h-3" />
              <span>Fixed</span>
            </button>
          </div>

          {/* Viva Explainer Modal Button */}
          <button
            onClick={onOpenVivaModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 transition-all shadow-sm"
            title="Viva & Algorithm Explainer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Viva Reference</span>
          </button>

          {/* Reset Button */}
          <button
            onClick={onReset}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-all"
            title="Reset Simulation"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
