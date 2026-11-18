import { describe, it, expect } from 'vitest';
import {
  calculateWebsterSplit,
  calculateQueuePressureSplit,
  computePhaseTransition,
  SignalController,
} from '../src/engine/SignalController';
import { IntersectionState, QueueCount, WeatherSettings } from '../src/types/traffic';

const defaultWeather: WeatherSettings = {
  type: 'CLEAR',
  label: 'Clear',
  speedMultiplier: 1.0,
  yellowExtension: 0,
  allRedExtension: 0,
  frictionCoefficient: 1.0,
  visibilityAlpha: 0,
};

const rainWeather: WeatherSettings = {
  type: 'RAIN',
  label: 'Rain',
  speedMultiplier: 0.8,
  yellowExtension: 1.5,
  allRedExtension: 1.0,
  frictionCoefficient: 0.7,
  visibilityAlpha: 0.3,
};

describe('SignalController Decision Logic & Formulas', () => {
  it('enforces min and max green bounds under extreme zero and heavy queues', () => {
    // Extreme zero queue
    const zeroQueue: QueueCount = { NORTH: 0, SOUTH: 0, EAST: 0, WEST: 0 };
    const resZero = calculateWebsterSplit(zeroQueue, [], false, null, defaultWeather, {
      minGreen: 5,
      maxGreen: 35,
    });
    expect(resZero.greenNS).toBeGreaterThanOrEqual(5);
    expect(resZero.greenEW).toBeGreaterThanOrEqual(5);
    expect(resZero.greenNS).toBeLessThanOrEqual(35);
    expect(resZero.greenEW).toBeLessThanOrEqual(35);

    // Extreme asymmetric queue (NS = 50 cars, EW = 0)
    const heavyNS: QueueCount = { NORTH: 25, SOUTH: 25, EAST: 0, WEST: 0 };
    const resHeavy = calculateWebsterSplit(heavyNS, [], false, null, defaultWeather, {
      minGreen: 5,
      maxGreen: 35,
    });
    // EW must still receive guaranteed minimum green (no starvation!)
    expect(resHeavy.greenEW).toBeGreaterThanOrEqual(5);
    // NS must be clamped to max green
    expect(resHeavy.greenNS).toBeLessThanOrEqual(35);
  });

  it('guarantees yellow and all-red clearance always precede phase changes', () => {
    const queue: QueueCount = { NORTH: 3, SOUTH: 3, EAST: 3, WEST: 3 };

    // NS_GREEN expires -> must transition to NS_YELLOW
    const t1 = computePhaseTransition(
      'NS_GREEN',
      15,
      0,
      queue,
      [],
      false,
      null,
      'WEBSTER',
      defaultWeather
    );
    expect(t1.nextPhase).toBe('NS_YELLOW');
    expect(t1.phaseDuration).toBe(SignalController.BASE_YELLOW);

    // NS_YELLOW expires -> must transition to ALL_RED
    const t2 = computePhaseTransition(
      'NS_YELLOW',
      15,
      0,
      queue,
      [],
      false,
      null,
      'WEBSTER',
      defaultWeather
    );
    expect(t2.nextPhase).toBe('ALL_RED');
    expect(t2.phaseDuration).toBe(SignalController.BASE_ALL_RED);

    // ALL_RED expires -> transitions to EW_GREEN
    const t3 = computePhaseTransition(
      'ALL_RED',
      15,
      0,
      queue,
      [],
      false,
      null,
      'WEBSTER',
      defaultWeather
    );
    expect(t3.nextPhase).toBe('EW_GREEN');
    expect(t3.phaseDuration).toBeGreaterThanOrEqual(SignalController.MIN_GREEN);

    // EW_GREEN expires -> must transition to EW_YELLOW
    const t4 = computePhaseTransition(
      'EW_GREEN',
      0,
      15,
      queue,
      [],
      false,
      null,
      'WEBSTER',
      defaultWeather
    );
    expect(t4.nextPhase).toBe('EW_YELLOW');
  });

  it('expands yellow and all-red safety buffers during adverse weather', () => {
    const queue: QueueCount = { NORTH: 2, SOUTH: 2, EAST: 2, WEST: 2 };
    const tRainYellow = computePhaseTransition(
      'NS_GREEN',
      15,
      0,
      queue,
      [],
      false,
      null,
      'WEBSTER',
      rainWeather
    );
    // Base 3.0s + rainExtension 1.5s = 4.5s
    expect(tRainYellow.phaseDuration).toBe(4.5);

    const tRainAllRed = computePhaseTransition(
      'NS_YELLOW',
      15,
      0,
      queue,
      [],
      false,
      null,
      'WEBSTER',
      rainWeather
    );
    // Base 1.5s + rainExtension 1.0s = 2.5s
    expect(tRainAllRed.phaseDuration).toBe(2.5);
  });

  it('re-allocates green capacity away from blocked accident approaches to cross traffic', () => {
    const queue: QueueCount = { NORTH: 5, SOUTH: 5, EAST: 5, WEST: 5 };
    // Normal split without accident (50/50 ratio)
    const normal = calculateWebsterSplit(queue, [], false, null, defaultWeather);

    // Accident on NORTH approach
    const accident = calculateWebsterSplit(queue, [], true, 'NORTH', defaultWeather);

    // NS green time must drop sharply (downweighted capacity)
    expect(accident.greenNS).toBeLessThan(normal.greenNS);
    // Green split ratio (EW / NS) must shift heavily in favor of unblocked cross traffic
    const normalRatio = normal.greenEW / normal.greenNS;
    const accidentRatio = accident.greenEW / accident.greenNS;
    expect(accidentRatio).toBeGreaterThan(normalRatio * 1.5);
  });
});
