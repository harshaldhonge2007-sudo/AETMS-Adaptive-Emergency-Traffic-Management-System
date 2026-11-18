import {
  Approach,
  EmergencyRouteConfig,
  EmergencyWaypoint,
  IntersectionState,
  PreemptionRequest,
  PreemptionState,
  SignalPhase,
  Vehicle,
  WeatherSettings,
} from '../types/traffic';
import { SignalController } from './SignalController';

export const PRESET_EMERGENCY_ROUTES: EmergencyRouteConfig[] = [
  {
    id: 'ROUTE_NORTH_SOUTH',
    label: 'Corridor 1: North -> South (I1 to I3)',
    origin: 'NORTH',
    destination: 'SOUTH',
    pathIntersections: ['I1', 'I3'],
    startX: 250 - 18,
    startY: 0,
    initialDirection: 'NORTH',
    waypoints: [
      { targetIntersectionId: 'I1', targetX: 250 - 18, targetY: 190, direction: 'NORTH' },
      { targetIntersectionId: 'I3', targetX: 250 - 18, targetY: 430, direction: 'NORTH' },
      { targetIntersectionId: null, targetX: 250 - 18, targetY: 650, direction: 'NORTH' },
    ],
  },
  {
    id: 'ROUTE_WEST_EAST',
    label: 'Corridor 2: West -> East (I1 to I2)',
    origin: 'WEST',
    destination: 'EAST',
    pathIntersections: ['I1', 'I2'],
    startX: 0,
    startY: 190 + 18,
    initialDirection: 'WEST',
    waypoints: [
      { targetIntersectionId: 'I1', targetX: 250, targetY: 190 + 18, direction: 'WEST' },
      { targetIntersectionId: 'I2', targetX: 550, targetY: 190 + 18, direction: 'WEST' },
      { targetIntersectionId: null, targetX: 850, targetY: 190 + 18, direction: 'WEST' },
    ],
  },
  {
    id: 'ROUTE_CROSS_DIAGONAL',
    label: 'Express Route: I1 -> I2 -> I4',
    origin: 'WEST',
    destination: 'SOUTH',
    pathIntersections: ['I1', 'I2', 'I4'],
    startX: 0,
    startY: 190 + 18,
    initialDirection: 'WEST',
    waypoints: [
      { targetIntersectionId: 'I1', targetX: 250, targetY: 190 + 18, direction: 'WEST' },
      { targetIntersectionId: 'I2', targetX: 550 - 18, targetY: 190 + 18, direction: 'WEST' },
      { targetIntersectionId: 'I4', targetX: 550 - 18, targetY: 430, direction: 'NORTH' },
      { targetIntersectionId: null, targetX: 550 - 18, targetY: 650, direction: 'NORTH' },
    ],
  },
  {
    id: 'ROUTE_SOUTH_CORRIDOR',
    label: 'Corridor 3: West -> East (I3 to I4)',
    origin: 'WEST',
    destination: 'EAST',
    pathIntersections: ['I3', 'I4'],
    startX: 0,
    startY: 430 + 18,
    initialDirection: 'WEST',
    waypoints: [
      { targetIntersectionId: 'I3', targetX: 250, targetY: 430 + 18, direction: 'WEST' },
      { targetIntersectionId: 'I4', targetX: 550, targetY: 430 + 18, direction: 'WEST' },
      { targetIntersectionId: null, targetX: 850, targetY: 430 + 18, direction: 'WEST' },
    ],
  },
];

export interface ActiveEmergencyRecord {
  vehicleId: string;
  routeConfig: EmergencyRouteConfig;
  spawnSimTime: number;
  completedSimTime?: number;
  travelTime?: number;
  stopsCount: number;
}

export class EmergencyManager {
  // Configurable preemption detection distance (default 160px from intersection center)
  public static readonly DETECTION_DISTANCE_PX = 160;

  // Active emergency vehicles map (supporting multiple simultaneous vehicles)
  private activeEmergencies: Map<string, ActiveEmergencyRecord> = new Map();

