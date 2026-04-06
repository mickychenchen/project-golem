const fs = require('fs');
const path = require('path');
const util = require('util');
const { execFile } = require('child_process');

const ConfigManager = require('../config');
const Executor = require('../core/Executor');
const ResponseParser = require('../utils/ResponseParser');

const execFileAsync = util.promisify(execFile);

class ResearchManager {
    constructor(brain, controller, options = {}) {
        this.brain = brain;
        this.controller = controller;
        this.golemId = options.golemId || 'default';
        this.repoRoot = options.repoRoot || process.cwd();
        this.logBaseDir = options.logBaseDir || ConfigManager.LOG_BASE_DIR;
        this.executor = options.executor || new Executor();
        this.nowFn = options.nowFn || (() => new Date());

        this.activeRun = null;
        this.lastRun = null;
        this.destroyed = false;
    }

    async startRun(rawConfig = {}) {
        if (this.destroyed) {
            throw new Error('ResearchManager 已關閉，無法啟動研究任務。');
        }
        if (this.activeRun && (this.activeRun.state === 'running' || this.activeRun.state === 'stopping')) {
            throw new Error(`已有進行中的研究任務 (${this.activeRun.id})，請先 /research stop。`);
        }

        const config = this._validateConfig(rawConfig);
        const run = await this._prepareRun(config);

        this.activeRun = run;
        this.lastRun = this._snapshot(run);
        this._persistRun(run);
        this._appendEvent(run, 'run-started', {
            branch: run.branchName,
            worktree: run.worktreeDir,
            rounds: run.config.rounds
        });

        run.promise = this._runLoop(run).catch((error) => {
            run.state = 'failed';
            run.lastError = error.message;
            run.updatedAt = this._nowIso();
            this._appendEvent(run, 'run-failed', { error: error.message });
            this._persistRun(run);
            this.lastRun = this._snapshot(run);
            if (this.activeRun && this.activeRun.id === run.id) {
                this.activeRun = null;
            }
        });

        return {
            runId: run.id,
            state: run.state,
            branch: run.branchName,
            rounds: run.config.rounds,
            runDir: run.runDir,
            editableFiles: [...run.config.editableFiles]
        };
    }

    getStatus() {
        if (this.activeRun) {
            return {
                hasActiveRun: true,
                ...this._snapshot(this.activeRun)
            };
        }
        if (this.lastRun) {
            return {
                hasActiveRun: false,
                ...this.lastRun
            };
        }
        return {
            hasActiveRun: false,
            state: 'idle'
        };
    }

    async stopRun() {
        if (!this.activeRun) {
            return { stopped: false, message: '目前沒有進行中的研究任務。' };
        }
        if (this.activeRun.state !== 'running' && this.activeRun.state !== 'stopping') {
            return { stopped: false, message: `目前任務狀態為 ${this.activeRun.state}，無需停止。` };
        }

        this.activeRun.stopRequested = true;
        this.activeRun.state = 'stopping';
        this.activeRun.updatedAt = this._nowIso();
        this._appendEvent(this.activeRun, 'stop-requested', {});
        this._persistRun(this.activeRun);

        return { stopped: true, message: `已標記停止研究任務 (${this.activeRun.id})，將在本回合結束後停止。` };
    }

    async suggestEditableFiles(objective, limit = 5) {
        const maxFiles = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 10) : 5;
        const tokens = String(objective || '')
            .toLowerCase()
            .split(/[^a-z0-9_\u4e00-\u9fff]+/)
            .map((t) => t.trim())
            .filter((t) => t.length >= 2);

        let trackedFiles = [];
        try {
            const raw = await this._runGit(['ls-files'], { cwd: this.repoRoot });
            trackedFiles = raw.split('\n').map((s) => s.trim()).filter(Boolean);
        } catch (error) {
            trackedFiles = [];
        }

        const candidates = trackedFiles.filter((file) => this._isAutoScopeCandidate(file));
        if (candidates.length === 0) {
            return this._defaultAutoScopeFiles(maxFiles);
        }

