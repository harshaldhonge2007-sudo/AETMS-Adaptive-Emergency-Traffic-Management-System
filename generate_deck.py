import os
import pptx
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def create_deck():
    prs = pptx.Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    NAVY = RGBColor(0x1F, 0x4E, 0x79)       # Deep Academic Navy
    SLATE = RGBColor(0x2F, 0x54, 0x96)      # Royal Blue Accent
    DARK_TEXT = RGBColor(0x22, 0x25, 0x2A)  # Body text
    MUTED_TEXT = RGBColor(0x5A, 0x60, 0x65) # Secondary text
    LIGHT_BG = RGBColor(0xF4, 0xF6, 0xFA)   # Card fill
    BORDER_COLOR = RGBColor(0xD2, 0xDC, 0xEC)
    WHITE = RGBColor(0xFF, 0xFF, 0xFF)

    FONT_MAIN = "Calibri"

    def add_header(slide, title_text, category_text="MICROPROCESSORS & DIGITAL ELECTRONICS (DEAM) | COURSE PROJECT"):
        cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.35), Inches(11.733), Inches(0.3))
        tf_cat = cat_box.text_frame
        tf_cat.word_wrap = True
        tf_cat.margin_left = tf_cat.margin_right = tf_cat.margin_top = tf_cat.margin_bottom = 0
        p_cat = tf_cat.paragraphs[0]
        p_cat.text = category_text.upper()
        p_cat.font.name = FONT_MAIN
        p_cat.font.size = Pt(10)
        p_cat.font.bold = True
        p_cat.font.color.rgb = SLATE

        t_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.65), Inches(11.733), Inches(0.65))
        tf = t_box.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        p = tf.paragraphs[0]
        p.text = title_text
        p.font.name = FONT_MAIN
        p.font.size = Pt(23)
        p.font.bold = True
        p.font.color.rgb = NAVY

        line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.35), Inches(11.733), Inches(0.02))
        line.fill.solid()
        line.fill.fore_color.rgb = BORDER_COLOR
        line.line.color.rgb = BORDER_COLOR

        f_box = slide.shapes.add_textbox(Inches(0.8), Inches(7.0), Inches(11.733), Inches(0.3))
        tf_f = f_box.text_frame
        tf_f.margin_left = tf_f.margin_right = tf_f.margin_top = tf_f.margin_bottom = 0
        p_f = tf_f.paragraphs[0]
        p_f.text = "VIT Pune | Department of AI&ML / Computer Engineering | AETMS Project Presentation"
        p_f.font.name = FONT_MAIN
        p_f.font.size = Pt(9.5)
        p_f.font.color.rgb = MUTED_TEXT

    def add_card(slide, left, top, width, height, title, items, card_fill=LIGHT_BG, border_col=BORDER_COLOR):
        shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(left), Inches(top), Inches(width), Inches(height))
        shape.fill.solid()
        shape.fill.fore_color.rgb = card_fill
        shape.line.color.rgb = border_col
        shape.line.width = Pt(1)

        tb = slide.shapes.add_textbox(Inches(left + 0.25), Inches(top + 0.2), Inches(width - 0.5), Inches(height - 0.4))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0

        if title:
            p0 = tf.paragraphs[0]
            p0.text = title
            p0.font.name = FONT_MAIN
            p0.font.size = Pt(15)
            p0.font.bold = True
            p0.font.color.rgb = NAVY
            p0.space_after = Pt(8)

        for i, item in enumerate(items):
            p = tf.add_paragraph() if (title or i > 0) else tf.paragraphs[0]
            p.font.name = FONT_MAIN
            p.font.size = Pt(11.5)
            p.space_after = Pt(6)

            if isinstance(item, tuple):
                bold_part, reg_part = item
                r1 = p.add_run()
                r1.text = bold_part + " "
                r1.font.bold = True
                r1.font.color.rgb = NAVY
                r2 = p.add_run()
                r2.text = reg_part
                r2.font.color.rgb = DARK_TEXT
            else:
                r = p.add_run()
                r.text = item
                r.font.color.rgb = DARK_TEXT

    # =========================================================================
    # SLIDE 1: TITLE SLIDE (VIT Pune Reference)
    # =========================================================================
    s1 = prs.slides.add_slide(blank_layout)
    if os.path.exists("vit_logo.png"):
        s1.shapes.add_picture("vit_logo.png", Inches(0.8), Inches(0.4), width=Inches(1.2))

    col_tb = s1.shapes.add_textbox(Inches(2.2), Inches(0.35), Inches(10.3), Inches(1.5))
    tf_col = col_tb.text_frame
    tf_col.word_wrap = True
    
    p = tf_col.paragraphs[0]
    p.text = "Bansilal Ramnath Agarwal Charitable Trust's"
    p.font.name = "Times New Roman"
    p.font.size = Pt(12)
    p.font.color.rgb = MUTED_TEXT

    p2 = tf_col.add_paragraph()
    p2.text = "VISHWAKARMA INSTITUTE OF TECHNOLOGY, PUNE – 411037"
    p2.font.name = "Times New Roman"
    p2.font.size = Pt(20)
    p2.font.bold = True
    p2.font.color.rgb = NAVY

    p3 = tf_col.add_paragraph()
    p3.text = "(An Autonomous Institute Affiliated to Savitribai Phule Pune University)"
    p3.font.name = "Times New Roman"
    p3.font.size = Pt(11)
    p3.font.color.rgb = MUTED_TEXT

    p4 = tf_col.add_paragraph()
    p4.text = "DEPARTMENT OF COMPUTER SCIENCE / ARTIFICIAL INTELLIGENCE & MACHINE LEARNING"
    p4.font.name = "Times New Roman"
    p4.font.size = Pt(12)
    p4.font.bold = True
    p4.font.color.rgb = SLATE

    t_shape = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(2.2), Inches(11.733), Inches(1.3))
    t_shape.fill.solid()
    t_shape.fill.fore_color.rgb = LIGHT_BG
    t_shape.line.color.rgb = BORDER_COLOR
    t_shape.line.width = Pt(1.5)

    t_tb = s1.shapes.add_textbox(Inches(1.0), Inches(2.3), Inches(11.333), Inches(1.1))
    tf_t = t_tb.text_frame
    tf_t.word_wrap = True
    p_t = tf_t.paragraphs[0]
    p_t.text = "Adaptive Emergency Traffic Management System (AETMS)"
    p_t.font.name = "Times New Roman"
    p_t.font.size = Pt(26)
    p_t.font.bold = True
    p_t.font.color.rgb = NAVY
    p_t.alignment = PP_ALIGN.CENTER

    p_sub = tf_t.add_paragraph()
    p_sub.text = "Microprocessor & Digital Electronics (DEAM) Course Project Presentation"
    p_sub.font.name = "Times New Roman"
    p_sub.font.size = Pt(14)
    p_sub.font.color.rgb = SLATE
    p_sub.alignment = PP_ALIGN.CENTER

    pres_shape = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(3.8), Inches(5.7), Inches(2.3))
    pres_shape.fill.solid()
    pres_shape.fill.fore_color.rgb = WHITE
    pres_shape.line.color.rgb = BORDER_COLOR

    pres_tb = s1.shapes.add_textbox(Inches(1.0), Inches(3.95), Inches(5.3), Inches(2.0))
    tf_pres = pres_tb.text_frame
    tf_pres.word_wrap = True
    p_h = tf_pres.paragraphs[0]
    p_h.text = "Presented by (Team Group 08):"
    p_h.font.name = "Times New Roman"
    p_h.font.size = Pt(14)
    p_h.font.bold = True
    p_h.font.color.rgb = NAVY
    p_h.space_after = Pt(6)

    members = [
        "1. Harshal Dhonge — Roll No: 1030230",
        "2. Nishad Dhokane — Roll No: 1030229",
        "3. Diksha Mann — Roll No: 1030232",
        "4. Huzefa Gandhi — Roll No: 1030245"
    ]
    for m in members:
        pm = tf_pres.add_paragraph()
        pm.text = m
        pm.font.name = "Times New Roman"
        pm.font.size = Pt(12)
        pm.font.color.rgb = DARK_TEXT

    guide_shape = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.8), Inches(3.8), Inches(5.733), Inches(2.3))
    guide_shape.fill.solid()
    guide_shape.fill.fore_color.rgb = WHITE
    guide_shape.line.color.rgb = BORDER_COLOR

    guide_tb = s1.shapes.add_textbox(Inches(7.0), Inches(3.95), Inches(5.3), Inches(2.0))
    tf_g = guide_tb.text_frame
    tf_g.word_wrap = True
    pg_h = tf_g.paragraphs[0]
    pg_h.text = "Project Guidance & Course Details:"
    pg_h.font.name = "Times New Roman"
    pg_h.font.size = Pt(14)
    pg_h.font.bold = True
    pg_h.font.color.rgb = NAVY
    pg_h.space_after = Pt(6)

    details = [
        "Course: Microprocessors and Digital Electronics (DEAM)",
        "Faculty Guide: Course Faculty / Project Mentor",
        "Hardware: Arduino MEGA 2560 (ATmega2560) + HC-SR04 Sensors",
        "Division: B   |   Group: 08   |   Academic Year: 2025–2026"
    ]
    for d in details:
        pd = tf_g.add_paragraph()
        pd.text = d
        pd.font.name = "Times New Roman"
        pd.font.size = Pt(12)
        pd.font.color.rgb = DARK_TEXT

    b_tb = s1.shapes.add_textbox(Inches(0.8), Inches(6.4), Inches(11.733), Inches(0.5))
    tf_b = b_tb.text_frame
    p_b = tf_b.paragraphs[0]
    p_b.text = "Division: B      |      Group No: 08      |      Academic Year: 2025–2026      |      DEAM Project Review"
    p_b.font.name = "Times New Roman"
    p_b.font.size = Pt(11)
    p_b.font.bold = True
    p_b.font.color.rgb = MUTED_TEXT
    p_b.alignment = PP_ALIGN.CENTER

    # =========================================================================
    # SLIDE 2: INTRODUCTION & PROBLEM STATEMENT
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    add_header(s2, "1. Introduction & Problem Statement")

    add_card(s2, 0.8, 1.6, 5.7, 5.0, "The Real-World Traffic Problem", [
        ("Urban Congestion:", "Intersections suffer from long vehicle queues and high idle times, leading to wasted fuel and commuter frustration."),
        ("Ambulance Delays:", "Emergency vehicles (ambulances and fire engines) get trapped in static queues, losing critical minutes during the 'Golden Hour'."),
        ("Fixed-Timer Signal Flaws:", "Traditional signals run on rigid pre-timed countdowns. They give green lights to empty roads while heavily congested roads stay stopped."),
        ("Lack of Emergency Priority:", "Standard signals cannot detect approaching emergency vehicles or adjust timing without manual traffic police intervention.")
    ])

    add_card(s2, 6.8, 1.6, 5.733, 5.0, "Proposed Solution & Objectives", [
        ("Core Project Goal:", "Build a low-cost, smart traffic management system that senses live vehicle queues and instantly clears lanes for emergency vehicles."),
        ("Adaptive Green Allocation:", "Dynamically allocate green light duration based on real-time vehicle density using ultrasonic sensors."),
        ("Instant Priority Preemption:", "A dedicated hardware interrupt clears the emergency corridor within seconds while maintaining safe yellow transitions."),
        ("Fail-Safe Operation:", "Guaranteed minimum green (5s) to avoid cross-road starvation and strict interlock logic to prevent conflicting greens.")
    ])

    # =========================================================================
    # SLIDE 3: WORKING METHODOLOGY & CONTROL LOGIC
    # =========================================================================
    s3 = prs.slides.add_slide(blank_layout)
    add_header(s3, "2. Working Methodology & Control Logic")

    add_card(s3, 0.8, 1.6, 5.7, 5.0, "Step-by-Step System Flow", [
        ("1. Distance & Queue Sensing:", "4× HC-SR04 ultrasonic sensors measure distance to vehicles on North, South, East, and West lanes to estimate queue density."),
        ("2. Status Display:", "A 16×2 I2C LCD displays live vehicle counts, current active phase, and countdown timers in real time."),
        ("3. Dynamic Green Calculation:", "Controller calculates green splits proportional to queue demand using the modified Webster formula."),
        ("4. Safe Clearance Transitions:", "Enforces a mandatory 3-second Yellow light and a 1-second All-Red safety buffer before switching traffic phases."),
        ("5. Emergency Override (INT0):", "An external interrupt immediately triggers a priority sequence, overriding standard timing to clear emergency vehicles.")
    ])

    add_card(s3, 6.8, 1.6, 5.733, 5.0, "Simple Mathematical Rules", [
        ("Dynamic Green Formula (Webster Method):", ""),
        ("Green Time = Clamp(5s, Total_Cycle * (Lane_Cars / Total_Cars), 30s)", ""),
        ("Anti-Starvation Clamp (Min 5s):", "Guarantees low-traffic side streets always receive minimum green time, preventing infinite waiting."),
        ("Congestion Cap (Max 30s):", "Prevents a heavy corridor from monopolizing the junction indefinitely."),
        ("Emergency Preemption ISR Routine:", ""),
        ("• Switch current green to Yellow (3s) immediately", ""),
        ("• Set ALL phases RED (1s) to clear the junction safely", ""),
        ("• Grant Emergency Lane GREEN until vehicle clears or timeout (20s)", ""),
        ("• Resume normal dynamic cycle smoothly")
    ])

    # =========================================================================
    # SLIDE 4: TECHNOLOGY STACK
    # =========================================================================
    s4 = prs.slides.add_slide(blank_layout)
    add_header(s4, "3. Technology Stack & Component Selection")

    add_card(s4, 0.8, 1.6, 5.7, 5.0, "Hardware Components (Circuit Tested)", [
        ("Arduino MEGA 2560 (ATmega2560):", "High-capacity 8-bit AVR microcontroller running at 16 MHz with 54 digital I/O pins, 16 analog pins, and 6 external interrupts (INT0–INT5)."),
        ("4× HC-SR04 Ultrasonic Sensors:", "Positioned on each road approach to measure distance to vehicles, providing accurate queue length measurement."),
        ("16×2 I2C LCD Display Module:", "Displays real-time lane vehicle counts, active signal phase, and emergency alerts using just 2 communication wires (SDA/SCL)."),
        ("12× Signal LEDs (R, Y, G × 4):", "High-intensity Red, Yellow, and Green LEDs per approach with 220Ω current-limiting resistors.")
    ])

    add_card(s4, 6.8, 1.6, 5.733, 5.0, "Software, Tools & Feasibility", [
        ("Embedded C / Arduino IDE:", "Direct pin manipulation, pulseIn() distance timing, and hardware interrupt service routines (ISR)."),
        ("Tinkercad / Wokwi EDA Simulation:", "Interactive virtual breadboard model for complete circuit validation and timing verification before hardware assembly."),
        ("DEAM Web Simulator (React + Canvas):", "Custom 60 FPS physics engine modeling a 2×2 grid of 4 coordinated intersections with real-time delay analytics."),
        ("Low Student Budget (₹1,200 – ₹1,500):", "Readily available, highly affordable components perfect for a 2nd-year engineering laboratory project.")
    ])

    # =========================================================================
    # SLIDE 5: SYSTEM ARCHITECTURE & TINKERCAD HARDWARE PROTOTYPE
    # =========================================================================
    s5 = prs.slides.add_slide(blank_layout)
    add_header(s5, "4. System Architecture & Hardware Prototype")

    # Left: Text description
    add_card(s5, 0.8, 1.6, 5.2, 5.0, "Architectural Subsystems", [
        ("1. Input Sensing (4× HC-SR04):", "Ultrasonic sensors send 10µs trigger pulses and measure echo response time to calculate distance to waiting cars on 4 lanes."),
        ("2. I2C LCD Telemetry:", "16×2 LCD connected via SDA (Pin 20) and SCL (Pin 21) provides real-time local status for commuters and operators."),
        ("3. Processing Core (Arduino Mega):", "Processes echo pulse widths, computes proportional green splits, and schedules phase switches."),
        ("4. Priority Interrupt Line:", "External interrupt pin immediately triggers priority corridor on emergency request."),
        ("5. Output Display (12 LEDs):", "Direct digital drive of 4 Red, 4 Yellow, and 4 Green LEDs with series current-limiting resistors.")
    ])

    # Right: Embedded circuit image if available
    img_circuit = "circuit_simulation_tinkercad.png"
    if os.path.exists(img_circuit):
        s5.shapes.add_picture(img_circuit, Inches(6.2), Inches(1.6), width=Inches(6.333))
        # Caption box
        cap_box = s5.shapes.add_textbox(Inches(6.2), Inches(5.9), Inches(6.333), Inches(0.7))
        tf_cap = cap_box.text_frame
        tf_cap.word_wrap = True
        p_c = tf_cap.paragraphs[0]
        p_c.text = "Tinkercad / Wokwi Hardware Prototype: Arduino MEGA 2560 interfaced with 16x2 I2C LCD, 4x HC-SR04 Ultrasonic Sensors, and 12x Traffic Signal LEDs."
        p_c.font.name = FONT_MAIN
        p_c.font.size = Pt(10.5)
        p_c.font.bold = True
        p_c.font.color.rgb = SLATE

    # =========================================================================
    # SLIDE 6: CIRCUIT INTERFACING & SAFETY MECHANISMS
    # =========================================================================
    s6 = prs.slides.add_slide(blank_layout)
    add_header(s6, "4. Circuit Interfacing & Safety Mechanisms")

    add_card(s6, 0.8, 1.6, 5.7, 5.0, "Interfacing & Communication Details", [
        ("I2C Bus Communication:", "The 16×2 LCD uses PCF8574 I2C backpack connected to SDA (Pin 20) and SCL (Pin 21) on Arduino Mega, saving 6 GPIO pins."),
        ("Ultrasonic Distance Timing:", "Sends a 10µs HIGH trigger pulse. The distance is calculated from Echo pulse duration: Distance = (Duration * 0.034 cm/µs) / 2."),
        ("Current-Limiting Resistors (220Ω):", "Placed in series with each of the 12 LEDs to limit current to ~15mA per pin, safely protecting Arduino Mega I/O ports."),
        ("Clean Power Rail Distribution:", "Regulated 5V and GND bus rails power all 4 ultrasonic sensors, the I2C LCD, and the LED array simultaneously.")
    ])

    add_card(s6, 6.8, 1.6, 5.733, 5.0, "Fail-Safe Safety Features", [
        ("Instant Interrupt Action (INT0):", "Hardware interrupt pin PD2 acts like an emergency alarm — stops normal delay execution in under 1 microsecond without waiting for code loops."),
        ("Accident & Capacity Collapse:", "If a collision blocks a lane, the system detects zero flow, downweights that lane's green time, and reallocates time to cross-traffic."),
        ("Weather-Adaptive Clearance:", "During rain or fog, braking distances increase. The controller automatically widens Yellow clearance (+1.5s) and adds All-Red safety buffers."),
        ("No Conflicting Green Lights:", "Software state machine guarantees that opposing green lights are mutually exclusive, eliminating collision hazards.")
    ])

    # =========================================================================
    # SLIDE 7: RESULTS & LIVE SIMULATION PROOF
    # =========================================================================
    s7 = prs.slides.add_slide(blank_layout)
    add_header(s7, "5. Live Simulation Results & Performance Proof")

    # Left: Key Metrics Card
    add_card(s7, 0.8, 1.6, 4.8, 5.0, "Quantitative Results", [
        ("38% Delay Reduction:", "Average vehicle delay reduced from 35.0s (Fixed-Time Baseline) down to 21.5s with Adaptive Webster."),
        ("2×2 Coordinated Grid:", "Tested on 4 connected intersections (NW, NE, SW, SE) modeling real multi-corridor arterial traffic."),
        ("Throughput Verification:", "Over 147 completed trips recorded in real time with continuous queue-pressure optimization."),
        ("Instant Preemption:", "Ambulances clear junctions in < 5 seconds with zero gridlock spillback."),
        ("Interactive Weather & Accident Tests:", "Successfully tested under Clear, Rain, Fog, and simulated lane collisions.")
    ])

    # Right: Embedded DEAM Web Simulator image
    img_web = "web_simulation_dashboard.png"
    if os.path.exists(img_web):
        s7.shapes.add_picture(img_web, Inches(5.8), Inches(1.6), width=Inches(6.733))
        cap_box2 = s7.shapes.add_textbox(Inches(5.8), Inches(5.9), Inches(6.733), Inches(0.7))
        tf_cap2 = cap_box2.text_frame
        tf_cap2.word_wrap = True
        p_c2 = tf_cap2.paragraphs[0]
        p_c2.text = "DEAM Interactive Simulation Engine: Live 2x2 grid physics, scenario injectors (Emergency, Crash, Weather), and live Recharts showing 38% delay reduction vs fixed time."
        p_c2.font.name = FONT_MAIN
        p_c2.font.size = Pt(10.5)
        p_c2.font.bold = True
        p_c2.font.color.rgb = SLATE

    # =========================================================================
    # SLIDE 8: WORK DISTRIBUTION
    # =========================================================================
    s8 = prs.slides.add_slide(blank_layout)
    add_header(s8, "6. Team Work Distribution")

    table_shape8 = s8.shapes.add_table(5, 4, Inches(0.8), Inches(1.6), Inches(11.733), Inches(4.8))
    table8 = table_shape8.table

    h8 = ["Team Member & Roll No.", "Role / Area", "Key Technical Responsibilities", "Project Deliverables"]
    for c_idx, h in enumerate(h8):
        cell = table8.cell(0, c_idx)
        cell.text = h
        cell.fill.solid()
        cell.fill.fore_color.rgb = NAVY
        p = cell.text_frame.paragraphs[0]
        p.font.name = FONT_MAIN
        p.font.size = Pt(12)
        p.font.bold = True
        p.font.color.rgb = WHITE
        p.alignment = PP_ALIGN.CENTER

    data8 = [
        ("Harshal Dhonge\n(1030230)", "Microcontroller Firmware & Algorithm Lead", "• Write Arduino Mega / ATmega2560 C++ code\n• Configure hardware timers & INT0 interrupt\n• Implement Webster dynamic split calculation", "Clean firmware code (.ino/.cpp), ISR logic, timing state machine"),
        ("Nishad Dhokane\n(1030229)", "Circuit Interfacing & Hardware Prototype", "• Build Tinkercad/Wokwi simulation circuit\n• Wire 4× HC-SR04 sensors & 16×2 I2C LCD\n• Connect 12 signal LEDs & current-limiting resistors", "Interactive Tinkercad model, wiring diagram, breadboard prototype"),
        ("Diksha Mann\n(1030232)", "Simulation, Testing & Performance Analytics", "• Test scenarios: normal, congested & emergency\n• Log average delay & throughput metrics\n• Compare adaptive results vs. fixed-time baseline", "Performance comparison charts, test logbook, simulation records"),
        ("Huzefa Gandhi\n(1030245)", "System Architecture, Budget & Documentation", "• Draw system block diagrams & flowcharts\n• Compile prototype Bill of Materials (BOM)\n• Create project report & final presentation deck", "System architecture diagrams, budget sheet, PowerPoint presentation")
    ]

    for r_idx, row in enumerate(data8):
        for c_idx, val in enumerate(row):
            cell = table8.cell(r_idx + 1, c_idx)
            cell.text = val
            cell.fill.solid()
            cell.fill.fore_color.rgb = WHITE if r_idx % 2 == 0 else LIGHT_BG
            p = cell.text_frame.paragraphs[0]
            p.font.name = FONT_MAIN
            p.font.size = Pt(11)
            p.font.color.rgb = DARK_TEXT

    table8.columns[0].width = Inches(2.3)
    table8.columns[1].width = Inches(2.4)
    table8.columns[2].width = Inches(4.5)
    table8.columns[3].width = Inches(2.533)

    # =========================================================================
    # SLIDE 9: IMPACT, FEASIBILITY & FUTURE SCOPE
    # =========================================================================
    s9 = prs.slides.add_slide(blank_layout)
    add_header(s9, "7. Impact, Feasibility & Future Roadmap")

    add_card(s9, 0.8, 1.6, 5.7, 5.0, "Societal Impact & Prototype Budget", [
        ("Saves Lives During Emergencies:", "Reduces ambulance transit delays by creating an immediate green corridor, helping patients reach hospitals faster."),
        ("Cuts Fuel Waste & Emissions:", "Reduces vehicle idling at empty traffic signals, lowering city fuel consumption and greenhouse gas emissions."),
        ("Itemized Prototype Budget (INR):", ""),
        ("• Arduino MEGA 2560 Board: ₹650 – ₹800", ""),
        ("• 4× HC-SR04 Ultrasonic Sensors: ₹240 – ₹320", ""),
        ("• 16×2 I2C LCD Display Module: ₹180 – ₹220", ""),
        ("• 12× Signal LEDs, Resistors & Wires: ₹150 – ₹200", ""),
        ("• Breadboard & Junction Model Base: ₹200 – ₹300", ""),
        ("Total Estimated Cost: ₹1,420 – ₹1,840 INR (Highly Feasible)")
    ])

    add_card(s9, 6.8, 1.6, 5.733, 5.0, "Prototype Limits & Future Scope", [
        ("Prototype vs. Real Roadways:", ""),
        ("• Ultrasonic sensors work well at short range; outdoor roads face dust, rain, and multi-vehicle occlusion.", ""),
        ("• Real intersections feature pedestrian crossings, dedicated turn bays, and high-voltage 230V AC fixtures.", ""),
        ("Future Roadmap:", ""),
        ("• Wireless V2I / RF Communication: Ambulances broadcast encrypted priority requests from 500m away.", ""),
        ("• Camera-Based AI Counting: Edge cameras count cars and differentiate vehicles (cars, buses, bikes, ambulances).", ""),
        ("• City-Wide Connected Signals: Network adjacent controllers via LoRa or CAN bus for city-wide synchronized green waves.")
    ])

    # =========================================================================
    # SLIDE 10: REFERENCES & VIVA CHEATSHEET
    # =========================================================================
    s10 = prs.slides.add_slide(blank_layout)
    add_header(s10, "8. References & Viva Defense Preparation")

    add_card(s10, 0.8, 1.6, 5.7, 5.0, "Credible Academic References", [
        ("1. F. V. Webster (1958):", "'Traffic Signal Settings', Road Research Paper No. 39. (Foundational mathematical formula for delay-minimizing green splits)."),
        ("2. FHWA Signal Timing Manual (2008):", "U.S. Dept of Transportation Report FHWA-HOP-08-024 on emergency vehicle preemption and safe clearance intervals."),
        ("3. IEEE Transactions on ITS (2017):", "Y. Shen et al., 'Traffic Safety Control Systems for Emergency Vehicle Preemption Using Timed Petri Nets' (DOI: 10.1109/TITS.2017.2683490)."),
        ("4. Microchip ATmega2560 / 328P Datasheet:", "Official technical documentation for AVR timers, I2C bus, and external hardware interrupts."),
        ("5. M. Morris Mano, Digital Design (6th Ed):", "Standard textbook for finite state machines, interfacing, and hardware interlock logic.")
    ])

    add_card(s10, 6.8, 1.6, 5.733, 5.0, "Top 3 Viva Questions & Confident Answers", [
        ("Q1: Why use an External Hardware Interrupt (INT0) instead of a regular polling loop for emergency vehicles?", ""),
        ("Answer: A polling loop only checks inputs after completing its delay loops (which could take 20+ seconds). An external interrupt acts like an instant alarm, pausing normal execution in microseconds to ensure ambulance safety."),
        ("Q2: How do you prevent cross-street traffic from starving?", ""),
        ("Answer: The Webster algorithm is clamped to strict boundaries (Minimum 5s, Maximum 30s). Even if one road has zero cars, it still receives a minimum 5-second green so no commuter is stranded."),
        ("Q3: Why use I2C for the LCD instead of standard 4-bit parallel mode?", ""),
        ("Answer: Standard LCDs require 6 to 10 GPIO pins. The PCF8574 I2C module uses only 2 communication lines (SDA and SCL), keeping pins free for sensors and LEDs.")
    ])

    prs.save("AETMS_DEAM_Presentation.pptx")
    print("Successfully generated updated presentation with embedded reference images at AETMS_DEAM_Presentation.pptx!")

if __name__ == "__main__":
    create_deck()
