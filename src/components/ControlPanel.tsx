import React, { useState } from 'react';
import {
  AlertOctagon,
  Car,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
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
import { Approach, WeatherType } from '../types/traffic';

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Emergency Vehicle Priority Dispatcher */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-rose-300 mb-1">
              <Siren className="w-4 h-4 text-rose-400 animate-pulse" />
              Emergency Preemption
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Spawn priority ambulance/fire engine with green wave corridor.
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
            Dispatch Emergency Vehicle
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
              Simulate crash, collapse lane capacity & force green re-allocation.
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
              Modifies braking friction, speed & yellow clearance safety buffer.
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

        {/* 4. Traffic Flow & Sim Speed Controls */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300 mb-1">
              <Car className="w-4 h-4 text-emerald-400" />
              Traffic Density & Pace
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Adjust Poisson arrival frequency and simulation execution speed.
            </p>

            {/* Density Slider */}
            <div className="space-y-1.5 mb-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Spawn Density:</span>
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

            {/* Speed Selector */}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-400">Simulation Speed:</span>
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
