'use strict';

const os = require('os');
const v8 = require('v8');

const MB = 1024 * 1024;

function clampPressure(current, next) {
    const rank = {
        normal: 0,
        warning: 1,
        critical: 2,
        fatal: 3,
    };
    return rank[next] > rank[current] ? next : current;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function parsePositiveNumber(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
}

function parsePositiveInteger(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
}

function resolveMemoryLimitMb(options = {}) {
    const hasOption = options.memoryLimitMb !== undefined;
    const envRaw = process.env.GOLEM_WORKER_MEMORY_LIMIT_MB;
    const hasEnv = typeof envRaw === 'string' && envRaw.trim().length > 0;

    if (hasOption || hasEnv) {
        const explicitRaw = hasOption ? options.memoryLimitMb : envRaw;
        const explicit = Number(explicitRaw);
        if (Number.isFinite(explicit) && explicit > 0) {
            return {
                memoryLimitMb: Math.floor(explicit),
                memoryLimitSource: 'explicit',
            };
        }
        if (explicit === 0) {
            return {
                memoryLimitMb: 0,
                memoryLimitSource: 'disabled',
            };
        }
    }

    let derivedMb = 1536;
    try {
        const totalMb = Number(os.totalmem() / MB);
        if (Number.isFinite(totalMb) && totalMb > 0) {
            derivedMb = Math.floor(totalMb * 0.60);
        }
    } catch {}

    return {
        memoryLimitMb: clamp(derivedMb, 1024, 4096),
        memoryLimitSource: 'derived',
    };
}

class MemoryPressureGuard {
    constructor(options = {}) {
        this.warnRatio = parsePositiveNumber(options.warnRatio ?? process.env.GOLEM_MEMORY_WARN_PCT, 0.70);
        this.criticalRatio = parsePositiveNumber(options.criticalRatio ?? process.env.GOLEM_MEMORY_CRITICAL_PCT, 0.85);
        this.fatalRatio = parsePositiveNumber(options.fatalRatio ?? process.env.GOLEM_MEMORY_FATAL_PCT, 0.92);
        this.intervalMs = parsePositiveInteger(options.intervalMs, 10000);

        const limitConfig = resolveMemoryLimitMb(options);
        this.memoryLimitMb = limitConfig.memoryLimitMb;
        this.memoryLimitSource = limitConfig.memoryLimitSource;

        this.fatalConsecutiveRequired = parsePositiveInteger(
            options.fatalConsecutiveRequired ?? process.env.GOLEM_MEMORY_FATAL_CONSECUTIVE,
            3
        );
        this.fatalStartupGraceMs = parsePositiveInteger(
            options.fatalStartupGraceMs ?? process.env.GOLEM_MEMORY_FATAL_STARTUP_GRACE_MS,
            120000
        );

        this._handlers = {
            warning: typeof options.onWarning === 'function' ? options.onWarning : null,
            critical: typeof options.onCritical === 'function' ? options.onCritical : null,
            fatal: typeof options.onFatal === 'function' ? options.onFatal : null,
            snapshot: typeof options.onSnapshot === 'function' ? options.onSnapshot : null,
        };

        this._startedAt = Date.now();
        this._fatalConsecutive = 0;

        this._lastActionAt = {
            warning: 0,
            critical: 0,
            fatal: 0,
        };

        this._snapshot = {
            pressure: 'normal',
            rssMb: 0,
            heapUsedMb: 0,
            heapTotalMb: 0,
            lastMitigation: '',
            sampledAt: null,
            memoryLimitMb: this.memoryLimitMb,
            memoryLimitSource: this.memoryLimitSource,
            fatalEligible: false,
            fatalConsecutive: 0,
            fatalRequired: this.fatalConsecutiveRequired,
            fatalStartupGraceMs: this.fatalStartupGraceMs,
            fatalSuppressedReason: '',
            fatalReason: '',
        };

        this._timer = null;
    }

    start() {
        if (this._timer) return;
        this._timer = setInterval(() => {
            this.sample({ source: 'interval' }).catch(() => {});
        }, this.intervalMs);
        if (typeof this._timer.unref === 'function') {
            this._timer.unref();
        }
    }

    stop() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
    }

    getSnapshot() {
        return { ...this._snapshot };
    }

    reportMitigation(level, action) {
        this._snapshot.lastMitigation = `${level}:${action}`;
    }

    async sample(meta = {}) {
        const previousSnapshot = this.getSnapshot();
        const now = Date.now();
        const usage = process.memoryUsage();
        const rssMb = Number((usage.rss / 1024 / 1024).toFixed(1));
        const heapUsedMb = Number((usage.heapUsed / 1024 / 1024).toFixed(1));
        const heapTotalMb = Number((usage.heapTotal / 1024 / 1024).toFixed(1));
        const v8Stats = v8.getHeapStatistics();
        const absoluteHeapLimitMb = v8Stats.heap_size_limit / 1024 / 1024;
        const heapRatio = absoluteHeapLimitMb > 0 ? usage.heapUsed / v8Stats.heap_size_limit : 0;
        const rssRatio = this.memoryLimitMb > 0 ? rssMb / this.memoryLimitMb : 0;
        const uptimeMs = Math.max(0, now - this._startedAt);
        const inGraceWindow = uptimeMs < this.fatalStartupGraceMs;

        let fatalReason = '';
        let fatalSignal = false;
        if (this.memoryLimitMb > 0 && rssMb >= this.memoryLimitMb) {
            fatalSignal = true;
            fatalReason = 'rss-limit';
        } else if (this.memoryLimitMb > 0 && rssRatio >= this.fatalRatio) {
            fatalSignal = true;
            fatalReason = 'rss-ratio';
        }

        if (fatalSignal) {
            this._fatalConsecutive += 1;
        } else {
            this._fatalConsecutive = 0;
        }

        const fatalEligible = fatalSignal
            && !inGraceWindow
            && this._fatalConsecutive >= this.fatalConsecutiveRequired;
        const fatalSuppressedReason = fatalSignal && !fatalEligible
            ? (inGraceWindow
                ? 'startup-grace'
                : `consecutive:${this._fatalConsecutive}/${this.fatalConsecutiveRequired}`)
            : '';

        let pressure = 'normal';
        if (heapRatio >= this.warnRatio || rssRatio >= this.warnRatio) pressure = 'warning';
        if (heapRatio >= this.criticalRatio || rssRatio >= this.criticalRatio) pressure = clampPressure(pressure, 'critical');
        if (fatalSignal) pressure = clampPressure(pressure, 'fatal');

        if (pressure === 'fatal' && !fatalEligible) {
            this._snapshot.lastMitigation = `fatal-suppressed:${fatalSuppressedReason || 'not-eligible'}`;
        }

        this._snapshot = {
            pressure,
            rssMb,
            heapUsedMb,
            heapTotalMb,
            lastMitigation: this._snapshot.lastMitigation,
            sampledAt: new Date(now).toISOString(),
            memoryLimitMb: this.memoryLimitMb,
            memoryLimitSource: this.memoryLimitSource,
            fatalEligible,
            fatalConsecutive: this._fatalConsecutive,
            fatalRequired: this.fatalConsecutiveRequired,
            fatalStartupGraceMs: this.fatalStartupGraceMs,
            fatalSuppressedReason,
            fatalReason,
        };

        if (this._handlers.snapshot) {
            try {
                this._handlers.snapshot(this.getSnapshot(), meta);
            } catch {}
        }

        await this._applyPressure(pressure, meta, previousSnapshot);
        return this.getSnapshot();
    }

    async _applyPressure(pressure, meta, previousSnapshot = null) {
        if (pressure === 'normal') return;

        if (pressure === 'fatal') {
            const snapshot = this.getSnapshot();
            if (snapshot.fatalEligible) {
                await this._applyPressureLevel('fatal', meta);
                return;
            }
            await this._applyPressureLevel('critical', {
                ...meta,
                escalatedFrom: 'fatal-suppressed',
                previousSnapshot,
            });
            return;
        }

        await this._applyPressureLevel(pressure, meta);
    }

    async _applyPressureLevel(level, meta) {
        if (level !== 'warning' && level !== 'critical' && level !== 'fatal') return;

        const now = Date.now();
        const cooldowns = {
            warning: 15000,
            critical: 30000,
            fatal: 60000,
        };

        if ((now - this._lastActionAt[level]) < cooldowns[level]) {
            return;
        }
        this._lastActionAt[level] = now;

        const handler = this._handlers[level];
        if (!handler) return;

        await handler(this.getSnapshot(), meta);
    }
}

module.exports = MemoryPressureGuard;
