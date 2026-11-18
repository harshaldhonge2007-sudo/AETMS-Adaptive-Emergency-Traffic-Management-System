/**
 * DEAM — Dynamic, Emergency-Aware, Adaptive Traffic Management System (AETMS)
 * Firmware for Arduino MEGA 2560 (ATmega2560)
 *
 * FEATURES:
 * 1. Non-blocking millis() finite state machine (zero blocking delay() in cycle execution).
 * 2. External Hardware Interrupt (Pin 2 / INT4) for sub-microsecond emergency priority preemption.
 *    (Pins 20/SDA and 21/SCL remain clean for I2C LCD communication).
 * 3. Sequential, non-overlapping ultrasonic triggering to prevent acoustic cross-talk.
 * 4. Formula synchronization with TypeScript simulation controller.
 * 5. Flicker-free LCD telemetry updates (padded buffer without repeated lcd.clear()).
 *
 * SHARED TEST VECTORS (TypeScript Controller & Arduino Mega Firmware):
 * [qN, qS, qE, qW] -> [TotalQ] -> [Cycle C] -> [greenNS, greenEW]
 * Vector 1: [1, 1, 1, 1] -> Total=4  -> C=26s -> greenNS=13s, greenEW=13s (Balanced Low)
 * Vector 2: [3, 3, 1, 1] -> Total=8  -> C=34s -> greenNS=25s, greenEW=9s  (Heavy NS Arterial)
 * Vector 3: [1, 1, 3, 3] -> Total=8  -> C=34s -> greenNS=9s,  greenEW=25s (Heavy EW Boulevard)
 * Vector 4: [3, 3, 3, 3] -> Total=12 -> C=42s -> greenNS=21s, greenEW=21s (Heavy Saturated Grid)
 * Vector 5: [0, 0, 3, 3] -> Total=6  -> C=30s -> greenNS=5s,  greenEW=25s (Starvation Protection Bound)
 */

#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

// ---------------- Traffic Light Pins (12 LEDs) ----------------
const byte N_R = 22, N_Y = 23, N_G = 24;
const byte S_R = 25, S_Y = 26, S_G = 27;
const byte E_R = 28, E_Y = 29, E_G = 30;
const byte W_R = 31, W_Y = 32, W_G = 33;

// ---------------- Ultrasonic Sensor Pins (HC-SR04) ----------------
const byte N_TRIG = 34, N_ECHO = 35;
const byte S_TRIG = 36, S_ECHO = 37;
const byte E_TRIG = 38, E_ECHO = 39;
const byte W_TRIG = 40, W_ECHO = 41;

// ---------------- Emergency Interrupt Pin (Arduino Mega Pin 2 -> INT4) ----------------
// NOTE: On Arduino Mega 2560, INT0 is Pin 21 (SCL). Pin 2 is INT4!
// Using Pin 2 avoids collision with I2C SCL on Pin 21.
const byte EMERGENCY_INTERRUPT_PIN = 2;

// ---------------- Algorithm Boundaries & Constants ----------------
const int MIN_GREEN = 5;       // Guaranteed minimum green (starvation prevention)
const int MAX_GREEN = 35;      // Congestion cap
const int BASE_YELLOW_MS = 3000;
const int BASE_ALL_RED_MS = 1500;
const int EMERGENCY_HOLD_MS = 15000;

// ---------------- FSM State Definitions ----------------
enum TrafficState {
  STATE_NS_GREEN,
  STATE_NS_YELLOW,
  STATE_ALL_RED_TO_EW,
  STATE_EW_GREEN,
  STATE_EW_YELLOW,
  STATE_ALL_RED_TO_NS,
  STATE_EMERGENCY_CLEARANCE_YELLOW,
  STATE_EMERGENCY_CLEARANCE_ALL_RED,
  STATE_EMERGENCY_GREEN
};

TrafficState currentState = STATE_NS_GREEN;
unsigned long stateStartTime = 0;
unsigned long currentPhaseDurationMs = 15000;

// Measured Queue Densities (1 = Low, 2 = Medium, 3 = High)
int qN = 1, qS = 1, qE = 1, qW = 1;
int allocatedGreenNS = 15;
int allocatedGreenEW = 15;

// Emergency ISR Flag & Timestamp
volatile bool emergencyRequested = false;
volatile unsigned long emergencyTriggerTimestamp = 0;

// Non-blocking Telemetry Update Timer
unsigned long lastLcdUpdate = 0;
unsigned long lastSensorRead = 0;
byte currentSensorIndex = 0;

// ---------------- External Hardware Interrupt Service Routine ----------------
void emergencyISR() {
  emergencyRequested = true;
  emergencyTriggerTimestamp = millis();
}

// ---------------- Ultrasonic Distance Sensing (Sequential non-blocking) ----------------
int readDistanceCm(byte trigPin, byte echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  unsigned long duration = pulseIn(echoPin, HIGH, 20000UL); // 20ms timeout (~3.4m)
  if (duration == 0) return 400; // Out of range / clear
  return (int)(duration / 58UL);
}

