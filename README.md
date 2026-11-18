# DEAM — Dynamic, Emergency-Aware, Adaptive Traffic Management

A high-performance web-based simulation and dashboard for a smart traffic signal system, modeling a **2×2 grid of 4 connected intersections** ($I_1, I_2, I_3, I_4$).

---

## 🌟 Key Features

1. **Density-Based Adaptive Signal Timing (Modified Webster Method)**
   - Continuous queue estimation per approach with real-time green phase allocation.
   - Dynamic cycle calculation ($25\text{s} - 60\text{s}$) with bounded safety constraints ($7\text{s} \le \text{Green} \le 35\text{s}$).

2. **Multi-Intersection Green Wave Coordination**
   - Inter-controller messaging sharing upstream platoon counts and ETA.
   - Synchronized green offsets along active corridors for smooth arterial transit.

3. **Emergency Vehicle Priority (Preemption)**
   - One-click dispatch of priority ambulances/fire engines along preset routes.
   - Immediate signal preemption with visual strobe flashers and graceful recovery.

4. **Accident Detection & Capacity Redistribution**
   - Interactive collision injector on any junction approach.
   - Dynamic capacity collapse and re-allocation of green time to unaffected approaches.

5. **Weather-Adaptive Control**
   - Toggles for **Clear**, **Rain**, **Fog**, and **Storm**.
   - Real-time adjustment of vehicle braking friction, speed limits, yellow clearance intervals, and all-red buffers.

6. **Quantitative Analytics & Proof-of-Improvement**
   - Real-time Recharts tracking average delay, queue lengths, and throughput.
   - Live side-by-side efficiency comparison (+30% to +45% delay reduction vs. fixed-time round-robin baseline).

7. **Built-in Viva & Project Reference Modal**
   - Interactive in-app guide explaining mathematical formulations, state machines, and high-frequency viva questions.

---

## 🚀 Quick Start (Local Run)

```bash
# 1. Install dependencies
npm install

# 2. Launch development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧠 Algorithmic Formulation

### 1. Queue Pressure Calculation
For each intersection $I_k$:
$$\text{Pressure}_{\text{NS}} = Q_{\text{North}} + Q_{\text{South}} + \sum \text{Platoons}_{\text{Incoming}}$$
$$\text{Pressure}_{\text{EW}} = Q_{\text{East}} + Q_{\text{West}} + \sum \text{Platoons}_{\text{Incoming}}$$

### 2. Dynamic Cycle & Green Allocation
$$C_{\text{dynamic}} = \text{clamp}(25, 20 + 1.2 \times (\text{Pressure}_{\text{NS}} + \text{Pressure}_{\text{EW}}), 60)$$
$$G_{\text{NS}} = \text{clamp}\left(7, C_{\text{dynamic}} \times \frac{\text{Pressure}_{\text{NS}}}{\text{Total Pressure}}, 35\right)$$

### 3. Weather Safety Buffers
$$\text{Yellow Duration} = 3.0\text{s} + \Delta_{\text{weather}}$$
$$\text{All-Red Clearance} = 1.5\text{s} + \Delta_{\text{all\_red}}$$

---

## 📁 Project Structure

```
DEAM CP/
├── AETMS_DEAM_Presentation.pptx    # Slide presentation (VIT Pune collegiate format)
├── DEAM_Presentation2.pptx         # Backup / alternate presentation deck
├── generate_deck.py                # Automation script generating PPTX deck
├── circuit_simulation_tinkercad.png # Tinkercad hardware simulation screenshot
├── web_simulation_dashboard.png     # DEAM 2x2 grid web simulator screenshot
├── firmware/
│   ├── sketch.ino                   # ATmega2560 Arduino Mega C++ firmware
│   └── diagram.json                 # Wokwi / Tinkercad circuit wiring schema
├── src/
│   ├── types/
│   │   └── traffic.ts               # TypeScript interfaces & types
│   ├── engine/
│   │   ├── SimulationEngine.ts      # 60 FPS Canvas physics loop & Poisson traffic
│   │   ├── SignalController.ts      # Webster adaptive vs Fixed-cycle logic
│   │   ├── EmergencyManager.ts      # Priority preemption & siren sync
│   │   ├── AccidentManager.ts       # Hazard events & capacity adjustment
│   │   └── WeatherManager.ts        # Friction, speed & clearance modifiers
│   ├── components/
│   │   ├── Header.tsx               # Status bar, mode toggle, viva trigger
│   │   ├── CanvasSimulation.tsx     # 2D Canvas rendering & glowing signals
│   │   ├── ControlPanel.tsx         # Scenario injectors (Emergency, Crash, Weather)
│   │   ├── IntersectionGridCards.tsx# Live junction cards (NW, NE, SW, SE)
│   │   ├── AnalyticsDashboard.tsx   # Recharts live wait-time comparison
│   │   └── VivaExplainerModal.tsx   # In-app viva cheat-sheet & math reference
│   ├── App.tsx                      # Root application layout
│   └── main.tsx                     # Entry point
```

---

## 🛠️ Hardware Prototype (Tinkercad / Wokwi)

The hardware model interfaces an **Arduino MEGA 2560 (ATmega2560)** with:
- **4× HC-SR04 Ultrasonic Sensors:** Discrete queue depth monitoring per approach lane.
- **16×2 Character LCD with I2C Backpack:** Displays live vehicle counts and signal countdowns (Pins 20/21).
- **12× Signal LEDs:** Red, Yellow, and Green LEDs with 220Ω current-limiting resistors.
- **Hardware Interrupt (`INT0`):** Sub-microsecond emergency priority preemption.

---

## 👥 Team & Project Credits

**Vishwakarma Institute of Technology, Pune – 37**  
*Department of Artificial Intelligence & Machine Learning / Computer Engineering*  
*Course: Microprocessors and Digital Electronics (DEAM) | Group 08*

- **Harshal Dhonge** (1030230) — Firmware & Algorithm Lead
- **Nishad Dhokane** (1030229) — Circuit Interfacing & Hardware Lead
- **Diksha Mann** (1030232) — Simulation, Testing & Analytics Lead
- **Huzefa Gandhi** (1030245) — System Architecture & Documentation Lead

---

## 🎓 Viva Q&A Highlights

- **Q: Why not give permanent green to the busiest road?**
  *A: To prevent starvation of cross-traffic. The algorithm bounds maximum green to 30s/35s and guarantees at least 5s/7s for cross-streets.*
- **Q: Why use an external hardware interrupt (INT0) instead of polling?**
  *A: Polling loop delays can leave emergency ambulances stuck for tens of seconds. An external hardware interrupt triggers an asynchronous CPU vector in under 1 µs.*
- **Q: How does the system handle accidents?**
  *A: The controller detects lane capacity reduction, downweights green time on the blocked approach, and reallocates time to cross streets.*
- **Q: How does the green wave work without machine learning?**
  *A: Controllers broadcast upcoming platoon sizes and ETA messages to neighboring junctions, factoring upstream arrivals into local phase split calculations.*