        const scored = candidates.map((file) => {
            const lower = file.toLowerCase();
            let score = 0;
            for (const token of tokens) {
                if (lower.includes(token)) score += 3;
                if (path.basename(lower).includes(token)) score += 2;
            }
            if (lower.includes('test')) score += 1;
            if (lower.startsWith('src/')) score += 1;
            return { file, score };
        });

        let selected = scored
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score || a.file.length - b.file.length)
            .slice(0, maxFiles)
            .map((item) => item.file);

        if (selected.length === 0) {
            selected = this._defaultAutoScopeFiles(maxFiles);
        }

        return selected;
    }

    async suggestRunDefaults(input = {}) {
        const raw = input && typeof input === 'object' ? input : {};
        const objective = String(raw.objective || '').trim();
        if (!objective) {
            throw new Error('缺少研究主題（objective）。');
        }

        let editableFiles = [];
        if (Array.isArray(raw.editableFiles) && raw.editableFiles.length > 0) {
            editableFiles = raw.editableFiles.map((file) => this._normalizeRepoRelativeFile(file));
        } else {
            editableFiles = await this.suggestEditableFiles(objective, 5);
        }

        if (!Array.isArray(editableFiles) || editableFiles.length === 0) {
            throw new Error('無法推測可編輯檔案，請改用 --files 或 JSON editableFiles 指定。');
        }

        const evalCommand = String(raw.evalCommand || '').trim() || await this._buildDefaultEvalCommand(editableFiles);
        const scoreRegex = String(raw.scoreRegex || '').trim() || 'Test Suites:\\s*(?:\\d+\\s*failed,\\s*)?(\\d+)\\s*passed';
        const scoreMode = String(raw.scoreMode || '').trim().toLowerCase() || 'max';

        const rounds = raw.rounds === undefined ? 8 : raw.rounds;
        const timeoutMs = raw.timeoutMs === undefined ? 600000 : raw.timeoutMs;

        return {
            ...raw,
            objective,
            editableFiles,
            evalCommand,
            scoreRegex,
            scoreMode,
            rounds,
            timeoutMs
        };
    }

    async destroy() {
        this.destroyed = true;
        if (this.activeRun && (this.activeRun.state === 'running' || this.activeRun.state === 'stopping')) {
            this.activeRun.stopRequested = true;
            this.activeRun.state = 'stopping';
            this._persistRun(this.activeRun);
            if (this.activeRun.promise) {
                try {
                    await this.activeRun.promise;
                } catch (error) {
                    // ignore during shutdown
                }
            }
        }
    }

    _validateConfig(rawConfig) {
        if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
            throw new Error('research start payload 必須是 JSON 物件。');
        }

        const objective = String(rawConfig.objective || '').trim();
        if (!objective) {
            throw new Error('`objective` 為必填字串。');
        }

        if (!Array.isArray(rawConfig.editableFiles) || rawConfig.editableFiles.length === 0) {
            throw new Error('`editableFiles` 必須是非空陣列。');
        }
        const editableFiles = rawConfig.editableFiles.map((file) => this._normalizeRepoRelativeFile(file));
        const editableFileSet = new Set(editableFiles);
        if (editableFiles.length !== editableFileSet.size) {
            throw new Error('`editableFiles` 不可包含重複檔案。');
        }

        const evalCommand = String(rawConfig.evalCommand || '').trim();
        if (!evalCommand) {
            throw new Error('`evalCommand` 為必填字串。');
        }
        this._assertEvalCommandSafety(evalCommand);

        const scoreRegexSource = String(rawConfig.scoreRegex || '').trim();
        if (!scoreRegexSource) {
            throw new Error('`scoreRegex` 為必填字串。');
        }
        const scoreRegex = this._compileScoreRegex(scoreRegexSource);
        if (!/\((?!\?)/.test(scoreRegex.source)) {
            throw new Error('`scoreRegex` 必須包含至少一個擷取群組，第一組需為分數。');
        }

        const scoreModeRaw = String(rawConfig.scoreMode || 'min').trim().toLowerCase();
        if (!['min', 'max'].includes(scoreModeRaw)) {
            throw new Error('`scoreMode` 僅支援 "min" 或 "max"。');
        }

        const roundsRaw = rawConfig.rounds === undefined ? 12 : Number(rawConfig.rounds);
        if (!Number.isInteger(roundsRaw) || roundsRaw <= 0) {
            throw new Error('`rounds` 必須是正整數。');
        }
        const rounds = Math.min(roundsRaw, 30);

        const timeoutRaw = rawConfig.timeoutMs === undefined ? 600000 : Number(rawConfig.timeoutMs);
        if (!Number.isFinite(timeoutRaw) || timeoutRaw < 1000) {
            throw new Error('`timeoutMs` 必須為 >= 1000 的數字。');
        }
        const timeoutMs = Math.min(timeoutRaw, 3600000);

        const tag = this._sanitizeTag(rawConfig.tag) || this._defaultTag();

        return {
            objective,
            editableFiles,
            editableFileSet,
            evalCommand,
            scoreRegexSource,
            scoreRegex,
            scoreMode: scoreModeRaw,
            rounds,
            timeoutMs,
            tag
        };
    }

    async _prepareRun(config) {
        const rootDir = path.join(this.logBaseDir, 'autoresearch');
        fs.mkdirSync(rootDir, { recursive: true });

        const runId = `${config.tag}-${Date.now()}`;
        const runDir = path.join(rootDir, runId);
        const worktreeDir = path.join(runDir, 'worktree');
        const branchName = `autoresearch/${config.tag}`;

        fs.mkdirSync(runDir, { recursive: true });
        this._assertBranchAvailable(branchName);

        await this._runGit(['worktree', 'add', '-b', branchName, worktreeDir, 'HEAD'], { cwd: this.repoRoot });
        const baseCommit = (await this._runGit(['rev-parse', 'HEAD'], { cwd: worktreeDir })).trim();

        const runJsonPath = path.join(runDir, 'run.json');
        const resultsPath = path.join(runDir, 'results.tsv');
        const eventsPath = path.join(runDir, 'events.jsonl');

        fs.writeFileSync(resultsPath, 'round\tcommit\tscore\tstatus\tnote\tduration_ms\n', 'utf8');
        fs.writeFileSync(eventsPath, '', 'utf8');
        fs.writeFileSync(path.join(rootDir, 'latest'), `${runId}\n`, 'utf8');

        return {
            id: runId,
            state: 'running',
            createdAt: this._nowIso(),
            updatedAt: this._nowIso(),
            completedAt: null,
            branchName,
            worktreeDir,
            runDir,
            runJsonPath,
            resultsPath,
            eventsPath,
            round: 0,
            completedRounds: 0,
            stopRequested: false,
            config,
            baseCommit,
            bestCommit: baseCommit,
            bestScore: null,
            lastScore: null,
            lastError: null,
            promise: null
        };
    }

    _assertBranchAvailable(branchName) {
        try {
            require('child_process').execFileSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`], {
                cwd: this.repoRoot,
                stdio: 'ignore'
            });
            throw new Error(`git branch ${branchName} 已存在，請更換 tag。`);
        } catch (error) {
            if (error.message.includes('已存在')) throw error;
        }
    }

    async _runLoop(run) {
        await this._recordBaseline(run);

        for (let round = 1; round <= run.config.rounds; round++) {
            if (run.stopRequested) break;

            run.round = round;
            run.updatedAt = this._nowIso();
            this._persistRun(run);

            await this._executeRound(run, round);

            run.completedRounds = round;
            run.updatedAt = this._nowIso();
            this._persistRun(run);
        }

        run.state = 'stopped';
        run.completedAt = this._nowIso();
        run.updatedAt = this._nowIso();
        this._appendEvent(run, 'run-stopped', {
            reason: run.stopRequested ? 'stop_requested' : 'max_rounds_reached',
            bestScore: run.bestScore,
            bestCommit: run.bestCommit
        });
        this._persistRun(run);
        this.lastRun = this._snapshot(run);

        if (this.activeRun && this.activeRun.id === run.id) {
            this.activeRun = null;
        }
    }

    async _recordBaseline(run) {
        const startedAt = Date.now();
        let output;
        try {
            output = await this._runEval(run);
        } catch (error) {
            throw new Error(`Baseline 評估失敗: ${error.message}`);
        }
        const score = this._extractScore(output, run.config.scoreRegex);
        run.bestScore = score;
        run.lastScore = score;
        run.updatedAt = this._nowIso();

        this._appendResult(run, {
            round: 0,
            commit: run.baseCommit,
            score,
            status: 'keep',
            note: 'baseline',
            durationMs: Date.now() - startedAt
        });
        this._appendEvent(run, 'baseline-recorded', {
            score,
            commit: run.baseCommit
        });
        this._persistRun(run);
    }

    async _executeRound(run, round) {
        const startedAt = Date.now();
        let roundStatus = 'crash';
        let note = '';
        let score = null;
        let commitHash = run.bestCommit;

        try {
            const action = await this._requestMutationAction(run, round);
            const normalizedAction = this._validateMutationAction(action, run.config.editableFileSet);
            this._applyMutationAction(run, normalizedAction);

            const hasDiff = await this._hasAllowlistDiff(run);
            if (!hasDiff) {
                roundStatus = 'discard';
                note = 'no-diff';
                await this._discardToBest(run);
                return;
            }

            commitHash = await this._commitCandidate(run, round, normalizedAction);

            const output = await this._runEval(run);
            score = this._extractScore(output, run.config.scoreRegex);
            run.lastScore = score;

            if (this._isBetter(score, run.bestScore, run.config.scoreMode)) {
                run.bestScore = score;
                run.bestCommit = commitHash;
                roundStatus = 'keep';
                note = 'improved';
            } else {
                await this._discardToBest(run);
                roundStatus = 'discard';
                note = 'not-better';
            }
        } catch (error) {
            roundStatus = 'crash';
            note = error.message;
            run.lastError = error.message;
            await this._discardToBest(run);
        } finally {
            this._appendResult(run, {
                round,
                commit: commitHash,
                score,
                status: roundStatus,
                note,
                durationMs: Date.now() - startedAt
            });
            this._appendEvent(run, 'round-finished', {
                round,
                status: roundStatus,
                score,
                commit: commitHash,
                bestScore: run.bestScore,
                bestCommit: run.bestCommit,
                note
            });
        }
    }

    async _requestMutationAction(run, round) {
        const prompt = [
            '【SYSTEM: AUTORESEARCH ROUND】',
            `目標: ${run.config.objective}`,
            `目前回合: ${round}/${run.config.rounds}`,
            `最佳分數: ${run.bestScore}`,
            `最佳 commit: ${run.bestCommit}`,
            '限制規則:',
            '- 你只能產生 1 個 self-evolution action。',
            '- 只允許修改下列檔案之一:',
            ...run.config.editableFiles.map((file) => `  - ${file}`),
            '- 不可新增依賴、不可修改 allowlist 外檔案。',
            '- 回傳格式必須是 [GOLEM_ACTION] JSON，且 action= "self-evolution"。',
            '- 不需要附加 [GOLEM_REPLY] 長文，只給 action。'
        ].join('\n');

        const raw = await this.brain.sendMessage(prompt, false, {
            suppressReply: true,
            isSystemFeedback: true
        });
        const responseText = raw && typeof raw === 'object' ? String(raw.text || '') : String(raw || '');
        const parsed = ResponseParser.parse(responseText);
        const actions = (parsed.actions || []).filter((step) => step && String(step.action || '').toLowerCase() === 'self-evolution');

        if (actions.length !== 1) {
            throw new Error(`模型未回傳唯一 self-evolution action (收到 ${actions.length} 個)。`);
        }
        return actions[0];
    }

    _validateMutationAction(action, editableFileSet) {
        if (!action || typeof action !== 'object') {
            throw new Error('mutation action 格式無效。');
        }

        const normalizedFile = this._normalizeRepoRelativeFile(action.file);
        if (!editableFileSet.has(normalizedFile)) {
            throw new Error(`mutation 嘗試修改未授權檔案: ${normalizedFile}`);
        }

        const hasContent = Object.prototype.hasOwnProperty.call(action, 'content');
        const hasFind = Object.prototype.hasOwnProperty.call(action, 'find');
        const hasReplace = Object.prototype.hasOwnProperty.call(action, 'replace');

        if (hasContent && (hasFind || hasReplace)) {
            throw new Error('mutation action 不可同時使用 content 與 find/replace。');
        }
        if (!hasContent && !(hasFind && hasReplace)) {
            throw new Error('mutation action 必須提供 content 或 find+replace。');
        }

        return {
            ...action,
            file: normalizedFile
        };
    }

    _applyMutationAction(run, action) {
        const targetPath = path.resolve(run.worktreeDir, action.file);
        if (!targetPath.startsWith(run.worktreeDir + path.sep) && targetPath !== run.worktreeDir) {
            throw new Error(`非法檔案路徑: ${action.file}`);
        }
        if (!fs.existsSync(targetPath)) {
            throw new Error(`目標檔案不存在: ${action.file}`);
        }

        const original = fs.readFileSync(targetPath, 'utf8');
        if (Object.prototype.hasOwnProperty.call(action, 'content')) {
            fs.writeFileSync(targetPath, String(action.content), 'utf8');
            return;
        }

        const findText = String(action.find);
        const replaceText = String(action.replace);
        if (!original.includes(findText)) {
            throw new Error(`find 片段未命中: ${action.file}`);
        }
        const updated = original.replace(findText, replaceText);
        fs.writeFileSync(targetPath, updated, 'utf8');
    }

    async _hasAllowlistDiff(run) {
        const status = await this._runGit(['status', '--porcelain', '--', ...run.config.editableFiles], {
            cwd: run.worktreeDir
        });
        return status.trim().length > 0;
    }

    async _commitCandidate(run, round, action) {
        await this._runGit(['add', '--', ...run.config.editableFiles], { cwd: run.worktreeDir });
        await this._runGit(['commit', '--no-gpg-sign', '-m', `autoresearch round ${round}: ${action.file}`], {
            cwd: run.worktreeDir
        });
        return (await this._runGit(['rev-parse', 'HEAD'], { cwd: run.worktreeDir })).trim();
    }

    async _runEval(run) {
        return this.executor.run(run.config.evalCommand, {
            cwd: run.worktreeDir,
            timeout: run.config.timeoutMs
        });
    }

    _extractScore(output, scoreRegex) {
        const text = String(output || '');
        const match = scoreRegex.exec(text);
        if (!match || match[1] === undefined) {
            throw new Error('無法從評估輸出解析分數，請確認 scoreRegex。');
        }
        const score = Number(match[1]);
        if (!Number.isFinite(score)) {
            throw new Error(`擷取到的分數不是有效數字: ${match[1]}`);
        }
        return score;
    }

    _isBetter(candidate, best, scoreMode) {
        if (!Number.isFinite(candidate)) return false;
        if (!Number.isFinite(best)) return true;
        if (scoreMode === 'max') return candidate > best;
        return candidate < best;
    }

    async _discardToBest(run) {
        if (!run.bestCommit) return;
        await this._runGit(['reset', '--hard', run.bestCommit], { cwd: run.worktreeDir });
    }

    async _runGit(args, options = {}) {
        const cwd = options.cwd || this.repoRoot;
        try {
            const { stdout } = await execFileAsync('git', args, {
                cwd,
                timeout: options.timeout || 120000,
                maxBuffer: 1024 * 1024 * 10
            });
            return String(stdout || '');
        } catch (error) {
            const stderr = error && error.stderr ? String(error.stderr) : '';
            const stdout = error && error.stdout ? String(error.stdout) : '';
            throw new Error(`git ${args.join(' ')} 失敗: ${stderr || stdout || error.message}`);
        }
    }

    _appendResult(run, row) {
        const scoreText = Number.isFinite(row.score) ? String(row.score) : '';
        const safeNote = this._safeTsv(row.note || '');
        const safeStatus = this._safeTsv(row.status || '');
        const line = `${row.round}\t${row.commit || ''}\t${scoreText}\t${safeStatus}\t${safeNote}\t${row.durationMs || 0}\n`;
        fs.appendFileSync(run.resultsPath, line, 'utf8');
    }

    _appendEvent(run, type, payload) {
        const event = {
            time: this._nowIso(),
            type,
            golemId: this.golemId,
            runId: run.id,
            ...payload
        };
        fs.appendFileSync(run.eventsPath, `${JSON.stringify(event)}\n`, 'utf8');
    }

    _persistRun(run) {
        run.updatedAt = this._nowIso();
        fs.writeFileSync(run.runJsonPath, `${JSON.stringify(this._snapshot(run), null, 2)}\n`, 'utf8');
    }

    _snapshot(run) {
        return {
            id: run.id,
            state: run.state,
            createdAt: run.createdAt,
            updatedAt: run.updatedAt,
            completedAt: run.completedAt,
            branchName: run.branchName,
            worktreeDir: run.worktreeDir,
            runDir: run.runDir,
            round: run.round,
            completedRounds: run.completedRounds,
            stopRequested: run.stopRequested,
            baseCommit: run.baseCommit,
            bestCommit: run.bestCommit,
            bestScore: run.bestScore,
            lastScore: run.lastScore,
            lastError: run.lastError,
            config: {
                objective: run.config.objective,
                editableFiles: run.config.editableFiles,
                evalCommand: run.config.evalCommand,
                scoreRegex: run.config.scoreRegexSource,
                scoreMode: run.config.scoreMode,
                rounds: run.config.rounds,
                timeoutMs: run.config.timeoutMs,
                tag: run.config.tag
            }
        };
    }

    _safeTsv(text) {
        return String(text).replace(/\t/g, ' ').replace(/\r?\n/g, ' ').trim();
    }

    _isAutoScopeCandidate(file) {
        const normalized = String(file || '').trim();
        if (!normalized) return false;
        if (normalized.startsWith('docs/')) return false;
        if (normalized.startsWith('logs/')) return false;
        if (normalized.startsWith('data/')) return false;
        if (normalized.startsWith('assets/')) return false;
        if (normalized.startsWith('node_modules/')) return false;
        if (normalized.endsWith('.md')) return false;
        if (normalized.endsWith('.png') || normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return false;
        return /\.(js|ts|tsx|json|sh)$/i.test(normalized);
    }

    _defaultAutoScopeFiles(limit) {
        const seeds = [
            'src/core/TaskController.js',
            'src/core/ConversationManager.js',
            'src/core/action_handlers/CommandHandler.js',
            'src/core/NodeRouter.js',
            'src/managers/AutonomyManager.js',
            'apps/runtime/index.js'
        ];
        const existing = seeds.filter((file) => fs.existsSync(path.resolve(this.repoRoot, file)));
        return existing.slice(0, limit);
    }

    async _buildDefaultEvalCommand(editableFiles) {
        const suggestedTests = await this._suggestTestFilesForEditableFiles(editableFiles, 8);
        if (suggestedTests.length > 0) {
            return `npm test -- ${suggestedTests.join(' ')}`;
        }

        const fallback = [
            'tests/ConversationManager.test.js',
            'tests/CommandHandler.test.js',
            'tests/TaskController.test.js',
            'tests/NeuroShunter.test.js',
            'tests/AutonomyManager.test.js'
        ].filter((file) => fs.existsSync(path.resolve(this.repoRoot, file)));

        if (fallback.length > 0) {
            return `npm test -- ${fallback.join(' ')}`;
        }

        return 'npm test';
    }

    async _suggestTestFilesForEditableFiles(editableFiles, limit = 8) {
        let trackedFiles = [];
        try {
            const raw = await this._runGit(['ls-files'], { cwd: this.repoRoot });
            trackedFiles = raw.split('\n').map((s) => s.trim()).filter(Boolean);
        } catch (error) {
            trackedFiles = [];
        }

        const tests = trackedFiles.filter((file) => /^tests\/.+\.test\.(js|ts)$/i.test(file));
        if (tests.length === 0) return [];

        const selected = new Set();
        for (const sourceFile of editableFiles) {
            const base = path.basename(sourceFile, path.extname(sourceFile)).toLowerCase();
            const compact = base.replace(/[^a-z0-9]/g, '');
            for (const testFile of tests) {
                const lower = testFile.toLowerCase();
                const lowerCompact = lower.replace(/[^a-z0-9]/g, '');
                if (lower.includes(base) || (compact && lowerCompact.includes(compact))) {
                    selected.add(testFile);
                }
            }
        }

        return Array.from(selected).slice(0, limit);
    }

    _compileScoreRegex(rawInput) {
        const text = String(rawInput).trim();
        const slashStyle = text.match(/^\/([\s\S]*)\/([a-z]*)$/i);
        if (slashStyle) {
            const pattern = slashStyle[1];
            let flags = slashStyle[2] || '';
            flags = flags.replace(/g/g, '');
            if (!flags.includes('m')) flags += 'm';
            return new RegExp(pattern, flags);
        }
        return new RegExp(text, 'm');
    }

    _assertEvalCommandSafety(command) {
        if (/\r|\n/.test(command)) {
            throw new Error('evalCommand 不可包含換行。');
        }
        if (/[;&`]|(\|\|)|(&&)|\$\(|\||>|</.test(command)) {
            throw new Error('evalCommand 包含高風險 shell 控制符號，已拒絕。');
        }

        const lowered = command.toLowerCase();
        const blockedKeywords = [' rm ', 'sudo', 'chmod', 'chown', 'mkfs', ' dd ', 'shutdown', 'reboot', 'curl', 'wget'];
        for (const keyword of blockedKeywords) {
            if (` ${lowered} `.includes(keyword)) {
                throw new Error(`evalCommand 命中風險關鍵字: ${keyword.trim()}`);
            }
        }

        const base = command.trim().split(/\s+/)[0];
        const allowedBases = new Set(['npm', 'node', 'npx', 'jest', 'pytest', 'python', 'python3', 'uv', 'cargo', 'go']);
        if (!allowedBases.has(base)) {
            throw new Error(`evalCommand 僅允許以下起始指令: ${Array.from(allowedBases).join(', ')}`);
        }
    }

    _normalizeRepoRelativeFile(file) {
        const raw = String(file || '').trim();
        if (!raw) {
            throw new Error('editableFiles 內含空字串。');
        }

        const normalized = path.posix.normalize(raw.replace(/\\/g, '/'));
        if (normalized.startsWith('/') || normalized.startsWith('../') || normalized.includes('/../')) {
            throw new Error(`editableFiles 路徑非法: ${raw}`);
        }

        const abs = path.resolve(this.repoRoot, normalized);
        if (!abs.startsWith(this.repoRoot + path.sep) && abs !== this.repoRoot) {
            throw new Error(`editableFiles 超出專案範圍: ${raw}`);
        }
        if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
            throw new Error(`editableFiles 目標不存在或非檔案: ${normalized}`);
        }

        return normalized;
    }

    _sanitizeTag(rawTag) {
        const text = String(rawTag || '').trim().toLowerCase();
        if (!text) return '';
        const sanitized = text.replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        if (!sanitized) return '';
        return sanitized.slice(0, 40);
    }

    _defaultTag() {
        const now = this.nowFn();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}${m}${d}`;
    }

    _nowIso() {
        return this.nowFn().toISOString();
    }
}

module.exports = ResearchManager;
