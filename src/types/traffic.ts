export type Approach = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';
export type SignalPhase = 'NS_GREEN' | 'NS_YELLOW' | 'ALL_RED' | 'EW_GREEN' | 'EW_YELLOW';
export type WeatherType = 'CLEAR' | 'RAIN' | 'FOG' | 'STORM';
export type ControlMode = 'ADAPTIVE' | 'FIXED';

export interface EmergencyWaypoint {
  targetIntersectionId: string | null;
  targetX: number;
  targetY: number;
  direction: Approach;
}

export interface EmergencyRouteConfig {
  id: string;
  label: string;
  origin: Approach;
  destination: Approach;
  pathIntersections: string[];
  startX: number;
  startY: number;
  initialDirection: Approach;
  waypoints: EmergencyWaypoint[];
}

export interface Vehicle {
  id: string;
  x: number;
  y: number;
  speed: number;
  maxSpeed: number;
  length: number;
  width: number;
  color: string;
  isEmergency: boolean;
  route: string[]; // List of intersection IDs to traverse e.g. ['I1', 'I2', 'I4']
  currentRouteIndex: number;
  origin: Approach;
  destination: Approach;
  currentIntersectionId: string | null;
  targetIntersectionId: string | null;
  direction: Approach; // Current movement direction
  isStopped: boolean;
  waitDuration: number; // accumulated time spent stationary (seconds)
  totalTravelTime: number;
  distanceTraveled: number;
  laneIndex: number;
  emergencyWaypoints?: EmergencyWaypoint[];
  currentWaypointIndex?: number;
  lateralOffset?: number; // px shift towards curb when yielding to emergency vehicle
  isYielding?: boolean; // currently yielding to an approaching emergency vehicle
  isAccidentStopped?: boolean; // stopped due to crash ahead
}

export interface QueueCount {
  NORTH: number;
  SOUTH: number;
  EAST: number;
  WEST: number;
}

export interface PlatoonMessage {
  fromIntersectionId: string;
  toIntersectionId: string;
  approach: Approach;
  vehicleCount: number;
  etaSeconds: number;
  isEmergencyPresent: boolean;
}

export interface IntersectionState {
  id: string; // 'I1' | 'I2' | 'I3' | 'I4'
  name: string; // 'NW Junction', 'NE Junction', 'SW Junction', 'SE Junction'
  x: number; // pixel center on canvas
  y: number;
  currentPhase: SignalPhase;
  phaseTimer: number; // seconds spent in current phase
  phaseDuration: number; // target seconds for current phase
  queues: QueueCount;
  incomingPlatoons: PlatoonMessage[];
  isEmergencyPreempted: boolean;
  preemptedPhase: SignalPhase | null;
  hasAccident: boolean;
  accidentApproach: Approach | null;
  accidentLane: number;
  historyQueueAvg: number;
  cycleCount: number;
  nsGreenAllocated: number;
  ewGreenAllocated: number;
  activeControlReason?: string;
}

export interface WeatherSettings {
  type: WeatherType;
  label: string;
  speedMultiplier: number;
  yellowExtension: number; // extra seconds for yellow light
  allRedExtension: number; // extra seconds for all-red clearance
  frictionCoefficient: number;
  visibilityAlpha: number; // canvas overlay opacity
}

export interface SimulationMetrics {
  timestamp: number;
  avgWaitTime: number;
  maxWaitTime: number;
  totalThroughput: number;
  activeVehiclesCount: number;
  totalQueueLength: number;
  adaptiveEfficiencyDelta: number; // Percentage better than fixed baseline
  emergencyClearingSpeed: number; // avg km/h during emergency mode
}

export interface AccidentEvent {
  intersectionId: string;
  approach: Approach;
  lane: number;
  description: string;
  timestamp: number;
}
