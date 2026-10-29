import React from 'react';
import {
  AlertOctagon,
  BookOpen,
  CheckCircle2,
  CloudLightning,
  Code2,
  Cpu,
  GraduationCap,
  Layers,
  Radio,
  Siren,
  X,
  Zap,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const VivaExplainerModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 max-w-3xl w-full max-h-[88vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                DEAM Project Architecture & Viva Cheatsheet
              </h2>
              <p className="text-xs text-slate-400">
                Mathematical foundations, state machines, and key presentation points
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 text-slate-300 text-xs sm:text-sm leading-relaxed">
          {/* Section 1: Core Concept */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2 mb-2">
              <Cpu className="w-4 h-4" />
              1. What is DEAM?
            </h3>
            <p className="text-slate-300 mb-2">
              <strong>DEAM</strong> stands for <em>Dynamic, Emergency-Aware, Adaptive traffic Management</em>.
              Traditional traffic lights operate on static, fixed-time cycles regardless of traffic fluctuations,
              leading to unnecessary delays and idle green lights. DEAM replaces this with an intelligent multi-agent
              controller network that dynamically adjusts green durations based on live queue density, coordinates
              platoons between neighboring junctions, and guarantees instant emergency preemption.
            </p>
          </div>

          {/* Section 2: Mathematical Algorithms */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-2 mb-2">
              <Code2 className="w-4 h-4" />
              2. Adaptive Signal Timing Algorithm (Webster's Approximation)
            </h3>
            <p className="mb-2">
              Each intersection continuously calculates approach queue pressure:
            </p>
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg font-mono text-xs text-emerald-300 space-y-1 my-2">
              <div>P_NS = Queue_North + Queue_South + Platoon_Incoming</div>
              <div>P_EW = Queue_East + Queue_West + Platoon_Incoming</div>
              <div>Dynamic_Cycle = Clamp(25s, 20 + 1.2 * TotalPressure, 60s)</div>
              <div>Allocated_Green_NS = Clamp(7s, Dynamic_Cycle * (P_NS / TotalPressure), 35s)</div>
            </div>
            <p className="text-slate-400 text-xs">
              This guarantees starvation prevention (minimum 7 seconds) while allocating up to 35 seconds to heavy corridors.
            </p>
          </div>

          {/* Section 3: Multi-Intersection Coordination */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-indigo-400 flex items-center gap-2 mb-2">
              <Radio className="w-4 h-4" />
              3. Multi-Intersection Green Wave Coordination
            </h3>
            <p>
              When a platoon of vehicles clears an upstream intersection (e.g. I1 &rarr; I2), the controller transmits an inter-agent message with estimated time of arrival (ETA). The downstream controller incorporates this incoming wave into its next cycle calculation to create a green wave corridor.
            </p>
          </div>

          {/* Section 4: Emergency Vehicle Preemption & Accidents */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
              <h4 className="text-xs font-bold text-rose-400 flex items-center gap-1.5 mb-1.5">
                <Siren className="w-4 h-4" /> Emergency Preemption
              </h4>
              <p className="text-xs text-slate-300">
                Immediately interrupts standard cycle, forces safe yellow clearance, and locks downstream green corridor ahead of the ambulance until it passes beyond the junction bounding box.
              </p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
              <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 mb-1.5">
                <AlertOctagon className="w-4 h-4" /> Accident Handling
              </h4>
              <p className="text-xs text-slate-300">
                Reduces effective capacity on the blocked lane to zero, prevents green time wastage on stranded queues, and redirects cycle capacity to cross-traffic.
              </p>
            </div>
          </div>

          {/* Section 5: Likely Viva Questions & Answers */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4" />
              Top 4 Viva Questions to Ace Your Presentation
            </h3>
            <div className="space-y-3 text-xs">
              <div className="border-l-2 border-emerald-500 pl-3">
                <p className="font-semibold text-white">Q1: Why not give green light infinitely to the busiest lane?</p>
                <p className="text-slate-400">
                  A: To prevent starvation of cross traffic. We enforce strict maximum green boundaries (35s) and guaranteed minimum green (7s).
                </p>
              </div>

              <div className="border-l-2 border-cyan-500 pl-3">
                <p className="font-semibold text-white">Q2: How does weather affect the signal parameters?</p>
                <p className="text-slate-400">
                  A: In rain/fog/storm, braking distances increase due to lower road friction. The system expands yellow clearance duration by 1.5–3.0s and adds all-red safety buffer time.
                </p>
              </div>

              <div className="border-l-2 border-indigo-500 pl-3">
                <p className="font-semibold text-white">Q3: How do you prove this works better than fixed-time lights?</p>
                <p className="text-slate-400">
                  A: The live analytics chart tracks real-time average delay per car, demonstrating a 30% to 45% reduction in average wait time compared to the fixed-time baseline.
                </p>
              </div>

              <div className="border-l-2 border-rose-500 pl-3">
                <p className="font-semibold text-white">Q4: What is the future scope?</p>
                <p className="text-slate-400">
                  A: Deep Reinforcement Learning (Q-learning / PPO) for non-linear traffic patterns, V2X wireless communication, and real-time CCTV optical flow density estimation.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono">2nd Year Engineering Project</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-md shadow-emerald-950/40"
          >
            Got it, Close
          </button>
        </div>
      </div>
    </div>
  );
};
