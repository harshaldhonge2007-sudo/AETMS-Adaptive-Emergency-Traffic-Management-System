import {
  ControlMode,
  IntersectionState,
  QueueCount,
  PlatoonMessage,
  Approach,
  SignalPhase,
  WeatherSettings,
} from '../types/traffic';

export interface ActiveTrafficContext {
  isCurrentPhaseDischarging: boolean;
  isCurrentPhaseBlocked: boolean;
  crossTrafficQueue: number;
  maxRedWaitTime: number;
  activeGreenQueue: number;
}

export interface ControllerConfig {
  fixedGreenDuration?: number; // default 15s, or tuned (e.g. 25s)
  minGreen?: number; // 5s or 7s
  maxGreen?: number; // 35s
  saturationFlowVehPerSec?: number; // 0.5 veh/s per lane
}

export interface PhaseTransitionResult {
  nextPhase: SignalPhase;
  phaseDuration: number;
  nsGreenAllocated: number;
  ewGreenAllocated: number;
  reason: string;
}

/**
 * Pure function: Calculates Webster's optimum cycle length and effective green split.
 * Formulation:
 *   Lost time L = 2 * (Yellow + AllRed - EffectiveExtension) ≈ 7.0s
 *   Flow ratios y_i = q_i / s_i
 *   Y = y_NS + y_EW (capped at 0.85)
 *   C0 = (1.5 * L + 5) / (1 - Y) = 15.5 / (1 - Y)
 *   g_i = (C0 - L) * (y_i / Y)
 */
export function calculateWebsterSplit(
  queues: QueueCount,
  incomingPlatoons: PlatoonMessage[],
  hasAccident: boolean,
  accidentApproach: Approach | null,
  weather: WeatherSettings,
  config: ControllerConfig = {}
): { greenNS: number; greenEW: number; cycleLength: number; reason: string } {
  const minGreen = config.minGreen ?? 5;
  const maxGreen = config.maxGreen ?? 35;
  const satFlow = config.saturationFlowVehPerSec ?? 0.5; // veh/s
  const lostTimePerPhase = 3.5; // 3.0 yellow + 1.5 all-red - 1.0 startup
  const totalLostTime = lostTimePerPhase * 2; // 7.0s

  let qNS = Math.max(0.5, queues.NORTH + queues.SOUTH);
  let qEW = Math.max(0.5, queues.EAST + queues.WEST);

  // Platoon arrival contributions
  for (const p of incomingPlatoons) {
    if (p.etaSeconds <= 12) {
      if (p.approach === 'NORTH' || p.approach === 'SOUTH') {
        qNS += p.vehicleCount * 1.2;
      } else {
        qEW += p.vehicleCount * 1.2;
      }
    }
  }

  // Accident capacity penalty
  if (hasAccident && accidentApproach) {
    if (accidentApproach === 'NORTH' || accidentApproach === 'SOUTH') {
      qNS = Math.max(0.2, qNS * 0.2);
      qEW += 3.0; // divert capacity
    } else {
      qEW = Math.max(0.2, qEW * 0.2);
      qNS += 3.0;
    }
  }

  // Nominal cycle estimate to compute flow rates (veh/s)
  const estimatedCycle = 40.0;
  const flowNS = qNS / estimatedCycle;
  const flowEW = qEW / estimatedCycle;

  // Flow ratios y = q / s
  const yNS = Math.min(0.42, Math.max(0.05, flowNS / satFlow));
  const yEW = Math.min(0.42, Math.max(0.05, flowEW / satFlow));
  const Y = Math.min(0.82, Math.max(0.15, yNS + yEW));

  // Webster Optimum Cycle Formula
  const rawCycle = (1.5 * totalLostTime + 5.0) / (1.0 - Y);
  const cycleLength = Math.round(Math.min(65, Math.max(22, rawCycle)));

  // Available effective green time
  const totalGreen = Math.max(minGreen * 2, cycleLength - totalLostTime);
  let greenNS = Math.round(totalGreen * (yNS / Y));
  let greenEW = Math.round(totalGreen * (yEW / Y));

  // Enforce boundary clamps
  greenNS = Math.min(maxGreen, Math.max(minGreen, greenNS));
  greenEW = Math.min(maxGreen, Math.max(minGreen, greenEW));

  // Weather safety extension for wet friction
  if (weather.type !== 'CLEAR') {
    greenNS = Math.min(maxGreen, Math.round(greenNS * 1.05));
    greenEW = Math.min(maxGreen, Math.round(greenEW * 1.05));
  }

  return {
    greenNS,
    greenEW,
    cycleLength,
    reason: `Webster: Y=${Y.toFixed(2)}, C0=${cycleLength}s, Splits=[${greenNS}s, ${greenEW}s]`,
  };
}

/**
 * Pure function: Calculates dynamic queue pressure split.
 * Uses approach queue pressure with exponent to prioritize congested lanes.
 */
