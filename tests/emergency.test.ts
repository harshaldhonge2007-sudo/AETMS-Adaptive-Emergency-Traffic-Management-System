import { describe, it, expect } from 'vitest';
import { EmergencyManager } from '../src/engine/EmergencyManager';
import { IntersectionState, SignalPhase, Vehicle, WeatherSettings } from '../src/types/traffic';

const defaultWeather: WeatherSettings = {
  type: 'CLEAR',
  label: 'Clear',
  speedMultiplier: 1.0,
  yellowExtension: 0,
  allRedExtension: 0,
  frictionCoefficient: 1.0,
  visibilityAlpha: 0,
};

function createMockIntersection(id: string, initialPhase: SignalPhase = 'EW_GREEN'): IntersectionState {
  return {
    id,
    name: `Junction ${id}`,
    x: 250,
    y: 190,
    currentPhase: initialPhase,
    phaseTimer: 0,
    phaseDuration: 15,
    queues: { NORTH: 0, SOUTH: 0, EAST: 0, WEST: 0 },
    incomingPlatoons: [],
    isEmergencyPreempted: false,
    preemptionState: 'IDLE',
    preemptedPhase: null,
    hasAccident: false,
    accidentApproach: null,
    accidentLane: 0,
    historyQueueAvg: 0,
    cycleCount: 0,
    nsGreenAllocated: 0,
    ewGreenAllocated: 15,
  };
}

describe('Emergency Preemption & Multi-Vehicle Resolution', () => {
  it('executes safe transition sequence without instantly snapping to green', () => {
    const em = new EmergencyManager();
    const inter = createMockIntersection('I1', 'EW_GREEN');
    const intersections = new Map([['I1', inter]]);

    // Ambulance approaching from NORTH at distance 120px (within 160px detection zone)
    const ambulance: Vehicle = {
      id: 'AMB_1',
      x: 250 - 18,
      y: 70, // 190 - 70 = 120px distance
      speed: 2.0,
      maxSpeed: 4.0,
      length: 26,
      width: 13,
      color: '#ef4444',
      isEmergency: true,
      route: ['I1'],
      currentRouteIndex: 0,
      origin: 'NORTH',
      destination: 'SOUTH',
      currentIntersectionId: null,
      targetIntersectionId: 'I1',
      direction: 'NORTH',
      isStopped: false,
      waitDuration: 0,
      stoppedDuration: 0,
      totalTravelTime: 0,
      distanceTraveled: 0,
      laneIndex: 0,
      spawnTime: 0,
      freeFlowTravelTime: 10,
      stopCount: 0,
    };

    // Step 1: Preemption activates -> Opposing green must transition to YELLOW first!
    em.updatePreemptionState(intersections, [ambulance], 0.1, defaultWeather);
    expect(inter.isEmergencyPreempted).toBe(true);
    expect(inter.preemptionState).toBe('TRANSITION_YELLOW');
    expect(inter.currentPhase).toBe('EW_YELLOW');

    // Step 2: Step through yellow duration (3.0s) -> Must transition to ALL_RED next!
    em.updatePreemptionState(intersections, [ambulance], 3.0, defaultWeather);
    expect(inter.preemptionState).toBe('TRANSITION_ALL_RED');
    expect(inter.currentPhase).toBe('ALL_RED');

    // Step 3: Step through all-red duration (1.5s) -> Finally grants required NS_GREEN!
    em.updatePreemptionState(intersections, [ambulance], 1.5, defaultWeather);
    expect(inter.preemptionState).toBe('PREEMPTED_GREEN');
    expect(inter.currentPhase).toBe('NS_GREEN');
  });

  it('releases intersection immediately once ambulance clears', () => {
    const em = new EmergencyManager();
    const inter = createMockIntersection('I1', 'NS_GREEN');
    inter.isEmergencyPreempted = true;
    inter.preemptionState = 'PREEMPTED_GREEN';

    em.releasePreemption(inter);
    expect(inter.isEmergencyPreempted).toBe(false);
    expect(inter.preemptionState).toBe('IDLE');
  });
});
