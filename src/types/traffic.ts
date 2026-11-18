export type Approach = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';
export type SignalPhase = 'NS_GREEN' | 'NS_YELLOW' | 'ALL_RED' | 'EW_GREEN' | 'EW_YELLOW';
export type WeatherType = 'CLEAR' | 'RAIN' | 'FOG' | 'STORM';

/**
 * Controller operating modes:
 * - 'FIXED': Standard pre-timed round-robin (15s default or tuned duration)
 * - 'QUEUE_PRESSURE': Dynamic heuristic based on approach queue exponent
 * - 'WEBSTER': True Webster formulation: C0 = (1.5L + 5) / (1 - Y) with flow ratios & lost time
 * - 'ADAPTIVE': Backward-compatibility alias for dynamic control (defaults to WEBSTER)
 */
export type ControlMode = 'FIXED' | 'QUEUE_PRESSURE' | 'WEBSTER' | 'ADAPTIVE';

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
  waitDuration: number; // accumulated time stationary during current stop (seconds)
  stoppedDuration: number; // total cumulative time spent stationary (speed < 0.1)
  totalTravelTime: number; // actual elapsed travel time from spawn
  distanceTraveled: number;
  laneIndex: number;
  vehicleType?: 'sedan' | 'cab' | 'truck' | 'hatchback';
  emergencyWaypoints?: EmergencyWaypoint[];
  currentWaypointIndex?: number;
  lateralOffset?: number; // px shift towards curb when yielding to emergency vehicle
  isYielding?: boolean; // currently yielding to an approaching emergency vehicle
  isAccidentStopped?: boolean; // stopped due to crash ahead
  spawnTime: number; // simulation time when vehicle spawned
  freeFlowTravelTime: number; // ideal travel time if moving at maxSpeed with zero interference
  stopCount: number; // number of times vehicle came to a complete halt
  hasStoppedBefore?: boolean;
}

/**
 * Record saved when a vehicle exits the simulation network.
 * Completely eliminates survivorship bias by tracking departed vehicle delays.
 */
export interface TripRecord {
  vehicleId: string;
  isEmergency: boolean;
  vehicleType: string;
  origin: Approach;
  destination: Approach;
  spawnTime: number;
  exitTime: number;
  actualTravelTime: number;
  freeFlowTravelTime: number;
  delay: number; // actualTravelTime - freeFlowTravelTime (>= 0)
  stoppedDuration: number; // total stationary seconds
  stopCount: number;
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
  etaSeconds: number; // distance / avgSpeed
  isEmergencyPresent: boolean;
}

export type PreemptionState =
  | 'IDLE'
  | 'TRANSITION_YELLOW'
  | 'TRANSITION_ALL_RED'
  | 'PREEMPTED_GREEN'
  | 'RECOVERY';

export interface IntersectionState {
  id: string; // 'I1' | 'I2' | 'I3' | 'I4'
  name: string; // 'NW Junction', 'NE Junction', 'SW Junction', 'SE Junction'
  x: number; // pixel center on canvas
  y: number;
  currentPhase: SignalPhase;
  phaseTimer: number; // seconds spent in current phase
  phaseDuration: number; // target seconds for current phase
  queues: QueueCount; // stopped vehicles queued at each approach
  incomingPlatoons: PlatoonMessage[];
  isEmergencyPreempted: boolean;
  preemptionState?: PreemptionState;
  activePreemptionTargetPhase?: SignalPhase | null;
  preemptionTimer?: number;
  preemptedPhase: SignalPhase | null;
  hasAccident: boolean;
  accidentApproach: Approach | null;
  accidentLane: number;
  historyQueueAvg: number;
  cycleCount: number;
  nsGreenAllocated: number;
  ewGreenAllocated: number;
  activeControlReason?: string;
  coordinationOffset?: number; // Green wave corridor timing offset in seconds
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
  timestamp: number; // simulation elapsed seconds (NOT Date.now())
  avgWaitTime: number; // real average delay across completed trips
  p95WaitTime: number; // 95th percentile delay across completed trips
  maxWaitTime: number; // maximum delay observed
  totalThroughput: number; // total completed trips
  throughputPerMin: number; // completed trips per simulation minute
  activeVehiclesCount: number;
  totalQueueLength: number; // truly stopped vehicles count
  fixedAvgWaitTime?: number; // baseline delay from twin FIXED engine
  adaptiveEfficiencyDelta?: number; // real ((fixed - adaptive)/fixed) * 100
  emergencyTravelTimeAvg?: number; // real measured ambulance transit time
  emergencyBystanderDelay?: number; // extra delay induced on other cars during preemption
  isBaselineReady?: boolean; // true once >= 5 trips completed in both engines
}

export interface AccidentEvent {
  intersectionId: string;
  approach: Approach;
  lane: number;
  description: string;
  timestamp: number;
}

export interface PreemptionRequest {
  vehicleId: string;
  intersectionId: string;
  requiredPhase: SignalPhase;
  approach: Approach;
  distanceToCenter: number;
  speed: number;
  etaSeconds: number;
}

export interface ExperimentRunResult {
  scenario: string;
  seed: number;
  mode: ControlMode;
  completedTrips: number;
  avgDelay: number;
  p95Delay: number;
  maxQueue: number;
  throughputPerMin: number;
  emergencyTravelTime?: number;
}

export interface ExperimentSummaryRow {
  scenario: string;
  fixedDefaultDelay: number;
  fixedDefaultStd: number;
  fixedTunedDelay: number;
  fixedTunedStd: number;
  queuePressureDelay: number;
  queuePressureStd: number;
  websterDelay: number;
  websterStd: number;
  websterImprovementVsDefault: number;
  websterImprovementVsTuned: number;
  throughputPerMin: number;
}
