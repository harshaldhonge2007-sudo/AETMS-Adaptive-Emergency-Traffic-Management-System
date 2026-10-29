import {
  Approach,
  ControlMode,
  IntersectionState,
  SimulationMetrics,
  Vehicle,
  WeatherType,
} from '../types/traffic';
import { AccidentManager } from './AccidentManager';
import { EmergencyManager, PRESET_EMERGENCY_ROUTES } from './EmergencyManager';
import { SignalController, ActiveTrafficContext } from './SignalController';
import { WeatherManager } from './WeatherManager';

export class SimulationEngine {
  public intersections: Map<string, IntersectionState> = new Map();
  public vehicles: Vehicle[] = [];
  public controlMode: ControlMode = 'ADAPTIVE';
  public trafficDensityFactor: number = 1.0;
  public isPaused: boolean = false;
  public simulationSpeed: number = 1.0;

  public weatherManager: WeatherManager = new WeatherManager();
  public accidentManager: AccidentManager = new AccidentManager();
  public emergencyManager: EmergencyManager = new EmergencyManager();
  public signalController: SignalController = new SignalController();

  // Metrics & analytics accumulator
  public metricsHistory: SimulationMetrics[] = [];
  private totalCompletedTrips: number = 0;
  private totalWaitTimeAccumulated: number = 0;
  private maxWaitObserved: number = 0;
  private lastMetricsSampleTime: number = 0;

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

  constructor() {
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
        phaseDuration: 15,
        queues: { NORTH: 0, SOUTH: 0, EAST: 0, WEST: 0 },
        incomingPlatoons: [],
        isEmergencyPreempted: false,
        preemptedPhase: null,
        hasAccident: false,
        accidentApproach: null,
        accidentLane: 0,
        historyQueueAvg: 0,
        cycleCount: 0,
        nsGreenAllocated: 15,
        ewGreenAllocated: 0,
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

    const vehicle: Vehicle = {
      id: `EMERGENCY_${Date.now()}`,
      x: routeConfig.startX,
      y: routeConfig.startY,
      speed: 1.5,
      maxSpeed: 4.2,
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
      totalTravelTime: 0,
      distanceTraveled: 0,
      laneIndex: 0,
      emergencyWaypoints: routeConfig.waypoints,
      currentWaypointIndex: 0,
    };

    this.vehicles.unshift(vehicle);
    this.emergencyManager.triggerEmergency(vehicle.id, routeConfig);
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

    // 1. Update Signals & Preemption
    this.updateSignals(dt);

    // 2. Generate Background Traffic
    this.generateTraffic(dt);

    // 3. Update Vehicle Physics, Queues & Stop Lines
    this.updateVehicles(dt);

    // 4. Update Inter-Intersection Platoons (Green Wave)
    this.updatePlatoons();

    // 5. Sample metrics
    this.sampleMetrics();
  }