  // Completed emergency metrics
  public completedEmergencyTrips: ActiveEmergencyRecord[] = [];
  public totalBystanderDelayAccumulated: number = 0;

  public triggerEmergency(
    vehicleId: string,
    route: EmergencyRouteConfig,
    simTime: number = 0
  ): void {
    this.activeEmergencies.set(vehicleId, {
      vehicleId,
      routeConfig: route,
      spawnSimTime: simTime,
      stopsCount: 0,
    });
  }

  public registerEmergencyCompletion(
    vehicleId: string,
    simTime: number
  ): void {
    const record = this.activeEmergencies.get(vehicleId);
    if (record) {
      record.completedSimTime = simTime;
      record.travelTime = simTime - record.spawnSimTime;
      this.completedEmergencyTrips.push(record);
      this.activeEmergencies.delete(vehicleId);
    }
  }

  public clearEmergency(): void {
    this.activeEmergencies.clear();
  }

  public isEmergencyActive(): boolean {
    return this.activeEmergencies.size > 0;
  }

  public getActiveVehicleCount(): number {
    return this.activeEmergencies.size;
  }

  public getActiveRoute(): EmergencyRouteConfig | null {
    const first = this.activeEmergencies.values().next().value;
    return first ? first.routeConfig : null;
  }

  /**
   * Evaluates all active emergency vehicles and checks which ones require preemption
   * at each intersection. Multiple vehicles targeting the same intersection are resolved by ETA.
   */
  public updatePreemptionState(
    intersections: Map<string, IntersectionState>,
    vehicles: Vehicle[],
    dt: number,
    weather: WeatherSettings
  ): void {
    const yellowDuration = SignalController.BASE_YELLOW + weather.yellowExtension;
    const allRedDuration = SignalController.BASE_ALL_RED + weather.allRedExtension;

    // Collect all emergency requests per intersection
    const requestsPerIntersection: Map<string, PreemptionRequest[]> = new Map();

    for (const v of vehicles) {
      if (!v.isEmergency || !v.targetIntersectionId) continue;
      const inter = intersections.get(v.targetIntersectionId);
      if (!inter) continue;

      const dist = this.getDistanceToIntersection(v, inter);
      // Preemption activates ONLY when vehicle is approaching and within detection zone (~160px)
      if (dist > 0 && dist <= EmergencyManager.DETECTION_DISTANCE_PX) {
        const requiredPhase: SignalPhase =
          v.direction === 'NORTH' || v.direction === 'SOUTH' ? 'NS_GREEN' : 'EW_GREEN';
        const eta = Math.max(0.1, dist / Math.max(0.5, v.speed * 60));

        const req: PreemptionRequest = {
          vehicleId: v.id,
          intersectionId: inter.id,
          requiredPhase,
          approach: v.direction,
          distanceToCenter: dist,
          speed: v.speed,
          etaSeconds: eta,
        };

        if (!requestsPerIntersection.has(inter.id)) {
          requestsPerIntersection.set(inter.id, []);
        }
        requestsPerIntersection.get(inter.id)!.push(req);
      }
    }

    // Process each intersection
    for (const inter of intersections.values()) {
      const requests = requestsPerIntersection.get(inter.id);

      if (!requests || requests.length === 0) {
        // No approaching emergency vehicle within detection zone
        if (inter.isEmergencyPreempted) {
          // Release preemption gracefully
          this.releasePreemption(inter);
        }
        continue;
      }

      // Resolve conflicting requests by lowest ETA
      requests.sort((a, b) => a.etaSeconds - b.etaSeconds);
      const winner = requests[0];

      this.applySafePreemptionTransition(inter, winner.requiredPhase, dt, yellowDuration, allRedDuration);
    }
  }

