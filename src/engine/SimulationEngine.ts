import {
  Approach,
  ControlMode,
  IntersectionState,
  SimulationMetrics,
  TripRecord,
  Vehicle,
  WeatherType,
} from '../types/traffic';
import { PRNG } from './prng';
import { AccidentManager } from './AccidentManager';
import { EmergencyManager, PRESET_EMERGENCY_ROUTES } from './EmergencyManager';
import { SignalController, ActiveTrafficContext } from './SignalController';
import { WeatherManager } from './WeatherManager';

export interface SimulationEngineOptions {
  seed?: number;
  controlMode?: ControlMode;
  tunedFixedGreen?: number;
}

export class SimulationEngine {
  public intersections: Map<string, IntersectionState> = new Map();
  public vehicles: Vehicle[] = [];
  public controlMode: ControlMode = 'WEBSTER';
  public trafficDensityFactor: number = 1.0;
  public isPaused: boolean = false;
  public simulationSpeed: number = 1.0;
  public tunedFixedGreen: number = 15; // default 15s, or tuned (e.g. 25s)

  // PRNG and Simulation Clock (All logic is driven by simTime, NOT Date.now())
  public prng: PRNG;
  public simTime: number = 0; // Elapsed simulation time in seconds
  private lastMetricsSampleSimTime: number = 0;

  public weatherManager: WeatherManager = new WeatherManager();
  public accidentManager: AccidentManager = new AccidentManager();
  public emergencyManager: EmergencyManager = new EmergencyManager();
  public signalController: SignalController = new SignalController();

  // Metrics & analytics accumulator (eliminates survivorship bias by tracking departed vehicles)
  public metricsHistory: SimulationMetrics[] = [];
  public completedTrips: TripRecord[] = [];
  private totalWaitTimeAccumulated: number = 0;
  private maxWaitObserved: number = 0;

  // External reference baseline from twin FIXED engine
  public externalFixedBaselineDelay: number | null = null;

  // Canvas coordinate geometry (800 x 600 default canvas)
  public readonly CANVAS_WIDTH = 800;
  public readonly CANVAS_HEIGHT = 600;
  public readonly ROAD_WIDTH = 70;
  public readonly INTERSECTION_POSITIONS: Record<string, { x: number; y: number; name: string }> =
    {
      I1: { x: 250, y: 190, name: 'NW Junction (I-1)' },
      I2: { x: 550, y: 190, name: 'NE Junction (I-2)' },
      I3: { x: 250, y: 430, name: 'SW Junction (I-3)' },
      I4: { x: 550, y: 430, name: 'SE Junction (I-4)' },
    };

  private vehicleIdCounter = 1;

  constructor(options: SimulationEngineOptions = {}) {
    this.prng = new PRNG(options.seed ?? 42);
    if (options.controlMode) {
      this.controlMode = options.controlMode;
    }
    if (options.tunedFixedGreen) {
      this.tunedFixedGreen = options.tunedFixedGreen;
    }
    this.initializeIntersections();
  }

  public initializeIntersections(): void {
    this.intersections.clear();
    Object.entries(this.INTERSECTION_POSITIONS).forEach(([id, config]) => {
      const state: IntersectionState = {
        id,
        name: config.name,
        x: config.x,
        y: config.y,
        currentPhase: id === 'I1' || id === 'I4' ? 'NS_GREEN' : 'EW_GREEN',
        phaseTimer: 0,
        phaseDuration: this.tunedFixedGreen,
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
        nsGreenAllocated: id === 'I1' || id === 'I4' ? this.tunedFixedGreen : 0,
        ewGreenAllocated: id === 'I2' || id === 'I3' ? this.tunedFixedGreen : 0,
      };
      this.intersections.set(id, state);
    });
  }

  public setControlMode(mode: ControlMode): void {
    this.controlMode = mode;
  }

  public setWeather(type: WeatherType): void {
    this.weatherManager.setWeather(type);
  }

  public spawnEmergencyVehicle(routeId?: string): Vehicle | null {
    const routeConfig =
      PRESET_EMERGENCY_ROUTES.find((r) => r.id === routeId) || PRESET_EMERGENCY_ROUTES[0];

    // Estimated free flow travel distance along waypoints
    let routeDistance = 0;
    let prevX = routeConfig.startX;
    let prevY = routeConfig.startY;
    for (const wp of routeConfig.waypoints) {
      routeDistance += Math.hypot(wp.targetX - prevX, wp.targetY - prevY);
      prevX = wp.targetX;
      prevY = wp.targetY;
    }

    const maxSpeed = 4.2;
    const vehicle: Vehicle = {
      id: `EMERGENCY_${this.vehicleIdCounter++}_${Math.floor(this.simTime)}`,
      x: routeConfig.startX,
      y: routeConfig.startY,
      speed: 1.5,
      maxSpeed,
      length: 26,
      width: 13,
      color: '#ef4444',
      isEmergency: true,
      route: [...routeConfig.pathIntersections],
      currentRouteIndex: 0,
      origin: routeConfig.origin,
      destination: routeConfig.destination,
      currentIntersectionId: null,
      targetIntersectionId: routeConfig.waypoints[0]?.targetIntersectionId || null,
      direction: routeConfig.initialDirection,
      isStopped: false,
      waitDuration: 0,
      stoppedDuration: 0,
      totalTravelTime: 0,
      distanceTraveled: 0,
      laneIndex: 0,
      emergencyWaypoints: routeConfig.waypoints,
      currentWaypointIndex: 0,
      spawnTime: this.simTime,
      freeFlowTravelTime: routeDistance / (maxSpeed * 60),
      stopCount: 0,
      hasStoppedBefore: false,
    };

    this.vehicles.unshift(vehicle);
    this.emergencyManager.triggerEmergency(vehicle.id, routeConfig, this.simTime);
    return vehicle;
  }

