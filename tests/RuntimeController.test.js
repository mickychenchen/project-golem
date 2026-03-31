const RuntimeController = require('../src/runtime/RuntimeController');

describe('RuntimeController memory fatal handling', () => {
    let controller;

    beforeEach(() => {
        controller = new RuntimeController({ workerPath: '/tmp/fake-worker.js' });
        controller._runtimeSnapshot.worker.status = 'running';
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('does not recycle worker when fatal event is suppressed', () => {
        const restartSpy = jest.spyOn(controller, 'restartWorker').mockResolvedValue(undefined);

        controller._handleRuntimeEvent('memory.fatal', {
            eligible: false,
            fatalSuppressedReason: 'startup-grace',
            pressure: 'fatal',
            rssMb: 900,
        });

        const snapshot = controller.getRuntimeSnapshot();
        expect(restartSpy).not.toHaveBeenCalled();
        expect(snapshot.worker.status).toBe('degraded');
        expect(snapshot.memory).toEqual(expect.objectContaining({
            pressure: 'fatal',
            fatalEligible: false,
            lastMitigation: 'fatal-suppressed:startup-grace',
        }));
    });

    test('recycles worker when fatal event is eligible', async () => {
        const restartSpy = jest.spyOn(controller, 'restartWorker').mockResolvedValue(undefined);

        controller._handleRuntimeEvent('memory.fatal', {
            eligible: true,
            fatalReason: 'rss-limit',
            restartReason: 'memory-fatal:rss-limit',
            pressure: 'fatal',
            rssMb: 1400,
        });
        await Promise.resolve();

        const snapshot = controller.getRuntimeSnapshot();
        expect(restartSpy).toHaveBeenCalledWith('memory-fatal:rss-limit');
        expect(snapshot.worker.status).toBe('restarting');
        expect(snapshot.memory).toEqual(expect.objectContaining({
            pressure: 'fatal',
            fatalEligible: true,
            lastMitigation: 'fatal:memory-fatal:rss-limit',
        }));
    });
});
