# Model Server

A GraphQL-based emergency guidance system that monitors building spaces and broadcasts real-time evacuation directives based on detected hazards.

## Purpose

The Model Server serves as the central control and state management system for a PoE (Power over Ethernet) emergency monitoring network. It maintains device state for multiple rooms or zones, processes sensor inputs (temperature, smoke detection, occupancy), and broadcasts dynamic evacuation guidance to connected dashboard clients.

### Key Capabilities

- Real-time device state management for emergency monitoring
- GraphQL API for queries, mutations, and live subscriptions
- Intelligent evacuation logic that provides spatial guidance (safe, danger zone, evacuation directions)
- WebSocket-based subscription system for low-latency dashboard updates
- Prototype implementation designed for integration with physical sensor networks

## System Architecture

### Backend Components

**index.js**  
Main server entry point. Configures Express HTTP server, GraphQL endpoint (port 5000), WebSocket subscription handler, and GraphiQL interactive interface.

**schema.js**  
GraphQL schema definition including Query (device state retrieval), Mutation (sensor updates and safety overrides), and Subscription (real-time device state changes).

**model.js**  
Core state model. Maintains per-room device objects with properties (temperature, humidity, occupancy, smoke detection, evacuation state, LED directives). Implements danger evaluation logic and evacuation guidance algorithm.

### Frontend Components

**frontend/src/**  
React-based monitoring dashboard. Queries initial device state and subscribes to real-time updates via Apollo Client. Displays room status cards with current sensor readings and evacuation directives.

## Getting Started

### Development Environment

Requirements: Node.js 16+, npm 8+

Install dependencies:
```bash
npm install
cd frontend && npm install && cd ..
```

Run backend tests:
```bash
npm test
```

Start the backend server:
```bash
npm start
```
The GraphQL endpoint will be available at http://localhost:5000

In a separate terminal, start the frontend development server:
```bash
cd frontend && npm start
```
The dashboard will open at http://localhost:3000

### Testing the System

Once both servers are running, you can verify system operation using curl or GraphQL IDE:

Query current device state:
```bash
curl -X POST http://localhost:5000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query{model{getDevice(id:0){temperature evacState danger ledState}}}"}'
```

Trigger a danger condition (temperature above 100°C):
```bash
curl -X POST http://localhost:5000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation{updateSensors(id:0,sensors:{temperature:105}){success}}"}'
```

Watch the frontend dashboard update in real-time as the evacuation state changes for all rooms.

## System Behavior

### Danger Detection

A device transitions to danger state when either condition is met:
- Temperature exceeds `TEMP_DANGER_THRESHOLD` (default 100°C)
- Smoke detection triggered
- Safety override: forceDanger mutation applied

### Evacuation Guidance

When danger is detected in any room, all devices transition to evacuation mode and receive spatial guidance:
- Rooms before the danger zone: EVAC_LEFT
- Danger zone rooms: DANGER
- Rooms after the danger zone: EVAC_RIGHT

This directs occupants toward the nearest safe exit.

### Dashboard Updates

The frontend subscribes to device state changes via GraphQL subscriptions. When any device state changes (sensors, danger flags, LED state, evacuation directives), connected dashboards receive updates within milliseconds.

## Production Deployment

### Container Image Build

[mkosi](https://github.com/systemd/mkosi) creates a minimal, reproducible system image containing all dependencies and the model-server application.

```bash
mkosi
```

This generates `mkosi.output/model-server.raw`, a portable systemd container image.

### Raspberry Pi Installation

Install systemd-container on the target system:
```bash
sudo apt install systemd-container
```

Transfer the image to the Pi and install to portables directory:
```bash
scp mkosi.output/model-server.raw user@pi:/tmp/
ssh user@pi sudo cp /tmp/model-server.raw /usr/local/lib/portables/
```

Attach and enable the service:
```bash
sudo portablectl attach -p trusted --enable --now model-server.raw
```

The service will start automatically and persists across reboots.

## API Reference

### Queries

**model.deviceCount**  
Returns the total number of configured devices.

**model.getDevice(id: Int!)**  
Returns device state for a specified room ID (0-indexed).

```graphql
query {
  model {
    deviceCount
    getDevice(id: 0) {
      danger
      occupied
      temperature
      humidity
      airQuality
      smokeDetected
      ledState
      evacState
      forcedDanger
      forcedOccupancy
    }
  }
}
```

### Mutations

**updateSensors(id: Int!, sensors: DeviceSensors!)**  
Updates sensor readings for a device. Triggers danger evaluation and evacuation logic.

**forceOccupancy(id: Int!, value: Boolean)**  
Override occupancy state for a device (use for testing or manual override).

**forceDanger(id: Int!, value: Boolean)**  
Override danger state for a device (unsafe; only for authorized testing/emergency response).

### Subscriptions

**deviceChanged(id: Int!)**  
Emitted when any field of a device changes (sensors, danger state, evacuation state).

**ledStateChanged(id: Int!)**  
Emitted when LED guidance state changes.

## Configuration

Current runtime configuration options:

**TEMP_DANGER_THRESHOLD** (environment variable)  
Temperature threshold used by danger evaluation. Default: 100

```bash
TEMP_DANGER_THRESHOLD=95 npm start
```

**DEVICE_COUNT** (environment variable)  
Number of monitored rooms/zones. Default: 4

```bash
DEVICE_COUNT=10 npm start
```

**PORT** (environment variable)  
HTTP/WebSocket server port. Default: 5000

```bash
PORT=8080 npm start
```

**NODE_ENV** (environment variable)  
Set to "production" to disable GraphiQL IDE and development endpoints.

## Development Notes

See [CHANGES.md](CHANGES.md) for recent fixes and improvements.
See [DEPENDENCY-REMEDIATION.md](DEPENDENCY-REMEDIATION.md) for the active frontend dependency remediation and CRA migration plan.
See [FLOWCHARTS.md](FLOWCHARTS.md) for detailed architecture and change-impact diagrams.

### Known Limitations

- State is held in memory; restart loses all data
- No persistence layer or audit logging
- No user authentication or authorization
- Supports fixed number of rooms at startup only

These limitations are acceptable for prototype deployments but should be addressed before production safety-critical use.

## Support and Contributing

For issues, feature requests, or questions, contact the development team.

---

**Version:** 1.0.0  
**Last Updated:** April 2026