  public triggerAccident(intersectionId: string, approach: Approach): void {
    this.accidentManager.triggerAccident(intersectionId, approach);
  }

  public clearAllAccidents(): void {
    this.accidentManager.clearAllAccidents();
  }

  public update(rawDt: number): void {
    if (this.isPaused) return;

    const dt = Math.min(0.1, rawDt) * this.simulationSpeed;
    this.simTime += dt;

    // 1. Update Signals & Safe Multi-Step Preemption
    this.updateSignals(dt);

    // 2. Generate Deterministic Poisson Traffic
    this.generateTraffic(dt);

    // 3. Update Vehicle Physics, Car-Following & Queues
    this.updateVehicles(dt);

    // 4. Update Inter-Intersection Platoons with distance-based ETA
    this.updatePlatoons();

    // 5. Sample metrics using simulation clock
    this.sampleMetrics();
  }

  private updateSignals(dt: number): void {
    const weather = this.weatherManager.getWeather();

    // Handle emergency preemption requests safely across all intersections
    this.emergencyManager.updatePreemptionState(this.intersections, this.vehicles, dt, weather);

    for (const intersection of this.intersections.values()) {
      // Check for accidents
      this.accidentManager.applyAccidentImpact(intersection);

      // Preempted intersections are stepped by emergencyManager's safe clearance state machine
      if (intersection.isEmergencyPreempted) {
        // Track bystander non-emergency delays while intersection is preempted
        const queuedBystanders =
          intersection.queues.NORTH +
          intersection.queues.SOUTH +
          intersection.queues.EAST +
          intersection.queues.WEST;
        this.emergencyManager.totalBystanderDelayAccumulated += queuedBystanders * dt;
        continue;
      }

      // Real-time dynamic queue, spillback & flow context
      const trafficContext = this.getActiveTrafficContext(intersection);

      // Standard cycle update with active adaptive/Webster/Fixed optimization
      this.signalController.updateIntersection(
        intersection,
        dt,
        this.controlMode,
        weather,
        trafficContext,
        { fixedGreenDuration: this.tunedFixedGreen }
      );
    }
  }

  /**
   * Computes real-time dynamic traffic discharge, spillback hold, and queue metrics
   * for an intersection so the signal controller can adapt timings mid-phase.
   */
  private getActiveTrafficContext(inter: IntersectionState): ActiveTrafficContext {
    const isNS = inter.currentPhase === 'NS_GREEN';
    const isEW = inter.currentPhase === 'EW_GREEN';

    let isDischarging = false;
    let greenStoppedCount = 0;
    let greenBlockedCount = 0;
    let maxRedWait = 0;

    for (const v of this.vehicles) {
      if (v.targetIntersectionId !== inter.id) continue;

      const isGreenApproach = isNS
        ? (v.direction === 'NORTH' || v.direction === 'SOUTH')
        : isEW
        ? (v.direction === 'EAST' || v.direction === 'WEST')
        : false;

      const dist = this.getDistanceToIntersection(v, inter);

      if (isGreenApproach) {
        if (dist > 0 && dist < 140 && v.speed > 0.3) {
          isDischarging = true;
        }
        if (dist > 0 && dist <= 65 && v.isStopped) {
          greenStoppedCount++;
          const hasRoom = this.hasDownstreamExitRoom(v, inter);
          const isAccident = inter.hasAccident && inter.accidentApproach === v.direction;
          if (!hasRoom || isAccident) {
            greenBlockedCount++;
          }
        }
      } else {
        if (v.isStopped && dist > 0 && dist <= 85) {
          if (v.waitDuration > maxRedWait) {
            maxRedWait = v.waitDuration;
          }
        }
      }
    }

    const isCurrentPhaseBlocked = greenStoppedCount > 0 && greenBlockedCount >= greenStoppedCount;
    const crossQueue = isNS
      ? inter.queues.EAST + inter.queues.WEST
      : isEW
      ? inter.queues.NORTH + inter.queues.SOUTH
      : 0;
    const activeGreenQueue = isNS
      ? inter.queues.NORTH + inter.queues.SOUTH
      : isEW
      ? inter.queues.EAST + inter.queues.WEST
      : 0;

    return {
      isCurrentPhaseDischarging: isDischarging,
      isCurrentPhaseBlocked,
      crossTrafficQueue: crossQueue,
      maxRedWaitTime: maxRedWait,
      activeGreenQueue,
    };
  }