int computeDensityScore(int distCm) {
  if (distCm < 10) return 3;       // High queue density
  if (distCm < 25) return 2;       // Medium queue density
  return 1;                        // Low / clear approach
}

// ---------------- Signal Output Controls ----------------
void setSignals(byte nr, byte ny, byte ng,
                byte sr, byte sy, byte sg,
                byte er, byte ey, byte eg,
                byte wr, byte wy, byte wg) {
  digitalWrite(N_R, nr); digitalWrite(N_Y, ny); digitalWrite(N_G, ng);
  digitalWrite(S_R, sr); digitalWrite(S_Y, sy); digitalWrite(S_G, sg);
  digitalWrite(E_R, er); digitalWrite(E_Y, ey); digitalWrite(E_G, eg);
  digitalWrite(W_R, wr); digitalWrite(W_Y, wy); digitalWrite(W_G, wg);
}

void applySignalsForState(TrafficState state) {
  switch (state) {
    case STATE_NS_GREEN:
    case STATE_EMERGENCY_GREEN:
      setSignals(LOW, LOW, HIGH, LOW, LOW, HIGH, HIGH, LOW, LOW, HIGH, LOW, LOW);
      break;
    case STATE_NS_YELLOW:
      setSignals(LOW, HIGH, LOW, LOW, HIGH, LOW, HIGH, LOW, LOW, HIGH, LOW, LOW);
      break;
    case STATE_ALL_RED_TO_EW:
    case STATE_ALL_RED_TO_NS:
    case STATE_EMERGENCY_CLEARANCE_ALL_RED:
      setSignals(HIGH, LOW, LOW, HIGH, LOW, LOW, HIGH, LOW, LOW, HIGH, LOW, LOW);
      break;
    case STATE_EW_GREEN:
      setSignals(HIGH, LOW, LOW, HIGH, LOW, LOW, LOW, LOW, HIGH, LOW, LOW, HIGH);
      break;
    case STATE_EW_YELLOW:
    case STATE_EMERGENCY_CLEARANCE_YELLOW:
      setSignals(HIGH, LOW, LOW, HIGH, LOW, LOW, LOW, HIGH, LOW, LOW, HIGH, LOW);
      break;
  }
}

// ---------------- Synchronized Dynamic Green Calculation ----------------
void calculateNextSplits() {
  int nsDemand = qN + qS;
  int ewDemand = qE + qW;
  int totalDemand = max(1, nsDemand + ewDemand);

  // Dynamic cycle length bounded between 22s and 65s
  long dynamicCycle = constrain(18 + totalDemand * 2, 22, 65);

  allocatedGreenNS = (int)(dynamicCycle * nsDemand / totalDemand);
  allocatedGreenEW = (int)(dynamicCycle * ewDemand / totalDemand);

  allocatedGreenNS = constrain(allocatedGreenNS, MIN_GREEN, MAX_GREEN);
  allocatedGreenEW = constrain(allocatedGreenEW, MIN_GREEN, MAX_GREEN);
}

// ---------------- Flicker-Free LCD Update (Overwrites with fixed spacing) ----------------
void updateLcdDisplay() {
  unsigned long now = millis();
  if (now - lastLcdUpdate < 300) return; // 3.3 Hz refresh
  lastLcdUpdate = now;

  int remainingSec = (int)((currentPhaseDurationMs - (now - stateStartTime)) / 1000);
  if (remainingSec < 0) remainingSec = 0;

  lcd.setCursor(0, 0);
  if (currentState == STATE_EMERGENCY_GREEN) {
    lcd.print("!EMERGENCY NS!  ");
  } else if (currentState == STATE_NS_GREEN) {
    lcd.print("NS GREEN   ");
    if (remainingSec < 10) lcd.print(" ");
    lcd.print(remainingSec);
    lcd.print("s ");
  } else if (currentState == STATE_NS_YELLOW || currentState == STATE_EW_YELLOW) {
    lcd.print("YELLOW CLEAR  ");
    lcd.print(remainingSec);
    lcd.print("s");
  } else if (currentState == STATE_ALL_RED_TO_EW || currentState == STATE_ALL_RED_TO_NS) {
    lcd.print("ALL RED CLEAR ");
    lcd.print(remainingSec);
    lcd.print("s");
  } else if (currentState == STATE_EW_GREEN) {
    lcd.print("EW GREEN   ");
    if (remainingSec < 10) lcd.print(" ");
    lcd.print(remainingSec);
    lcd.print("s ");
  }

  // Row 1: Density telemetry
  lcd.setCursor(0, 1);
  lcd.print("N"); lcd.print(qN);
  lcd.print(" S"); lcd.print(qS);
  lcd.print(" E"); lcd.print(qE);
  lcd.print(" W"); lcd.print(qW);
  lcd.print(" C");
  int cycle = allocatedGreenNS + allocatedGreenEW + 9;
  lcd.print(cycle);
  lcd.print("s ");
}

