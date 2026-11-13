# AI-Based Smart Industrial Safety Dashboard

This Vite + React app is the live dashboard for the quotation-backed project:

- Project: `AI-Based Smart Industrial Safety and Predictive Hazard Monitoring System`
- Quotation reference: `SPN-27072026-KS5587`
- Contact: `+91 88619-38913` / `info@spherenex.com`

## What the dashboard covers

- Realtime Firebase monitoring for temperature, gas/smoke, fire, relays, and wearable data
- AI camera fire detection in the browser
- Automatic relay support for ventilation and water spray
- Worker health cards for heart rate, pulse, SpO2, and blood pressure
- Alert banners and overall system condition states
- Quotation summary and project contact details directly in the UI

## Firebase path

The app reads from:

- `AI-Based_Smart_Industrial_5634`

Supported field names include these aliases:

- Temperature: `Temp`, `Temperature`
- Gas / smoke: `Gas`, `Smoke`, `AirQuality`
- Fire: `Fire`
- Fan relay: `Relay1`, `Fan`
- Pump relay: `Relay2`, `Pump`
- Heart rate: `HR`, `HeartRate`
- Pulse: `Pulse`
- SpO2: `Spo2`, `SpO2`
- Blood pressure: `BP`, `BloodPressure`

## Local setup

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