  private generateTraffic(dt: number): void {
    const baseRate = 0.5 * this.trafficDensityFactor;
    const spawnChance = baseRate * dt;

    const entryPoints: {
      origin: Approach;
      targetId: string;
      x: number;
      y: number;
      dir: Approach;
      route: string[];
      routeDistance: number;
    }[] = [
      // Top entrances (moving South)
      { origin: 'NORTH', targetId: 'I1', x: 250 - 18, y: -20, dir: 'NORTH', route: ['I1', 'I3'], routeDistance: 640 },
      { origin: 'NORTH', targetId: 'I2', x: 550 - 18, y: -20, dir: 'NORTH', route: ['I2', 'I4'], routeDistance: 640 },
      // Bottom entrances (moving North)
      { origin: 'SOUTH', targetId: 'I3', x: 250 + 18, y: this.CANVAS_HEIGHT + 20, dir: 'SOUTH', route: ['I3', 'I1'], routeDistance: 640 },
      { origin: 'SOUTH', targetId: 'I4', x: 550 + 18, y: this.CANVAS_HEIGHT + 20, dir: 'SOUTH', route: ['I4', 'I2'], routeDistance: 640 },
      // Left entrances (moving East)
      { origin: 'WEST', targetId: 'I1', x: -20, y: 190 + 18, dir: 'WEST', route: ['I1', 'I2'], routeDistance: 840 },
      { origin: 'WEST', targetId: 'I3', x: -20, y: 430 + 18, dir: 'WEST', route: ['I3', 'I4'], routeDistance: 840 },
      // Right entrances (moving West)
      { origin: 'EAST', targetId: 'I2', x: this.CANVAS_WIDTH + 20, y: 190 - 18, dir: 'EAST', route: ['I2', 'I1'], routeDistance: 840 },
      { origin: 'EAST', targetId: 'I4', x: this.CANVAS_WIDTH + 20, y: 430 - 18, dir: 'EAST', route: ['I4', 'I3'], routeDistance: 840 },
    ];

    for (const entry of entryPoints) {
      if (this.prng.next() < spawnChance) {
        const isBlocked = this.vehicles.some(
          (v) => Math.hypot(v.x - entry.x, v.y - entry.y) < 42
        );

        if (!isBlocked && this.vehicles.length < 75) {
          this.spawnNormalVehicle(entry);
        }
      }
    }
  }

  private spawnNormalVehicle(entry: {
    origin: Approach;
    targetId: string;
    x: number;
    y: number;
    dir: Approach;
    route: string[];
    routeDistance: number;
  }): void {
    const roll = this.prng.next();
    let type: 'sedan' | 'cab' | 'truck' | 'hatchback' = 'sedan';
    let length = 18;
    let width = 10;
    let color = '#38bdf8';

    if (roll < 0.15) {
      type = 'truck';
      length = 24;
      width = 11;
      const truckColors = ['#f59e0b', '#0284c7', '#475569', '#ea580c'];
      color = this.prng.pick(truckColors);
    } else if (roll < 0.35) {
      type = 'cab';
      length = 18;
      width = 10;
      color = '#eab308';
    } else if (roll < 0.65) {
      type = 'sedan';
      length = 18;
      width = 10;
      const sedanColors = ['#38bdf8', '#818cf8', '#34d399', '#60a5fa'];
      color = this.prng.pick(sedanColors);
    } else {
      type = 'hatchback';
      length = 16;
      width = 9.5;
      const hatchColors = ['#f472b6', '#a78bfa', '#fb7185', '#2dd4bf'];
      color = this.prng.pick(hatchColors);
    }

    const maxSpeed = type === 'truck' ? 1.9 : 2.2 + this.prng.next() * 0.6;
    const vehicle: Vehicle = {
      id: `V_${this.vehicleIdCounter++}`,
      x: entry.x,
      y: entry.y,
      speed: 1.2,
      maxSpeed,
      length,
      width,
      color,
      vehicleType: type,
      isEmergency: false,
      route: entry.route,
      currentRouteIndex: 0,
      origin: entry.origin,
      destination: 'SOUTH',
      currentIntersectionId: null,
      targetIntersectionId: entry.targetId,
      direction: entry.dir,
      isStopped: false,
      waitDuration: 0,
      stoppedDuration: 0,
      totalTravelTime: 0,
      distanceTraveled: 0,
      laneIndex: 0,
      spawnTime: this.simTime,
      freeFlowTravelTime: entry.routeDistance / (maxSpeed * 60),
      stopCount: 0,
      hasStoppedBefore: false,
    };

    this.vehicles.push(vehicle);
  }