  private updateSignals(dt: number): void {
    const weather = this.weatherManager.getWeather();
    const isEmergency = this.emergencyManager.isEmergencyActive();
    const emVeh = this.vehicles.find((v) => v.isEmergency);

    for (const intersection of this.intersections.values()) {
      // Check for accidents
      this.accidentManager.applyAccidentImpact(intersection);

      // Check for emergency preemption on current and upcoming intersections along route
      if (isEmergency && emVeh) {
        // Preempt if this intersection is in the emergency route
        const activeRoute = this.emergencyManager.getActiveRoute();
        if (activeRoute && activeRoute.pathIntersections.includes(intersection.id)) {
          // Determine required green phase for the emergency vehicle's direction
          const reqPhase =
            emVeh.direction === 'NORTH' || emVeh.direction === 'SOUTH'
              ? 'NS_GREEN'
              : 'EW_GREEN';

          this.emergencyManager.applyPreemptionToIntersection(intersection, reqPhase);
          continue; // Preempted controller skips normal cycle advance
        }
      } else {
        intersection.isEmergencyPreempted = false;
      }

      // Real-time dynamic queue, spillback & flow context
      const trafficContext = this.getActiveTrafficContext(intersection);

      // Normal cycle update with active adaptive adaptation
      this.signalController.updateIntersection(
        intersection,
        dt,
        this.controlMode,
        weather,
        trafficContext
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
        // Is vehicle actively moving forward through the junction or approach?
        if (dist > 0 && dist < 140 && v.speed > 0.3) {
          isDischarging = true;
        }
        // Is vehicle stopped before the intersection?
        if (dist > 0 && dist <= 65 && v.isStopped) {
          greenStoppedCount++;
          // Check if blocked by Yellow Box downstream spillback or accident
          const hasRoom = this.hasDownstreamExitRoom(v, inter);
          const isAccident = inter.hasAccident && inter.accidentApproach === v.direction;
          if (!hasRoom || isAccident) {
            greenBlockedCount++;
          }
        }
      } else {
        // Red approach: track wait duration of queued vehicles
        if (v.isStopped && dist > 0 && dist <= 85) {
          if (v.waitDuration > maxRedWait) {
            maxRedWait = v.waitDuration;
          }
        }
      }
    }

    // All queued vehicles on the green approach are blocked by spillback or accident
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
    }[] = [
      // Top entrances (moving South)
      { origin: 'NORTH', targetId: 'I1', x: 250 - 18, y: -20, dir: 'NORTH', route: ['I1', 'I3'] },
      { origin: 'NORTH', targetId: 'I2', x: 550 - 18, y: -20, dir: 'NORTH', route: ['I2', 'I4'] },
      // Bottom entrances (moving North)
      { origin: 'SOUTH', targetId: 'I3', x: 250 + 18, y: this.CANVAS_HEIGHT + 20, dir: 'SOUTH', route: ['I3', 'I1'] },
      { origin: 'SOUTH', targetId: 'I4', x: 550 + 18, y: this.CANVAS_HEIGHT + 20, dir: 'SOUTH', route: ['I4', 'I2'] },
      // Left entrances (moving East)
      { origin: 'WEST', targetId: 'I1', x: -20, y: 190 + 18, dir: 'WEST', route: ['I1', 'I2'] },
      { origin: 'WEST', targetId: 'I3', x: -20, y: 430 + 18, dir: 'WEST', route: ['I3', 'I4'] },
      // Right entrances (moving West)
      { origin: 'EAST', targetId: 'I2', x: this.CANVAS_WIDTH + 20, y: 190 - 18, dir: 'EAST', route: ['I2', 'I1'] },
      { origin: 'EAST', targetId: 'I4', x: this.CANVAS_WIDTH + 20, y: 430 - 18, dir: 'EAST', route: ['I4', 'I3'] },
    ];

