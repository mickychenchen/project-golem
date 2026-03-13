const SystemLogger = require('../src/utils/SystemLogger');
const fs = require('fs');
const path = require('path');

jest.mock('fs');

describe('SystemLogger', () => {
    const logDir = '/tmp/logs';
    
    beforeEach(() => {
        jest.clearAllMocks();
        fs.existsSync.mockReturnValue(true);
        // Reset singleton state if possible
        SystemLogger.initialized = false;
        SystemLogger.logFile = null;
    });

    test('init should wrap console methods', () => {
        const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
        SystemLogger.init(logDir);
        
        console.log('test-log');
        
        expect(fs.appendFileSync).toHaveBeenCalledWith(
            expect.stringContaining('system.log'),
            expect.stringContaining('[INFO] test-log')
        );
        
        spy.mockRestore();
    });

    test('_write should respect ENABLE_SYSTEM_LOG env', () => {
        process.env.ENABLE_SYSTEM_LOG = 'false';
        SystemLogger.init(logDir);
        
        SystemLogger._write('INFO', 'should not write');
        
        expect(fs.appendFileSync).not.toHaveBeenCalled();
        delete process.env.ENABLE_SYSTEM_LOG;
    });
});