  public spawnRandomVehicle(): boolean {
    const entryPoints = [
      { origin: 'NORTH' as Approach, targetId: 'I1', x: 250 - 18, y: -20, dir: 'NORTH' as Approach, route: ['I1', 'I3'], routeDistance: 640 },
      { origin: 'NORTH' as Approach, targetId: 'I2', x: 550 - 18, y: -20, dir: 'NORTH' as Approach, route: ['I2', 'I4'], routeDistance: 640 },
      { origin: 'SOUTH' as Approach, targetId: 'I3', x: 250 + 18, y: this.CANVAS_HEIGHT + 20, dir: 'SOUTH' as Approach, route: ['I3', 'I1'], routeDistance: 640 },
      { origin: 'SOUTH' as Approach, targetId: 'I4', x: 550 + 18, y: this.CANVAS_HEIGHT + 20, dir: 'SOUTH' as Approach, route: ['I4', 'I2'], routeDistance: 640 },
      { origin: 'WEST' as Approach, targetId: 'I1', x: -20, y: 190 + 18, dir: 'WEST' as Approach, route: ['I1', 'I2'], routeDistance: 840 },
      { origin: 'WEST' as Approach, targetId: 'I3', x: -20, y: 430 + 18, dir: 'WEST' as Approach, route: ['I3', 'I4'], routeDistance: 840 },
      { origin: 'EAST' as Approach, targetId: 'I2', x: this.CANVAS_WIDTH + 20, y: 190 - 18, dir: 'EAST' as Approach, route: ['I2', 'I1'], routeDistance: 840 },
      { origin: 'EAST' as Approach, targetId: 'I4', x: this.CANVAS_WIDTH + 20, y: 430 - 18, dir: 'EAST' as Approach, route: ['I4', 'I3'], routeDistance: 840 },
    ];

    const shuffled = [...entryPoints].sort(() => this.prng.next() - 0.5);
    for (const entry of shuffled) {
      const isBlocked = this.vehicles.some(
        (v) => Math.hypot(v.x - entry.x, v.y - entry.y) < 45
      );
      if (!isBlocked && this.vehicles.length < 75) {
        this.spawnNormalVehicle(entry);
        return true;
      }
    }
    return false;
  }

