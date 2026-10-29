import {
  Approach,
  EmergencyRouteConfig,
  EmergencyWaypoint,
  IntersectionState,
  SignalPhase,
} from '../types/traffic';


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

export class EmergencyManager {
  private activeEmergencyVehicleId: string | null = null;
  private activeRoute: EmergencyRouteConfig | null = null;
  private preemptedIntersections: Set<string> = new Set();
  private sirenFlashState: boolean = false;
  private lastFlashTime: number = 0;

  public triggerEmergency(vehicleId: string, route: EmergencyRouteConfig): void {
    this.activeEmergencyVehicleId = vehicleId;
    this.activeRoute = route;
    this.preemptedIntersections.clear();
    route.pathIntersections.forEach((id) => this.preemptedIntersections.add(id));
  }

  public clearEmergency(): void {
    this.activeEmergencyVehicleId = null;
    this.activeRoute = null;
    this.preemptedIntersections.clear();
  }

  public isEmergencyActive(): boolean {
    return this.activeEmergencyVehicleId !== null;
  }

  public getActiveVehicleId(): string | null {
    return this.activeEmergencyVehicleId;
  }

  public getActiveRoute(): EmergencyRouteConfig | null {
    return this.activeRoute;
  }

  public isIntersectionPreempted(intersectionId: string): boolean {
    return this.preemptedIntersections.has(intersectionId);
  }

  public getRequiredPreemptionPhase(
    intersectionId: string,
    currentMovement: 'NS' | 'EW'
  ): SignalPhase {
    return currentMovement === 'NS' ? 'NS_GREEN' : 'EW_GREEN';
  }

  public updateSirenFlash(nowMs: number): boolean {
    if (nowMs - this.lastFlashTime > 250) {
      this.sirenFlashState = !this.sirenFlashState;
      this.lastFlashTime = nowMs;
    }
    return this.sirenFlashState;
  }

  public applyPreemptionToIntersection(
    intersection: IntersectionState,
    requiredPhase: SignalPhase
  ): void {
    intersection.isEmergencyPreempted = true;
    if (intersection.currentPhase !== requiredPhase) {
      // Transition gracefully: if yellow, let it finish or force immediate safe transition
      intersection.currentPhase = requiredPhase;
      intersection.phaseTimer = 0;
      intersection.phaseDuration = 25; // Extended green guarantee for emergency corridor
    }
  }
}
