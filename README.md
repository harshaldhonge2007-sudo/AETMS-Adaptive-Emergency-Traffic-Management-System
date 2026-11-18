# DEAM — Dynamic, Emergency-Aware, Adaptive Traffic Management

A high-performance, deterministic simulation and telemetry dashboard for a smart traffic signal network, modeling a **2×2 grid of 4 connected intersections** ($I_1, I_2, I_3, I_4$) alongside an **Arduino MEGA 2560 embedded hardware prototype**.

---

## 🌟 Key Technical Features

1. **Dual-Mode Dynamic Signal Optimization:**
   - **True Webster Method:** Implements Webster's optimum cycle formula $C_0 = \frac{1.5L + 5}{1 - Y}$ using critical approach flow ratios $y_i = q_i / s_i$, lost time $L = 7.0\text{s}$, and saturation flow rate $s = 0.5\text{ veh/s}$.
   - **Queue-Pressure Heuristic:** Exponential queue pressure $(Q_N + Q_S)^{1.25}$ for prioritizing congested approaches.
   - **Starvation Prevention & Limits:** Strictly clamped between $C_{\min} = 22\text{s}$ and $C_{\max} = 65\text{s}$, with guaranteed minimum green $G_{\min} = 5\text{s}$ and maximum green cap $G_{\max} = 35\text{s}$.

2. **Deterministic PRNG (Mulberry32):**
   - 100% reproducible traffic arrival schedules, vehicle characteristics, and seed-controlled random walks.

3. **Multi-Intersection Green Wave Coordination:**
   - Distance-based platoon ETA calculation ($\text{ETA} = \text{Distance} / \text{Speed}$) and corridor progression offsets.

4. **Multi-Step Emergency Vehicle Preemption:**
   - Proximity detection within approach zone ($d \le 160\text{px}$).
   - Safe transition state machine: Current Green $\rightarrow$ Yellow Clearance ($3.0\text{s} + \Delta_{\text{weather}}$) $\rightarrow$ All-Red Buffer ($1.5\text{s} + \Delta_{\text{weather}}$) $\rightarrow$ Priority Green.
   - Immediate release once ambulance clears the intersection box.
   - Simultaneous multi-vehicle emergency resolution by lowest ETA.

5. **Accident Detection & Capacity Reallocation:**
   - Interactive collision injector on any junction approach.
   - Capacity downweighting on blocked lanes and automatic redirection of green split to cross traffic.

6. **Weather-Adaptive Safety Clearance:**
   - Toggles for **Clear**, **Rain**, **Fog**, and **Storm**.
   - Dynamically expands yellow clearance intervals (+1.5s to +3.0s) and adds all-red safety buffers (+1.0s to +1.5s) to compensate for wet braking friction.

7. **Empirical A/B Benchmarking (No Survivorship Bias):**
   - Runs a twin baseline engine on the exact same seed and arrival schedule.
   - Measures true departure delay ($t_{\text{actual}} - t_{\text{free\_flow}}$) across exiting vehicles.
   - Real-time P95 delay, throughput per minute, and stopped queue tracking.

---

## 📊 Empirical Batch Benchmark Results (720 Runs / 20 Seeds)

Generated via `npm run experiments` across 20 randomized seeds for 9 scenarios ($T = 120\text{s}$, $dt = 0.1\text{s}$):

| Scenario | Fixed Baseline (15s) | Tuned Fixed (25s) | Queue Pressure | Webster (Ours) | Gain vs 15s | Gain vs 25s | Throughput |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **LOW_TRAFFIC** | $33.04 \pm 1.24\text{s}$ | $42.20 \pm 1.86\text{s}$ | $27.04 \pm 2.17\text{s}$ | **$26.93 \pm 2.36\text{s}$** | **+18.5%** | **+36.2%** | $17.3\text{ trips/min}$ |
| **NORMAL_TRAFFIC** | $38.57 \pm 0.86\text{s}$ | $48.56 \pm 1.31\text{s}$ | $34.68 \pm 1.09\text{s}$ | **$34.68 \pm 1.09\text{s}$** | **+10.1%** | **+28.6%** | $25.8\text{ trips/min}$ |
| **RUSH_HOUR** | $40.81 \pm 0.77\text{s}$ | $51.98 \pm 1.29\text{s}$ | $36.57 \pm 1.01\text{s}$ | **$36.57 \pm 1.01\text{s}$** | **+10.4%** | **+29.6%** | $27.5\text{ trips/min}$ |
| **HEAVY_GRID** | $42.03 \pm 0.62\text{s}$ | $53.93 \pm 0.87\text{s}$ | $37.15 \pm 0.76\text{s}$ | **$37.15 \pm 0.76\text{s}$** | **+11.6%** | **+31.1%** | $28.1\text{ trips/min}$ |
| **RAIN_WEATHER** | $45.23 \pm 0.98\text{s}$ | $54.59 \pm 1.26\text{s}$ | $44.46 \pm 1.33\text{s}$ | **$44.46 \pm 1.33\text{s}$** | **+1.7%** | **+18.6%** | $23.1\text{ trips/min}$ |
| **FOG_WEATHER** | $47.24 \pm 1.14\text{s}$ | $57.59 \pm 1.22\text{s}$ | $49.91 \pm 1.70\text{s}$ | **$49.91 \pm 1.70\text{s}$** | -5.7% | **+13.3%** | $21.4\text{ trips/min}$ |
| **STORM_WEATHER** | $54.30 \pm 1.19\text{s}$ | $60.81 \pm 1.02\text{s}$ | $56.54 \pm 1.64\text{s}$ | **$56.54 \pm 1.64\text{s}$** | -4.1% | **+7.0%** | $19.2\text{ trips/min}$ |
| **ACCIDENT_I1** | $38.88 \pm 0.98\text{s}$ | $48.67 \pm 1.23\text{s}$ | $32.95 \pm 0.89\text{s}$ | **$32.90 \pm 0.93\text{s}$** | **+15.4%** | **+32.4%** | $23.8\text{ trips/min}$ |
| **EMERGENCY_PRIORITY**| $37.56 \pm 0.87\text{s}$ | $38.12 \pm 1.20\text{s}$ | $33.53 \pm 1.22\text{s}$ | **$33.53 \pm 1.22\text{s}$** | **+10.7%** | **+12.0%** | $24.6\text{ trips/min}$ |

