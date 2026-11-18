# DEAM Arduino MEGA 2560 Firmware Specification

## 1. Microcontroller Architecture
This firmware runs on an **Arduino MEGA 2560 (ATmega2560 @ 16 MHz)**. The ATmega2560 provides 54 digital I/O pins, 16 analog pins, and 6 hardware external interrupts (INT0–INT5), accommodating 4 ultrasonic sensors (8 pins), 12 signal LEDs, an emergency interrupt, and an I2C telemetry LCD without pin starvation.

### Pin Mapping Table
| Subsystem | Signal / Function | Arduino Mega Pin | ATmega2560 Port |
| :--- | :--- | :--- | :--- |
| **North Signal** | Red, Yellow, Green LEDs | Pins 22, 23, 24 | PA0, PA1, PA2 |
| **South Signal** | Red, Yellow, Green LEDs | Pins 25, 26, 27 | PA3, PA4, PA5 |
| **East Signal** | Red, Yellow, Green LEDs | Pins 28, 29, 30 | PA6, PA7, PC7 |
| **West Signal** | Red, Yellow, Green LEDs | Pins 31, 32, 33 | PC6, PC5, PC4 |
| **North HC-SR04** | Trig / Echo | Pins 34 / 35 | PC3 / PC2 |
| **South HC-SR04** | Trig / Echo | Pins 36 / 37 | PC1 / PC0 |
| **East HC-SR04** | Trig / Echo | Pins 38 / 39 | PD7 / PG2 |
| **West HC-SR04** | Trig / Echo | Pins 40 / 41 | PG1 / PG0 |
| **I2C Telemetry LCD**| SDA / SCL | Pins 20 / 21 | PD1 / PD0 |
| **Emergency Priority**| External Hardware Interrupt | **Pin 2 (INT4)** | PE4 (INPUT_PULLUP) |

> [!IMPORTANT]
> **Why Pin 2 (INT4) instead of Pin 21 (INT0)?**  
> On an Arduino Uno, `INT0` is Digital Pin 2. However, on the **ATmega2560 (Arduino Mega)**, `INT0` is hardwired to **Pin 21 (PD0)**, which is also the `SCL` line of the hardware I2C bus! Attaching an interrupt button to Pin 21 shorts the I2C clock line, corrupting communication with the PCF8574 LCD. We use **Pin 2 (INT4)**, keeping Pins 20 and 21 clean for flicker-free LCD telemetry.

---

## 2. Non-Blocking State Machine Execution
The firmware executes a non-blocking `millis()` finite state machine:
- `STATE_NS_GREEN`: Active green on North-South corridor.
- `STATE_NS_YELLOW`: 3.0-second yellow clearance.
- `STATE_ALL_RED_TO_EW`: 1.5-second all-red intersection clearance.
- `STATE_EW_GREEN`: Active green on East-West corridor.
- `STATE_EW_YELLOW`: 3.0-second yellow clearance.
- `STATE_ALL_RED_TO_NS`: 1.5-second all-red intersection clearance.
- `STATE_EMERGENCY_CLEARANCE_YELLOW`: Safe yellow transition when interrupt triggers during opposing green.
- `STATE_EMERGENCY_CLEARANCE_ALL_RED`: 1.5-second all-red box clearance.
- `STATE_EMERGENCY_GREEN`: Priority green hold for emergency vehicle passage.

Sensors are polled **sequentially** (one sensor every 35ms, completing a full 4-approach sweep in 140ms). This prevents acoustic cross-talk / echo reflections between adjacent ultrasonic transducers.

---

## 3. Mathematical Formula & Bounds
Approach queue densities:
- $d < 10\text{ cm} \implies q = 3\text{ (High Density)}$
- $10\text{ cm} \le d < 25\text{ cm} \implies q = 2\text{ (Medium Density)}$
- $d \ge 25\text{ cm} \implies q = 1\text{ (Low / Clear Approach)}$

Dynamic cycle allocation:
$$C_{\text{dynamic}} = \text{clamp}(22\text{s}, 18 + 2.0 \times (Q_{\text{NS}} + Q_{\text{EW}}), 65\text{s})$$
$$G_{\text{NS}} = \text{clamp}\left(5\text{s}, C_{\text{dynamic}} \times \frac{Q_{\text{NS}}}{Q_{\text{NS}} + Q_{\text{EW}}}, 35\text{s}\right)$$
$$G_{\text{EW}} = \text{clamp}\left(5\text{s}, C_{\text{dynamic}} \times \frac{Q_{\text{EW}}}{Q_{\text{NS}} + Q_{\text{EW}}}, 35\text{s}\right)$$

---

## 4. Shared Test Vectors (Firmware & TypeScript Verification)
Both the Arduino Mega firmware and the TypeScript simulation engine satisfy these identical test vectors:

| Test Vector | $[q_N, q_S, q_E, q_W]$ | Total $Q$ | $C_{\text{dynamic}}$ | $G_{\text{NS}}$ | $G_{\text{EW}}$ | System Behavior |
| :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Vector 1** | $[1, 1, 1, 1]$ | 4 | 26s | **13s** | **13s** | Balanced baseline traffic |
| **Vector 2** | $[3, 3, 1, 1]$ | 8 | 34s | **25s** | **9s** | Heavy North-South arterial |
| **Vector 3** | $[1, 1, 3, 3]$ | 8 | 34s | **9s** | **25s** | Heavy East-West boulevard |
| **Vector 4** | $[3, 3, 3, 3]$ | 12 | 42s | **21s** | **21s** | Saturated grid traffic |
| **Vector 5** | $[0, 0, 3, 3]$ | 6 | 30s | **5s** | **25s** | **Anti-Starvation Clamp**: $G_{\min} = 5\text{s}$ guaranteed |

---

## 5. Running in Wokwi
1. Open this folder in VS Code with the Wokwi extension installed.
2. Press `F1` $\to$ **Wokwi: Start Simulator**.
3. Press the red **EMERGENCY INT4** pushbutton to test safe preemption transitions and ISR execution in real time!
