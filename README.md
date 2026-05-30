# Rythmio

**Low-Cost ECG Holter**

## System Overview
EROS is an integrated, low-cost ambulatory electrocardiogram (ECG) monitoring system designed for continuous cardiac acquisition. The project encompasses a custom-designed hardware front-end, an embedded microcontroller executing a Real-Time Operating System (RTOS), a mobile application for data telemetry and visualization, and mechanical CAD designs for the device housing.

## Repository Structure

* **`3D Models/`**: Mechanical CAD files defining the physical enclosure.
* **`Embedded Software/`**: Firmware implemented in C and C++ operating within an RTOS framework. This directory includes hardware abstraction layers, deterministic task scheduling, and peripheral drivers.
* **`Media/`**: Visual documentation and media assets detailing the prototype iterations.
* **`MobileApp/`**: React Native based mobile application source code responsible for device configuration, state monitoring, and telemetry data parsing.
* **`PCB/`**: Schematic diagrams, printed circuit board layouts, and documentation of the boards.
* **`Prototype/`**: Complete implementation of initial hardware and software version.
* **`Software/PCB_Software/`**: Auxiliary software utilities designed for debugging, test automation, and preliminary board bring-up.