  private updateVehicles(dt: number): void {
    const weather = this.weatherManager.getWeather();
    const remainingVehicles: Vehicle[] = [];

    // Reset queue tallies (will ONLY count stopped vehicles)
    for (const inter of this.intersections.values()) {
      inter.queues = { NORTH: 0, SOUTH: 0, EAST: 0, WEST: 0 };
    }

    const emVehicles = this.vehicles.filter((v) => v.isEmergency);

    for (const v of this.vehicles) {
      v.totalTravelTime += dt;
      let shouldStop = false;
      let stopTargetDist: number | null = null;
      let isAccidentBlocked = false;

      // Emergency Waypoint Progression
      if (v.isEmergency && v.emergencyWaypoints && v.currentWaypointIndex !== undefined) {
        const currentWp = v.emergencyWaypoints[v.currentWaypointIndex];
        if (currentWp) {
          const distToWp = Math.hypot(currentWp.targetX - v.x, currentWp.targetY - v.y);
          if (distToWp < 28) {
            v.currentWaypointIndex++;
            const nextWp = v.emergencyWaypoints[v.currentWaypointIndex];
            if (nextWp) {
              v.targetIntersectionId = nextWp.targetIntersectionId;
              v.direction = nextWp.direction;
            } else {
              v.targetIntersectionId = null;
            }
          }
        }
      }

      // Check Yielding behavior for approaching emergency vehicles
      if (!v.isEmergency && emVehicles.length > 0) {
        let isYieldingToAny = false;
        for (const em of emVehicles) {
          if (v.direction === em.direction) {
            let distBehind = Infinity;
            if (v.direction === 'NORTH' && Math.abs(v.x - em.x) < 26 && em.y < v.y) {
              distBehind = v.y - em.y;
            } else if (v.direction === 'SOUTH' && Math.abs(v.x - em.x) < 26 && em.y > v.y) {
              distBehind = em.y - v.y;
            } else if (v.direction === 'WEST' && Math.abs(v.y - em.y) < 26 && em.x < v.x) {
              distBehind = v.x - em.x;
            } else if (v.direction === 'EAST' && Math.abs(v.y - em.y) < 26 && em.x > v.x) {
              distBehind = em.x - v.x;
            }

            if (distBehind < 180) {
              isYieldingToAny = true;
              v.isYielding = true;
              v.lateralOffset = Math.min(10, (v.lateralOffset || 0) + 24 * dt);
              if (distBehind < 90) {
                shouldStop = true;
              } else {
                v.speed = Math.min(v.speed, 0.5);
              }
              break;
            }
          }
        }

        if (!isYieldingToAny) {
          v.isYielding = false;
          v.lateralOffset = Math.max(0, (v.lateralOffset || 0) - 20 * dt);
        }
      } else if (!v.isEmergency) {
        v.isYielding = false;
        v.lateralOffset = Math.max(0, (v.lateralOffset || 0) - 20 * dt);
      }

      // Signal state & Stop line checking
      const targetInter = v.targetIntersectionId ? this.intersections.get(v.targetIntersectionId) : null;
      if (targetInter) {
        const distToCenter = this.getDistanceToIntersection(v, targetInter);
        const signalStopTarget = 38 + v.length / 2 + 5;
        const accidentStopTarget = 70 + v.length / 2 + 12;

        if (distToCenter > 0 && distToCenter < 190) {
          const isGreen = this.isGreenForVehicle(v, targetInter);
          const isAccidentAhead =
            targetInter.hasAccident && targetInter.accidentApproach === v.direction;

          const isBeforeBox = distToCenter >= 35;
          const hasRoomDownstream = this.hasDownstreamExitRoom(v, targetInter);
          const isBoxBlocked = this.isIntersectionBoxOccupied(targetInter, v);

          if (isAccidentAhead && !v.isEmergency) {
            if (distToCenter <= accidentStopTarget + 2) {
              shouldStop = true;
              stopTargetDist = accidentStopTarget;
              isAccidentBlocked = true;
            } else if (distToCenter <= accidentStopTarget + 90) {
              const excess = distToCenter - accidentStopTarget;
              v.speed = Math.min(v.speed, Math.max(0.15, (excess / 60) * v.maxSpeed));
            }
          } else if (
            !v.isEmergency &&
            (!isGreen || (isBeforeBox && (!hasRoomDownstream || isBoxBlocked)))
          ) {
            if (distToCenter <= signalStopTarget + 2) {
              shouldStop = true;
              stopTargetDist = signalStopTarget;
            } else if (distToCenter <= signalStopTarget + 100) {
              const excess = distToCenter - signalStopTarget;
              v.speed = Math.min(v.speed, Math.max(0.15, (excess / 65) * v.maxSpeed));
            }
          }

          // QUEUE COUNTING FIX: Count ONLY vehicles that are TRULY STOPPED (speed < 0.15)
          // near the approach stop line. Moving vehicles are NOT in queue!
          if (v.isStopped && v.speed < 0.15 && distToCenter <= signalStopTarget + 85) {
            targetInter.queues[v.direction] = (targetInter.queues[v.direction] || 0) + 1;
          }
        }
      }

      v.isAccidentStopped = isAccidentBlocked;

      // Car-Following Model
      const leader = this.getVehicleAhead(v);
      if (leader) {
        const gap = this.getGapBetweenVehicles(v, leader);
        const minSafetyGap = v.isEmergency ? 14 : 16;

        if (gap <= minSafetyGap) {
          shouldStop = true;
          v.speed = 0;
          this.clampBehindLeader(v, leader, minSafetyGap);
        } else if (gap < minSafetyGap * 2.8) {
          const factor = (gap - minSafetyGap) / (minSafetyGap * 1.8);
          v.speed = Math.min(v.speed, Math.max(0.15, leader.speed * factor + 0.3 * factor));
        }
      }

      // Perpendicular Conflict Avoidance
      const perpConflict = this.getPerpendicularConflict(v);
      if (perpConflict) {
        shouldStop = true;
        v.speed = 0;
      }

      // Physics, Acceleration & Deceleration
      const weatherSpeedCap = v.maxSpeed * weather.speedMultiplier;
      const effectiveMaxSpeed = v.isEmergency ? v.maxSpeed * 1.4 : weatherSpeedCap;

      if (shouldStop) {
        v.speed = Math.max(0, v.speed - 8.0 * dt * weather.frictionCoefficient);
        if (v.speed < 0.05) {
          v.speed = 0;
          v.isStopped = true;
          v.waitDuration += dt;
          v.stoppedDuration += dt;
          this.totalWaitTimeAccumulated += dt;
          if (v.waitDuration > this.maxWaitObserved) {
            this.maxWaitObserved = v.waitDuration;
          }

          if (!v.hasStoppedBefore) {
            v.stopCount++;
            v.hasStoppedBefore = true;
          }
        }

        if (targetInter && stopTargetDist !== null) {
          this.clampAtStopDistance(v, targetInter, stopTargetDist);
        }
      } else {
        v.isStopped = false;
        v.waitDuration = 0;
        if (v.speed > 0.4) {
          v.hasStoppedBefore = false;
        }
        v.speed = Math.min(
          effectiveMaxSpeed,
          v.speed + 3.2 * dt * weather.frictionCoefficient
        );
      }

      // Move vehicle forward
      this.moveVehicle(v, dt);

      // Traversal and box clearance
      if (targetInter && this.hasPassedIntersection(v, targetInter)) {
        // If this vehicle was an emergency vehicle preempting this intersection,
        // release the intersection immediately!
        if (v.isEmergency && targetInter.isEmergencyPreempted) {
          this.emergencyManager.releasePreemption(targetInter);
        }

        if (!v.isEmergency) {
          v.currentRouteIndex++;
          if (v.currentRouteIndex < v.route.length) {
            v.targetIntersectionId = v.route[v.currentRouteIndex];
          } else {
            v.targetIntersectionId = null;
          }
        }
      }

      // Boundary Departure (Exit Network)
      const isOffScreen =
        v.x < -60 ||
        v.x > this.CANVAS_WIDTH + 60 ||
        v.y < -60 ||
        v.y > this.CANVAS_HEIGHT + 60;

      if (isOffScreen) {
        // UNBIASED DEPARTURE METRICS: Record completed trip record for departed vehicle
        const actualTravel = this.simTime - v.spawnTime;
        const realDelay = Math.max(0, actualTravel - v.freeFlowTravelTime);

        const record: TripRecord = {
          vehicleId: v.id,
          isEmergency: v.isEmergency,
          vehicleType: v.vehicleType || 'sedan',
          origin: v.origin,
          destination: v.destination,
          spawnTime: v.spawnTime,
          exitTime: this.simTime,
          actualTravelTime: Number(actualTravel.toFixed(2)),
          freeFlowTravelTime: Number(v.freeFlowTravelTime.toFixed(2)),
          delay: Number(realDelay.toFixed(2)),
          stoppedDuration: Number(v.stoppedDuration.toFixed(2)),
          stopCount: v.stopCount,
        };

        this.completedTrips.push(record);

        if (v.isEmergency) {
          this.emergencyManager.registerEmergencyCompletion(v.id, this.simTime);
        }
      } else {
        remainingVehicles.push(v);
      }
    }

    this.vehicles = remainingVehicles;
  }

