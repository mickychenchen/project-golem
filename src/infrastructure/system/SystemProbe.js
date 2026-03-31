'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

function parsePositiveInteger(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
}

class SystemProbe {
    constructor(options = {}) {
        this.fs = options.fs || fs;
        this.os = options.os || os;
        this.path = options.path || path;
        this.execSync = options.execSync || execSync;
        this.process = options.process || process;
        this.now = typeof options.now === 'function' ? options.now : () => Date.now();

        this.cacheTtlMs = parsePositiveInteger(
            options.cacheTtlMs !== undefined
                ? options.cacheTtlMs
                : this.process.env.DASHBOARD_SYSTEM_STATUS_CACHE_TTL_MS,
            15000
        );

        this._cache = {
            expiresAt: 0,
            value: null,
        };
    }

    clear() {
        this._cache.expiresAt = 0;
        this._cache.value = null;
    }

    _computeStatusSnapshot(cwd) {
        const runtimeEnv = {
            npm: 'N/A',
            osName: `${this.os.type()} ${this.os.release()}`,
        };

        try {
            runtimeEnv.npm = `v${this.execSync('npm -v').toString().trim()}`;
        } catch {}

        try {
            if (this.process.platform === 'darwin') {
                const name = this.execSync('sw_vers -productName').toString().trim();
                const ver = this.execSync('sw_vers -productVersion').toString().trim();
                runtimeEnv.osName = `${name} ${ver}`;
            } else if (this.process.platform === 'linux') {
                const osReleasePath = '/etc/os-release';
                if (this.fs.existsSync(osReleasePath)) {
                    const content = this.fs.readFileSync(osReleasePath, 'utf8');
                    const match = content.match(/PRETTY_NAME="([^"]+)"/);
                    if (match) runtimeEnv.osName = match[1];
                }
            }
        } catch {}

        const dotEnvPath = this.path.join(cwd, '.env');
        const health = {
            env: this.fs.existsSync(dotEnvPath),
            deps: this.fs.existsSync(this.path.join(cwd, 'node_modules')),
            core: ['index.js', 'package.json', 'dashboard.js'].every((file) => this.fs.existsSync(this.path.join(cwd, file))),
            dashboard: this.fs.existsSync(this.path.join(cwd, 'web-dashboard/node_modules')) || this.fs.existsSync(this.path.join(cwd, 'web-dashboard/.next')),
        };

        let diskAvail = 'N/A';
        try {
            if (this.process.platform === 'darwin' || this.process.platform === 'linux') {
                diskAvail = this.execSync("df -h . | awk 'NR==2{print $4}'").toString().trim();
            }
        } catch {}

        return {
            runtimeEnv,
            health,
            diskAvail,
        };
    }

    getStatusSnapshot(cwd = this.process.cwd()) {
        const now = this.now();
        if (this._cache.value && now < this._cache.expiresAt) {
            return this._cache.value;
        }

        const value = this._computeStatusSnapshot(cwd);
        this._cache.value = value;
        this._cache.expiresAt = now + this.cacheTtlMs;
        return value;
    }
}

module.exports = SystemProbe;
