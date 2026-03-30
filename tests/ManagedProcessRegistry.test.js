const EventEmitter = require('events');
const ManagedProcessRegistry = require('../src/runtime/ManagedProcessRegistry');

describe('ManagedProcessRegistry', () => {
    test('tracks protected pids and removes them on cleanup', () => {
        const registry = new ManagedProcessRegistry({ owner: 'test' });
        const unprotect = registry.protectPid(1234, { name: 'supervisor' });

        expect(registry.isProtectedPid(1234)).toBe(true);
        expect(registry.listProtectedPids()).toEqual([1234]);

        unprotect();

        expect(registry.isProtectedPid(1234)).toBe(false);
    });

    test('registers resources and updates stats', () => {
        const registry = new ManagedProcessRegistry({ owner: 'test' });
        const child = new EventEmitter();
        child.pid = 4321;

        const registration = registry.registerResource('worker-child', {
            child,
            protected: true,
            recyclable: false,
        });

        expect(registry.isProtectedPid(4321)).toBe(true);
        expect(registry.getStats()).toEqual({
            total: 1,
            protected: 1,
            recyclable: 0,
        });

        registration.unregister();

        expect(registry.getStats()).toEqual({
            total: 0,
            protected: 0,
            recyclable: 0,
        });
        expect(registry.isProtectedPid(4321)).toBe(false);
    });

    test('blocks broad kill commands and protected explicit pids', () => {
        const registry = new ManagedProcessRegistry({ owner: 'test' });
        registry.protectPid(999, { name: 'worker' });

        expect(() => registry.assertCommandAllowed('pkill -f node')).toThrow('Broad kill commands are blocked');
        expect(() => registry.assertCommandAllowed('killall node')).toThrow('Broad kill commands are blocked');
        expect(() => registry.assertCommandAllowed('kill 999')).toThrow('Refusing to kill protected process 999');
        expect(() => registry.assertCommandAllowed('kill -9')).toThrow('Kill commands must target explicit numeric PIDs');
        expect(() => registry.assertCommandAllowed('kill 123')).not.toThrow();
    });
});