  private isGreenForVehicle(v: Vehicle, inter: IntersectionState): boolean {
    if (v.direction === 'NORTH' || v.direction === 'SOUTH') {
      return inter.currentPhase === 'NS_GREEN';
    } else {
      return inter.currentPhase === 'EW_GREEN';
    }
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

  private hasPassedIntersection(v: Vehicle, inter: IntersectionState): boolean {
    switch (v.direction) {
      case 'NORTH':
        return v.y > inter.y + 36;
      case 'SOUTH':
        return v.y < inter.y - 36;
      case 'WEST':
        return v.x > inter.x + 36;
      case 'EAST':
        return v.x < inter.x - 36;
    }
  }

  private moveVehicle(v: Vehicle, dt: number): void {
    const step = v.speed * 60 * dt;
    v.distanceTraveled += step;

    switch (v.direction) {
      case 'NORTH':
        v.y += step;
        break;
      case 'SOUTH':
        v.y -= step;
        break;
      case 'WEST':
        v.x += step;
        break;
      case 'EAST':
        v.x -= step;
        break;
    }
  }

  private getVehicleAhead(current: Vehicle): Vehicle | null {
    let closestLeader: Vehicle | null = null;
    let minDistance = Infinity;

    for (const other of this.vehicles) {
      if (other.id === current.id) continue;
      if (other.direction !== current.direction) continue;

      if (current.isEmergency && other.isYielding && (other.lateralOffset || 0) >= 6) {
        continue;
      }

      let isAhead = false;
      let dist = 0;

      switch (current.direction) {
        case 'NORTH':
          if (Math.abs(current.x - other.x) < 18 && other.y > current.y) {
            isAhead = true;
            dist = other.y - current.y;
          }
          break;
        case 'SOUTH':
          if (Math.abs(current.x - other.x) < 18 && other.y < current.y) {
            isAhead = true;
            dist = current.y - other.y;
          }
          break;
        case 'WEST':
          if (Math.abs(current.y - other.y) < 18 && other.x > current.x) {
            isAhead = true;
            dist = other.x - current.x;
          }
          break;
        case 'EAST':
          if (Math.abs(current.y - other.y) < 18 && other.x < current.x) {
            isAhead = true;
            dist = current.x - other.x;
          }
          break;
      }

      if (isAhead && dist < minDistance) {
        minDistance = dist;
        closestLeader = other;
      }
    }

    return closestLeader;
  }

  private getGapBetweenVehicles(follower: Vehicle, leader: Vehicle): number {
    const halfLengths = follower.length / 2 + leader.length / 2;
    switch (follower.direction) {
      case 'NORTH':
        return leader.y - follower.y - halfLengths;
      case 'SOUTH':
        return follower.y - leader.y - halfLengths;
      case 'WEST':
        return leader.x - follower.x - halfLengths;
      case 'EAST':
        return follower.x - leader.x - halfLengths;
    }
  }

  private clampAtStopDistance(v: Vehicle, inter: IntersectionState, targetDist: number): void {
    switch (v.direction) {
      case 'NORTH':
        v.y = Math.min(v.y, inter.y - targetDist);
        break;
      case 'SOUTH':
        v.y = Math.max(v.y, inter.y + targetDist);
        break;
      case 'WEST':
        v.x = Math.min(v.x, inter.x - targetDist);
        break;
      case 'EAST':
        v.x = Math.max(v.x, inter.x + targetDist);
        break;
    }
  }

  private clampBehindLeader(follower: Vehicle, leader: Vehicle, minGap: number): void {
    const requiredDist = follower.length / 2 + leader.length / 2 + minGap;
    switch (follower.direction) {
      case 'NORTH':
        follower.y = Math.min(follower.y, leader.y - requiredDist);
        break;
      case 'SOUTH':
        follower.y = Math.max(follower.y, leader.y + requiredDist);
        break;
      case 'WEST':
        follower.x = Math.min(follower.x, leader.x - requiredDist);
        break;
      case 'EAST':
        follower.x = Math.max(follower.x, leader.x + requiredDist);
        break;
    }
  }

  private hasDownstreamExitRoom(v: Vehicle, inter: IntersectionState): boolean {
    const halfRoad = this.ROAD_WIDTH / 2;
    const requiredRoom = v.length + 14;

    const leader = this.getVehicleAhead(v);
    if (!leader) return true;

    switch (v.direction) {
      case 'NORTH': {
        const exitBoundaryY = inter.y + halfRoad;
        const leaderRearBumperY = leader.y - leader.length / 2;
        return leaderRearBumperY - exitBoundaryY >= requiredRoom;
      }
      case 'SOUTH': {
        const exitBoundaryY = inter.y - halfRoad;
        const leaderRearBumperY = leader.y + leader.length / 2;
        return exitBoundaryY - leaderRearBumperY >= requiredRoom;
      }
      case 'WEST': {
        const exitBoundaryX = inter.x + halfRoad;
        const leaderRearBumperX = leader.x - leader.length / 2;
        return leaderRearBumperX - exitBoundaryX >= requiredRoom;
      }
      case 'EAST': {
        const exitBoundaryX = inter.x - halfRoad;
        const leaderRearBumperX = leader.x + leader.length / 2;
        return exitBoundaryX - leaderRearBumperX >= requiredRoom;
      }
    }
  }

  private isIntersectionBoxOccupied(inter: IntersectionState, currentVehicle: Vehicle): boolean {
    const halfBox = this.ROAD_WIDTH / 2 + 1;
    for (const other of this.vehicles) {
      if (other.id === currentVehicle.id) continue;
      if (
        Math.abs(other.x - inter.x) < halfBox &&
        Math.abs(other.y - inter.y) < halfBox
      ) {
        return true;
      }
    }
    return false;
  }

  private getPerpendicularConflict(current: Vehicle): Vehicle | null {
    for (const other of this.vehicles) {
      if (other.id === current.id) continue;
      if (other.direction === current.direction) continue;

      const dist = Math.hypot(current.x - other.x, current.y - other.y);
      if (dist < 26) {
        if (other.isEmergency && !current.isEmergency) return other;
        if (current.isEmergency && !other.isEmergency) continue;

        if (other.distanceTraveled > current.distanceTraveled) {
          return other;
        }
      }
    }
    return null;
  }

  /**
   * Real Platoon Coordination: Computes ETA from actual distance and travel speed.
   */
  private updatePlatoons(): void {
    const corridors = [
      { from: 'I1', to: 'I2', approach: 'WEST' as Approach },
      { from: 'I2', to: 'I1', approach: 'EAST' as Approach },
      { from: 'I1', to: 'I3', approach: 'NORTH' as Approach },
      { from: 'I3', to: 'I1', approach: 'SOUTH' as Approach },
      { from: 'I3', to: 'I4', approach: 'WEST' as Approach },
      { from: 'I4', to: 'I3', approach: 'EAST' as Approach },
      { from: 'I2', to: 'I4', approach: 'NORTH' as Approach },
      { from: 'I4', to: 'I2', approach: 'SOUTH' as Approach },
    ];

    for (const corr of corridors) {
      const targetInter = this.intersections.get(corr.to);
      if (!targetInter) continue;

      // Filter vehicles traversing between these junctions (within 40px to 320px range)
      const vehiclesInFlight = this.vehicles.filter((v) => {
        if (v.targetIntersectionId !== corr.to || v.direction !== corr.approach) return false;
        const d = this.getDistanceToIntersection(v, targetInter);
        return d > 35 && d <= 320;
      });

      const count = vehiclesInFlight.length;
      const isEmergencyPresent = vehiclesInFlight.some((v) => v.isEmergency);
      const existingPlatoon = targetInter.incomingPlatoons.find(
        (p) => p.fromIntersectionId === corr.from
      );

      if (count > 0) {
        // Compute real ETA from closest vehicle's distance and speed
        const closestDist = Math.min(...vehiclesInFlight.map((v) => this.getDistanceToIntersection(v, targetInter)));
        const avgSpeed = vehiclesInFlight.reduce((s, v) => s + v.speed, 0) / count;
        const realEta = Math.max(0.5, closestDist / Math.max(0.5, avgSpeed * 60));

        if (existingPlatoon) {
          existingPlatoon.vehicleCount = count;
          existingPlatoon.etaSeconds = Number(realEta.toFixed(1));
          existingPlatoon.isEmergencyPresent = isEmergencyPresent;
        } else {
          targetInter.incomingPlatoons.push({
            fromIntersectionId: corr.from,
            toIntersectionId: corr.to,
            approach: corr.approach,
            vehicleCount: count,
            etaSeconds: Number(realEta.toFixed(1)),
            isEmergencyPresent,
          });
        }
      } else if (existingPlatoon) {
        targetInter.incomingPlatoons = targetInter.incomingPlatoons.filter(
          (p) => p.fromIntersectionId !== corr.from
        );
      }
    }
  }

  /**
   * Samples metrics strictly according to simulation time.
   * Completely eliminates fake multipliers and hardcoded values.
   */
  private sampleMetrics(): void {
    if (this.simTime - this.lastMetricsSampleSimTime < 1.0) return;
    this.lastMetricsSampleSimTime = this.simTime;

    // Count ONLY truly stopped queue vehicles
    let totalQueue = 0;
    for (const inter of this.intersections.values()) {
      totalQueue +=
        inter.queues.NORTH +
        inter.queues.SOUTH +
        inter.queues.EAST +
        inter.queues.WEST;
    }

    // Unbiased Delay Calculations
    let avgWait = 0;
    let p95Wait = 0;
    let maxWait = 0;
    const completedCount = this.completedTrips.length;

    if (completedCount > 0) {
      const delays = this.completedTrips.map((t) => t.delay).sort((a, b) => a - b);
      const sumDelay = delays.reduce((acc, d) => acc + d, 0);
      avgWait = Number((sumDelay / completedCount).toFixed(2));

      const p95Idx = Math.min(delays.length - 1, Math.floor(delays.length * 0.95));
      p95Wait = Number(delays[p95Idx].toFixed(2));
      maxWait = Number(delays[delays.length - 1].toFixed(2));
    } else {
      // Prior to any departures, estimate using active stopped vehicles
      const stoppedCars = this.vehicles.filter((v) => v.isStopped);
      if (stoppedCars.length > 0) {
        const sumActiveWait = stoppedCars.reduce((s, v) => s + v.stoppedDuration, 0);
        avgWait = Number((sumActiveWait / stoppedCars.length).toFixed(2));
        maxWait = Number(Math.max(...stoppedCars.map((v) => v.stoppedDuration)).toFixed(2));
        p95Wait = avgWait;
      }
    }

    // Throughput per simulation minute
    const throughputPerMin =
      this.simTime > 0 ? Number(((completedCount / this.simTime) * 60).toFixed(1)) : 0;

    // Emergency metrics from real trips
    let emTravelAvg: number | undefined;
    if (this.emergencyManager.completedEmergencyTrips.length > 0) {
      const emSum = this.emergencyManager.completedEmergencyTrips.reduce(
        (s, r) => s + (r.travelTime || 0),
        0
      );
      emTravelAvg = Number(
        (emSum / this.emergencyManager.completedEmergencyTrips.length).toFixed(1)
      );
    }

    // Real A/B comparison against measured fixed baseline
    let efficiencyDelta: number | undefined;
    const isBaselineReady = completedCount >= 5;

    if (this.externalFixedBaselineDelay !== null && this.externalFixedBaselineDelay > 0) {
      if (isBaselineReady) {
        efficiencyDelta = Number(
          (
            ((this.externalFixedBaselineDelay - avgWait) /
              this.externalFixedBaselineDelay) *
            100
          ).toFixed(1)
        );
      } else {
        efficiencyDelta = 0;
      }
    }

    const sample: SimulationMetrics = {
      timestamp: Number(this.simTime.toFixed(1)),
      avgWaitTime: avgWait,
      p95WaitTime: p95Wait,
      maxWaitTime: maxWait,
      totalThroughput: completedCount,
      throughputPerMin,
      activeVehiclesCount: this.vehicles.length,
      totalQueueLength: totalQueue,
      fixedAvgWaitTime: this.externalFixedBaselineDelay ?? undefined,
      adaptiveEfficiencyDelta: efficiencyDelta,
      emergencyTravelTimeAvg: emTravelAvg,
      emergencyBystanderDelay: Number(this.emergencyManager.totalBystanderDelayAccumulated.toFixed(1)),
      isBaselineReady,
    };

    this.metricsHistory.push(sample);
    if (this.metricsHistory.length > 50) {
      this.metricsHistory.shift();
    }
  }

  public resetSimulation(newSeed?: number): void {
    if (newSeed !== undefined) {
      this.prng = new PRNG(newSeed);
    }
    this.vehicles = [];
    this.completedTrips = [];
    this.totalWaitTimeAccumulated = 0;
    this.maxWaitObserved = 0;
    this.simTime = 0;
    this.lastMetricsSampleSimTime = 0;
    this.metricsHistory = [];
    this.externalFixedBaselineDelay = null;
    this.accidentManager.clearAllAccidents();
    this.emergencyManager.clearEmergency();
    this.initializeIntersections();
  }
}
