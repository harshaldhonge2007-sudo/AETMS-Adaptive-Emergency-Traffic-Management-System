import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../src/engine/SimulationEngine';

describe('SimulationEngine Determinism & Real Metrics', () => {
  it('guarantees identical runs with identical seeds', () => {
    const engine1 = new SimulationEngine({ seed: 888, controlMode: 'WEBSTER' });
    const engine2 = new SimulationEngine({ seed: 888, controlMode: 'WEBSTER' });

    for (let step = 0; step < 300; step++) {
      engine1.update(0.1);
      engine2.update(0.1);
    }

    expect(engine1.vehicles.length).toBe(engine2.vehicles.length);
    expect(engine1.completedTrips.length).toBe(engine2.completedTrips.length);

    if (engine1.vehicles.length > 0) {
      expect(engine1.vehicles[0].x).toBe(engine2.vehicles[0].x);
      expect(engine1.vehicles[0].y).toBe(engine2.vehicles[0].y);
      expect(engine1.vehicles[0].speed).toBe(engine2.vehicles[0].speed);
    }
  });

  it('records unbiased departure delays for exiting vehicles', () => {
    const engine = new SimulationEngine({ seed: 555, controlMode: 'WEBSTER' });
    engine.trafficDensityFactor = 1.5;

    // Run 600 ticks (60 sim seconds) to allow multiple trips to complete
    for (let step = 0; step < 600; step++) {
      engine.update(0.1);
    }

    expect(engine.completedTrips.length).toBeGreaterThan(0);
    const sampleTrip = engine.completedTrips[0];
    expect(sampleTrip.actualTravelTime).toBeGreaterThan(0);
    expect(sampleTrip.freeFlowTravelTime).toBeGreaterThan(0);
    expect(sampleTrip.delay).toBeGreaterThanOrEqual(0);
  });

  it('runs twin engines on identical seed to obtain real A/B benchmarking', () => {
    const seed = 999;
    const adaptiveEngine = new SimulationEngine({ seed, controlMode: 'WEBSTER' });
    const fixedEngine = new SimulationEngine({ seed, controlMode: 'FIXED', tunedFixedGreen: 25 });

    adaptiveEngine.trafficDensityFactor = 1.0;
    fixedEngine.trafficDensityFactor = 1.0;

    for (let step = 0; step < 800; step++) {
      adaptiveEngine.update(0.1);
      fixedEngine.update(0.1);
    }

    expect(adaptiveEngine.completedTrips.length).toBeGreaterThan(0);
    expect(fixedEngine.completedTrips.length).toBeGreaterThan(0);

    const adaptiveAvgDelay =
      adaptiveEngine.completedTrips.reduce((s, t) => s + t.delay, 0) /
      adaptiveEngine.completedTrips.length;
    const fixedAvgDelay =
      fixedEngine.completedTrips.reduce((s, t) => s + t.delay, 0) /
      fixedEngine.completedTrips.length;

    // Real empirical delay comparison without multipliers
    expect(adaptiveAvgDelay).toBeLessThan(fixedAvgDelay);
  });
});
