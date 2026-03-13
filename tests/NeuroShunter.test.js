jest.mock('../src/utils/ResponseParser');
// Mock all handlers to avoid side effects
jest.mock('../src/core/action_handlers/CommandHandler', () => ({ execute: jest.fn() }));
jest.mock('../src/core/action_handlers/SkillHandler', () => ({ execute: jest.fn().mockResolvedValue(true) }));
jest.mock('../src/core/action_handlers/MultiAgentHandler', () => ({ execute: jest.fn() }));

const NeuroShunter = require('../src/core/NeuroShunter');
const ResponseParser = require('../src/utils/ResponseParser');

describe('NeuroShunter', () => {
    let mockCtx;
    let mockBrain;
    let mockController;

    beforeEach(() => {
        jest.clearAllMocks();
        mockCtx = {
            reply: jest.fn().mockResolvedValue(),
            sendTyping: jest.fn().mockResolvedValue(),
            platform: 'default'
        };
        mockBrain = {
            _appendChatLog: jest.fn(),
            memorize: jest.fn().mockResolvedValue()
        };
        mockController = {
            actionQueue: { enqueue: jest.fn() }
        };
    });

    test('dispatch should handle reply correctly', async () => {
        ResponseParser.parse.mockReturnValue({
            memory: null,
            reply: 'Hello World',
            actions: []
        });

        await NeuroShunter.dispatch(mockCtx, 'raw', mockBrain, mockController);

        expect(mockCtx.reply).toHaveBeenCalledWith('Hello World');
    });

    test('dispatch should handle memory update', async () => {
        ResponseParser.parse.mockReturnValue({
            memory: 'some memory',
            reply: null,
            actions: []
        });

        await NeuroShunter.dispatch(mockCtx, 'raw', mockBrain, mockController);

        expect(mockBrain.memorize).toHaveBeenCalledWith('some memory', expect.anything());
    });
});
