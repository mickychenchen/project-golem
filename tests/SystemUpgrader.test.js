const SystemUpgrader = require('../src/managers/SystemUpgrader');
const { execSync } = require('child_process');
const fs = require('fs');

jest.mock('fs');
jest.mock('child_process', () => ({
    execSync: jest.fn()
}));
jest.mock('../src/config', () => ({
    CONFIG: { ENABLE_WEB_DASHBOARD: 'false' }
}));

describe('SystemUpgrader', () => {
    let mockCtx;

    beforeEach(() => {
        jest.clearAllMocks();
        mockCtx = {
            reply: jest.fn().mockResolvedValue(),
            sendTyping: jest.fn().mockResolvedValue()
        };
        fs.existsSync.mockReturnValue(true);
        execSync.mockReturnValue(Buffer.from('main'));
    });

    test('should perform full update sequence', async () => {
        await SystemUpgrader.performUpdate(mockCtx);

        expect(execSync).toHaveBeenCalledWith(expect.stringContaining('git fetch'), expect.anything());
        expect(execSync).toHaveBeenCalledWith(expect.stringContaining('git reset'), expect.anything());
        expect(execSync).toHaveBeenCalledWith(expect.stringContaining('npm install'), expect.anything());
        expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('更新完成'));
    });

    test('should handle update failures', async () => {
        execSync.mockImplementation((cmd) => {
            if (cmd.includes('npm install')) throw new Error('Network error');
            return Buffer.from('ok');
        });

        await SystemUpgrader.performUpdate(mockCtx);
        expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('更新失敗'));
    });
});
