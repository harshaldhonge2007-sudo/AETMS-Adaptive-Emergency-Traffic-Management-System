import React, { useRef, useEffect } from 'react';
import { SimulationEngine } from '../engine/SimulationEngine';
import { SignalPhase } from '../types/traffic';

interface Props {
  engine: SimulationEngine;
}

export const CanvasSimulation: React.FC<Props> = ({ engine }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
          drawScene(ctx, engine);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [engine]);

  const drawScene = (ctx: CanvasRenderingContext2D, sim: SimulationEngine) => {
    const { CANVAS_WIDTH, CANVAS_HEIGHT, ROAD_WIDTH } = sim;
    const weather = sim.weatherManager.getWeather();
    const isEmergency = sim.emergencyManager.isEmergencyActive();
    const emergencyRoute = sim.emergencyManager.getActiveRoute();

    // 1. Clear background (Urban Asphalt / Dark map theme)
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Grid block buildings / terrain texture
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(20, 20, 195, 135);
    ctx.fillRect(285, 20, 230, 135);
    ctx.fillRect(585, 20, 195, 135);

    ctx.fillRect(20, 225, 195, 170);
    ctx.fillRect(285, 225, 230, 170);
    ctx.fillRect(585, 225, 195, 170);

    ctx.fillRect(20, 465, 195, 115);
    ctx.fillRect(285, 465, 230, 115);
    ctx.fillRect(585, 465, 195, 115);

    // Subtle building borders
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    [
      [20, 20, 195, 135],
      [285, 20, 230, 135],
      [585, 20, 195, 135],
      [20, 225, 195, 170],
      [285, 225, 230, 170],
      [585, 225, 195, 170],
      [20, 465, 195, 115],
      [285, 465, 230, 115],
      [585, 465, 195, 115],
    ].forEach(([bx, by, bw, bh]) => ctx.strokeRect(bx, by, bw, bh));

    // 2. Draw Emergency Green Wave Corridor Glow (if active)
    if (isEmergency && emergencyRoute) {
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.lineWidth = ROAD_WIDTH + 16;
      ctx.lineCap = 'round';
      ctx.beginPath();

      if (emergencyRoute.id === 'ROUTE_NORTH_SOUTH') {
        ctx.moveTo(250, 0);
        ctx.lineTo(250, CANVAS_HEIGHT);
      } else if (emergencyRoute.id === 'ROUTE_WEST_EAST') {
        ctx.moveTo(0, 190);
        ctx.lineTo(CANVAS_WIDTH, 190);
      } else if (emergencyRoute.id === 'ROUTE_SOUTH_CORRIDOR') {
        ctx.moveTo(0, 430);
        ctx.lineTo(CANVAS_WIDTH, 430);
      } else if (emergencyRoute.id === 'ROUTE_CROSS_DIAGONAL') {
        ctx.moveTo(0, 190);
        ctx.lineTo(550, 190);
        ctx.lineTo(550, CANVAS_HEIGHT);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 3. Draw Roads (Asphalt + Markings)
    ctx.fillStyle = '#1e2533';

    // Vertical Roads (x=250 and x=550)
    ctx.fillRect(250 - ROAD_WIDTH / 2, 0, ROAD_WIDTH, CANVAS_HEIGHT);
    ctx.fillRect(550 - ROAD_WIDTH / 2, 0, ROAD_WIDTH, CANVAS_HEIGHT);

    // Horizontal Roads (y=190 and y=430)
    ctx.fillRect(0, 190 - ROAD_WIDTH / 2, CANVAS_WIDTH, ROAD_WIDTH);
    ctx.fillRect(0, 430 - ROAD_WIDTH / 2, CANVAS_WIDTH, ROAD_WIDTH);

    // Road Borders
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;

    // Vertical borders
    [250 - ROAD_WIDTH / 2, 250 + ROAD_WIDTH / 2, 550 - ROAD_WIDTH / 2, 550 + ROAD_WIDTH / 2].forEach(
      (rx) => {
        ctx.beginPath();
        ctx.moveTo(rx, 0);
        ctx.lineTo(rx, CANVAS_HEIGHT);
        ctx.stroke();
      }
    );

    // Horizontal borders
    [190 - ROAD_WIDTH / 2, 190 + ROAD_WIDTH / 2, 430 - ROAD_WIDTH / 2, 430 + ROAD_WIDTH / 2].forEach(
      (ry) => {
        ctx.beginPath();
        ctx.moveTo(0, ry);
        ctx.lineTo(CANVAS_WIDTH, ry);
        ctx.stroke();
      }
    );

    // Lane Dividers (Dashed yellow/white lines)
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 8]);

    // Vertical center dividers
    [250, 550].forEach((vx) => {
      ctx.beginPath();
      ctx.moveTo(vx, 0);
      ctx.lineTo(vx, 190 - ROAD_WIDTH / 2);
      ctx.moveTo(vx, 190 + ROAD_WIDTH / 2);
      ctx.lineTo(vx, 430 - ROAD_WIDTH / 2);
      ctx.moveTo(vx, 430 + ROAD_WIDTH / 2);
      ctx.lineTo(vx, CANVAS_HEIGHT);
      ctx.stroke();
    });

    // Horizontal center dividers
    [190, 430].forEach((hy) => {
      ctx.beginPath();
      ctx.moveTo(0, hy);
      ctx.lineTo(250 - ROAD_WIDTH / 2, hy);
      ctx.moveTo(250 + ROAD_WIDTH / 2, hy);
      ctx.lineTo(550 - ROAD_WIDTH / 2, hy);
      ctx.moveTo(550 + ROAD_WIDTH / 2, hy);
      ctx.lineTo(CANVAS_WIDTH, hy);
      ctx.stroke();
    });

    ctx.setLineDash([]); // Reset dash

    // 4. Draw Intersection Junctions, Stop Lines & Signals
    for (const inter of sim.intersections.values()) {
      drawIntersection(ctx, inter, sim);
    }

    // 5. Draw Platoons / Wave indicators (arrows showing coordinated flow)
    drawCoordinatedWaves(ctx, sim);

    // 6. Draw Accidents (Hazard cones & Warning pulses)
    drawAccidents(ctx, sim);

    // 7. Draw Vehicles
    for (const v of sim.vehicles) {
      drawVehicle(ctx, v, sim);
    }

    // 8. Weather Overlay (Rain streaks, fog blur, darkness)
    if (weather.type !== 'CLEAR') {
      drawWeatherEffect(ctx, sim);
    }
  };

  const drawIntersection = (
    ctx: CanvasRenderingContext2D,
    inter: any,
    sim: SimulationEngine
  ) => {
    const { x, y, currentPhase, isEmergencyPreempted, id, name } = inter;
    const halfRoad = sim.ROAD_WIDTH / 2;

    // Intersection Box Base
    ctx.fillStyle = isEmergencyPreempted ? 'rgba(239, 68, 68, 0.15)' : '#171e2e';
    ctx.fillRect(x - halfRoad, y - halfRoad, sim.ROAD_WIDTH, sim.ROAD_WIDTH);

    // Yellow Box Junction Markings (Anti-Gridlock / Yellow Box Rule)
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - halfRoad, y - halfRoad, sim.ROAD_WIDTH, sim.ROAD_WIDTH);
    ctx.clip();
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - halfRoad, y - halfRoad, sim.ROAD_WIDTH, sim.ROAD_WIDTH);

    // Diagonal criss-cross grid lines inside the box
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.12)';
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

    // Junction ID Badge
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(id, x, y);

    // Draw Stop Lines (White solid bars)
    ctx.fillStyle = '#f8fafc';
    // North stop line
    ctx.fillRect(x - halfRoad, y - halfRoad - 3, halfRoad, 3);
    // South stop line
    ctx.fillRect(x, y + halfRoad, halfRoad, 3);
    // West stop line
    ctx.fillRect(x - halfRoad - 3, y, 3, halfRoad);
    // East stop line
    ctx.fillRect(x + halfRoad, y - halfRoad, 3, halfRoad);

    // Traffic Signal Heads with Glowing Lamps
    // North approach signal (facing vehicles coming from North, placed top-left of stop line)
    drawSignalHead(ctx, x - halfRoad - 14, y - halfRoad - 12, currentPhase, 'NS');
    // South approach signal (facing vehicles coming from South, placed bottom-right of stop line)
    drawSignalHead(ctx, x + halfRoad + 4, y + halfRoad - 6, currentPhase, 'NS');

    // West approach signal (facing vehicles coming from West, placed bottom-left of stop line)
    drawSignalHead(ctx, x - halfRoad - 12, y + halfRoad + 4, currentPhase, 'EW');
    // East approach signal (facing vehicles coming from East, placed top-right of stop line)
    drawSignalHead(ctx, x + halfRoad - 6, y - halfRoad - 14, currentPhase, 'EW');

    // Queue Counters display near entry approaches
    drawQueueBadge(ctx, x - 18, y - halfRoad - 18, inter.queues.NORTH);
    drawQueueBadge(ctx, x + 18, y + halfRoad + 18, inter.queues.SOUTH);
    drawQueueBadge(ctx, x - halfRoad - 18, y + 18, inter.queues.WEST);
    drawQueueBadge(ctx, x + halfRoad + 18, y - 18, inter.queues.EAST);
  };

  const drawSignalHead = (
    ctx: CanvasRenderingContext2D,
    bx: number,
    by: number,
    phase: SignalPhase,
    targetOrientation: 'NS' | 'EW'
  ) => {
    // Housing
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

    // Red Light
    ctx.fillStyle = isRed ? '#ef4444' : '#450a0a';
    if (isRed) {
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 6;
    }
    ctx.beginPath();
    ctx.arc(bx + 5, by + 4, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Yellow Light
    ctx.fillStyle = isYellow ? '#eab308' : '#422006';
    if (isYellow) {
      ctx.shadowColor = '#eab308';
      ctx.shadowBlur = 6;
    }
    ctx.beginPath();
    ctx.arc(bx + 5, by + 9, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Green Light
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
    count: number
  ) => {
    if (count === 0) return;
    ctx.save();
    ctx.fillStyle = count >= 4 ? '#ef4444' : count >= 2 ? '#f59e0b' : '#38bdf8';
    ctx.beginPath();
    ctx.arc(qx, qy, 6.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(count.toString(), qx, qy);
    ctx.restore();
  };

  const drawCoordinatedWaves = (ctx: CanvasRenderingContext2D, sim: SimulationEngine) => {
    if (sim.controlMode !== 'ADAPTIVE') return;

    // Draw green wave coordination sync pulses along active corridors
    for (const inter of sim.intersections.values()) {
      for (const p of inter.incomingPlatoons) {
        if (p.vehicleCount >= 2) {
          const fromInter = sim.intersections.get(p.fromIntersectionId);
          if (fromInter) {
            ctx.save();
            ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
            ctx.lineWidth = 3;
            ctx.setLineDash([4, 6]);
            ctx.beginPath();
            ctx.moveTo(fromInter.x, fromInter.y);
            ctx.lineTo(inter.x, inter.y);
            ctx.stroke();
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
        ay = inter.y + 18; // Right lane for Westbound traffic
        rotAngle = 0;
      } else if (acc.approach === 'EAST') {
        ax = inter.x + 70;
        ay = inter.y - 18; // Right lane for Eastbound traffic
        rotAngle = Math.PI;
      }

      ctx.save();
      // Warning beacon pulse
      const pulse = (Date.now() % 1000) / 1000;
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.85 - pulse * 0.8})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(ax, ay, 14 + pulse * 18, 0, Math.PI * 2);
      ctx.stroke();

      // Crash safety barrier / hazard cones
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

      // Crashed Vehicle Wreckage (tilted collision body)
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(rotAngle + 0.35); // skewed impact rotation
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

      // Label
      ctx.fillStyle = '#fdba74';
      ctx.font = 'bold 8px monospace';
      ctx.fillText('BLOCKED', ax, ay - 14);
      ctx.restore();
    }
  };

  const drawVehicle = (
    ctx: CanvasRenderingContext2D,
    v: any,
    sim: SimulationEngine
  ) => {
    ctx.save();

    // Apply lateral offset when vehicle pulls over to curb for an emergency vehicle
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

    // Rotate vehicle along movement heading
    let angle = 0;
    if (v.direction === 'NORTH') angle = Math.PI / 2; // Moving down
    else if (v.direction === 'SOUTH') angle = -Math.PI / 2; // Moving up
    else if (v.direction === 'WEST') angle = 0; // Moving right
    else if (v.direction === 'EAST') angle = Math.PI; // Moving left

    ctx.rotate(angle);

    const length = v.length;
    const width = v.width;

    // Siren sound wave ripples emitting ahead of emergency vehicle
    if (v.isEmergency) {
      const wavePhase = (Date.now() % 600) / 600;
      ctx.save();
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.7 - wavePhase * 0.6})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(length / 2 + 6 + wavePhase * 16, 0, 8 + wavePhase * 10, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
      ctx.restore();
    }

    // Vehicle Body
    ctx.fillStyle = v.color;
    ctx.beginPath();
    ctx.roundRect(-length / 2, -width / 2, length, width, 3);
    ctx.fill();

    // Windshield & roof detail
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-length / 6, -width / 2 + 2, length / 3, width - 4);

    // Headlights
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(length / 2 - 2, -width / 2 + 1, 2, 2.5);
    ctx.fillRect(length / 2 - 2, width / 2 - 3.5, 2, 2.5);

    // Hazard Blinkers (when yielding to ambulance or stopped at accident)
    if (v.isYielding || v.isAccidentStopped) {
      const isAmberBlink = Math.floor(Date.now() / 250) % 2 === 0;
      if (isAmberBlink) {
        ctx.fillStyle = '#f59e0b';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 6;
        // Front & rear blinkers
        ctx.fillRect(length / 2 - 2, -width / 2, 2, 2);
        ctx.fillRect(length / 2 - 2, width / 2 - 2, 2, 2);
        ctx.fillRect(-length / 2, -width / 2, 2, 2);
        ctx.fillRect(-length / 2, width / 2 - 2, 2, 2);
        ctx.shadowBlur = 0;
      }
    }

    // Emergency Strobe Flashers & Roof Beacon
    if (v.isEmergency) {
      const isRedStrobe = Math.floor(Date.now() / 120) % 2 === 0;
      ctx.fillStyle = isRedStrobe ? '#ef4444' : '#3b82f6';
      ctx.shadowColor = isRedStrobe ? '#ef4444' : '#3b82f6';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
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

      // Rain streak particles
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
        // Lightning flash
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    }
    ctx.restore();
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl shadow-emerald-950/20">
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-slate-900/90 backdrop-blur border border-slate-700/60 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping inline-block" />
        <span>Live Grid: 2×2 Coordinated Corridors</span>
      </div>

      <div className="absolute top-3 right-3 z-10 flex items-center gap-2 bg-slate-900/90 backdrop-blur border border-slate-700/60 px-3 py-1.5 rounded-lg text-xs font-mono text-emerald-400">
        <span>60 FPS Physics Simulation</span>
      </div>

      <canvas
        ref={canvasRef}
        width={engine.CANVAS_WIDTH}
        height={engine.CANVAS_HEIGHT}
        className="w-full h-auto block cursor-crosshair aspect-4/3"
      />
    </div>
  );
};
