const SystemProbe = require('../src/infrastructure/system/SystemProbe');

describe('SystemProbe', () => {
    test('getStatusSnapshot should honor cache ttl and avoid repeated expensive probes', () => {
        let now = 1000;
        const execSync = jest.fn((cmd) => {
            if (cmd === 'npm -v') return Buffer.from('10.0.0');
            if (cmd.includes('df -h')) return Buffer.from('30G');
            return Buffer.from('');
        });

        const fsMock = {
            existsSync: jest.fn((p) => {
                if (String(p).endsWith('.env')) return true;
                if (String(p).includes('node_modules')) return true;
                if (String(p).includes('web-dashboard/.next')) return true;
                return true;
            }),
            readFileSync: jest.fn(() => ''),
        };

        const probe = new SystemProbe({
            execSync,
            fs: fsMock,
            cacheTtlMs: 15000,
            now: () => now,
            process: {
                env: {},
                cwd: () => '/tmp/project',
                platform: 'darwin',
            },
            os: {
                type: () => 'Darwin',
                release: () => '24.0',
            },
            path: require('path'),
        });

        const first = probe.getStatusSnapshot('/tmp/project');
        expect(first.runtimeEnv.npm).toBe('v10.0.0');
        expect(execSync).toHaveBeenCalledTimes(4); // npm + 2 x sw_vers + df

        now += 5000;
        const second = probe.getStatusSnapshot('/tmp/project');
        expect(second).toBe(first);
        expect(execSync).toHaveBeenCalledTimes(4);

        now += 20000;
        const third = probe.getStatusSnapshot('/tmp/project');
        expect(third).not.toBe(first);
        expect(execSync).toHaveBeenCalledTimes(8);
    });
});
