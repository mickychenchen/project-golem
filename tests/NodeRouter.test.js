jest.mock('../src/managers/SkillArchitect', () => {
    return jest.fn().mockImplementation(() => ({
        designSkill: jest.fn()
    }));
});

const NodeRouter = require('../src/core/NodeRouter');

describe('NodeRouter /research commands', () => {
    let ctx;
    let brain;
    let researchManager;

    beforeEach(() => {
        ctx = {
            text: '',
            reply: jest.fn().mockResolvedValue()
        };

        researchManager = {
            startRun: jest.fn(),
            stopRun: jest.fn(),
            getStatus: jest.fn(),
            suggestRunDefaults: jest.fn(async (payload) => payload),
            suggestEditableFiles: jest.fn().mockResolvedValue(['src/auto-picked.js'])
        };

        brain = {
            userDataDir: '/tmp',
            researchManager
        };
    });

    test('/research status returns active status', async () => {
        ctx.text = '/research status';
        researchManager.getStatus.mockReturnValue({
            id: 'run-1',
            state: 'running',
            completedRounds: 2,
            config: { rounds: 12 },
            bestScore: 0.93,
            bestCommit: 'abc123'
        });

        await NodeRouter.handle(ctx, brain);

        expect(researchManager.getStatus).toHaveBeenCalled();
        expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Research Status'), expect.any(Object));
    });

    test('/research start rejects malformed JSON', async () => {
        ctx.text = '/research start {"objective":';

        await NodeRouter.handle(ctx, brain);

        expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('無法解析 /research start payload'), expect.any(Object));
        expect(researchManager.startRun).not.toHaveBeenCalled();
    });

    test('/research start dispatches parsed payload', async () => {
        ctx.text = '/research start {"objective":"opt","editableFiles":["src/a.js"],"evalCommand":"npm test -- tests/a.test.js","scoreRegex":"score: ([0-9.]+)"}';
        researchManager.startRun.mockResolvedValue({
            runId: 'run-2',
            branch: 'autoresearch/t',
            rounds: 12,
            runDir: '/tmp/run-2'
        });

        await NodeRouter.handle(ctx, brain);

        expect(researchManager.startRun).toHaveBeenCalledWith({
            objective: 'opt',
            editableFiles: ['src/a.js'],
            evalCommand: 'npm test -- tests/a.test.js',
            scoreRegex: 'score: ([0-9.]+)'
        });
        expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('已啟動研究迴圈'), expect.any(Object));
    });

    test('/research stop dispatches stop request', async () => {
        ctx.text = '/research stop';
        researchManager.stopRun.mockResolvedValue({
            stopped: true,
            message: 'stopping'
        });

        await NodeRouter.handle(ctx, brain);

        expect(researchManager.stopRun).toHaveBeenCalled();
        expect(ctx.reply).toHaveBeenCalledWith('stopping', expect.any(Object));
    });

    test('research start (non-JSON natural flags) auto-picks files and starts run', async () => {
        ctx.text = 'research start 優化 TaskController 穩定性 --eval "npm test -- tests/TaskController.test.js" --score "Failed: (\\\\d+)" --mode min --rounds 8';
        researchManager.startRun.mockResolvedValue({
            runId: 'run-natural',
            branch: 'autoresearch/natural',
            rounds: 8,
            runDir: '/tmp/run-natural',
            editableFiles: ['src/auto-picked.js']
        });

        await NodeRouter.handle(ctx, brain);

        expect(researchManager.suggestRunDefaults).toHaveBeenCalled();
        expect(researchManager.startRun).toHaveBeenCalledWith(expect.objectContaining({
            objective: '優化 TaskController 穩定性',
            evalCommand: 'npm test -- tests/TaskController.test.js',
            scoreRegex: 'Failed: (\\\\d+)',
            scoreMode: 'min',
            rounds: 8
        }));
    });

    test('research start with topic-only input uses auto defaults', async () => {
        ctx.text = '/research start 優化對話隊列';
        researchManager.suggestRunDefaults.mockResolvedValue({
            objective: '優化對話隊列',
            editableFiles: ['src/core/ConversationManager.js'],
            evalCommand: 'npm test -- tests/ConversationManager.test.js',
            scoreRegex: 'Test Suites:\\s*(?:\\d+\\s*failed,\\s*)?(\\d+)\\s*passed',
            scoreMode: 'max',
            rounds: 8,
            timeoutMs: 600000
        });
        researchManager.startRun.mockResolvedValue({
            runId: 'run-topic',
            branch: 'autoresearch/topic',
            rounds: 8,
            runDir: '/tmp/run-topic',
            editableFiles: ['src/core/ConversationManager.js']
        });

        await NodeRouter.handle(ctx, brain);

        expect(researchManager.suggestRunDefaults).toHaveBeenCalledWith(expect.objectContaining({
            objective: '優化對話隊列'
        }));
        expect(researchManager.startRun).toHaveBeenCalledWith(expect.objectContaining({
            objective: '優化對話隊列',
            evalCommand: 'npm test -- tests/ConversationManager.test.js',
            scoreMode: 'max'
        }));
        expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('已啟動研究迴圈'), expect.any(Object));
    });
});
