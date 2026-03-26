# Recent Changes and Fixes

## Overview
This document describes critical fixes applied to the model-server codebase to resolve subscription event propagation issues and improve system reliability.

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
- Updated frontend WebSocket connection URL to: `ws://${window.location.host}/`
- This matches the backend WebSocket server path as configured in `index.js`
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
