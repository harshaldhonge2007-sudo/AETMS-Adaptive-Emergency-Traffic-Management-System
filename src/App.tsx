import React, { useState, useEffect, useMemo } from 'react';
import { SimulationEngine } from './engine/SimulationEngine';
import { Header } from './components/Header';
import { CanvasSimulation } from './components/CanvasSimulation';
import { ControlPanel } from './components/ControlPanel';
import { IntersectionGridCards } from './components/IntersectionGridCards';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { VivaExplainerModal } from './components/VivaExplainerModal';
import { Approach, ControlMode, IntersectionState, SimulationMetrics, WeatherType } from './types/traffic';

export function App() {
  const engine = useMemo(() => new SimulationEngine(), []);

  const [controlMode, setControlMode] = useState<ControlMode>('ADAPTIVE');
  const [currentWeather, setCurrentWeather] = useState<WeatherType>('CLEAR');
  const [trafficDensity, setTrafficDensity] = useState<number>(1.0);
  const [simSpeed, setSimSpeed] = useState<number>(1.0);
  const [isVivaModalOpen, setIsVivaModalOpen] = useState<boolean>(false);

  // Synchronized state with engine for React re-renders
  const [intersections, setIntersections] = useState<IntersectionState[]>([]);
  const [metrics, setMetrics] = useState<SimulationMetrics[]>([]);
  const [activeVehiclesCount, setActiveVehiclesCount] = useState<number>(0);
  const [totalThroughput, setTotalThroughput] = useState<number>(0);
  const [isEmergencyActive, setIsEmergencyActive] = useState<boolean>(false);
  const [hasAccidents, setHasAccidents] = useState<boolean>(false);

  // Sync state from simulation loop at 10 Hz for smooth React UI updates
  useEffect(() => {
    const interval = setInterval(() => {
      setIntersections(Array.from(engine.intersections.values()));
      setMetrics([...engine.metricsHistory]);
      setActiveVehiclesCount(engine.vehicles.length);
      setTotalThroughput(engine.metricsHistory[engine.metricsHistory.length - 1]?.totalThroughput || 0);
      setIsEmergencyActive(engine.emergencyManager.isEmergencyActive());
      setHasAccidents(engine.accidentManager.getAllAccidents().length > 0);
    }, 100);

    return () => clearInterval(interval);
  }, [engine]);

  const handleToggleMode = (mode: ControlMode) => {
    setControlMode(mode);
    engine.setControlMode(mode);
  };

  const handleSetWeather = (weather: WeatherType) => {
    setCurrentWeather(weather);
    engine.setWeather(weather);
  };

  const handleSetTrafficDensity = (density: number) => {
    setTrafficDensity(density);
    engine.trafficDensityFactor = density;
  };

  const handleSetSimSpeed = (spd: number) => {
    setSimSpeed(spd);
    engine.simulationSpeed = spd;
  };

  const handleSpawnEmergency = (routeId: string) => {
    engine.spawnEmergencyVehicle(routeId);
    setIsEmergencyActive(true);
  };

  const handleTriggerAccident = (intersectionId: string, approach: Approach) => {
    engine.triggerAccident(intersectionId, approach);
    setHasAccidents(true);
  };

  const handleClearAccidents = () => {
    engine.clearAllAccidents();
    setHasAccidents(false);
  };

  const handleReset = () => {
    engine.resetSimulation();
    setIntersections(Array.from(engine.intersections.values()));
    setMetrics([]);
    setActiveVehiclesCount(0);
    setTotalThroughput(0);
    setIsEmergencyActive(false);
    setHasAccidents(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30">
      {/* Top Header */}
      <Header
        mode={controlMode}
        onToggleMode={handleToggleMode}
        onOpenVivaModal={() => setIsVivaModalOpen(true)}
        onReset={handleReset}
        activeVehiclesCount={activeVehiclesCount}
        totalThroughput={totalThroughput}
        isEmergencyActive={isEmergencyActive}
        hasAccidents={hasAccidents}
      />

      {/* Main Dashboard Layout */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6 flex-1">
        {/* Top Grid: Simulation Canvas & Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Simulation Visualizer (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <CanvasSimulation engine={engine} />
          </div>

          {/* Interactive Controls & Scenario Injectors (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <ControlPanel
              onSpawnEmergency={handleSpawnEmergency}
              onTriggerAccident={handleTriggerAccident}
              onClearAccidents={handleClearAccidents}
              onSetWeather={handleSetWeather}
              currentWeather={currentWeather}
              trafficDensity={trafficDensity}
              onSetTrafficDensity={handleSetTrafficDensity}
              simSpeed={simSpeed}
              onSetSimSpeed={handleSetSimSpeed}
              hasAccidents={hasAccidents}
            />
          </div>
        </div>

        {/* Intersection Status Cards (4 Junctions: NW, NE, SW, SE) */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-slate-300">
              Live Intersection Controllers (2×2 Network)
            </h2>
            <span className="text-xs text-slate-500">Auto-synchronized via inter-agent communication</span>
          </div>
          <IntersectionGridCards intersections={intersections} />
        </section>

        {/* Performance Analytics & Proof-of-Improvement Chart */}
        <section>
          <AnalyticsDashboard metrics={metrics} mode={controlMode} />
        </section>
      </main>

      {/* Viva & Project Documentation Modal */}
      <VivaExplainerModal
        isOpen={isVivaModalOpen}
        onClose={() => setIsVivaModalOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-4 px-6 text-center text-xs text-slate-500">
        <p>DEAM Smart Traffic Management System • College Project 2026</p>
      </footer>
    </div>
  );
}

export default App;
