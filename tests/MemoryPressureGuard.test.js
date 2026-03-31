const os = require('os');
const MemoryPressureGuard = require('../src/runtime/MemoryPressureGuard');

function createUsage({ rssMb, heapUsedMb, heapTotalMb }) {
    return {
        rss: rssMb * 1024 * 1024,
        heapUsed: heapUsedMb * 1024 * 1024,
        heapTotal: heapTotalMb * 1024 * 1024,
        external: 0,
        arrayBuffers: 0,
    };
}

describe('MemoryPressureGuard', () => {
    beforeEach(() => {
        delete process.env.GOLEM_WORKER_MEMORY_LIMIT_MB;
        delete process.env.GOLEM_MEMORY_FATAL_CONSECUTIVE;
        delete process.env.GOLEM_MEMORY_FATAL_STARTUP_GRACE_MS;
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test('heap-only pressure does not trigger fatal recycle', async () => {
        const warningHandler = jest.fn().mockResolvedValue(undefined);
        const criticalHandler = jest.fn().mockResolvedValue(undefined);
        const fatalHandler = jest.fn().mockResolvedValue(undefined);

        const guard = new MemoryPressureGuard({
            memoryLimitMb: 1000,
            warnRatio: 0.70,
            criticalRatio: 0.85,
            fatalRatio: 0.92,
            onWarning: warningHandler,
            onCritical: criticalHandler,
            onFatal: fatalHandler,
        });

        jest.spyOn(process, 'memoryUsage').mockReturnValue(createUsage({
            rssMb: 180,
            heapUsedMb: 92,
            heapTotalMb: 100,
        }));

        await guard.sample({ source: 'heap-only' });

        expect(guard.getSnapshot()).toEqual(expect.objectContaining({
            pressure: 'critical',
            fatalEligible: false,
            fatalReason: '',
        }));
        expect(warningHandler).not.toHaveBeenCalled();
        expect(criticalHandler).toHaveBeenCalledTimes(1);
        expect(fatalHandler).not.toHaveBeenCalled();
    });

    test('fatal recycle requires startup grace and consecutive rss signals', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-03-30T00:00:00.000Z'));

        const criticalHandler = jest.fn().mockResolvedValue(undefined);
        const fatalHandler = jest.fn().mockResolvedValue(undefined);

        const guard = new MemoryPressureGuard({
            memoryLimitMb: 100,
            warnRatio: 0.70,
            criticalRatio: 0.85,
            fatalRatio: 0.92,
            fatalStartupGraceMs: 2000,
            fatalConsecutiveRequired: 3,
            onCritical: criticalHandler,
            onFatal: fatalHandler,
        });

        jest.spyOn(process, 'memoryUsage').mockReturnValue(createUsage({
            rssMb: 95,
            heapUsedMb: 20,
            heapTotalMb: 80,
        }));

        await guard.sample({ source: 'fatal-1' });
        expect(guard.getSnapshot()).toEqual(expect.objectContaining({
            pressure: 'fatal',
            fatalEligible: false,
            fatalConsecutive: 1,
            fatalSuppressedReason: 'startup-grace',
        }));
        expect(fatalHandler).not.toHaveBeenCalled();

        jest.advanceTimersByTime(2100);
        await guard.sample({ source: 'fatal-2' });
        expect(guard.getSnapshot()).toEqual(expect.objectContaining({
            fatalEligible: false,
            fatalConsecutive: 2,
            fatalSuppressedReason: 'consecutive:2/3',
        }));
        expect(fatalHandler).not.toHaveBeenCalled();

        await guard.sample({ source: 'fatal-3' });
        expect(guard.getSnapshot()).toEqual(expect.objectContaining({
            fatalEligible: true,
            fatalConsecutive: 3,
            fatalReason: 'rss-ratio',
        }));
        expect(fatalHandler).toHaveBeenCalledTimes(1);
        expect(criticalHandler).toHaveBeenCalledTimes(1);
    });

    test('derives worker memory limit when env is not configured', () => {
        jest.spyOn(os, 'totalmem').mockReturnValue(8 * 1024 * 1024 * 1024);
        const guard = new MemoryPressureGuard();

        expect(guard.memoryLimitMb).toBe(4096);
        expect(guard.getSnapshot()).toEqual(expect.objectContaining({
            memoryLimitMb: 4096,
            memoryLimitSource: 'derived',
            fatalRequired: 3,
        }));
    });
});