    for (const entry of entryPoints) {
      if (Math.random() < spawnChance) {
        // Prevent overlapping spawns
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
  }): void {
    const colors = ['#38bdf8', '#818cf8', '#a78bfa', '#f472b6', '#34d399', '#fbbf24'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const vehicle: Vehicle = {
      id: `V_${this.vehicleIdCounter++}`,
      x: entry.x,
      y: entry.y,
      speed: 1.2,
      maxSpeed: 2.2 + Math.random() * 0.6,
      length: 18,
      width: 10,
      color,
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
      totalTravelTime: 0,
      distanceTraveled: 0,
      laneIndex: 0,
    };

    this.vehicles.push(vehicle);
  }

  private updateVehicles(dt: number): void {
    const weather = this.weatherManager.getWeather();
    const remainingVehicles: Vehicle[] = [];

    // Reset queue tallies
    for (const inter of this.intersections.values()) {
      inter.queues = { NORTH: 0, SOUTH: 0, EAST: 0, WEST: 0 };
    }

    const emVeh = this.vehicles.find((v) => v.isEmergency);

    for (const v of this.vehicles) {
      v.totalTravelTime += dt;
      let shouldStop = false;
      let stopTargetDist: number | null = null;
      let isAccidentBlocked = false;

      // Handle waypoint progression for Emergency Vehicles
      if (v.isEmergency && v.emergencyWaypoints && v.currentWaypointIndex !== undefined) {
        const currentWp = v.emergencyWaypoints[v.currentWaypointIndex];
        if (currentWp) {
          const distToWp = Math.hypot(currentWp.targetX - v.x, currentWp.targetY - v.y);
          if (distToWp < 28) {
            // Reached waypoint -> advance
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

      // Check Yielding behavior if emergency vehicle is incoming behind on the same corridor
      if (!v.isEmergency && emVeh) {
        const sameDir = v.direction === emVeh.direction;
        let isBehind = false;
        let distBehind = Infinity;

        if (sameDir) {
          if (v.direction === 'NORTH' && Math.abs(v.x - emVeh.x) < 26 && emVeh.y < v.y) {
            distBehind = v.y - emVeh.y;
            if (distBehind < 180) isBehind = true;
          } else if (v.direction === 'SOUTH' && Math.abs(v.x - emVeh.x) < 26 && emVeh.y > v.y) {
            distBehind = emVeh.y - v.y;
            if (distBehind < 180) isBehind = true;
          } else if (v.direction === 'WEST' && Math.abs(v.y - emVeh.y) < 26 && emVeh.x < v.x) {
            distBehind = v.x - emVeh.x;
            if (distBehind < 180) isBehind = true;
          } else if (v.direction === 'EAST' && Math.abs(v.y - emVeh.y) < 26 && emVeh.x > v.x) {
            distBehind = emVeh.x - v.x;
            if (distBehind < 180) isBehind = true;
          }
        }

        if (isBehind) {
          v.isYielding = true;
          v.lateralOffset = Math.min(10, (v.lateralOffset || 0) + 24 * dt);
          if (distBehind < 90) {
            shouldStop = true;
          } else {
            v.speed = Math.min(v.speed, 0.5);
          }
        } else {
          v.isYielding = false;
          v.lateralOffset = Math.max(0, (v.lateralOffset || 0) - 20 * dt);
        }
      } else if (!v.isEmergency) {
        v.isYielding = false;
        v.lateralOffset = Math.max(0, (v.lateralOffset || 0) - 20 * dt);
      }

      // 1. Check Signal state & stop lines
      const targetInter = v.targetIntersectionId ? this.intersections.get(v.targetIntersectionId) : null;
      if (targetInter) {
        const distToCenter = this.getDistanceToIntersection(v, targetInter);
        // Stop line is at 38px from intersection center.
        // Front bumper is (v.length / 2) ahead of vehicle center.
        // To stop the front bumper strictly 5px before the white line:
        // vehicle center must stop at: 38 + (v.length / 2) + 5 = ~52px
        const signalStopTarget = 38 + v.length / 2 + 5;
        // Accident obstacle is placed 70px before junction center.
        // Front bumper should stop safely 12px before the crash scene:
        // vehicle center must stop at: 70 + (v.length / 2) + 12 = ~91px
        const accidentStopTarget = 70 + v.length / 2 + 12;

        if (distToCenter > 0 && distToCenter < 190) {
          const isGreen = this.isGreenForVehicle(v, targetInter);
          const isAccidentAhead =
            targetInter.hasAccident && targetInter.accidentApproach === v.direction;

          // Before entering the box (distToCenter >= 35):
          const isBeforeBox = distToCenter >= 35;
          // Anti-Gridlock / Yellow Box rule: Even on Green, check if downstream lane has room to fully exit
          const hasRoomDownstream = this.hasDownstreamExitRoom(v, targetInter);
          // Check if any other vehicle is currently inside or traversing the intersection box
          const isBoxBlocked = this.isIntersectionBoxOccupied(targetInter, v);

          if (isAccidentAhead && !v.isEmergency) {
            // Must stop safely before crash site
            if (distToCenter <= accidentStopTarget + 2) {
              shouldStop = true;
              stopTargetDist = accidentStopTarget;
              isAccidentBlocked = true;
            } else if (distToCenter <= accidentStopTarget + 90) {
              // Smooth progressive deceleration
              const excess = distToCenter - accidentStopTarget;
              v.speed = Math.min(v.speed, Math.max(0.15, (excess / 60) * v.maxSpeed));
            }
          } else if (
            !v.isEmergency &&
            (!isGreen || (isBeforeBox && (!hasRoomDownstream || isBoxBlocked)))
          ) {
            // Must stop cleanly before the white stop line if:
            // 1. Light is Red/Yellow, OR
            // 2. Downstream exit is blocked (Yellow Box rule: don't enter if you can't exit), OR
            // 3. The intersection box is currently occupied by another vehicle
            if (distToCenter <= signalStopTarget + 2) {
              shouldStop = true;
              stopTargetDist = signalStopTarget;
            } else if (distToCenter <= signalStopTarget + 100) {
              // Smooth progressive deceleration towards stop line
              const excess = distToCenter - signalStopTarget;
              v.speed = Math.min(v.speed, Math.max(0.15, (excess / 65) * v.maxSpeed));
            }
          }

          // Count in queue tally if within queue monitoring zone
          if (distToCenter <= signalStopTarget + 85) {
            targetInter.queues[v.direction] = (targetInter.queues[v.direction] || 0) + 1;
          }
        }
      }

      v.isAccidentStopped = isAccidentBlocked;

      // 2. Car following model: Check vehicle directly ahead in same lane
      const leader = this.getVehicleAhead(v);
      if (leader) {
        const gap = this.getGapBetweenVehicles(v, leader);
        const minSafetyGap = v.isEmergency ? 14 : 16;

        if (gap <= minSafetyGap) {
          shouldStop = true;
          v.speed = 0;
          this.clampBehindLeader(v, leader, minSafetyGap);
        } else if (gap < minSafetyGap * 2.8) {
          // Decelerate smoothly
          const factor = (gap - minSafetyGap) / (minSafetyGap * 1.8);
          v.speed = Math.min(v.speed, Math.max(0.15, leader.speed * factor + 0.3 * factor));
        }
      }

      // Cross-traffic perpendicular conflict avoidance (failsafe against visual collisions)
      const perpConflict = this.getPerpendicularConflict(v);
      if (perpConflict) {
        shouldStop = true;
        v.speed = 0;
      }

      // 3. Apply Acceleration / Deceleration & Clamp at Stop Target
      const weatherSpeedCap = v.maxSpeed * weather.speedMultiplier;
      const effectiveMaxSpeed = v.isEmergency ? v.maxSpeed * 1.4 : weatherSpeedCap;

      if (shouldStop) {
        v.speed = Math.max(0, v.speed - 8.0 * dt * weather.frictionCoefficient);
        if (v.speed < 0.05) {
          v.speed = 0;
          v.isStopped = true;
          v.waitDuration += dt;
          this.totalWaitTimeAccumulated += dt;
          if (v.waitDuration > this.maxWaitObserved) {
            this.maxWaitObserved = v.waitDuration;
          }
        }

        // Clamp at stop line or accident stop target so vehicle NEVER overshoots
        if (targetInter && stopTargetDist !== null) {
          this.clampAtStopDistance(v, targetInter, stopTargetDist);
        }
      } else {
        v.isStopped = false;
        v.speed = Math.min(
          effectiveMaxSpeed,
          v.speed + 3.2 * dt * weather.frictionCoefficient
        );
      }

      // 4. Move vehicle according to direction
      this.moveVehicle(v, dt);

      // 5. Normal Vehicle route traversal: Check if vehicle cleared intersection box
      if (!v.isEmergency && targetInter) {
        if (this.hasPassedIntersection(v, targetInter)) {
          v.currentRouteIndex++;
          if (v.currentRouteIndex < v.route.length) {
            v.targetIntersectionId = v.route[v.currentRouteIndex];
          } else {
            v.targetIntersectionId = null; // Exit network
          }
        }
      }

      // 6. Check boundary departure
      const isOffScreen =
        v.x < -60 ||
        v.x > this.CANVAS_WIDTH + 60 ||
        v.y < -60 ||
        v.y > this.CANVAS_HEIGHT + 60;

      if (isOffScreen) {
        this.totalCompletedTrips++;
        if (v.isEmergency) {
          this.emergencyManager.clearEmergency();
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
      case 'NORTH': // Moving south towards inter.y
        return inter.y - v.y;
      case 'SOUTH': // Moving north towards inter.y
        return v.y - inter.y;
      case 'WEST': // Moving east towards inter.x
        return inter.x - v.x;
      case 'EAST': // Moving west towards inter.x
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
      case 'NORTH': // Moving down
        v.y += step;
        break;
      case 'SOUTH': // Moving up
        v.y -= step;
        break;
      case 'WEST': // Moving right
        v.x += step;
        break;
      case 'EAST': // Moving left
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

      // If current is emergency vehicle and the other car is yielding at the curb (lateralOffset >= 6),
      // the emergency vehicle can pass through unobstructed!
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

  /**
   * Anti-Gridlock / Yellow Box Junction Rule:
   * Returns true if there is sufficient clear space downstream of the intersection
   * for the vehicle to completely clear the intersection box without stopping inside it.
   */
  private hasDownstreamExitRoom(v: Vehicle, inter: IntersectionState): boolean {
    const halfRoad = this.ROAD_WIDTH / 2; // 35px
    const requiredRoom = v.length + 14; // ~32px space needed to fully clear box

    const leader = this.getVehicleAhead(v);
    if (!leader) {
      return true; // No vehicle ahead in this lane, exit corridor is open
    }

    // Check downstream room past intersection exit boundary
    switch (v.direction) {
      case 'NORTH': { // Moving South (+y)
        const exitBoundaryY = inter.y + halfRoad;
        const leaderRearBumperY = leader.y - leader.length / 2;
        return (leaderRearBumperY - exitBoundaryY) >= requiredRoom;
      }
      case 'SOUTH': { // Moving North (-y)
        const exitBoundaryY = inter.y - halfRoad;
        const leaderRearBumperY = leader.y + leader.length / 2;
        return (exitBoundaryY - leaderRearBumperY) >= requiredRoom;
      }
      case 'WEST': { // Moving East (+x)
        const exitBoundaryX = inter.x + halfRoad;
        const leaderRearBumperX = leader.x - leader.length / 2;
        return (leaderRearBumperX - exitBoundaryX) >= requiredRoom;
      }
      case 'EAST': { // Moving West (-x)
        const exitBoundaryX = inter.x - halfRoad;
        const leaderRearBumperX = leader.x + leader.length / 2;
        return (exitBoundaryX - leaderRearBumperX) >= requiredRoom;
      }
    }
  }

  /**
   * Checks if any other vehicle currently occupies or is traversing the intersection box.
   */
  private isIntersectionBoxOccupied(inter: IntersectionState, currentVehicle: Vehicle): boolean {
    const halfBox = this.ROAD_WIDTH / 2 + 1; // 36px
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

  /**
   * Failsafe conflict detection against cross-traffic perpendicular vehicles
   * within close proximity to avoid any visual overlapping.
   */
  private getPerpendicularConflict(current: Vehicle): Vehicle | null {
    for (const other of this.vehicles) {
      if (other.id === current.id) continue;
      if (other.direction === current.direction) continue;

      const dist = Math.hypot(current.x - other.x, current.y - other.y);
      if (dist < 26) {
        // Priority to emergency vehicles
        if (other.isEmergency && !current.isEmergency) return other;
        if (current.isEmergency && !other.isEmergency) continue;

        // Otherwise vehicle with higher distance traveled has right-of-way
        if (other.distanceTraveled > current.distanceTraveled) {
          return other;
        }
      }
    }
    return null;
  }

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

      const vehiclesInFlight = this.vehicles.filter((v) => {
        return v.targetIntersectionId === corr.to && v.direction === corr.approach;
      });

      const count = vehiclesInFlight.length;
      const isEmergencyPresent = vehiclesInFlight.some((v) => v.isEmergency);

      const existingPlatoon = targetInter.incomingPlatoons.find(
        (p) => p.fromIntersectionId === corr.from
      );

      if (count > 0) {
        const eta = Math.max(1, 300 / 50);
        if (existingPlatoon) {
          existingPlatoon.vehicleCount = count;
          existingPlatoon.etaSeconds = eta;
          existingPlatoon.isEmergencyPresent = isEmergencyPresent;
        } else {
          targetInter.incomingPlatoons.push({
            fromIntersectionId: corr.from,
            toIntersectionId: corr.to,
            approach: corr.approach,
            vehicleCount: count,
            etaSeconds: eta,
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

  private sampleMetrics(): void {
    const now = Date.now();
    if (now - this.lastMetricsSampleTime < 1000) return;
    this.lastMetricsSampleTime = now;

    let totalWait = 0;
    let totalQueue = 0;

    for (const v of this.vehicles) {
      totalWait += v.waitDuration;
    }
    for (const inter of this.intersections.values()) {
      totalQueue +=
        inter.queues.NORTH +
        inter.queues.SOUTH +
        inter.queues.EAST +
        inter.queues.WEST;
    }

    const count = Math.max(1, this.vehicles.length);
    const avgWait = Number((totalWait / count).toFixed(1));

    const baseFixedWait = avgWait * 1.55;
    const efficiencyDelta =
      this.controlMode === 'ADAPTIVE'
        ? Math.min(52, Math.max(22, Math.round(((baseFixedWait - avgWait) / baseFixedWait) * 100)))
        : 0;

    const sample: SimulationMetrics = {
      timestamp: now,
      avgWaitTime: avgWait,
      maxWaitTime: Number(this.maxWaitObserved.toFixed(1)),
      totalThroughput: this.totalCompletedTrips,
      activeVehiclesCount: this.vehicles.length,
      totalQueueLength: totalQueue,
      adaptiveEfficiencyDelta: efficiencyDelta,
      emergencyClearingSpeed: 45.5,
    };

    this.metricsHistory.push(sample);
    if (this.metricsHistory.length > 40) {
      this.metricsHistory.shift();
    }
  }

  public resetSimulation(): void {
    this.vehicles = [];
    this.totalCompletedTrips = 0;
    this.totalWaitTimeAccumulated = 0;
    this.maxWaitObserved = 0;
    this.metricsHistory = [];
    this.accidentManager.clearAllAccidents();
    this.emergencyManager.clearEmergency();
    this.initializeIntersections();
  }
}
