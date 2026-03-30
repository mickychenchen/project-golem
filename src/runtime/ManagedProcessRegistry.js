'use strict';

let nextResourceId = 1;

class ManagedProcessRegistry {
    constructor(options = {}) {
        this.owner = options.owner || 'runtime';
        this._resources = new Map();
        this._protectedPids = new Map();
    }

    protectPid(pid, metadata = {}) {
        const normalizedPid = Number(pid);
        if (!Number.isInteger(normalizedPid) || normalizedPid <= 0) {
            return () => {};
        }

        this._protectedPids.set(normalizedPid, {
            pid: normalizedPid,
            ...metadata,
        });

        return () => {
            this._protectedPids.delete(normalizedPid);
        };
    }

    registerResource(name, options = {}) {
        const child = options.child || null;
        const pid = Number.isInteger(Number(options.pid))
            ? Number(options.pid)
            : (child && Number.isInteger(child.pid) ? child.pid : null);

        const id = `${this.owner}:${nextResourceId++}`;
        const resource = {
            id,
            name: String(name || 'resource'),
            pid,
            child,
            protected: options.protected === true,
            recyclable: options.recyclable !== false,
            stop: typeof options.stop === 'function' ? options.stop : null,
            metadata: options.metadata || {},
        };

        this._resources.set(id, resource);

        let unprotect = () => {};
        if (resource.protected && Number.isInteger(resource.pid) && resource.pid > 0) {
            unprotect = this.protectPid(resource.pid, {
                name: resource.name,
                resourceId: resource.id,
            });
        }

        const cleanup = () => {
            this._resources.delete(id);
            unprotect();
        };

        if (child && typeof child.once === 'function') {
            child.once('exit', cleanup);
        }

        return {
            id,
            cleanup,
            unregister: cleanup,
            update: (updates = {}) => {
                const current = this._resources.get(id);
                if (!current) return;
                Object.assign(current, updates);
            },
        };
    }

    isProtectedPid(pid) {
        const normalizedPid = Number(pid);
        return Number.isInteger(normalizedPid) && this._protectedPids.has(normalizedPid);
    }

    listProtectedPids() {
        return Array.from(this._protectedPids.keys()).sort((a, b) => a - b);
    }

    getStats() {
        const resources = Array.from(this._resources.values());
        return {
            total: resources.length,
            protected: resources.filter((item) => item.protected).length,
            recyclable: resources.filter((item) => item.recyclable).length,
        };
    }

    getResources() {
        return Array.from(this._resources.values());
    }

    async recycleResources(filterFn = null) {
        const resources = this.getResources()
            .filter((item) => item.recyclable && typeof item.stop === 'function')
            .filter((item) => (typeof filterFn === 'function' ? filterFn(item) : true));

        const recycled = [];
        for (const resource of resources) {
            try {
                await resource.stop();
                recycled.push(resource.name);
            } catch (error) {
                recycled.push(`${resource.name}:failed:${error.message}`);
            }
        }
        return recycled;
    }

    assertCommandAllowed(command) {
        const text = String(command || '').trim();
        if (!text) return;

        if (/\bpkill\b/.test(text) || /\bkillall\b/.test(text)) {
            throw new Error('Broad kill commands are blocked in managed runtime.');
        }

        if (!/^\s*kill\b/.test(text)) return;

        const pidMatches = text.match(/(?:^|\s)(\d{1,10})(?=\s|$)/g) || [];
        const pids = pidMatches
            .map((item) => Number(String(item).trim()))
            .filter((pid) => Number.isInteger(pid) && pid > 0);

        if (pids.length === 0) {
            throw new Error('Kill commands must target explicit numeric PIDs in managed runtime.');
        }

        for (const pid of pids) {
            if (this.isProtectedPid(pid)) {
                const info = this._protectedPids.get(pid) || {};
                throw new Error(`Refusing to kill protected process ${pid}${info.name ? ` (${info.name})` : ''}.`);
            }
        }
    }
}

module.exports = ManagedProcessRegistry;
