import { EventEmitter } from 'node:events';

const DEFAULT_TEMP_DANGER_THRESHOLD = 100;
const parsedThreshold = Number.parseFloat(process.env.TEMP_DANGER_THRESHOLD ?? '');
const TEMP_DANGER_THRESHOLD = Number.isFinite(parsedThreshold)
    ? parsedThreshold
    : DEFAULT_TEMP_DANGER_THRESHOLD;

export const EVACStates = Object.freeze({
    NORMAL: "normal",
    EVAC: "evac"
});

export const LEDStates = Object.freeze({
    EVAC_LEFT: "evac_left",
    EVAC_RIGHT: "evac_right",
    DANGER: "danger",
    SAFE: "safe",
    OFF: "off"
});

export class Device extends EventEmitter {
    danger = false;
    occupied = null;
    temperature = null;
    humidity = null;
    airQuality = null;
    ledState = LEDStates.SAFE;
    evacState = EVACStates.NORMAL;
    smokeDetected = null;
    forcedDanger = null;
    forcedOccupancy = null;

    setEvacState(evacState) {
        let needsUpdate = evacState !== this.evacState;
        this.evacState = evacState;
        if (needsUpdate) this.emit('deviceChanged', this);
    }

    setLedState(ledState) {
        let needsUpdate = ledState != this.ledState;
        this.ledState = ledState;
        if (needsUpdate) this.ledStateChanged();
    }

    ledStateChanged() {
        this.emit('ledStateChanged', this.ledState);
    }

    deferredEval() {
    if (this.forcedOccupancy != null) {
        this.occupied = this.forcedOccupancy;
    }
    const prevDanger = this.danger;
    const prevOccupied = this.occupied;
    this.evalDanger();
    if (this.danger !== prevDanger || this.occupied !== prevOccupied) {
        this.emit('deviceChanged', this);
    }
}

    evalDanger() {
        let danger = !!(this.temperature > TEMP_DANGER_THRESHOLD || this.smokeDetected);
        if (this.forcedDanger !== null) {
            danger = this.forcedDanger;
        }
        let needsUpdate = danger !== this.danger;
        this.danger = danger;
        if (needsUpdate) updateGraph();
    }
}

const device_count = process.env.DEVICE_COUNT ? Number.parseInt(process.env.DEVICE_COUNT) : 4

export const model = {
    devices: Array.from({length: device_count}).map(_ => new Device()),
}

function updateGraph() {
    let danger = model.devices.find(d => d.danger) !== undefined;
    if (danger) {
        let minDanger = model.devices.findIndex(d => d.danger);
        let maxDanger = model.devices.findLastIndex(d => d.danger);
        model.devices.slice(0, minDanger).forEach(device => device.setLedState(LEDStates.EVAC_LEFT));
        model.devices.slice(minDanger, maxDanger+1).forEach(device => device.setLedState(LEDStates.DANGER));
        model.devices.slice(maxDanger+1).forEach(device => device.setLedState(LEDStates.EVAC_RIGHT));
        model.devices.forEach(device => device.setEvacState(EVACStates.EVAC));
    } else {
        model.devices.forEach(device => device.setLedState(LEDStates.SAFE));
        model.devices.forEach(device => device.setEvacState(EVACStates.NORMAL));
    }
}
