#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

// ---------------- Traffic light pins ----------------
// Each approach has: RED, YELLOW, GREEN
const byte N_R = 22, N_Y = 23, N_G = 24;
const byte S_R = 25, S_Y = 26, S_G = 27;
const byte E_R = 28, E_Y = 29, E_G = 30;
const byte W_R = 31, W_Y = 32, W_G = 33;

// ---------------- Ultrasonic sensor pins ----------------
const byte N_TRIG = 34, N_ECHO = 35;
const byte S_TRIG = 36, S_ECHO = 37;
const byte E_TRIG = 38, E_ECHO = 39;
const byte W_TRIG = 40, W_ECHO = 41;

// ---------------- Timing ----------------
const int MIN_GREEN = 5;
const int MAX_GREEN = 30;
const int YELLOW_TIME = 3;
const unsigned long ALL_RED_MS = 1500;

// Read all sensors at the start of every cycle.
int distanceCm(byte trigPin, byte echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  unsigned long duration = pulseIn(echoPin, HIGH, 25000UL);
  if (duration == 0) return 400;  // no vehicle / out of range

  return (int)(duration / 58UL);
}

// 1 = low, 2 = medium, 3 = high density.
int densityScore(int distance) {
  if (distance < 10) return 3;
  if (distance < 25) return 2;
  return 1;
}

void setAllLow() {
  digitalWrite(N_R, LOW); digitalWrite(N_Y, LOW); digitalWrite(N_G, LOW);
  digitalWrite(S_R, LOW); digitalWrite(S_Y, LOW); digitalWrite(S_G, LOW);
  digitalWrite(E_R, LOW); digitalWrite(E_Y, LOW); digitalWrite(E_G, LOW);
  digitalWrite(W_R, LOW); digitalWrite(W_Y, LOW); digitalWrite(W_G, LOW);
}

void nsGreen() {
  // North + South GREEN, East + West RED
  setAllLow();
  digitalWrite(N_G, HIGH);
  digitalWrite(S_G, HIGH);
  digitalWrite(E_R, HIGH);
  digitalWrite(W_R, HIGH);
}

void nsYellow() {
  setAllLow();
  digitalWrite(N_Y, HIGH);
  digitalWrite(S_Y, HIGH);
  digitalWrite(E_R, HIGH);
  digitalWrite(W_R, HIGH);
}

void ewGreen() {
  // East + West GREEN, North + South RED
  setAllLow();
  digitalWrite(N_R, HIGH);
  digitalWrite(S_R, HIGH);
  digitalWrite(E_G, HIGH);
  digitalWrite(W_G, HIGH);
}

void ewYellow() {
  setAllLow();
  digitalWrite(N_R, HIGH);
  digitalWrite(S_R, HIGH);
  digitalWrite(E_Y, HIGH);
  digitalWrite(W_Y, HIGH);
}

void allRed() {
  setAllLow();
  digitalWrite(N_R, HIGH);
  digitalWrite(S_R, HIGH);
  digitalWrite(E_R, HIGH);
  digitalWrite(W_R, HIGH);
}

// Keep the LCD useful during long green periods.
void showPhase(const char* phase, int seconds,
               int n, int s, int e, int w) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(phase);
  lcd.print(" ");
  lcd.print(seconds);
  lcd.print("s");

  lcd.setCursor(0, 1);
  lcd.print("N");
  lcd.print(n);
  lcd.print(" S");
  lcd.print(s);
  lcd.print(" E");
  lcd.print(e);
  lcd.print(" W");
  lcd.print(w);
}

void countdown(const char* phase, int seconds,
               int n, int s, int e, int w) {
  for (int remaining = seconds; remaining > 0; remaining--) {
    showPhase(phase, remaining, n, s, e, w);
    delay(1000);
  }
}

void setup() {
  byte outputPins[] = {
    N_R,N_Y,N_G,S_R,S_Y,S_G,E_R,E_Y,E_G,W_R,W_Y,W_G
  };

  for (byte i = 0; i < sizeof(outputPins); i++) {
    pinMode(outputPins[i], OUTPUT);
  }

  byte trigPins[] = {N_TRIG,S_TRIG,E_TRIG,W_TRIG};
  byte echoPins[] = {N_ECHO,S_ECHO,E_ECHO,W_ECHO};

  for (byte i = 0; i < 4; i++) {
    pinMode(trigPins[i], OUTPUT);
    pinMode(echoPins[i], INPUT);
  }

  Serial.begin(115200);

  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Adaptive Traffic");
  lcd.setCursor(0, 1);
  lcd.print("System Starting");
  delay(1500);
}

void loop() {
  // -------- 1. Measure four approach densities --------
  int dN = distanceCm(N_TRIG, N_ECHO);
  delay(30);
  int dS = distanceCm(S_TRIG, S_ECHO);
  delay(30);
  int dE = distanceCm(E_TRIG, E_ECHO);
  delay(30);
  int dW = distanceCm(W_TRIG, W_ECHO);

  int qN = densityScore(dN);
  int qS = densityScore(dS);
  int qE = densityScore(dE);
  int qW = densityScore(dW);

  // -------- 2. Aggregate opposite approaches --------
  // NS and EW are operated as two non-conflicting phases.
  int nsDensity = qN + qS;
  int ewDensity = qE + qW;
  int totalDensity = nsDensity + ewDensity;

  // Webster-style proportional allocation with min/max limits.
  int greenNS = (int)((long)30 * nsDensity / totalDensity);
  int greenEW = (int)((long)30 * ewDensity / totalDensity);

  greenNS = constrain(greenNS, MIN_GREEN, MAX_GREEN);
  greenEW = constrain(greenEW, MIN_GREEN, MAX_GREEN);

  Serial.print("Distance N/S/E/W: ");
  Serial.print(dN); Serial.print("/");
  Serial.print(dS); Serial.print("/");
  Serial.print(dE); Serial.print("/");
  Serial.println(dW);

  Serial.print("Density N/S/E/W: ");
  Serial.print(qN); Serial.print("/");
  Serial.print(qS); Serial.print("/");
  Serial.print(qE); Serial.print("/");
  Serial.println(qW);

  Serial.print("Green NS/EW: ");
  Serial.print(greenNS);
  Serial.print("s / ");
  Serial.print(greenEW);
  Serial.println("s");
  Serial.println();

  // -------- 3. NS phase --------
  nsGreen();
  countdown("NS GREEN", greenNS, qN, qS, qE, qW);

  nsYellow();
  countdown("NS YELLOW", YELLOW_TIME, qN, qS, qE, qW);

  allRed();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("ALL RED");
  lcd.setCursor(0, 1);
  lcd.print("Clearance 1.5s");
  delay(ALL_RED_MS);

  // -------- 4. EW phase --------
  ewGreen();
  countdown("EW GREEN", greenEW, qN, qS, qE, qW);

  ewYellow();
  countdown("EW YELLOW", YELLOW_TIME, qN, qS, qE, qW);

  allRed();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("ALL RED");
  lcd.setCursor(0, 1);
  lcd.print("Clearance 1.5s");
  delay(ALL_RED_MS);
}
