# Adaptive (Density-Based) Traffic Signal System

## Wokwi version
This version uses an Arduino Mega because the complete 4-way design needs more GPIO than an Uno when using 4 ultrasonic sensors, 12 LEDs, and an I2C LCD.

### Components
- Arduino Mega 2560
- 4 x HC-SR04 ultrasonic sensors (N/S/E/W)
- 12 x LEDs (red/yellow/green for N/S/E/W)
- 12 x 220 ohm resistors
- 16x2 I2C LCD

### Pin map
Traffic LEDs:
- North: R22 Y23 G24
- South: R25 Y26 G27
- East:  R28 Y29 G30
- West:  R31 Y32 G33

Ultrasonic sensors:
- North TRIG34 ECHO35
- South TRIG36 ECHO37
- East  TRIG38 ECHO39
- West  TRIG40 ECHO41

LCD:
- SDA20
- SCL21

### Density
- <10 cm = 3 (high)
- 10-24 cm = 2 (medium)
- >=25 cm = 1 (low)

The controller sums N+S and E+W densities, allocates green time proportionally, and limits each green to 5–30 seconds. Yellow is 3 seconds and all-red clearance is 1.5 seconds.

## Wokwi
Create a new Arduino Mega project, replace its `sketch.ino` and `diagram.json` with the files in this folder, then run the simulation.
