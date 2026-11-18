import React, { useState } from 'react';
import {
  AlertOctagon,
  Car,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  Cpu,
  Flame,
  Plus,
  Radio,
  RotateCcw,
  ShieldAlert,
  Siren,
  Sliders,
  Sun,
  Zap,
} from 'lucide-react';
import { PRESET_EMERGENCY_ROUTES } from '../engine/EmergencyManager';
import { Approach, ControlMode, WeatherType } from '../types/traffic';

interface Props {
  onSpawnEmergency: (routeId: string) => void;
  onTriggerAccident: (intersectionId: string, approach: Approach) => void;
  onClearAccidents: () => void;
  onSetWeather: (weather: WeatherType) => void;
  currentWeather: WeatherType;
  trafficDensity: number;
  onSetTrafficDensity: (val: number) => void;
  simSpeed: number;
  onSetSimSpeed: (val: number) => void;
  hasAccidents: boolean;
  controlMode: ControlMode;
  onSetControlMode: (mode: ControlMode) => void;
  tunedFixedGreen: number;
  onSetTunedFixedGreen: (val: number) => void;
}

export const ControlPanel: React.FC<Props> = ({
  onSpawnEmergency,
  onTriggerAccident,
  onClearAccidents,
  onSetWeather,
  currentWeather,
  trafficDensity,
  onSetTrafficDensity,
  simSpeed,
  onSetSimSpeed,
  hasAccidents,
  controlMode,
  onSetControlMode,
  tunedFixedGreen,
  onSetTunedFixedGreen,
}) => {
  const [selectedRoute, setSelectedRoute] = useState<string>(PRESET_EMERGENCY_ROUTES[0].id);
  const [selectedAccidentInter, setSelectedAccidentInter] = useState<string>('I1');
  const [selectedAccidentApproach, setSelectedAccidentApproach] = useState<Approach>('NORTH');

  return (
    <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-5 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          Interactive Scenario Controls
        </h2>
        <span className="text-xs text-slate-400 font-mono">Live Injections</span>
      </div>

      {/* Control Algorithm Selector */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <div>
            <span className="text-xs font-semibold text-white block">Active Controller Algorithm:</span>
            <span className="text-[10px] text-slate-400">Pure decision logic with exact mathematical formulations</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {[
            { mode: 'WEBSTER' as ControlMode, label: 'True Webster', desc: 'C0=(1.5L+5)/(1-Y)' },
            { mode: 'QUEUE_PRESSURE' as ControlMode, label: 'Queue Pressure', desc: 'Q^1.25 Heuristic' },
            { mode: 'FIXED' as ControlMode, label: 'Fixed Cycle', desc: `${tunedFixedGreen}s Base` },
          ].map((m) => {
            const isActive =
              controlMode === m.mode || (m.mode === 'WEBSTER' && controlMode === 'ADAPTIVE');
            return (
              <button
                key={m.mode}
                onClick={() => onSetControlMode(m.mode)}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Emergency Vehicle Priority Dispatcher */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-rose-300 mb-1">
              <Siren className="w-4 h-4 text-rose-400 animate-pulse" />
              Emergency Preemption
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Detects approaching ambulance (&lt;160px) & triggers safe yellow/all-red sequence.
            </p>
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500 mb-2 font-medium"
            >
              {PRESET_EMERGENCY_ROUTES.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => onSpawnEmergency(selectedRoute)}
            className="w-full py-2 px-3 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-rose-900/30 active:scale-[0.98]"
          >
            <Zap className="w-3.5 h-3.5" />
            Dispatch Ambulance
          </button>
        </div>

        {/* 2. Accident Simulation */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-300 mb-1">
              <AlertOctagon className="w-4 h-4 text-amber-400" />
              Accident & Bottleneck
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Simulates collision: collapses lane capacity & diverts green time to cross traffic.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <select
                value={selectedAccidentInter}
                onChange={(e) => setSelectedAccidentInter(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="I1">Junction I1 (NW)</option>
                <option value="I2">Junction I2 (NE)</option>
                <option value="I3">Junction I3 (SW)</option>
                <option value="I4">Junction I4 (SE)</option>
              </select>
              <select
                value={selectedAccidentApproach}
                onChange={(e) => setSelectedAccidentApproach(e.target.value as Approach)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="NORTH">Northbound</option>
                <option value="SOUTH">Southbound</option>
                <option value="WEST">Eastbound</option>
                <option value="EAST">Westbound</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onTriggerAccident(selectedAccidentInter, selectedAccidentApproach)}
              className="flex-1 py-2 px-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-md shadow-amber-900/20 active:scale-[0.98]"
            >
              <Flame className="w-3.5 h-3.5" />
              Simulate Crash
            </button>
            {hasAccidents && (
              <button
                onClick={onClearAccidents}
                className="py-2 px-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-all"
                title="Clear Accidents"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 3. Weather Conditions */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-sky-300 mb-1">
              <CloudRain className="w-4 h-4 text-sky-400" />
              Environmental Weather
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Modifies braking friction, speed & yellow clearance safety buffer (+1.5s).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {[
              { type: 'CLEAR' as WeatherType, label: 'Clear', icon: Sun, color: 'text-amber-400' },
              { type: 'RAIN' as WeatherType, label: 'Rain', icon: CloudRain, color: 'text-sky-400' },
              { type: 'FOG' as WeatherType, label: 'Fog', icon: CloudFog, color: 'text-slate-300' },
              {
                type: 'STORM' as WeatherType,
                label: 'Storm',
                icon: CloudLightning,
                color: 'text-purple-400',
              },
            ].map(({ type, label, icon: Icon, color }) => (
              <button
                key={type}
                onClick={() => onSetWeather(type)}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                  currentWeather === type
                    ? 'bg-sky-950/80 border-sky-500 text-white shadow-sm shadow-sky-500/20'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${color}`} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Traffic Flow & Fixed Baseline Tuner */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300 mb-1">
              <Car className="w-4 h-4 text-emerald-400" />
              Traffic Density & Pace
            </div>

            {/* Density Slider */}
            <div className="space-y-1 mb-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Poisson Density:</span>
                <span className="text-emerald-400 font-mono font-bold">
                  {(trafficDensity * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.4"
                max="2.2"
                step="0.1"
                value={trafficDensity}
                onChange={(e) => onSetTrafficDensity(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>

            {/* Fixed Baseline Tuner */}
            <div className="flex items-center justify-between text-xs pt-1 mb-2">
              <span className="text-slate-400">Fixed Baseline Split:</span>
              <div className="flex gap-1">
                {[15, 20, 25, 30].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => onSetTunedFixedGreen(sec)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition-all ${
                      tunedFixedGreen === sec
                        ? 'bg-sky-600 text-white border-sky-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>

            {/* Speed Selector */}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-400">Sim Pace:</span>
              <div className="flex gap-1">
                {[1.0, 1.5, 2.0].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => onSetSimSpeed(spd)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-all ${
                      simSpeed === spd
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
