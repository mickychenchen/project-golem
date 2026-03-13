const ChatLogManager = require('../src/managers/ChatLogManager');
const fs = require('fs');
const path = require('path');

jest.mock('fs');

describe('ChatLogManager', () => {
    let clm;

    beforeEach(() => {
        jest.clearAllMocks();
        fs.existsSync.mockReturnValue(true);
        clm = new ChatLogManager({ logDir: '/tmp/logs' });
    });

    test('append should write formatted JSON to file', () => {
        fs.readFileSync.mockReturnValue('[]');
        clm.append({ sender: 'User', content: 'hello' });
        expect(fs.writeFileSync).toHaveBeenCalledWith(
            expect.stringContaining('.log'),
            expect.stringContaining('hello')
        );
    });

    test('cleanup should remove old files', () => {
        // Hourly logs expect YYYYMMDDHH.log (14 chars)
        fs.readdirSync.mockReturnValue(['2023010101.log']); 
        fs.statSync.mockReturnValue({ mtimeMs: Date.now() - 1000 * 60 * 60 * 24 * 10 }); // 10 days ago
        
        clm.cleanup();
        
        expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('2023010101.log'));
    });

    test('compressLogsForDate should skip if summary exists', async () => {
        fs.existsSync.mockReturnValue(true); // Summary exists
        const brain = { sendMessage: jest.fn() };
        await clm.compressLogsForDate('20230101', brain);
        expect(brain.sendMessage).not.toHaveBeenCalled();
    });

    test('compressLogsForDate should skip if too few logs', async () => {
        fs.existsSync.mockReturnValue(false); // Summary doesn't exist
        fs.readdirSync.mockReturnValue(['2023010101.log']); // Only 1 log
        const brain = { sendMessage: jest.fn() };
        await clm.compressLogsForDate('20230101', brain);
        expect(brain.sendMessage).not.toHaveBeenCalled();
    });
});
