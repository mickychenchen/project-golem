const AutonomyManager = require('../src/managers/AutonomyManager');
const ConfigManager = require('../src/config');
const fs = require('fs');

jest.mock('fs');
jest.mock('../src/config', () => ({
    CONFIG: {
        AWAKE_INTERVAL_MIN: 1,
        AWAKE_INTERVAL_MAX: 1,
        SLEEP_START: 1,
        SLEEP_END: 7
    },
    LOG_BASE_DIR: '/tmp/logs'
}));

describe('AutonomyManager', () => {
    let am;
    let mockBrain;
    let mockController;
    let mockMemory;

    beforeEach(() => {
        jest.useFakeTimers();
        mockBrain = { sendMessage: jest.fn() };
        mockController = { pendingTasks: new Map() };
        mockMemory = {};
        am = new AutonomyManager(mockBrain, mockController, mockMemory);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('scheduleNextAwakening should set a timeout', () => {
        am.scheduleNextAwakening();
        expect(jest.getTimerCount()).toBe(1);
    });

    test('timeWatcher should read and execute due tasks', async () => {
        const scheduleFile = '/tmp/logs/schedules.json';
        fs.existsSync.mockReturnValue(true);
        const now = Date.now();
        const tasks = [
            { time: new Date(now - 1000).toISOString(), task: 'due task' },
            { time: new Date(now + 10000).toISOString(), task: 'future task' }
        ];
        fs.readFileSync.mockReturnValue(JSON.stringify(tasks));
        
        am.convoManager = { enqueue: jest.fn() };
        
        await am.timeWatcher();
        
        expect(am.convoManager.enqueue).toHaveBeenCalledWith(
            expect.anything(), 
            expect.stringContaining('due task'), 
            expect.anything()
        );
        // Should write back 1 remaining task
        expect(fs.writeFileSync).toHaveBeenCalledWith(scheduleFile, expect.stringContaining('future task'));
    });

    test('getAdminContext should return valid system context', async () => {
        const ctx = await am.getAdminContext();
        expect(ctx.isAdmin).toBe(true);
        expect(ctx.platform).toBe('autonomy');
    });
});
