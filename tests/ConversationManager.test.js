const ConversationManager = require('../src/core/ConversationManager');

describe('ConversationManager', () => {
    let cm;
    let mockBrain;
    let mockShunter;
    let mockController;
    let mockCtx;

    beforeEach(() => {
        jest.useFakeTimers();

        mockBrain = {
            recall: jest.fn().mockResolvedValue([]),
            sendMessage: jest.fn().mockResolvedValue({
                text: '[GOLEM_REPLY] AI Response',
                attachments: [],
                status: 'ENVELOPE_COMPLETE'
            }),
            _ensureBrowserHealth: jest.fn().mockResolvedValue(true),
            _appendChatLog: jest.fn()
        };

        mockShunter = { dispatch: jest.fn().mockResolvedValue() };
        mockController = { pendingTasks: new Map() };

        mockCtx = {
            chatId: '123',
            platform: 'telegram',
            text: 'hello',
            sendTyping: jest.fn().mockResolvedValue(),
            reply: jest.fn().mockResolvedValue({ message_id: 1 }),
            isMentioned: jest.fn().mockReturnValue(false)
        };
    });

    afterEach(() => {
        if (cm && typeof cm.destroy === 'function') cm.destroy();
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test('should debounce and merge multiple messages from same user', () => {
        cm = new ConversationManager(mockBrain, mockShunter, mockController);
        jest.spyOn(cm, '_processQueue').mockImplementation(() => {});

        cm.enqueue(mockCtx, 'msg1');
        cm.enqueue(mockCtx, 'msg2');

        expect(cm.userBuffers.has('123')).toBe(true);

        jest.advanceTimersByTime(1600);

        expect(cm.userBuffers.has('123')).toBe(false);
        expect(cm.queue.length).toBe(1);
        expect(cm.queue[0].text).toBe('msg1\nmsg2');
    });

    test('should bypass debounce for priority messages', () => {
        cm = new ConversationManager(mockBrain, mockShunter, mockController);
        jest.spyOn(cm, '_processQueue').mockImplementation(() => {});

        cm.enqueue(mockCtx, 'priority', { bypassDebounce: true, isPriority: true });

        expect(cm.queue.length).toBe(1);
        expect(cm.queue[0].text).toBe('priority');
    });

    test('should request queue approval when busy', () => {
        cm = new ConversationManager(mockBrain, mockShunter, mockController);
        jest.spyOn(cm, '_processQueue').mockImplementation(() => {});

        cm.queue.push({ ctx: mockCtx, text: 'existing', attachment: null, options: {} });
        cm.enqueue(mockCtx, 'new-msg', { bypassDebounce: true, isPriority: false });

        expect(mockCtx.reply).toHaveBeenCalledWith(
            expect.stringContaining('急件插隊'),
            expect.any(Object)
        );
        expect(mockController.pendingTasks.size).toBe(1);
    });

    test('should process queue and dispatch through shunter', async () => {
        cm = new ConversationManager(mockBrain, mockShunter, mockController);
        mockBrain.recall.mockResolvedValue([{ text: 'memory-hit' }]);

        cm.queue.push({ ctx: mockCtx, text: 'hello', attachment: null, options: {} });
        await cm._processQueue();

        expect(mockBrain.sendMessage).toHaveBeenCalledWith(
            expect.stringContaining('【相關記憶】'),
            false,
            expect.any(Object)
        );
        expect(mockShunter.dispatch).toHaveBeenCalled();
    });

    test('should retry recoverable browser-closed errors up to three attempts', async () => {
        jest.useRealTimers();
        cm = new ConversationManager(mockBrain, mockShunter, mockController);

        mockBrain.sendMessage
            .mockRejectedValueOnce(new Error('page.evaluate: Target page, context or browser has been closed'))
            .mockRejectedValueOnce(new Error('page.evaluate: Target page, context or browser has been closed'))
            .mockResolvedValueOnce({
                text: '[GOLEM_REPLY] recovered',
                attachments: [],
                status: 'ENVELOPE_COMPLETE',
            });

        cm.queue.push({ ctx: mockCtx, text: 'hello', attachment: null, options: {} });
        await cm._processQueue();

        expect(mockBrain.sendMessage).toHaveBeenCalledTimes(3);
        expect(mockBrain._ensureBrowserHealth).toHaveBeenCalledTimes(2);
        expect(mockBrain._ensureBrowserHealth).toHaveBeenCalledWith(true, { allowDuringInteraction: true });
        expect(mockShunter.dispatch).toHaveBeenCalledTimes(1);
    });

    test('should complete three consecutive direct-chat turns', async () => {
        jest.useRealTimers();
        cm = new ConversationManager(mockBrain, mockShunter, mockController);

        cm.queue.push({ ctx: mockCtx, text: 'turn-1', attachment: null, options: {} });
        cm.queue.push({ ctx: mockCtx, text: 'turn-2', attachment: null, options: {} });
        cm.queue.push({ ctx: mockCtx, text: 'turn-3', attachment: null, options: {} });

        await cm._processQueue();
        await cm._processQueue();
        await cm._processQueue();

        expect(mockBrain.sendMessage).toHaveBeenCalledTimes(3);
        expect(mockShunter.dispatch).toHaveBeenCalledTimes(3);
        expect(cm.queue.length).toBe(0);
    });
});
