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
            sendMessage: jest.fn().mockResolvedValue('AI Response'),
            _appendChatLog: jest.fn()
        };
        mockShunter = { dispatch: jest.fn().mockResolvedValue() };
        mockController = { pendingTasks: new Map() };
        mockCtx = {
            chatId: '123',
            sendTyping: jest.fn().mockResolvedValue(),
            reply: jest.fn().mockResolvedValue({ message_id: 1 })
        };

        cm = new ConversationManager(mockBrain, mockShunter, mockController);
        // Prevent _processQueue from running automatically during queue addition tests
        jest.spyOn(cm, '_processQueue').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test('should debounce multiple messages from same user', async () => {
        cm.enqueue(mockCtx, 'msg1');
        cm.enqueue(mockCtx, 'msg2');

        expect(cm.userBuffers.has('123')).toBe(true);
        
        // Fast forward debounce time
        jest.advanceTimersByTime(1600);
        
        expect(cm.userBuffers.has('123')).toBe(false);
        // Should have committed directly
        expect(cm.queue.length).toBe(1);
        expect(cm.queue[0].text).toBe('msg1\nmsg2');
    });

    test('should bypass debounce for priority messages', () => {
        cm.enqueue(mockCtx, 'priority', { bypassDebounce: true, isPriority: true });
        expect(cm.queue.length).toBe(1);
        expect(cm.queue[0].text).toBe('priority');
    });

    test('should handle priority approval when queue is busy', async () => {
        // Mock a busy queue
        cm.queue.push({ ctx: mockCtx, text: 'existing' });
        
        cm.enqueue(mockCtx, 'new-msg', { bypassDebounce: true, isPriority: false });
        
        expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('急件插隊'), expect.anything());
        expect(mockController.pendingTasks.size).toBe(1);
    });

    test('processQueue should execute brain and dispatch', async () => {
        // Restore real _processQueue for this test
        cm._processQueue.mockRestore();
        cm.queue.push({ ctx: mockCtx, text: 'hello' });
        
        await cm._processQueue();
        
        expect(mockBrain.sendMessage).toHaveBeenCalledWith(expect.stringContaining('hello'), expect.anything(), expect.anything());
        expect(mockShunter.dispatch).toHaveBeenCalled();
    });
});
