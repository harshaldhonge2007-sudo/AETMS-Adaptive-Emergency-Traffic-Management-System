import {
  ControlMode,
  IntersectionState,
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

export class SignalController {
  // Base timing constants (seconds)
  public static readonly MIN_GREEN = 5;
  public static readonly MAX_GREEN = 35;
  public static readonly BASE_YELLOW = 3.0;
  public static readonly BASE_ALL_RED = 1.5;
  public static readonly FIXED_GREEN = 15;

  /**
   * Updates an intersection's signal timing for one simulation delta tick.
   * In ADAPTIVE mode, actively monitors queue pressure, spillback blocks, and flow.
   */
  public updateIntersection(
    intersection: IntersectionState,
    dtSeconds: number,
    mode: ControlMode,
    weather: WeatherSettings,
    trafficContext?: ActiveTrafficContext
  ): void {
    intersection.phaseTimer += dtSeconds;

    const yellowDuration = SignalController.BASE_YELLOW + weather.yellowExtension;
    const allRedDuration = SignalController.BASE_ALL_RED + weather.allRedExtension;

    // ACTIVE DYNAMIC ADAPTATION (Real-time mid-phase optimization in ADAPTIVE mode)
    if (mode === 'ADAPTIVE' && trafficContext && !intersection.isEmergencyPreempted) {
      const isGreenPhase =
        intersection.currentPhase === 'NS_GREEN' || intersection.currentPhase === 'EW_GREEN';

      if (isGreenPhase) {
        // 1. EARLY PHASE TRUNCATION (Spillback & Wasted-Green Cut-off):
        // If current green approaches are blocked by spillback / accident (or have 0 vehicles discharging)
        // and cross-traffic has queued vehicles waiting on red, cut off green early after MIN_GREEN
        if (
          intersection.phaseTimer >= SignalController.MIN_GREEN &&
          (trafficContext.isCurrentPhaseBlocked ||
            (trafficContext.activeGreenQueue === 0 && !trafficContext.isCurrentPhaseDischarging)) &&
          trafficContext.crossTrafficQueue > 0
        ) {
          intersection.phaseTimer = intersection.phaseDuration;
          intersection.activeControlReason = 'Early Cut-off (Spillback Cleared)';
        }

        // 2. STARVATION PREVENTION (Urgent Red Clearance):
        // If vehicles waiting on RED have been waiting >= 16s with queued vehicles,
        // terminate current green promptly once safe MIN_GREEN is reached
        else if (
          trafficContext.maxRedWaitTime >= 16 &&
          trafficContext.crossTrafficQueue >= 2 &&
          intersection.phaseTimer >= SignalController.MIN_GREEN &&
          intersection.phaseTimer < intersection.phaseDuration - 1
        ) {
          intersection.phaseTimer = intersection.phaseDuration;
          intersection.activeControlReason = 'Anti-Starvation Phase Switch';
        }

        // 3. DYNAMIC CONGESTION FLUSH EXTENSION:
        // If current green phase is actively discharging a heavy queue into clear downstream roads,
        // and countdown is nearly expired, extend green by +3.5s (up to MAX_GREEN) to flush the platoon
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

    // Check if phase expired
    if (intersection.phaseTimer >= intersection.phaseDuration) {
      this.advancePhase(intersection, mode, weather, yellowDuration, allRedDuration);
    }
  }

  /**
   * Cycles through the state machine:
   * NS_GREEN -> NS_YELLOW -> ALL_RED -> EW_GREEN -> EW_YELLOW -> ALL_RED -> NS_GREEN
   */
  private advancePhase(
    intersection: IntersectionState,
    mode: ControlMode,
    weather: WeatherSettings,
    yellowDuration: number,
    allRedDuration: number
  ): void {
    intersection.phaseTimer = 0;

    switch (intersection.currentPhase) {
      case 'NS_GREEN':
        intersection.currentPhase = 'NS_YELLOW';
        intersection.phaseDuration = yellowDuration;
        break;

      case 'NS_YELLOW':
        intersection.currentPhase = 'ALL_RED';
        intersection.phaseDuration = allRedDuration;
        break;

      case 'ALL_RED':
        if (intersection.nsGreenAllocated > 0) {
          intersection.currentPhase = 'EW_GREEN';
          intersection.phaseDuration = this.calculateGreenDuration(
            intersection,
            'EW',
            mode,
            weather
          );
          intersection.ewGreenAllocated = intersection.phaseDuration;
          intersection.nsGreenAllocated = 0;
          intersection.activeControlReason =
            intersection.activeControlReason || 'Adaptive Webster Split';
        } else {
          intersection.currentPhase = 'NS_GREEN';
          intersection.phaseDuration = this.calculateGreenDuration(
            intersection,
            'NS',
            mode,
            weather
          );
          intersection.nsGreenAllocated = intersection.phaseDuration;
          intersection.ewGreenAllocated = 0;
          intersection.cycleCount++;
          intersection.activeControlReason =
            intersection.activeControlReason || 'Adaptive Webster Split';
        }
        break;

      case 'EW_GREEN':
        intersection.currentPhase = 'EW_YELLOW';
        intersection.phaseDuration = yellowDuration;
        break;

      case 'EW_YELLOW':
        intersection.currentPhase = 'ALL_RED';
        intersection.phaseDuration = allRedDuration;
        break;
    }
  }

  /**
   * Calculates green split using Webster's modified method with exponential queue pressure
   * and Green Wave coordination.
   */
  public calculateGreenDuration(
    intersection: IntersectionState,
    approachGroup: 'NS' | 'EW',
    mode: ControlMode,
    weather: WeatherSettings
  ): number {
    if (mode === 'FIXED') {
      return SignalController.FIXED_GREEN;
    }

    // Adaptive Calculation (Webster's approximation + Exponential Queue Pressure)
    const qNorth = intersection.queues.NORTH;
    const qSouth = intersection.queues.SOUTH;
    const qEast = intersection.queues.EAST;
    const qWest = intersection.queues.WEST;

    // Exponential queue weighting: heavily congested approaches get prioritized
    let nsPressure = Math.pow(qNorth + qSouth, 1.25);
    let ewPressure = Math.pow(qEast + qWest, 1.25);

    // Account for accident impact: if approach has an accident, its useful capacity is near 0
    if (intersection.hasAccident) {
      if (intersection.accidentApproach === 'NORTH' || intersection.accidentApproach === 'SOUTH') {
        nsPressure = Math.max(0.3, nsPressure * 0.2); // downweight blocked lane
        ewPressure += 4; // reallocate excess time to clear cross traffic
      } else if (
        intersection.accidentApproach === 'EAST' ||
        intersection.accidentApproach === 'WEST'
      ) {
        ewPressure = Math.max(0.3, ewPressure * 0.2);
        nsPressure += 4;
      }
    }

    // Account for Incoming Platoons from upstream intersections (Green Wave coordination)
    for (const platoon of intersection.incomingPlatoons) {
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
    const targetRatio =
      approachGroup === 'NS' ? nsPressure / totalPressure : ewPressure / totalPressure;

    // Dynamic Cycle length between 22s and 65s
    const dynamicCycle = Math.min(65, Math.max(22, 18 + totalPressure * 2.0));
    let allocatedGreen = dynamicCycle * targetRatio;

    // Constrain within bounds
    allocatedGreen = Math.max(
      SignalController.MIN_GREEN,
      Math.min(SignalController.MAX_GREEN, allocatedGreen)
    );

    // Weather adjustment: in poor weather, add slight buffer for slower starts
    if (weather.type !== 'CLEAR') {
      allocatedGreen = Math.round(allocatedGreen * 1.1);
    }

    return Math.round(allocatedGreen);
  }
}