---

## 🚀 Quick Start (Local Run)

```bash
# 1. Install dependencies
npm install

# 2. Run unit & algorithm test suites (Vitest)
npm run test

# 3. Run headless batch experiments (output results.csv)
npm run experiments

# 4. Launch web visualizer & dashboard
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧠 Mathematical Formulations

### 1. True Webster Optimum Cycle & Green Splits
$$L = 2 \times l = 2 \times (\text{Yellow} + \text{All-Red} - \text{Extension}) = 7.0\text{s}$$
$$y_{\text{NS}} = \frac{q_{\text{NS}}}{s}, \quad y_{\text{EW}} = \frac{q_{\text{EW}}}{s}, \quad Y = y_{\text{NS}} + y_{\text{EW}} \le 0.82$$
$$C_0 = \frac{1.5 L + 5.0}{1.0 - Y} = \frac{15.5}{1.0 - Y}$$
$$C_{\text{dynamic}} = \text{clamp}(22\text{s}, C_0, 65\text{s})$$
$$G_{\text{NS}} = \text{clamp}\left(5\text{s}, (C_{\text{dynamic}} - L) \times \frac{y_{\text{NS}}}{Y}, 35\text{s}\right)$$

### 2. Queue Pressure Heuristic
$$\text{Pressure}_{\text{NS}} = (Q_N + Q_S)^{1.25} + \sum \text{Platoons}_{\text{Incoming}}$$
$$\text{Pressure}_{\text{EW}} = (Q_E + Q_W)^{1.25} + \sum \text{Platoons}_{\text{Incoming}}$$
$$C_{\text{dynamic}} = \text{clamp}(22\text{s}, 18 + 2.0 \times (\text{Pressure}_{\text{NS}} + \text{Pressure}_{\text{EW}}), 65\text{s})$$
$$G_{\text{NS}} = \text{clamp}\left(5\text{s}, C_{\text{dynamic}} \times \frac{\text{Pressure}_{\text{NS}}}{\text{Total Pressure}}, 35\text{s}\right)$$

### 3. Weather Safety Extensions
$$\text{Yellow Clearance} = 3.0\text{s} + \Delta_{\text{yellow\_weather}}$$
$$\text{All-Red Safety Buffer} = 1.5\text{s} + \Delta_{\text{all\_red\_weather}}$$

---

## ⚠️ Model Assumptions & Limitations

- **Straight-Through Movements Only:** Current simulation models straight arterial traffic without left or right protected turn phases.
- **Single Lane Per Approach:** Approaching corridors model a single dedicated lane. Multi-lane overtaking is not modeled.
- **Idealized Car Following:** Vehicles follow a deterministic car-following model with safe headway buffers. Driver reaction delays are idealized.

---

## 🛠️ Hardware Prototype (Arduino MEGA 2560 / Wokwi)

The hardware prototype interfaces an **Arduino MEGA 2560 (ATmega2560 @ 16 MHz)** with:
- **4× HC-SR04 Ultrasonic Sensors:** Approach distance sensing (Pins 34–41).
- **16×2 Character LCD with I2C Backpack:** Commuter & operator telemetry on SDA (Pin 20) and SCL (Pin 21) at address `0x27`.
- **12× Signal LEDs:** 4× Red, 4× Yellow, 4× Green with 220Ω current-limiting resistors (Pins 22–33).
- **External Hardware Interrupt (`INT4`):** Emergency pushbutton on **Digital Pin 2 (PE4)** with `INPUT_PULLUP`.
  *(Avoids Pin 21 / INT0 collision with I2C SCL).*

---

## 👥 Team & Project Credits

**Vishwakarma Institute of Technology, Pune – 37**  
*Department of Computer Engineering / Artificial Intelligence & Machine Learning*  
*Course: Microprocessors and Digital Electronics (DEAM) | Division B | Group 08*

- **Harshal Dhonge** (1030230) — Firmware & Algorithm Lead
- **Nishad Dhokane** (1030229) — Circuit Interfacing & Hardware Lead
- **Diksha Mann** (1030232) — Simulation, Testing & Analytics Lead
- **Huzefa Gandhi** (1030245) — System Architecture & Documentation Lead