  /**
   * Executes safe multi-step clearance transition:
   * Current Green -> Yellow -> All-Red -> Required Preempted Green.
   * NEVER abruptly snaps phase to green without clearance!
   */
  private applySafePreemptionTransition(
    inter: IntersectionState,
    requiredPhase: SignalPhase,
    dt: number,
    yellowDuration: number,
    allRedDuration: number
  ): void {
    inter.isEmergencyPreempted = true;

    // Initialize state if not present
    if (!inter.preemptionState || inter.preemptionState === 'IDLE') {
      inter.activePreemptionTargetPhase = requiredPhase;

      if (inter.currentPhase === requiredPhase) {
        // Already on the required green: immediately lock it and extend
        inter.preemptionState = 'PREEMPTED_GREEN';
        inter.phaseDuration = 30; // lock green while emergency is active
        inter.activeControlReason = 'Emergency Preemption Locked (Green)';
        return;
      }

      // Opposing phase is active: begin safe clearance sequence
      if (inter.currentPhase === 'NS_GREEN') {
        inter.currentPhase = 'NS_YELLOW';
        inter.phaseTimer = 0;
        inter.phaseDuration = yellowDuration;
        inter.preemptionState = 'TRANSITION_YELLOW';
        inter.activeControlReason = 'Emergency Preemption: NS Yellow Clearance';
      } else if (inter.currentPhase === 'EW_GREEN') {
        inter.currentPhase = 'EW_YELLOW';
        inter.phaseTimer = 0;
        inter.phaseDuration = yellowDuration;
        inter.preemptionState = 'TRANSITION_YELLOW';
        inter.activeControlReason = 'Emergency Preemption: EW Yellow Clearance';
      } else if (inter.currentPhase === 'NS_YELLOW' || inter.currentPhase === 'EW_YELLOW') {
        inter.preemptionState = 'TRANSITION_YELLOW';
      } else if (inter.currentPhase === 'ALL_RED') {
        inter.preemptionState = 'TRANSITION_ALL_RED';
      }
      return;
    }

    // Step through the clearance state machine
    if (inter.preemptionState === 'TRANSITION_YELLOW') {
      inter.phaseTimer += dt;
      if (inter.phaseTimer >= inter.phaseDuration) {
        inter.currentPhase = 'ALL_RED';
        inter.phaseTimer = 0;
        inter.phaseDuration = allRedDuration;
        inter.preemptionState = 'TRANSITION_ALL_RED';
        inter.activeControlReason = 'Emergency Preemption: All-Red Buffer';
      }
    } else if (inter.preemptionState === 'TRANSITION_ALL_RED') {
      inter.phaseTimer += dt;
      if (inter.phaseTimer >= inter.phaseDuration) {
        inter.currentPhase = requiredPhase;
        inter.phaseTimer = 0;
        inter.phaseDuration = 30; // extended green for ambulance passage
        inter.preemptionState = 'PREEMPTED_GREEN';
        inter.activeControlReason = 'Emergency Priority Granted';
      }
    } else if (inter.preemptionState === 'PREEMPTED_GREEN') {
      // Hold green until released
      inter.currentPhase = requiredPhase;
      inter.phaseDuration = Math.max(inter.phaseDuration, 25);
    }
  }

  /**
   * Releases an intersection once the emergency vehicle clears the junction box.
   */
  public releasePreemption(inter: IntersectionState): void {
    inter.isEmergencyPreempted = false;
    inter.preemptionState = 'IDLE';
    inter.activePreemptionTargetPhase = null;
    inter.activeControlReason = 'Emergency Cleared (Resuming Normal Control)';
    // Force normal cycle to evaluate queue demands on cross traffic
    inter.phaseDuration = Math.min(inter.phaseDuration, 6);
  }

  private getDistanceToIntersection(v: Vehicle, inter: IntersectionState): number {
    switch (v.direction) {
      case 'NORTH':
        return inter.y - v.y;
      case 'SOUTH':
        return v.y - inter.y;
      case 'WEST':
        return inter.x - v.x;
      case 'EAST':
        return v.x - inter.x;
    }
  }
}