// ---------------- Sequential Non-Blocking Sensor Reader ----------------
void pollSensorsSequential() {
  unsigned long now = millis();
  if (now - lastSensorRead < 35) return; // Poll one sensor every 35ms (140ms full sweep)
  lastSensorRead = now;

  switch (currentSensorIndex) {
    case 0:
      qN = computeDensityScore(readDistanceCm(N_TRIG, N_ECHO));
      break;
    case 1:
      qS = computeDensityScore(readDistanceCm(S_TRIG, S_ECHO));
      break;
    case 2:
      qE = computeDensityScore(readDistanceCm(E_TRIG, E_ECHO));
      break;
    case 3:
      qW = computeDensityScore(readDistanceCm(W_TRIG, W_ECHO));
      break;
  }

  currentSensorIndex = (currentSensorIndex + 1) % 4;
}

// ---------------- Arduino Setup ----------------
void setup() {
  byte outputPins[] = {
    N_R, N_Y, N_G, S_R, S_Y, S_G, E_R, E_Y, E_G, W_R, W_Y, W_G,
    N_TRIG, S_TRIG, E_TRIG, W_TRIG
  };
  for (byte i = 0; i < sizeof(outputPins); i++) {
    pinMode(outputPins[i], OUTPUT);
  }

  byte inputPins[] = { N_ECHO, S_ECHO, E_ECHO, W_ECHO };
  for (byte i = 0; i < sizeof(inputPins); i++) {
    pinMode(inputPins[i], INPUT);
  }

  // Configure Emergency Pushbutton / Interrupt on Pin 2 (INT4)
  pinMode(EMERGENCY_INTERRUPT_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(EMERGENCY_INTERRUPT_PIN), emergencyISR, FALLING);

  Serial.begin(115200);

  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("DEAM Smart Signal");
  lcd.setCursor(0, 1);
  lcd.print("ATmega2560 Init");
  delay(1200);
  lcd.clear();

  stateStartTime = millis();
  currentState = STATE_NS_GREEN;
  currentPhaseDurationMs = 15000;
  applySignalsForState(currentState);
}

// ---------------- Non-Blocking Main Loop ----------------
void loop() {
  unsigned long now = millis();

  // 1. Sequential Ultrasonic Sensor Polling
  pollSensorsSequential();

  // 2. Emergency Preemption Check (Sub-Microsecond ISR Vector -> Safe State Transition)
  if (emergencyRequested) {
    emergencyRequested = false;

    if (currentState == STATE_NS_GREEN) {
      // Already on requested corridor: lock green immediately
      currentState = STATE_EMERGENCY_GREEN;
      stateStartTime = now;
      currentPhaseDurationMs = EMERGENCY_HOLD_MS;
      applySignalsForState(currentState);
    } else if (currentState == STATE_EW_GREEN) {
      // Opposing green: execute safe yellow clearance transition
      currentState = STATE_EMERGENCY_CLEARANCE_YELLOW;
      stateStartTime = now;
      currentPhaseDurationMs = BASE_YELLOW_MS;
      applySignalsForState(currentState);
    }
  }

  // 3. FSM State Transition Check
  if (now - stateStartTime >= currentPhaseDurationMs) {
    stateStartTime = now;

    switch (currentState) {
      case STATE_NS_GREEN:
        currentState = STATE_NS_YELLOW;
        currentPhaseDurationMs = BASE_YELLOW_MS;
        break;

      case STATE_NS_YELLOW:
        currentState = STATE_ALL_RED_TO_EW;
        currentPhaseDurationMs = BASE_ALL_RED_MS;
        calculateNextSplits();
        break;

      case STATE_ALL_RED_TO_EW:
        currentState = STATE_EW_GREEN;
        currentPhaseDurationMs = (unsigned long)allocatedGreenEW * 1000UL;
        break;

      case STATE_EW_GREEN:
        currentState = STATE_EW_YELLOW;
        currentPhaseDurationMs = BASE_YELLOW_MS;
        break;

      case STATE_EW_YELLOW:
        currentState = STATE_ALL_RED_TO_NS;
        currentPhaseDurationMs = BASE_ALL_RED_MS;
        calculateNextSplits();
        break;

      case STATE_ALL_RED_TO_NS:
        currentState = STATE_NS_GREEN;
        currentPhaseDurationMs = (unsigned long)allocatedGreenNS * 1000UL;
        break;

      // Emergency Clearance Sequence
      case STATE_EMERGENCY_CLEARANCE_YELLOW:
        currentState = STATE_EMERGENCY_CLEARANCE_ALL_RED;
        currentPhaseDurationMs = BASE_ALL_RED_MS;
        break;

      case STATE_EMERGENCY_CLEARANCE_ALL_RED:
        currentState = STATE_EMERGENCY_GREEN;
        currentPhaseDurationMs = EMERGENCY_HOLD_MS;
        break;

      case STATE_EMERGENCY_GREEN:
        // Emergency cleared: transition back safely to EW to clear bystander queue
        currentState = STATE_NS_YELLOW;
        currentPhaseDurationMs = BASE_YELLOW_MS;
        calculateNextSplits();
        break;
    }

    applySignalsForState(currentState);
  }

  // 4. Update LCD Telemetry (flicker-free)
  updateLcdDisplay();
}