export function calculateQueuePressureSplit(
  queues: QueueCount,
  incomingPlatoons: PlatoonMessage[],
  hasAccident: boolean,
  accidentApproach: Approach | null,
  weather: WeatherSettings,
  config: ControllerConfig = {}
): { greenNS: number; greenEW: number; cycleLength: number; reason: string } {
  const minGreen = config.minGreen ?? 5;
  const maxGreen = config.maxGreen ?? 35;

  let nsPressure = Math.pow(queues.NORTH + queues.SOUTH, 1.25);
  let ewPressure = Math.pow(queues.EAST + queues.WEST, 1.25);

  if (hasAccident && accidentApproach) {
    if (accidentApproach === 'NORTH' || accidentApproach === 'SOUTH') {
      nsPressure = Math.max(0.3, nsPressure * 0.2);
      ewPressure += 4.0;
    } else {
      ewPressure = Math.max(0.3, ewPressure * 0.2);
      nsPressure += 4.0;
    }
  }

  for (const platoon of incomingPlatoons) {
    if (platoon.etaSeconds <= 8) {
      if (platoon.approach === 'NORTH' || platoon.approach === 'SOUTH') {
        nsPressure += platoon.vehicleCount * 1.8;
      } else {
        ewPressure += platoon.vehicleCount * 1.8;
      }
    }
  }

  nsPressure = Math.max(1, nsPressure);
  ewPressure = Math.max(1, ewPressure);
  const totalPressure = nsPressure + ewPressure;

  const cycleLength = Math.round(Math.min(65, Math.max(22, 18 + totalPressure * 2.0)));
  const targetRatioNS = nsPressure / totalPressure;
  const targetRatioEW = ewPressure / totalPressure;

  let greenNS = Math.round(Math.min(maxGreen, Math.max(minGreen, cycleLength * targetRatioNS)));
  let greenEW = Math.round(Math.min(maxGreen, Math.max(minGreen, cycleLength * targetRatioEW)));

  if (weather.type !== 'CLEAR') {
    greenNS = Math.min(maxGreen, Math.round(greenNS * 1.1));
    greenEW = Math.min(maxGreen, Math.round(greenEW * 1.1));
  }

  return {
    greenNS,
    greenEW,
    cycleLength,
    reason: `Queue Pressure: Ratio=${(targetRatioNS * 100).toFixed(0)}%/${(targetRatioEW * 100).toFixed(0)}%`,
  };
}

/**
 * Pure function: Computes the next state and phase duration when a phase expires.
 */
export function computePhaseTransition(
  currentPhase: SignalPhase,
  nsGreenAllocated: number,
  ewGreenAllocated: number,
  queues: QueueCount,
  incomingPlatoons: PlatoonMessage[],
  hasAccident: boolean,
  accidentApproach: Approach | null,
  mode: ControlMode,
  weather: WeatherSettings,
  config: ControllerConfig = {}
): PhaseTransitionResult {
  const yellowDuration = SignalController.BASE_YELLOW + weather.yellowExtension;
  const allRedDuration = SignalController.BASE_ALL_RED + weather.allRedExtension;
  const effectiveMode = mode === 'ADAPTIVE' ? 'WEBSTER' : mode;

  switch (currentPhase) {
    case 'NS_GREEN':
      return {
        nextPhase: 'NS_YELLOW',
        phaseDuration: yellowDuration,
        nsGreenAllocated,
        ewGreenAllocated,
        reason: 'NS Green Expired -> Yellow Clearance',
      };

    case 'NS_YELLOW':
      return {
        nextPhase: 'ALL_RED',
        phaseDuration: allRedDuration,
        nsGreenAllocated,
        ewGreenAllocated,
        reason: 'Yellow Expired -> All-Red Safety Buffer',
      };

    case 'ALL_RED':
      // Decide whether next green is EW or NS based on previous allocation
      if (nsGreenAllocated > 0) {
        // NS just completed; next is EW GREEN
        let ewDuration = config.fixedGreenDuration ?? SignalController.FIXED_GREEN;
        let reason = `Fixed Timing (${ewDuration}s)`;

        if (effectiveMode === 'WEBSTER') {
          const split = calculateWebsterSplit(queues, incomingPlatoons, hasAccident, accidentApproach, weather, config);
          ewDuration = split.greenEW;
          reason = split.reason;
        } else if (effectiveMode === 'QUEUE_PRESSURE') {
          const split = calculateQueuePressureSplit(queues, incomingPlatoons, hasAccident, accidentApproach, weather, config);
          ewDuration = split.greenEW;
          reason = split.reason;
        }

        return {
          nextPhase: 'EW_GREEN',
          phaseDuration: ewDuration,
          nsGreenAllocated: 0,
          ewGreenAllocated: ewDuration,
          reason,
        };
      } else {
        // EW just completed; next is NS GREEN
        let nsDuration = config.fixedGreenDuration ?? SignalController.FIXED_GREEN;
        let reason = `Fixed Timing (${nsDuration}s)`;

        if (effectiveMode === 'WEBSTER') {
          const split = calculateWebsterSplit(queues, incomingPlatoons, hasAccident, accidentApproach, weather, config);
          nsDuration = split.greenNS;
          reason = split.reason;
        } else if (effectiveMode === 'QUEUE_PRESSURE') {
          const split = calculateQueuePressureSplit(queues, incomingPlatoons, hasAccident, accidentApproach, weather, config);
          nsDuration = split.greenNS;
          reason = split.reason;
        }

        return {
          nextPhase: 'NS_GREEN',
          phaseDuration: nsDuration,
          nsGreenAllocated: nsDuration,
          ewGreenAllocated: 0,
          reason,
        };
      }

    case 'EW_GREEN':
      return {
        nextPhase: 'EW_YELLOW',
        phaseDuration: yellowDuration,
        nsGreenAllocated,
        ewGreenAllocated,
        reason: 'EW Green Expired -> Yellow Clearance',
      };

    case 'EW_YELLOW':
      return {
        nextPhase: 'ALL_RED',
        phaseDuration: allRedDuration,
        nsGreenAllocated,
        ewGreenAllocated,
        reason: 'Yellow Expired -> All-Red Safety Buffer',
      };
  }
}

