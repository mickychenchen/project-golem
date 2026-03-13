const fs = require('fs');

// Mock fs.promises BEFORE requiring Introspection
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn(),
        readdir: jest.fn()
    },
    readFileSync: jest.fn(),
    existsSync: jest.fn()
}));

const Introspection = require('../src/services/Introspection');

describe('Introspection', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('readCore should redact sensitive keys', async () => {
        require('fs').promises.readFile.mockResolvedValue('const KEY = "secret-123";\nconst OTHER = "val";');
        
        const content = await Introspection.readCore();
        expect(content).toContain('KEY: "[REDACTED]"');
    });

    test('readFile should block illegal paths', async () => {
        await expect(Introspection.readFile('../etc/passwd')).rejects.toThrow('Access Denied');
    });
});
