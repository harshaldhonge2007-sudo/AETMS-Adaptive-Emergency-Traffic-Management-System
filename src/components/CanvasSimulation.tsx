import React, { useRef, useEffect, useState, useCallback } from 'react';
import { SimulationEngine } from '../engine/SimulationEngine';
import { Approach, IntersectionState, SignalPhase, Vehicle } from '../types/traffic';
import {
  Activity,
  Car,
  Eye,
  Maximize2,
  Pause,
  Play,
  Radio,
  Volume2,
  VolumeX,
  Waves,
  Zap,
} from 'lucide-react';

interface Props {
  engine: SimulationEngine;
}

export const CanvasSimulation: React.FC<Props> = ({ engine }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Interactive Visualizer Toggles
  const [showSensors, setShowSensors] = useState<boolean>(true);
  const [showGreenWave, setShowGreenWave] = useState<boolean>(true);
  const [showSpeedTags, setShowSpeedTags] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [hoveredInterId, setHoveredInterId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Audio Context Ref for emergency siren
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sirenOscRef = useRef<OscillatorNode | null>(null);
  const sirenGainRef = useRef<GainNode | null>(null);

  // Refs for animation loop state to avoid closure staleness
  const stateRef = useRef({
    showSensors: true,
    showGreenWave: true,
    showSpeedTags: false,
    hoveredInterId: null as string | null,
    mousePos: null as { x: number; y: number } | null,
  });

  useEffect(() => {
    stateRef.current = {
      showSensors,
      showGreenWave,
      showSpeedTags,
      hoveredInterId,
      mousePos,
    };
  }, [showSensors, showGreenWave, showSpeedTags, hoveredInterId, mousePos]);

  // Audio handling for emergency vehicle siren
  useEffect(() => {
    const isEmergency = engine.emergencyManager.isEmergencyActive();

    if (isEmergency && !isMuted) {
      try {
        if (!audioCtxRef.current) {
          const AudioContextClass =
            window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          audioCtxRef.current = new AudioContextClass();
        }

        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        if (!sirenOscRef.current) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';

          // Frequency modulation for European / US high-low siren
          const now = ctx.currentTime;
          osc.frequency.setValueAtTime(650, now);
          gain.gain.setValueAtTime(0.04, now); // Gentle volume

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();

          sirenOscRef.current = osc;
          sirenGainRef.current = gain;
        }

        // Modulate siren pitch continuously while active
        if (sirenOscRef.current && ctx) {
          const t = ctx.currentTime;
          const freq = 650 + Math.sin(t * 7) * 220;
          sirenOscRef.current.frequency.setTargetAtTime(freq, t, 0.05);
        }
      } catch {
        // Fallback gracefully if browser audio is blocked
      }
    } else {
      if (sirenOscRef.current) {
        try {
          sirenOscRef.current.stop();
          sirenOscRef.current.disconnect();
        } catch {
          // Ignore
        }
        sirenOscRef.current = null;
        sirenGainRef.current = null;
      }
    }

    return () => {
      if (sirenOscRef.current) {
        try {
          sirenOscRef.current.stop();
          sirenOscRef.current.disconnect();
        } catch {
          // Ignore
        }
        sirenOscRef.current = null;
      }
    };
  }, [engine, isMuted]);

  // Main 60 FPS Canvas rendering loop with Retina (devicePixelRatio) scaling
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const render = (currentTime: number) => {
      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // Update simulation logic
      engine.update(dt);

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          const targetW = engine.CANVAS_WIDTH * dpr;
          const targetH = engine.CANVAS_HEIGHT * dpr;

          if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
          }

          ctx.save();
          ctx.scale(dpr, dpr);
          drawScene(ctx, engine, stateRef.current);
          ctx.restore();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [engine]);

  // Handle canvas mouse move for interactive inspection
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = engine.CANVAS_WIDTH / rect.width;
    const scaleY = engine.CANVAS_HEIGHT / rect.height;

    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    setMousePos({ x: mx, y: my });

    // Check if mouse is hovering an intersection (within 65px)
    let foundInter: string | null = null;
    for (const inter of engine.intersections.values()) {
      const dist = Math.hypot(mx - inter.x, my - inter.y);
      if (dist < 65) {
        foundInter = inter.id;
        break;
      }
    }
    setHoveredInterId(foundInter);
  };

  const handleMouseLeave = () => {
    setHoveredInterId(null);
    setMousePos(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Quick spawn or toggle
    const spawned = engine.spawnRandomVehicle();
    if (!spawned) {
      engine.spawnRandomVehicle();
    }
  };

  const togglePause = () => {
    engine.isPaused = !engine.isPaused;
    setIsPaused(engine.isPaused);
  };

  // -------------------------------------------------------------
  // RENDERING PIPELINE
  // -------------------------------------------------------------
  const drawScene = (
    ctx: CanvasRenderingContext2D,
    sim: SimulationEngine,
    viewState: {
      showSensors: boolean;
      showGreenWave: boolean;
      showSpeedTags: boolean;
      hoveredInterId: string | null;
      mousePos: { x: number; y: number } | null;
    }
  ) => {
    const { CANVAS_WIDTH, CANVAS_HEIGHT, ROAD_WIDTH } = sim;
    const weather = sim.weatherManager.getWeather();
    const isEmergency = sim.emergencyManager.isEmergencyActive();
    const emergencyRoute = sim.emergencyManager.getActiveRoute();

    // 1. Clear background (Urban Dark Asphalt)
    ctx.fillStyle = '#070b12';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 2. City Blocks & Landscaping (Modern Architectural footprint)
    drawCityBlocks(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 3. Emergency Green Wave Priority Corridor Glow (if active)
    if (isEmergency && emergencyRoute) {
      drawEmergencyCorridorGlow(ctx, emergencyRoute, ROAD_WIDTH, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // 4. Roads, Asphalt, Curbs, Crosswalks & Markings
    drawRoadNetwork(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, ROAD_WIDTH);

    // 5. Intersections, Signals & Countdown Rings
    for (const inter of sim.intersections.values()) {
      drawIntersection(ctx, inter, sim, viewState.hoveredInterId === inter.id);
    }

    // 6. HC-SR04 Ultrasonic Sensor Cones (Hardware Microprocessor Interfacing)
    if (viewState.showSensors) {
      drawUltrasonicSensors(ctx, sim);
    }

    // 7. Green Wave Platoon Synchronization Waves
    if (viewState.showGreenWave) {
      drawCoordinatedWaves(ctx, sim);
    }

    // 8. Accidents & Collisions (Hazards, Cones, Broken wreckage)
    drawAccidents(ctx, sim);

    // 9. Vehicles (Sedans, Taxis, Trucks, Hatchbacks, Ambulances with soft shadows & brake lights)
    for (const v of sim.vehicles) {
      drawVehicle(ctx, v, sim, viewState.showSpeedTags);
    }

    // 10. Weather Effects (Rain streaks, Fog blur, Storm lightning)
    if (weather.type !== 'CLEAR') {
      drawWeatherEffect(ctx, sim);
    }

    // 11. Interactive Telemetry Inspection HUD
    if (viewState.hoveredInterId) {
      const target = sim.intersections.get(viewState.hoveredInterId);
      if (target) {
        drawTelemetryHUD(ctx, target, sim, viewState.mousePos);
      }
    }
  };

  // -------------------------------------------------------------
  // SUB-RENDERERS
  // -------------------------------------------------------------

  const drawCityBlocks = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ) => {
    // 9 Urban Blocks surrounding the 2x2 grid
    const blocks = [
      [20, 20, 195, 135],
      [285, 20, 230, 135],
      [585, 20, 195, 135],
      [20, 225, 195, 170],
      [285, 225, 230, 170], // Center district
      [585, 225, 195, 170],
      [20, 465, 195, 115],
      [285, 465, 230, 115],
      [585, 465, 195, 115],
    ];

    blocks.forEach(([bx, by, bw, bh], idx) => {
      // Base sidewalk/block
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(bx, by, bw, bh);

      // Building inner footprint
      ctx.fillStyle = '#141e33';
      ctx.fillRect(bx + 8, by + 8, bw - 16, bh - 16);

      // Subtle architectural roof grid lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 8, by + 8, bw - 16, bh - 16);

      // Micro building windows / rooftop detail
      ctx.fillStyle = idx === 4 ? 'rgba(56, 189, 248, 0.15)' : 'rgba(100, 116, 139, 0.1)';
      ctx.fillRect(bx + 16, by + 16, bw - 32, bh - 32);

      // District label on center block
      if (idx === 4) {
        ctx.fillStyle = '#475569';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CENTRAL COMMERCIAL HUB', bx + bw / 2, by + bh / 2);
      }
    });
  };

  const drawEmergencyCorridorGlow = (
    ctx: CanvasRenderingContext2D,
    route: any,
    roadWidth: number,
    cw: number,
    ch: number
  ) => {
    ctx.save();
    const pulse = (Math.sin(Date.now() * 0.006) + 1) * 0.5; // 0 to 1
    ctx.strokeStyle = `rgba(239, 68, 68, ${0.25 + pulse * 0.25})`;
    ctx.lineWidth = roadWidth + 24;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    if (route.id === 'ROUTE_NORTH_SOUTH') {
      ctx.moveTo(250, 0);
      ctx.lineTo(250, ch);
    } else if (route.id === 'ROUTE_WEST_EAST') {
      ctx.moveTo(0, 190);
      ctx.lineTo(cw, 190);
    } else if (route.id === 'ROUTE_SOUTH_CORRIDOR') {
      ctx.moveTo(0, 430);
      ctx.lineTo(cw, 430);
    } else if (route.id === 'ROUTE_CROSS_DIAGONAL') {
      ctx.moveTo(0, 190);
      ctx.lineTo(550, 190);
      ctx.lineTo(550, ch);
    }
    ctx.stroke();

    // Secondary inner electric glow core
    ctx.strokeStyle = `rgba(254, 202, 202, ${0.4 + pulse * 0.3})`;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.restore();
  };

  const drawRoadNetwork = (
    ctx: CanvasRenderingContext2D,
    cw: number,
    ch: number,
    roadWidth: number
  ) => {
    const halfRoad = roadWidth / 2;

    // Asphalt Base
    ctx.fillStyle = '#192231';
    // Vertical Roads (x=250 and x=550)
    ctx.fillRect(250 - halfRoad, 0, roadWidth, ch);
    ctx.fillRect(550 - halfRoad, 0, roadWidth, ch);
    // Horizontal Roads (y=190 and y=430)
    ctx.fillRect(0, 190 - halfRoad, cw, roadWidth);
    ctx.fillRect(0, 430 - halfRoad, cw, roadWidth);

    // Sidewalk Curbs / Road Borders
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.5;

    [250 - halfRoad, 250 + halfRoad, 550 - halfRoad, 550 + halfRoad].forEach((rx) => {
      ctx.beginPath();
      ctx.moveTo(rx, 0);
      ctx.lineTo(rx, ch);
      ctx.stroke();
    });

    [190 - halfRoad, 190 + halfRoad, 430 - halfRoad, 430 + halfRoad].forEach((ry) => {
      ctx.beginPath();
      ctx.moveTo(0, ry);
      ctx.lineTo(cw, ry);
      ctx.stroke();
    });

    // Dashed Centerline Lane Dividers (Yellow & White)
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 8]);

    // Vertical center dividers
    [250, 550].forEach((vx) => {
      ctx.beginPath();
      ctx.moveTo(vx, 0);
      ctx.lineTo(vx, 190 - halfRoad);
      ctx.moveTo(vx, 190 + halfRoad);
      ctx.lineTo(vx, 430 - halfRoad);
      ctx.moveTo(vx, 430 + halfRoad);
      ctx.lineTo(vx, ch);
      ctx.stroke();
    });

    // Horizontal center dividers
    [190, 430].forEach((hy) => {
      ctx.beginPath();
      ctx.moveTo(0, hy);
      ctx.lineTo(250 - halfRoad, hy);
      ctx.moveTo(250 + halfRoad, hy);
      ctx.lineTo(550 - halfRoad, hy);
      ctx.moveTo(550 + halfRoad, hy);
      ctx.lineTo(cw, hy);
      ctx.stroke();
    });

    ctx.setLineDash([]); // Reset dash

    // Directional Arrows on Approaches
    drawLaneArrows(ctx, roadWidth);

    // Pedestrian Zebra Crosswalks
    drawZebraCrosswalks(ctx, roadWidth);
  };

  const drawLaneArrows = (ctx: CanvasRenderingContext2D, roadWidth: number) => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Northbound approach arrows (moving south, top to down)
    ctx.fillText('↓', 250 - 18, 95);
    ctx.fillText('↓', 550 - 18, 95);

    // Southbound approach arrows (moving north, bottom to up)
    ctx.fillText('↑', 250 + 18, 515);
    ctx.fillText('↑', 550 + 18, 515);

    // Westbound approach arrows (moving east, left to right)
    ctx.fillText('→', 115, 190 + 18);
    ctx.fillText('→', 115, 430 + 18);

    // Eastbound approach arrows (moving west, right to left)
    ctx.fillText('←', 685, 190 - 18);
    ctx.fillText('←', 685, 430 - 18);
  };

  const drawZebraCrosswalks = (ctx: CanvasRenderingContext2D, roadWidth: number) => {
    const halfRoad = roadWidth / 2; // 35
    ctx.fillStyle = 'rgba(241, 245, 249, 0.6)';

    const junctions = [
      { x: 250, y: 190 },
      { x: 550, y: 190 },
      { x: 250, y: 430 },
      { x: 550, y: 430 },
    ];

    junctions.forEach(({ x, y }) => {
      // North Crosswalk (above stop line)
      for (let s = -halfRoad + 3; s < halfRoad - 3; s += 8) {
        ctx.fillRect(x + s, y - halfRoad - 14, 5, 8);
      }
      // South Crosswalk (below stop line)
      for (let s = -halfRoad + 3; s < halfRoad - 3; s += 8) {
        ctx.fillRect(x + s, y + halfRoad + 6, 5, 8);
      }
      // West Crosswalk (left of stop line)
      for (let s = -halfRoad + 3; s < halfRoad - 3; s += 8) {
        ctx.fillRect(x - halfRoad - 14, y + s, 8, 5);
      }
      // East Crosswalk (right of stop line)
      for (let s = -halfRoad + 3; s < halfRoad - 3; s += 8) {
        ctx.fillRect(x + halfRoad + 6, y + s, 8, 5);
      }
    });
  };

  const drawIntersection = (
    ctx: CanvasRenderingContext2D,
    inter: IntersectionState,
    sim: SimulationEngine,
    isHovered: boolean
  ) => {
    const { x, y, currentPhase, isEmergencyPreempted, id, phaseTimer, phaseDuration } = inter;
    const halfRoad = sim.ROAD_WIDTH / 2;

    // Intersection Box Base
    ctx.fillStyle = isEmergencyPreempted
      ? 'rgba(239, 68, 68, 0.25)'
      : isHovered
      ? '#1e293b'
      : '#131b2b';
    ctx.fillRect(x - halfRoad, y - halfRoad, sim.ROAD_WIDTH, sim.ROAD_WIDTH);

    // Yellow Box Junction Markings (Anti-Gridlock / Box Rule)
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - halfRoad, y - halfRoad, sim.ROAD_WIDTH, sim.ROAD_WIDTH);
    ctx.clip();

    ctx.strokeStyle = isEmergencyPreempted
      ? 'rgba(239, 68, 68, 0.45)'
      : 'rgba(234, 179, 8, 0.28)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let d = -sim.ROAD_WIDTH; d <= sim.ROAD_WIDTH; d += 14) {
      ctx.moveTo(x - halfRoad + d, y - halfRoad);
      ctx.lineTo(x + halfRoad + d, y + halfRoad);
      ctx.moveTo(x - halfRoad + d, y + halfRoad);
      ctx.lineTo(x + halfRoad + d, y - halfRoad);
    }
    ctx.stroke();
    ctx.restore();

    // Outer Box Border
    ctx.strokeStyle = isEmergencyPreempted
      ? '#ef4444'
      : isHovered
      ? '#38bdf8'
      : '#334155';
    ctx.lineWidth = isHovered ? 2.5 : 1.5;
    ctx.strokeRect(x - halfRoad, y - halfRoad, sim.ROAD_WIDTH, sim.ROAD_WIDTH);

    // White Stop Lines
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x - halfRoad, y - halfRoad - 3, halfRoad, 3); // North
    ctx.fillRect(x, y + halfRoad, halfRoad, 3); // South
    ctx.fillRect(x - halfRoad - 3, y, 3, halfRoad); // West
    ctx.fillRect(x + halfRoad, y - halfRoad, 3, halfRoad); // East

    // Dynamic Circular Countdown Ring at Junction Center
    const remainingTime = Math.max(0, Math.ceil(phaseDuration - phaseTimer));
    const progress = Math.min(1, Math.max(0, phaseTimer / (phaseDuration || 1)));

    // Center circular badge
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#090d16';
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Progress Arc
    let ringColor = '#22c55e'; // Green
    if (isEmergencyPreempted) {
      ringColor = '#ef4444';
    } else if (currentPhase.includes('YELLOW')) {
      ringColor = '#eab308';
    } else if (currentPhase.includes('RED')) {
      ringColor = '#f43f5e';
    }

    ctx.beginPath();
    ctx.arc(x, y, 16, -Math.PI / 2, -Math.PI / 2 + (1 - progress) * Math.PI * 2);
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center Text: Countdown Seconds & ID
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${remainingTime}s`, x, y - 2);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 7px sans-serif';
    ctx.fillText(id, x, y + 8);

    // Traffic Signal Heads with Glowing Lamps
    drawSignalHead(ctx, x - halfRoad - 14, y - halfRoad - 12, currentPhase, 'NS');
    drawSignalHead(ctx, x + halfRoad + 4, y + halfRoad - 6, currentPhase, 'NS');
    drawSignalHead(ctx, x - halfRoad - 12, y + halfRoad + 4, currentPhase, 'EW');
    drawSignalHead(ctx, x + halfRoad - 6, y - halfRoad - 14, currentPhase, 'EW');

    // Queue Badges
    drawQueueBadge(ctx, x - 18, y - halfRoad - 22, inter.queues.NORTH, 'N');
    drawQueueBadge(ctx, x + 18, y + halfRoad + 22, inter.queues.SOUTH, 'S');
    drawQueueBadge(ctx, x - halfRoad - 22, y + 18, inter.queues.WEST, 'W');
    drawQueueBadge(ctx, x + halfRoad + 22, y - 18, inter.queues.EAST, 'E');

    // Active Control State Tag (e.g. "Webster Split", "Preempted")
    if (isEmergencyPreempted) {
      drawPillBadge(ctx, x, y - halfRoad - 14, '🚨 PREEMPTION', '#ef4444');
    } else if (inter.hasAccident) {
      drawPillBadge(ctx, x, y - halfRoad - 14, '⚠️ COLLISION COLLAPSE', '#f59e0b');
    }
  };

  const drawPillBadge = (
    ctx: CanvasRenderingContext2D,
    bx: number,
    by: number,
    label: string,
    color: string
  ) => {
    ctx.save();
    ctx.font = 'bold 8px monospace';
    const textWidth = ctx.measureText(label).width;
    const pad = 6;

    ctx.fillStyle = '#090d16';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bx - textWidth / 2 - pad, by - 6, textWidth + pad * 2, 13, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx, by);
    ctx.restore();
  };

  const drawSignalHead = (
    ctx: CanvasRenderingContext2D,
    bx: number,
    by: number,
    phase: SignalPhase,
    targetOrientation: 'NS' | 'EW'
  ) => {
    ctx.fillStyle = '#020617';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bx, by, 10, 18, 3);
    ctx.fill();
    ctx.stroke();

    let isGreen = false;
    let isYellow = false;
    let isRed = false;

    if (targetOrientation === 'NS') {
      if (phase === 'NS_GREEN') isGreen = true;
      else if (phase === 'NS_YELLOW') isYellow = true;
      else isRed = true;
    } else {
      if (phase === 'EW_GREEN') isGreen = true;
      else if (phase === 'EW_YELLOW') isYellow = true;
      else isRed = true;
    }

    // Red Lamp
    ctx.fillStyle = isRed ? '#ef4444' : '#450a0a';
    if (isRed) {
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 6;
    }
    ctx.beginPath();
    ctx.arc(bx + 5, by + 4, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Yellow Lamp
    ctx.fillStyle = isYellow ? '#eab308' : '#422006';
    if (isYellow) {
      ctx.shadowColor = '#eab308';
      ctx.shadowBlur = 6;
    }
    ctx.beginPath();
    ctx.arc(bx + 5, by + 9, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Green Lamp
    ctx.fillStyle = isGreen ? '#22c55e' : '#052e16';
    if (isGreen) {
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 6;
    }
    ctx.beginPath();
    ctx.arc(bx + 5, by + 14, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  };

  const drawQueueBadge = (
    ctx: CanvasRenderingContext2D,
    qx: number,
    qy: number,
    count: number,
    dirLabel: string
  ) => {
    ctx.save();
    const isHeavy = count >= 4;
    const isMed = count >= 2;
    const bgCol = count === 0 ? '#1e293b' : isHeavy ? '#ef4444' : isMed ? '#f59e0b' : '#38bdf8';

    ctx.fillStyle = bgCol;
    ctx.beginPath();
    ctx.arc(qx, qy, 7.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = count === 0 ? '#94a3b8' : '#0f172a';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${count}`, qx, qy);

    ctx.restore();
  };

  // -------------------------------------------------------------
  // HC-SR04 ULTRASONIC SENSORS VISUALIZATION
  // -------------------------------------------------------------
  const drawUltrasonicSensors = (ctx: CanvasRenderingContext2D, sim: SimulationEngine) => {
    const time = Date.now() * 0.003;

    for (const inter of sim.intersections.values()) {
      const { x, y, queues } = inter;

      // 4 Approach Sensors: North, South, East, West
      const sensorConfigs: {
        dir: Approach;
        sx: number;
        sy: number;
        angle: number;
        queue: number;
        label: string;
      }[] = [
        { dir: 'NORTH', sx: x - 26, sy: y - 56, angle: -Math.PI / 2, queue: queues.NORTH, label: 'N' },
        { dir: 'SOUTH', sx: x + 26, sy: y + 56, angle: Math.PI / 2, queue: queues.SOUTH, label: 'S' },
        { dir: 'WEST', sx: x - 56, sy: y + 26, angle: Math.PI, queue: queues.WEST, label: 'W' },
        { dir: 'EAST', sx: x + 56, sy: y - 26, angle: 0, queue: queues.EAST, label: 'E' },
      ];

      sensorConfigs.forEach(({ dir, sx, sy, angle, queue, label }) => {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(angle);

        // Simulated distance in cm based on queue count
        const simulatedCm = queue >= 3 ? 8 : queue === 2 ? 18 : queue === 1 ? 26 : 55;
        const isActive = queue > 0;

        // Draw Ultrasonic Sensor PCB (HC-SR04 body)
        ctx.fillStyle = '#0284c7'; // Arduino/Sensor Blue PCB
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.roundRect(-7, -4, 14, 8, 1.5);
        ctx.fill();
        ctx.stroke();

        // Dual Aluminum Ultrasonic Transducers (Transmitter & Receiver)
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(-3.5, 0, 2.2, 0, Math.PI * 2);
        ctx.arc(3.5, 0, 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing Acoustic Sound Cones (Sonar Arcs)
        const pulsePhase = (time + (sx + sy) * 0.05) % 1;
        const beamColor = isActive
          ? queue >= 3
            ? 'rgba(239, 68, 68,'
            : 'rgba(234, 179, 8,'
          : 'rgba(56, 189, 248,';

        for (let arc = 1; arc <= 3; arc++) {
          const arcR = 10 + arc * 14 + pulsePhase * 8;
          const arcAlpha = Math.max(0, 0.45 - (arc / 4) * 0.4);

          ctx.strokeStyle = `${beamColor} ${arcAlpha})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          // Arc spreading forward 60 degrees (-PI/6 to PI/6)
          ctx.arc(0, 0, arcR, -Math.PI / 5, Math.PI / 5);
          ctx.stroke();
        }

        ctx.restore();

        // Distance Tag Floating next to sensor
        if (isActive) {
          ctx.save();
          ctx.fillStyle = '#090d16';
          ctx.strokeStyle = queue >= 3 ? '#ef4444' : '#eab308';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.roundRect(sx - 16, sy - 18, 32, 10, 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = queue >= 3 ? '#fca5a5' : '#fef08a';
          ctx.font = 'bold 7px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${simulatedCm}cm`, sx, sy - 13);
          ctx.restore();
        }
      });
    }
  };

  const drawCoordinatedWaves = (ctx: CanvasRenderingContext2D, sim: SimulationEngine) => {
    if (sim.controlMode !== 'ADAPTIVE') return;

    for (const inter of sim.intersections.values()) {
      for (const p of inter.incomingPlatoons) {
        if (p.vehicleCount >= 1) {
          const fromInter = sim.intersections.get(p.fromIntersectionId);
          if (fromInter) {
            ctx.save();
            const dashOffset = (Date.now() * 0.03) % 20;
            ctx.strokeStyle = 'rgba(52, 211, 153, 0.6)';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.setLineDash([8, 8]);
            ctx.lineDashOffset = -dashOffset;

            ctx.beginPath();
            ctx.moveTo(fromInter.x, fromInter.y);
            ctx.lineTo(inter.x, inter.y);
            ctx.stroke();

            // Platoon packet badge in transit
            const midX = (fromInter.x + inter.x) / 2;
            const midY = (fromInter.y + inter.y) / 2;
            ctx.fillStyle = '#064e3b';
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(midX - 24, midY - 7, 48, 14, 3);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#6ee7b7';
            ctx.font = 'bold 7.5px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`Wave: ${p.vehicleCount} cars`, midX, midY);

            ctx.restore();
          }
        }
      }
    }
  };

  const drawAccidents = (ctx: CanvasRenderingContext2D, sim: SimulationEngine) => {
    const accidents = sim.accidentManager.getAllAccidents();
    for (const acc of accidents) {
      const inter = sim.intersections.get(acc.intersectionId);
      if (!inter) continue;

      let ax = inter.x;
      let ay = inter.y;
      let rotAngle = 0;

      if (acc.approach === 'NORTH') {
        ax = inter.x - 18;
        ay = inter.y - 70;
        rotAngle = Math.PI / 2;
      } else if (acc.approach === 'SOUTH') {
        ax = inter.x + 18;
        ay = inter.y + 70;
        rotAngle = -Math.PI / 2;
      } else if (acc.approach === 'WEST') {
        ax = inter.x - 70;
        ay = inter.y + 18;
        rotAngle = 0;
      } else if (acc.approach === 'EAST') {
        ax = inter.x + 70;
        ay = inter.y - 18;
        rotAngle = Math.PI;
      }

      ctx.save();
      const pulse = (Date.now() % 1000) / 1000;
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.85 - pulse * 0.8})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(ax, ay, 14 + pulse * 18, 0, Math.PI * 2);
      ctx.stroke();

      // Crash Hazard Cones
      const coneOffsets = [
        { dx: -10, dy: -9 },
        { dx: 10, dy: -9 },
        { dx: -10, dy: 9 },
        { dx: 10, dy: 9 },
      ];
      coneOffsets.forEach((c) => {
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(ax + c.dx, ay + c.dy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Crashed Wreckage
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(rotAngle + 0.35);
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.roundRect(-8, -5, 16, 10, 2);
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-3, -4, 6, 8);
      ctx.restore();

      // Warning Badge
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(ax, ay, 8.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚠️', ax, ay);

      ctx.fillStyle = '#fdba74';
      ctx.font = 'bold 8px monospace';
      ctx.fillText('BLOCKED', ax, ay - 14);
      ctx.restore();
    }
  };

  const drawVehicle = (
    ctx: CanvasRenderingContext2D,
    v: Vehicle,
    sim: SimulationEngine,
    showSpeedTags: boolean
  ) => {
    ctx.save();

    let renderX = v.x;
    let renderY = v.y;
    const latOff = v.lateralOffset || 0;
    if (latOff !== 0) {
      if (v.direction === 'NORTH' || v.direction === 'SOUTH') {
        renderX += latOff;
      } else if (v.direction === 'WEST') {
        renderY += latOff;
      } else if (v.direction === 'EAST') {
        renderY -= latOff;
      }
    }

    ctx.translate(renderX, renderY);

    let angle = 0;
    if (v.direction === 'NORTH') angle = Math.PI / 2;
    else if (v.direction === 'SOUTH') angle = -Math.PI / 2;
    else if (v.direction === 'WEST') angle = 0;
    else if (v.direction === 'EAST') angle = Math.PI;

    ctx.rotate(angle);

    const length = v.length;
    const width = v.width;

    // 1. Soft Vehicle Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.roundRect(-length / 2 + 1, -width / 2 + 2, length, width, 3);
    ctx.fill();

    // 2. Emergency Siren Shockwave
    if (v.isEmergency) {
      const wavePhase = (Date.now() % 500) / 500;
      ctx.save();
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.7 - wavePhase * 0.6})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(length / 2 + 6 + wavePhase * 16, 0, 8 + wavePhase * 10, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Vehicle Body
    ctx.fillStyle = v.color;
    ctx.beginPath();
    ctx.roundRect(-length / 2, -width / 2, length, width, 3);
    ctx.fill();

    // 4. Vehicle Silhouette details (Cab, Truck, Sedan, Ambulance)
    if (v.isEmergency) {
      // Ambulance White Roof with Red Medical Cross
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-length / 4, -width / 2 + 2, length / 2, width - 4);

      // Red Cross '+'
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-4, -1.2, 8, 2.4);
      ctx.fillRect(-1.2, -4, 2.4, 8);
    } else if (v.vehicleType === 'truck') {
      // Truck Cargo Box behind cab
      ctx.fillStyle = '#334155';
      ctx.fillRect(-length / 2 + 2, -width / 2 + 1, length * 0.58, width - 2);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(length / 6, -width / 2 + 1.5, length / 4, width - 3);
    } else if (v.vehicleType === 'cab') {
      // Taxi Roof Sign
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-length / 6, -width / 2 + 2, length / 3, width - 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2, -width / 2 + 1, 4, width - 2);
    } else {
      // Regular Sedan / Hatchback Windshield & Roof
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-length / 6, -width / 2 + 2, length / 3, width - 4);
    }

    // 5. Headlights
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(length / 2 - 2, -width / 2 + 1, 2, 2.5);
    ctx.fillRect(length / 2 - 2, width / 2 - 3.5, 2, 2.5);

    // 6. Glowing Brake Lights (when stopping or stopped)
    const isBraking = v.isStopped || v.speed < 0.35;
    if (isBraking) {
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 8;
      ctx.fillRect(-length / 2, -width / 2 + 1, 2, 2.5);
      ctx.fillRect(-length / 2, width / 2 - 3.5, 2, 2.5);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(-length / 2, -width / 2 + 1, 1.5, 2);
      ctx.fillRect(-length / 2, width / 2 - 3, 1.5, 2);
    }

    // 7. Hazard Blinkers (when yielding or stopped behind accident)
    if (v.isYielding || v.isAccidentStopped) {
      const isAmberBlink = Math.floor(Date.now() / 250) % 2 === 0;
      if (isAmberBlink) {
        ctx.fillStyle = '#f59e0b';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 6;
        ctx.fillRect(length / 2 - 2, -width / 2, 2, 2);
        ctx.fillRect(length / 2 - 2, width / 2 - 2, 2, 2);
        ctx.fillRect(-length / 2, -width / 2, 2, 2);
        ctx.fillRect(-length / 2, width / 2 - 2, 2, 2);
        ctx.shadowBlur = 0;
      }
    }

    // 8. Emergency Rotating Strobe Beacons
    if (v.isEmergency) {
      const strobeTime = Math.floor(Date.now() / 110) % 2;
      const strobeColor = strobeTime === 0 ? '#ef4444' : '#3b82f6';

      ctx.fillStyle = strobeColor;
      ctx.shadowColor = strobeColor;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    // Speed Tag Overlay
    if (showSpeedTags) {
      ctx.save();
      ctx.fillStyle = '#090d16';
      ctx.fillRect(renderX - 12, renderY - 14, 24, 9);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${(v.speed * 25).toFixed(0)}km/h`, renderX, renderY - 9);
      ctx.restore();
    }
  };

  const drawWeatherEffect = (ctx: CanvasRenderingContext2D, sim: SimulationEngine) => {
    const weather = sim.weatherManager.getWeather();
    const { CANVAS_WIDTH, CANVAS_HEIGHT } = sim;

    ctx.save();
    if (weather.type === 'FOG') {
      ctx.fillStyle = `rgba(148, 163, 184, ${weather.visibilityAlpha})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else if (weather.type === 'RAIN' || weather.type === 'STORM') {
      ctx.fillStyle = `rgba(15, 23, 42, ${weather.visibilityAlpha * 0.7})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.strokeStyle = weather.type === 'STORM' ? '#93c5fd' : '#60a5fa';
      ctx.lineWidth = 1;
      const count = weather.type === 'STORM' ? 90 : 45;
      const time = Date.now() * 0.001;

      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const rx = (Math.sin(i * 99 + time * 5) * 0.5 + 0.5) * CANVAS_WIDTH;
        const ry = (Math.cos(i * 33 + time * 7) * 0.5 + 0.5) * CANVAS_HEIGHT;
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 4, ry + 12);
      }
      ctx.stroke();

      if (weather.type === 'STORM' && Math.random() < 0.03) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    }
    ctx.restore();
  };

  // -------------------------------------------------------------
  // INTERACTIVE TELEMETRY HUD (ON HOVER)
  // -------------------------------------------------------------
  const drawTelemetryHUD = (
    ctx: CanvasRenderingContext2D,
    inter: IntersectionState,
    sim: SimulationEngine,
    pos: { x: number; y: number } | null
  ) => {
    if (!pos) return;
    const hx = Math.min(sim.CANVAS_WIDTH - 210, Math.max(15, pos.x + 15));
    const hy = Math.min(sim.CANVAS_HEIGHT - 170, Math.max(15, pos.y + 15));

    ctx.save();
    // Glassmorphism Card
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(hx, hy, 195, 150, 8);
    ctx.fill();
    ctx.stroke();

    // Header
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${inter.name} [${inter.id}]`, hx + 10, hy + 18);

    ctx.fillStyle = '#64748b';
    ctx.font = '9px sans-serif';
    ctx.fillText('Live Microcontroller Telemetry', hx + 10, hy + 30);

    ctx.strokeStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(hx + 10, hy + 36);
    ctx.lineTo(hx + 185, hy + 36);
    ctx.stroke();

    // Metrics Breakdown
    const rows = [
      { label: 'Active Phase:', val: inter.currentPhase, col: '#38bdf8' },
      {
        label: 'Remaining Timer:',
        val: `${Math.ceil(inter.phaseDuration - inter.phaseTimer)}s / ${Math.round(inter.phaseDuration)}s`,
        col: '#22c55e',
      },
      {
        label: 'Queue Demands:',
        val: `N:${inter.queues.NORTH} S:${inter.queues.SOUTH} E:${inter.queues.EAST} W:${inter.queues.WEST}`,
        col: '#e2e8f0',
      },
      {
        label: 'Platoons En Route:',
        val: `${inter.incomingPlatoons.reduce((s, p) => s + p.vehicleCount, 0)} vehicles`,
        col: '#a78bfa',
      },
      {
        label: 'Preemption Status:',
        val: inter.isEmergencyPreempted ? 'PRIORITY OVERRIDE' : 'NORMAL ADAPTIVE',
        col: inter.isEmergencyPreempted ? '#ef4444' : '#10b981',
      },
      {
        label: 'Decision Reason:',
        val: inter.activeControlReason || 'Webster Split',
        col: '#f59e0b',
      },
    ];

    rows.forEach((r, idx) => {
      const ry = hy + 50 + idx * 16;
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px sans-serif';
      ctx.fillText(r.label, hx + 10, ry);

      ctx.fillStyle = r.col;
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(r.val, hx + 185, ry);
      ctx.textAlign = 'left';
    });

    ctx.restore();
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl shadow-emerald-950/20 group">
      {/* Top Overlay Status Bar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-slate-900/90 backdrop-blur border border-slate-700/60 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 shadow-lg">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping inline-block" />
        <span>Live Grid: 2×2 Coordinated Corridors</span>
      </div>

      {/* Top Right Controls & Sensor Toggles Toolbar */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-slate-900/95 backdrop-blur border border-slate-700/80 px-2 py-1 rounded-lg text-xs shadow-lg">
        {/* HC-SR04 Ultrasonic Sensor Cone Toggle */}
        <button
          onClick={() => setShowSensors(!showSensors)}
          title="Toggle HC-SR04 Ultrasonic Sensor Sonar Cones"
          className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all ${
            showSensors
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio className="w-3 h-3" />
          <span>Sensors</span>
        </button>

        {/* Green Wave Coordination Toggle */}
        <button
          onClick={() => setShowGreenWave(!showGreenWave)}
          title="Toggle Multi-Intersection Green Wave Sync Pulses"
          className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all ${
            showGreenWave
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Waves className="w-3 h-3" />
          <span>Green Wave</span>
        </button>

        {/* Speed Tags */}
        <button
          onClick={() => setShowSpeedTags(!showSpeedTags)}
          title="Toggle Vehicle Speed Tags"
          className={`px-1.5 py-1 rounded text-[11px] font-medium transition-all ${
            showSpeedTags
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Speed
        </button>

        {/* Siren Sound Toggle */}
        <button
          onClick={() => setIsMuted(!isMuted)}
          title={isMuted ? 'Unmute Siren Sound FX' : 'Mute Sound FX'}
          className={`p-1 rounded text-[11px] transition-all ${
            !isMuted
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>

        {/* Quick Spawn Vehicle */}
        <button
          onClick={() => engine.spawnRandomVehicle()}
          title="Spawn random vehicle on road"
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm"
        >
          <Car className="w-3 h-3" />
          <span>+Car</span>
        </button>

        {/* Pause/Play Toggle */}
        <button
          onClick={togglePause}
          title={isPaused ? 'Resume Simulation' : 'Pause Simulation'}
          className="p-1 rounded text-slate-300 hover:text-white transition-all"
        >
          {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Bottom Hint */}
      <div className="absolute bottom-2.5 left-3 z-10 flex items-center gap-3 text-[10px] text-slate-400 bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
        <span>💡 Hover any junction to inspect live Webster queue telemetry</span>
        <span className="text-slate-600">•</span>
        <span>Click canvas to spawn car</span>
      </div>

      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleCanvasClick}
        className="w-full h-auto block cursor-crosshair aspect-4/3"
      />
    </div>
  );
};
