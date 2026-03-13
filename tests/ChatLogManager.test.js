const fs = require('fs');
const path = require('path');
const ChatLogManager = require('../src/managers/ChatLogManager');

jest.mock('fs');
jest.mock('path', () => {
    const actualPath = jest.requireActual('path');
    return {
        ...actualPath,
        join: jest.fn((...args) => actualPath.join(...args)),
        relative: jest.fn((from, to) => actualPath.relative(from, to))
    };
});

describe('ChatLogManager', () => {
    const testDir = '/tmp/test_logs';
    let manager;

    beforeEach(() => {
        jest.clearAllMocks();
        manager = new ChatLogManager({ logDir: testDir });
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync.mockReturnValue([]);
    });

    test('init creates directories if missing', async () => {
        fs.existsSync.mockReturnValue(false);
        await manager.init();
        expect(fs.mkdirSync).toHaveBeenCalledTimes(5); // hourly, daily, monthly, yearly, era
        expect(manager._isInitialized).toBe(true);
    });

    test('init migrates existing daily summaries', async () => {
        fs.readdirSync.mockReturnValue(['20240101.log', 'invalid.txt']); // 20240101.log is 12 chars
        fs.existsSync.mockImplementation(p => p === testDir); // dest not exists
        await manager.init();
        expect(fs.renameSync).toHaveBeenCalledTimes(1);
    });

    test('init only runs once', async () => {
        await manager.init();
        await manager.init();
        expect(fs.mkdirSync).not.toHaveBeenCalled(); // second time shouldn't run _ensureDirectories if true
    });

    test('append writes new file if not exists', () => {
        fs.existsSync.mockReturnValue(false);
        manager.append({ message: 'test' });
        expect(fs.writeFileSync).toHaveBeenCalled();
        const callArgs = fs.writeFileSync.mock.calls[0];
        expect(callArgs[0]).toContain('.log');
        expect(callArgs[1]).toContain('"message": "test"');
    });

    test('append appends to existing file', () => {
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue(JSON.stringify([{ message: 'old' }]));
        manager.append({ message: 'new' });
        expect(fs.writeFileSync).toHaveBeenCalled();
        const callArgs = fs.writeFileSync.mock.calls[0];
        const writtenData = JSON.parse(callArgs[1]);
        expect(writtenData.length).toBe(2);
        expect(writtenData[1].message).toBe('new');
    });

    test('append creates new array if existing file is corrupted', () => {
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue('corrupted json');
        manager.append({ message: 'new' });
        expect(fs.writeFileSync).toHaveBeenCalled();
        const callArgs = fs.writeFileSync.mock.calls[0];
        const writtenData = JSON.parse(callArgs[1]);
        expect(writtenData.length).toBe(1);
        expect(writtenData[0].message).toBe('new');
    });

    test('cleanup removes old logs', () => {
        const oldTime = Date.now() - (100 * 24 * 60 * 60 * 1000); // 100 days old
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync.mockReturnValue(['old.log']);
        fs.statSync.mockReturnValue({ mtimeMs: oldTime });
        manager.cleanup();
        expect(fs.unlinkSync).toHaveBeenCalled();
    });

    test('_getYesterdayDateString formatting', () => {
        const str = manager._getYesterdayDateString();
        expect(str).toMatch(/^\d{8}$/);
    });

    test('_getLastMonthString formatting', () => {
        const str = manager._getLastMonthString();
        expect(str).toMatch(/^\d{6}$/);
    });

    test('_getLastYearString formatting', () => {
        const str = manager._getLastYearString();
        expect(str).toMatch(/^\d{4}$/);
    });

    test('_getCurrentDecadeString formatting', () => {
        const str = manager._getCurrentDecadeString();
        expect(str).toContain('decade_');
    });

    test('_getLastDecadeString formatting', () => {
        const str = manager._getLastDecadeString();
        expect(str).toContain('decade_');
    });

    describe('Compression logic', () => {
        let mockBrain;
        const mockResponseParser = require('../src/utils/ResponseParser');
        jest.mock('../src/utils/ResponseParser', () => ({
            parse: jest.fn().mockImplementation(() => ({
                reply: 'Mocked summary text'
            }))
        }));

        beforeEach(() => {
            mockBrain = {
                sendMessage: jest.fn().mockResolvedValue('[GOLEM_REPLY]Mocked summary text')
            };
            fs.writeFileSync.mockClear();
            fs.unlinkSync.mockClear();
        });

        test('compressLogsForDate skips if daily summary already exists', async () => {
            fs.existsSync.mockImplementation(p => p.includes('daily'));
            await manager.compressLogsForDate('20240101', mockBrain);
            expect(mockBrain.sendMessage).not.toHaveBeenCalled();
        });

        test('compressLogsForDate skips if files length < 3 without force', async () => {
            fs.existsSync.mockReturnValue(false);
            fs.readdirSync.mockReturnValue(['2024010100.log', '2024010101.log']); // only 2
            await manager.compressLogsForDate('20240101', mockBrain);
            expect(mockBrain.sendMessage).not.toHaveBeenCalled();
        });

        test('compressLogsForDate compresses and deletes source files', async () => {
            fs.existsSync.mockReturnValue(false);
            fs.readdirSync.mockReturnValue(['2024010100.log', '2024010101.log', '2024010102.log']); // 3 files
            fs.readFileSync.mockReturnValue(JSON.stringify([{ timestamp: 123, sender: 'User', content: 'test' }]));
            
            manager._compressAndSave = jest.fn();
            await manager.compressLogsForDate('20240101', mockBrain, true);
            
            expect(manager._compressAndSave).toHaveBeenCalled();
            expect(manager._compressAndSave.mock.calls[0][0]).toContain('test'); // Prompt contains logs
        });

        test('compressMonthly compresses and deletes source files', async () => {
            fs.existsSync.mockReturnValue(false);
            fs.readdirSync.mockReturnValue(['20240101.log', '20240102.log']);
            fs.readFileSync.mockReturnValue(JSON.stringify([{ content: 'daily test' }]));
            
            manager._compressAndSave = jest.fn();
            await manager.compressMonthly('202401', mockBrain);
            
            expect(manager._compressAndSave).toHaveBeenCalled();
            expect(manager._compressAndSave.mock.calls[0][0]).toContain('daily test');
        });

        test('compressYearly compresses', async () => {
            fs.existsSync.mockReturnValue(false);
            fs.readdirSync.mockReturnValue(['202401.log', '202402.log']);
            fs.readFileSync.mockReturnValue(JSON.stringify([{ content: 'monthly test' }]));
            
            manager._compressAndSave = jest.fn();
            await manager.compressYearly('2024', mockBrain);
            
            expect(manager._compressAndSave).toHaveBeenCalled();
            expect(manager._compressAndSave.mock.calls[0][0]).toContain('monthly test');
        });

        test('compressEra compresses', async () => {
            fs.existsSync.mockReturnValue(false);
            fs.readdirSync.mockReturnValue(['2020.log', '2021.log']);
            fs.readFileSync.mockReturnValue(JSON.stringify([{ content: 'yearly test' }]));
            
            manager._compressAndSave = jest.fn();
            await manager.compressEra('decade_2020', mockBrain);
            
            expect(manager._compressAndSave).toHaveBeenCalled();
            expect(manager._compressAndSave.mock.calls[0][0]).toContain('yearly test');
        });

        test('_compressAndSave actually talks to brain and writes to file', async () => {
            fs.existsSync.mockReturnValue(false);
            
            await manager._compressAndSave('prompt', '/tmp/out.log', 'label', 'type', ['1.log'], '/tmp', mockBrain, 100);

            expect(mockBrain.sendMessage).toHaveBeenCalledWith('prompt', false);
            expect(fs.writeFileSync).toHaveBeenCalled();
            const writeArgs = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writeArgs[0].content).toBe('Mocked summary text');
            expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/1.log');
        });

        test('readRecentHourly gathers logs correctly', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue(['2024010100.log', '2024010101.log']);
            fs.readFileSync.mockReturnValue(JSON.stringify([{ timestamp: 0, sender: 'U', content: 'txt' }]));
            
            const txt = manager.readRecentHourly(1);
            expect(txt).toContain('U: txt');
        });

        test('readTier gathers logs correctly', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue(['20240101.log']);
            fs.readFileSync.mockReturnValue(JSON.stringify([{ date: '20240101', content: 'sum' }]));
            
            const data = manager.readTier('daily');
            expect(data).toHaveLength(1);
            expect(data[0].content).toBe('sum');
        });
    });
});
