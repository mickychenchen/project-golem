const fs = require('fs');
const os = require('os');
const path = require('path');

const ResearchManager = require('../src/managers/ResearchManager');

describe('ResearchManager', () => {
    let tempRoot;
    let repoRoot;
    let logBaseDir;
    let mockBrain;
    let manager;

    beforeEach(() => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'research-manager-'));
        repoRoot = path.join(tempRoot, 'repo');
        logBaseDir = path.join(tempRoot, 'logs', 'single');
        fs.mkdirSync(path.join(repoRoot, 'src'), { recursive: true });
        fs.mkdirSync(logBaseDir, { recursive: true });
        fs.writeFileSync(path.join(repoRoot, 'src', 'editable.js'), 'module.exports = 1;\n', 'utf8');

        mockBrain = {
            sendMessage: jest.fn()
        };

        manager = new ResearchManager(mockBrain, {}, {
            repoRoot,
            logBaseDir,
            executor: { run: jest.fn() }
        });
    });

    test('config validation fails for missing objective', () => {
        expect(() => manager._validateConfig({
            editableFiles: ['src/editable.js'],
            evalCommand: 'npm test -- tests/TaskController.test.js',
            scoreRegex: 'score: ([0-9.]+)'
        })).toThrow('`objective`');
    });

    test('config validation fails for invalid editable file', () => {
        expect(() => manager._validateConfig({
            objective: 'optimize',
            editableFiles: ['../oops.js'],
            evalCommand: 'npm test -- tests/TaskController.test.js',
            scoreRegex: 'score: ([0-9.]+)'
        })).toThrow('editableFiles');
    });

    test('one-active-run guard rejects second run', async () => {
        manager.activeRun = { id: 'run-1', state: 'running' };
        await expect(manager.startRun({
            objective: 'optimize',
            editableFiles: ['src/editable.js'],
            evalCommand: 'npm test -- tests/TaskController.test.js',
            scoreRegex: 'score: ([0-9.]+)'
        })).rejects.toThrow('已有進行中的研究任務');
    });

    test('score comparison handles min/max modes', () => {
        expect(manager._isBetter(9, 10, 'min')).toBe(true);
        expect(manager._isBetter(11, 10, 'min')).toBe(false);
        expect(manager._isBetter(11, 10, 'max')).toBe(true);
        expect(manager._isBetter(9, 10, 'max')).toBe(false);
    });

    test('stop behavior sets stopRequested while active', async () => {
        manager.activeRun = {
            id: 'run-2',
            state: 'running',
            stopRequested: false,
            updatedAt: new Date().toISOString(),
            runJsonPath: path.join(tempRoot, 'run.json'),
            runDir: tempRoot,
            branchName: 'autoresearch/t',
            worktreeDir: tempRoot,
            round: 0,
            completedRounds: 0,
            baseCommit: 'base',
            bestCommit: 'base',
            bestScore: null,
            lastScore: null,
            lastError: null,
            createdAt: new Date().toISOString(),
            completedAt: null,
            config: {
                objective: 'x',
                editableFiles: ['src/editable.js'],
                evalCommand: 'npm test -- tests/TaskController.test.js',
                scoreRegexSource: 'score: ([0-9.]+)',
                scoreMode: 'min',
                rounds: 1,
                timeoutMs: 1000,
                tag: 'tag'
            },
            eventsPath: path.join(tempRoot, 'events.jsonl')
        };
        fs.writeFileSync(manager.activeRun.eventsPath, '', 'utf8');

        const result = await manager.stopRun();
        expect(result.stopped).toBe(true);
        expect(manager.activeRun.stopRequested).toBe(true);
        expect(manager.activeRun.state).toBe('stopping');
    });

    test('rejects mutation outside allowlist', () => {
        fs.writeFileSync(path.join(repoRoot, 'src', 'not-allowed.js'), 'module.exports = 3;\n', 'utf8');
        const allowlist = new Set(['src/editable.js']);
        expect(() => manager._validateMutationAction({
            action: 'self-evolution',
            file: 'src/not-allowed.js',
            content: 'x'
        }, allowlist)).toThrow('未授權檔案');
    });

    test('integration-style loop keeps improvements and discards regressions', async () => {
        const runDir = path.join(tempRoot, 'run');
        fs.mkdirSync(runDir, { recursive: true });

        const run = {
            id: 'run-int',
            state: 'running',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            completedAt: null,
            branchName: 'autoresearch/int',
            worktreeDir: repoRoot,
            runDir,
            runJsonPath: path.join(runDir, 'run.json'),
            resultsPath: path.join(runDir, 'results.tsv'),
            eventsPath: path.join(runDir, 'events.jsonl'),
            round: 0,
            completedRounds: 0,
            stopRequested: false,
            config: {
                objective: 'minimize score',
                editableFiles: ['src/editable.js'],
                editableFileSet: new Set(['src/editable.js']),
                evalCommand: 'npm test -- tests/TaskController.test.js',
                scoreRegexSource: 'score:\\s*([0-9.]+)',
                scoreRegex: manager._compileScoreRegex('score:\\s*([0-9.]+)'),
                scoreMode: 'min',
                rounds: 3,
                timeoutMs: 1000,
                tag: 'int'
            },
            baseCommit: 'base-commit',
            bestCommit: 'base-commit',
            bestScore: null,
            lastScore: null,
            lastError: null,
            promise: null
        };

        fs.writeFileSync(run.resultsPath, 'round\tcommit\tscore\tstatus\tnote\tduration_ms\n', 'utf8');
        fs.writeFileSync(run.eventsPath, '', 'utf8');

        const evalOutputs = ['score: 10.0', 'score: 8.0', 'score: 7.0', 'score: 9.0']; // baseline + 3 rounds
        const commits = ['c1', 'c2', 'c3'];

        manager._runEval = jest.fn().mockImplementation(async () => evalOutputs.shift());
        manager._requestMutationAction = jest.fn().mockResolvedValue({
            action: 'self-evolution',
            file: 'src/editable.js',
            content: 'module.exports = 2;\n'
        });
        manager._validateMutationAction = jest.fn((action) => action);
        manager._applyMutationAction = jest.fn();
        manager._hasAllowlistDiff = jest.fn().mockResolvedValue(true);
        manager._commitCandidate = jest.fn().mockImplementation(async () => commits.shift());
        manager._discardToBest = jest.fn().mockResolvedValue();

        manager.activeRun = run;
        await manager._runLoop(run);

        expect(manager._discardToBest).toHaveBeenCalledTimes(1);
        expect(run.bestScore).toBe(7);
        expect(run.bestCommit).toBe('c2');
        expect(manager.activeRun).toBeNull();
        expect(run.state).toBe('stopped');

        const lines = fs.readFileSync(run.resultsPath, 'utf8').trim().split('\n');
        expect(lines.length).toBe(5); // header + baseline + 3 rounds
    });

    test('suggestEditableFiles picks likely files by objective keywords', async () => {
        manager._runGit = jest.fn().mockResolvedValue(
            [
                'src/core/TaskController.js',
                'src/core/ConversationManager.js',
                'tests/TaskController.test.js',
                'docs/golem指令說明一覽表.md'
            ].join('\n')
        );

        const files = await manager.suggestEditableFiles('優化 taskcontroller 穩定性', 3);
        expect(files).toContain('src/core/TaskController.js');
        expect(files.length).toBeLessThanOrEqual(3);
    });

    test('suggestRunDefaults can bootstrap from objective-only input', async () => {
        manager.suggestEditableFiles = jest.fn().mockResolvedValue(['src/editable.js']);
        manager._buildDefaultEvalCommand = jest.fn().mockResolvedValue('npm test -- tests/TaskController.test.js');

        const result = await manager.suggestRunDefaults({
            objective: '優化對話隊列'
        });

        expect(result.objective).toBe('優化對話隊列');
        expect(result.editableFiles).toEqual(['src/editable.js']);
        expect(result.evalCommand).toBe('npm test -- tests/TaskController.test.js');
        expect(result.scoreRegex).toContain('Test Suites');
        expect(result.scoreMode).toBe('max');
        expect(result.rounds).toBe(8);
    });

    test('suggestRunDefaults respects user-provided eval and score settings', async () => {
        const result = await manager.suggestRunDefaults({
            objective: 'opt',
            editableFiles: ['src/editable.js'],
            evalCommand: 'npm test -- tests/ConversationManager.test.js',
            scoreRegex: 'Failed: (\\d+)',
            scoreMode: 'min',
            rounds: 12
        });

        expect(result.editableFiles).toEqual(['src/editable.js']);
        expect(result.evalCommand).toBe('npm test -- tests/ConversationManager.test.js');
        expect(result.scoreRegex).toBe('Failed: (\\d+)');
        expect(result.scoreMode).toBe('min');
        expect(result.rounds).toBe(12);
    });
});
