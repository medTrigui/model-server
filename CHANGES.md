# Recent Changes and Fixes

## Overview
This document describes critical fixes applied to the model-server codebase to resolve subscription event propagation issues and improve system reliability.

---



## Changes Applied

### 1. WebSocket Subscription Path Correction
**File:** `frontend/src/app.js`  
**Severity:** Critical

The frontend WebSocket client was attempting to connect to an incorrect path that did not match the backend configuration.

**Issue:**
- Frontend configuration: `ws://${window.location.host}/graphqlws`
- Backend configuration: WebSocket server listening on path `/`
- Result: Subscription connections would fail to establish

**Resolution:**
- Added env-aware GraphQL endpoints in the frontend so local development can talk directly to the backend when the proxy path is unavailable.
- Enabled permissive CORS on the backend to support direct frontend requests during local development.
- Updated frontend WebSocket endpoint handling to use the local backend directly in development and the proxied `/graphqlws` path elsewhere.
- Added `model.deviceCount` query field and switched frontend room rendering to use backend-reported device count.
- Subscriptions now connect correctly and receive real-time device state updates

**Testing:**
- Verified mutation triggers properly propagate state changes to subscribers
- Confirmed evacuation state changes broadcast to connected clients

---

### 2. Evacuation State Event Emission
**File:** `model.js`  
**Severity:** Critical

The application logic failed to emit events when evacuation state (evacState) changed, preventing real-time updates from reaching frontend subscribers.

**Issue:**
- `setEvacState()` method directly modified state without emitting any event
- Frontend subscriptions receive `deviceChanged` events only
- When evacuation state changed during danger logic, subscribers were not notified
- Frontend displays might show stale evacuation state

**Before:**
```javascript
setEvacState(evacState) {
    this.evacState = evacState;
}
```

**After:**
```javascript
setEvacState(evacState) {
    let needsUpdate = evacState !== this.evacState;
    this.evacState = evacState;
    if (needsUpdate) this.emit('deviceChanged', this);
}
```

**Resolution:**
- Added change detection to `setEvacState()`
- Method now emits `deviceChanged` event when evacuation state actually transitions
- Prevents redundant events when state does not change
- Matches event emission pattern used by `setLedState()`

**Testing:**
- Temperature threshold exceeded (105°C) on device 0
- Confirmed all devices receive evacuation state update to "EVAC"
- Verified spatial guidance logic correctly assigns LED directions (EVAC_LEFT, DANGER, EVAC_RIGHT)

---

### 3. PubSub Instance Caching
**File:** `schema.js`  
**Severity:** High

The subscription resolver created a new PubSub instance for every subscription request, resulting in memory inefficiency and potential event ordering issues.

**Issue:**
- Every subscription to the same device created a separate PubSub wrapper
- Multiple event listeners registered for the same device EventEmitter
- Memory accumulation over time as subscriptions were created and destroyed
- Potential race conditions with multiple listeners competing for events

**Before:**
```javascript
subscribe: (_, {id}) => {
  if (0 <= id && id < model.devices.length) {
    let pubsub = new PubSub({eventEmitter: model.devices[id]});
    return pubsub.asyncIterableIterator("deviceChanged");
  }
}
```

**After:**
- Introduced caching mechanism at module level
- PubSub instances now created once per device and reused for all subscriptions
- EventEmitter continues to emit events once; all subscribers receive same events

**Resolution:**
```javascript
const pubsubCache = new Map();
function getPubSub(device) {
  if (!pubsubCache.has(device)) {
    pubsubCache.set(device, new PubSub({eventEmitter: device}));
  }
  return pubsubCache.get(device);
}
```

Subscriptions updated to use: `let pubsub = getPubSub(model.devices[id])`

**Testing:**
- Verified multiple simultaneous subscriptions receive same events
- Confirmed no listener accumulation

### 5. Repository Analysis and Reliability Hardening (April 2026)
**Files:** `schema.js`, `model.js`, `frontend/src/app.js`, `frontend/src/setupProxy.js`, `README.md`  
**Severity:** High

Detailed review of backend, frontend, and deployment wiring identified several follow-up issues after earlier subscription fixes.

**Findings:**
- Frontend subscriptions used a root WebSocket path that bypassed the established `/graphqlws` proxy route in development and nginx deployment.
- Frontend room rendering used a hardcoded device count (`4`) while backend supports configurable `DEVICE_COUNT`.
- `updateSensors` mutation overwrote existing device fields with `undefined` when partial sensor payloads were sent.
- Sensor mutation input lacked bounds validation for safety-relevant values.
- Backend danger threshold was hardcoded in model logic.
- Frontend app JSX included stray template characters after the Add Room section.

**Resolution:**
- Updated frontend WebSocket endpoint to `ws(s)://<host>/graphqlws` and aligned dev proxy middleware usage.
- Added `model.deviceCount` query field and switched frontend room rendering to use backend-reported device count.
- Hardened `updateSensors` to apply only provided sensor fields (partial updates no longer clear existing values).
- Added sensor validation in GraphQL resolver:
  - temperature: -50 to 200
  - humidity: 0 to 100
  - airQuality: 0 to 1000
- Added optional mutation response `message` for clearer invalid input or invalid device errors.
- Introduced `TEMP_DANGER_THRESHOLD` environment variable (default `100`) for configurable danger detection.
- Renamed internal model evaluation helper from `deferedEval` to `deferredEval` for consistency and maintainability.
- Removed malformed JSX artifact from frontend app layout.

**Verification:**
- `node --check index.js && node --check model.js && node --check schema.js`
- `cd frontend && npm install`
- `cd frontend && npm run build` (successful compile)

**Result:**
- Subscription transport now matches dev and deployment proxy routes.
- Frontend device cards scale with backend configuration instead of fixed count.
- Mutation safety and data integrity improved for partial updates and out-of-range sensor values.
- Danger threshold can now be tuned without code changes.

**Residual Risk:**
- Frontend `npm install` currently reports 17 vulnerabilities in the CRA dependency tree. This was not changed in this fix set and should be addressed in a dedicated dependency modernization pass.

---

### 4. Frontend Dependency Hardening and Build Cleanup
**Files:** `frontend/package.json`, `frontend/package-lock.json`, `frontend/src/components/DeviceMonitor.js`  
**Severity:** High

The frontend dependency tree included several vulnerable transitive packages from the CRA toolchain, and the build emitted accessibility warnings for icon images.

**Resolution:**
- Added npm overrides for `resolve-url-loader`, `serialize-javascript`, `underscore`, and `yaml`
- Reinstalled the frontend dependencies so the lockfile reflects the patched tree
- Confirmed the frontend audit now reports zero vulnerabilities
- Added empty `alt` text and `aria-hidden="true"` to decorative status icons in `DeviceMonitor`

**Testing:**
- Ran `npm install` in the frontend workspace
- Ran `npm audit` in the frontend workspace and confirmed no remaining vulnerabilities
- Ran `npm run build` successfully with no lint warnings
---

## Verification Summary

All three critical issues have been resolved and tested:

1. Subscriptions establish connection to correct WebSocket path
2. Evacuation state changes are broadcast to all subscribers
3. System memory usage improved by eliminating redundant PubSub instances

The application now correctly propagates real-time device state changes including danger flags, LED states, and evacuation directives to all connected dashboard clients.

---

## Outstanding Items

These issues are documented but not yet addressed in this change set:

- Input validation on sensor values (temperature, humidity, air quality bounds)
- Audit logging for safety-critical mutations
- Configuration file support for emergency thresholds
- Dynamic room/device management at runtime
- Persistence layer for state recovery
- User authentication and authorization
