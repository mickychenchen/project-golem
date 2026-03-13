const PatchManager = require('../src/managers/PatchManager');
const fs = require('fs');
const { spawnSync } = require('child_process');

jest.mock('fs');
jest.mock('child_process', () => ({
    spawnSync: jest.fn()
}));

describe('PatchManager', () => {
    test('apply should replace text matching search term', () => {
        const original = 'const x = 1;';
        const patch = { search: 'x = 1', replace: 'y = 2' };
        expect(PatchManager.apply(original, patch)).toBe('const y = 2;');
    });

    test('apply should reject changes in protected blocks', () => {
        const original = '// ========= [KERNEL PROTECTED START] =========\nconst secret = 1;\n// ========= [KERNEL PROTECTED END] =========';
        const patch = { search: 'secret = 1', replace: 'secret = 0' };
        expect(() => PatchManager.apply(original, patch)).toThrow('權限拒絕');
    });

    test('apply should use fuzzy matching for whitespace', () => {
        const original = 'const   x   =   1;';
        const patch = { search: 'const x = 1', replace: 'const x = 2' };
        expect(PatchManager.apply(original, patch)).toBe('const x = 2;');
    });

    test('verify should return true on successful syntax check', () => {
        spawnSync.mockReturnValue({ status: 0 });
        expect(PatchManager.verify('test.js')).toBe(true);
        expect(spawnSync).toHaveBeenCalledWith('node', ['-c', 'test.js'], expect.anything());
    });

    test('verify should return false on syntax error', () => {
        spawnSync.mockReturnValue({ status: 1, stderr: Buffer.from('SyntaxError') });
        expect(PatchManager.verify('test.js')).toBe(false);
    });
});
