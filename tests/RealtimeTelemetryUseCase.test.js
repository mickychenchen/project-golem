const RealtimeTelemetryUseCase = require('../src/application/use-cases/RealtimeTelemetryUseCase');

describe('RealtimeTelemetryUseCase', () => {
    test('buildHeartbeat should append seq and ts', () => {
        let now = 1700000000000;
        const useCase = new RealtimeTelemetryUseCase({
            now: () => now,
        });

        const first = useCase.buildHeartbeat({ memUsage: 100 });
        now += 1000;
        const second = useCase.buildHeartbeat({ memUsage: 101 });

        expect(first.seq).toBe(1);
        expect(second.seq).toBe(2);
        expect(first.ts).toBe(1700000000000);
        expect(second.ts).toBe(1700000001000);
    });

    test('shouldEmitHeartbeat should emit on change and skip duplicates in force window', () => {
        let now = 1000;
        const useCase = new RealtimeTelemetryUseCase({
            now: () => now,
            forceEmitIntervalMs: 10000,
        });

        const payloadA = { memUsage: 120, cpu: 20, uptime: '1h 0m', queueCount: 1, runtime: { worker: { status: 'running', restarts: 0 }, memory: { pressure: 'normal', rssMb: 200 } } };
        const payloadB = { ...payloadA };
        const payloadC = { ...payloadA, memUsage: 130 };

        expect(useCase.shouldEmitHeartbeat(payloadA)).toBe(true);
        now += 1000;
        expect(useCase.shouldEmitHeartbeat(payloadB)).toBe(false);
        now += 1000;
        expect(useCase.shouldEmitHeartbeat(payloadC)).toBe(true);
    });
});
