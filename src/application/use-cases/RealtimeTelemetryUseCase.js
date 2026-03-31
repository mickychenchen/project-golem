'use strict';

function parseInteger(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
}

class RealtimeTelemetryUseCase {
    constructor(options = {}) {
        this.now = typeof options.now === 'function' ? options.now : () => Date.now();
        this.forceEmitIntervalMs = parseInteger(options.forceEmitIntervalMs, 10000);

        this._sequence = 0;
        this._lastHeartbeatSignature = '';
        this._lastHeartbeatEmitAt = 0;

        this._lastStateSignature = '';
        this._lastStateEmitAt = 0;
    }

    _buildHeartbeatSignature(payload) {
        const runtime = payload.runtime || {};
        const worker = runtime.worker || {};
        const memory = runtime.memory || {};
        return JSON.stringify({
            memUsage: payload.memUsage,
            uptime: payload.uptime,
            cpu: payload.cpu,
            queueCount: payload.queueCount,
            workerStatus: worker.status,
            workerRestarts: worker.restarts,
            memoryPressure: memory.pressure,
            rssMb: memory.rssMb,
        });
    }

    _buildStateSignature(payload) {
        return JSON.stringify({
            queueCount: payload.queueCount,
            lastSchedule: payload.lastSchedule,
            runtime: payload.runtime ? {
                mode: payload.runtime.mode,
                worker: payload.runtime.worker ? {
                    status: payload.runtime.worker.status,
                    restarts: payload.runtime.worker.restarts,
                } : null,
                memory: payload.runtime.memory ? {
                    pressure: payload.runtime.memory.pressure,
                    rssMb: payload.runtime.memory.rssMb,
                } : null,
            } : null,
        });
    }

    buildHeartbeat(input = {}) {
        const ts = this.now();
        const seq = ++this._sequence;
        return {
            ...input,
            seq,
            ts,
        };
    }

    shouldEmitHeartbeat(payload) {
        const now = this.now();
        const signature = this._buildHeartbeatSignature(payload);
        const changed = signature !== this._lastHeartbeatSignature;
        const forceEmit = (now - this._lastHeartbeatEmitAt) >= this.forceEmitIntervalMs;

        if (!changed && !forceEmit) {
            return false;
        }

        this._lastHeartbeatSignature = signature;
        this._lastHeartbeatEmitAt = now;
        return true;
    }

    shouldEmitState(payload) {
        const now = this.now();
        const signature = this._buildStateSignature(payload);
        const changed = signature !== this._lastStateSignature;
        const forceEmit = (now - this._lastStateEmitAt) >= this.forceEmitIntervalMs;

        if (!changed && !forceEmit) {
            return false;
        }

        this._lastStateSignature = signature;
        this._lastStateEmitAt = now;
        return true;
    }
}

module.exports = RealtimeTelemetryUseCase;