export class SignalController {
  public static readonly MIN_GREEN = 5;
  public static readonly MAX_GREEN = 35;
  public static readonly BASE_YELLOW = 3.0;
  public static readonly BASE_ALL_RED = 1.5;
  public static readonly FIXED_GREEN = 15;

  /**
   * Updates an intersection's signal timing for one simulation delta tick.
   * Handles dynamic mid-phase truncation (early cut-off, starvation flush) and phase progression.
   */
  public updateIntersection(
    intersection: IntersectionState,
    dtSeconds: number,
    mode: ControlMode,
    weather: WeatherSettings,
    trafficContext?: ActiveTrafficContext,
    config: ControllerConfig = {}
  ): void {
    intersection.phaseTimer += dtSeconds;

    const effectiveMode = mode === 'ADAPTIVE' ? 'WEBSTER' : mode;
    const isDynamic = effectiveMode === 'WEBSTER' || effectiveMode === 'QUEUE_PRESSURE';

    // Mid-phase dynamic optimization
    if (isDynamic && trafficContext && !intersection.isEmergencyPreempted) {
      const isGreenPhase =
        intersection.currentPhase === 'NS_GREEN' || intersection.currentPhase === 'EW_GREEN';

      if (isGreenPhase) {
        // 1. EARLY CUT-OFF: Empty queue or spillback blocking while cross traffic is waiting
        if (
          intersection.phaseTimer >= SignalController.MIN_GREEN &&
          (trafficContext.isCurrentPhaseBlocked ||
            (trafficContext.activeGreenQueue === 0 && !trafficContext.isCurrentPhaseDischarging)) &&
          trafficContext.crossTrafficQueue > 0
        ) {
          intersection.phaseTimer = intersection.phaseDuration;
          intersection.activeControlReason = 'Early Cut-off (Spillback/No Flow)';
        }
        // 2. ANTI-STARVATION: Cross traffic waiting on red >= 16s with queue >= 2
        else if (
          trafficContext.maxRedWaitTime >= 16 &&
          trafficContext.crossTrafficQueue >= 2 &&
          intersection.phaseTimer >= SignalController.MIN_GREEN &&
          intersection.phaseTimer < intersection.phaseDuration - 1
        ) {
          intersection.phaseTimer = intersection.phaseDuration;
          intersection.activeControlReason = 'Anti-Starvation Phase Switch';
        }
        // 3. DYNAMIC CONGESTION FLUSH: Platoon actively discharging into clear road
        else if (
          trafficContext.activeGreenQueue >= 2 &&
          trafficContext.isCurrentPhaseDischarging &&
          !trafficContext.isCurrentPhaseBlocked &&
          intersection.phaseTimer >= intersection.phaseDuration - 2.5 &&
          intersection.phaseDuration < SignalController.MAX_GREEN &&
          trafficContext.maxRedWaitTime < 18
        ) {
          const extension = Math.min(3.5, SignalController.MAX_GREEN - intersection.phaseDuration);
          if (extension > 0) {
            intersection.phaseDuration += extension;
            intersection.activeControlReason = `Dynamic Flush (+${Math.round(extension)}s)`;
          }
        }
      }
    }

    // Phase expiration
    if (intersection.phaseTimer >= intersection.phaseDuration) {
      intersection.phaseTimer = 0;
      const res = computePhaseTransition(
        intersection.currentPhase,
        intersection.nsGreenAllocated,
        intersection.ewGreenAllocated,
        intersection.queues,
        intersection.incomingPlatoons,
        intersection.hasAccident,
        intersection.accidentApproach,
        mode,
        weather,
        config
      );

      intersection.currentPhase = res.nextPhase;
      intersection.phaseDuration = res.phaseDuration;
      intersection.nsGreenAllocated = res.nsGreenAllocated;
      intersection.ewGreenAllocated = res.ewGreenAllocated;
      intersection.activeControlReason = res.reason;

      if (res.nextPhase === 'NS_GREEN') {
        intersection.cycleCount++;
      }
    }
  }
}
