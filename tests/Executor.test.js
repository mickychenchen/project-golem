const Executor = require('../src/core/Executor');
const { spawn } = require('child_process');
const EventEmitter = require('events');
const { getManagedProcessRegistry } = require('../src/runtime/RuntimeState');

jest.mock('child_process', () => ({
    spawn: jest.fn()
}));

jest.mock('../src/runtime/RuntimeState', () => ({
    getManagedProcessRegistry: jest.fn(),
}));

describe('Executor', () => {
    let executor;
    let mockProcess;

    beforeEach(() => {
        jest.clearAllMocks();
        executor = new Executor();
        mockProcess = new EventEmitter();
        mockProcess.stdout = new EventEmitter();
        mockProcess.stderr = new EventEmitter();
        mockProcess.kill = jest.fn();
        spawn.mockReturnValue(mockProcess);
        getManagedProcessRegistry.mockReturnValue(null);
    });

    test('should resolve with stdout on success', async () => {
        const promise = executor.run('ls');
        
        mockProcess.stdout.emit('data', Buffer.from('file1\nfile2'));
        mockProcess.emit('close', 0);

        const result = await promise;
        expect(result).toContain('file1');
        expect(spawn).toHaveBeenCalledWith('ls', [], expect.anything());
    });

    test('should reject on non-zero exit code', async () => {
        const promise = executor.run('invalid-cmd');
        
        mockProcess.stderr.emit('data', Buffer.from('Command not found'));
        mockProcess.emit('close', 1);

        await expect(promise).rejects.toThrow('Command failed (Exit Code 1)');
    });

    test('should reject on process error', async () => {
        const promise = executor.run('ls');
        mockProcess.emit('error', new Error('Spawn failed'));
        await expect(promise).rejects.toThrow('Spawn failed');
    });

    test('should handle timeout', async () => {
        jest.useFakeTimers();
        const promise = executor.run('sleep 10', { timeout: 1000 });

        jest.advanceTimersByTime(1100);
        
        await expect(promise).rejects.toThrow('Command timed out');
        expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
        jest.useRealTimers();
    });

    test('should block protected kill commands via managed registry', async () => {
        const registry = {
            assertCommandAllowed: jest.fn(() => {
                throw new Error('Refusing to kill protected process 123');
            }),
            registerResource: jest.fn(),
        };
        getManagedProcessRegistry.mockReturnValue(registry);

        await expect(executor.run('kill 123')).rejects.toThrow('Refusing to kill protected process 123');
        expect(spawn).not.toHaveBeenCalled();
    });

    test('should register spawned process in managed registry', async () => {
        const unregister = jest.fn();
        const registry = {
            assertCommandAllowed: jest.fn(),
            registerResource: jest.fn(() => ({ unregister })),
        };
        getManagedProcessRegistry.mockReturnValue(registry);

        const promise = executor.run('ls');
        mockProcess.emit('close', 0);

        await expect(promise).resolves.toBe('');
        expect(registry.assertCommandAllowed).toHaveBeenCalledWith('ls');
        expect(registry.registerResource).toHaveBeenCalledWith(expect.stringContaining('executor:ls'), expect.objectContaining({
            child: mockProcess,
            recyclable: true,
        }));
        expect(unregister).toHaveBeenCalled();
    });
});
