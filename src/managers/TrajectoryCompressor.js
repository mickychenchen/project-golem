// ============================================================
// 🗜️ TrajectoryCompressor — 對話軌跡動態壓縮引擎
// 靈感來自 NousResearch/hermes-agent trajectory_compressor.py
// 策略：保護頭部 N 輪 + 尾部 N 輪，用 LLM 摘要壓縮中段
// ============================================================

/**
 * 壓縮後的 summary 訊息前綴（對齊 Hermes 格式）
 */
const SUMMARY_PREFIX = '[CONTEXT SUMMARY]:';

/**
 * @typedef {{ role: string, content: string }} Turn
 */

class TrajectoryCompressor {
    /**
     * @param {object} brain - GolemBrain 實體（提供 _wikiChat 輕量 LLM 呼叫）
     * @param {object} [options]
     * @param {number} [options.targetChars=80000]        - 目標字元上限
     * @param {number} [options.summaryTargetChars=1500]  - 摘要目標長度
     * @param {number} [options.protectFirstTurns=3]      - 保護頭部輪數
     * @param {number} [options.protectLastTurns=5]       - 保護尾部輪數
     * @param {number} [options.minCompressThreshold=5]   - 最少幾輪才嘗試壓縮
     */
    constructor(brain, options = {}) {
        this.brain = brain;
        this.targetChars = options.targetChars ?? 80000;
        this.summaryTargetChars = options.summaryTargetChars ?? 1500;
        this.protectFirstTurns = options.protectFirstTurns ?? 3;
        this.protectLastTurns = options.protectLastTurns ?? 5;
        this.minCompressThreshold = options.minCompressThreshold ?? 5;
    }

    // ================================================================
    // 🔑 Public API
    // ================================================================

    /**
     * 壓縮對話串，若未超過目標字元則原樣返回
     * @param {Turn[]} turns - 對話輪次陣列
     * @returns {Promise<{ turns: Turn[], compressed: boolean, savedChars: number }>}
     */
    async compress(turns) {
        if (!Array.isArray(turns) || turns.length === 0) {
            return { turns, compressed: false, savedChars: 0 };
        }

        const totalChars = this._countChars(turns);

        // 未超標：直接返回
        if (totalChars <= this.targetChars) {
            return { turns, compressed: false, savedChars: 0 };
        }

        // 對話太短：無法壓縮
        if (turns.length < this.protectFirstTurns + this.protectLastTurns + this.minCompressThreshold) {
            console.warn(`⚠️ [TrajectoryCompressor] 對話輪數不足（${turns.length} 輪），無法壓縮。`);
            return { turns, compressed: false, savedChars: 0 };
        }

        return this._doCompress(turns, totalChars);
    }

    /**
     * 批量壓縮多組對話（適用於 log-archive 等批量場景）
     * @param {Turn[][]} multiTurns
     * @returns {Promise<Array<{ turns: Turn[], compressed: boolean, savedChars: number }>>}
     */
    async compressBatch(multiTurns) {
        const results = [];
        for (const turns of multiTurns) {
            results.push(await this.compress(turns));
        }
        return results;
    }

    // ================================================================
    // 🔧 Private Methods
    // ================================================================

    /**
     * 實際執行壓縮邏輯
     */
    async _doCompress(turns, totalChars) {
        const n = turns.length;
        const head = turns.slice(0, this.protectFirstTurns);
        const tail = turns.slice(Math.max(this.protectFirstTurns, n - this.protectLastTurns));
        const middle = turns.slice(this.protectFirstTurns, n - this.protectLastTurns);

        if (middle.length === 0) {
            console.warn(`⚠️ [TrajectoryCompressor] 中段為空，無法壓縮。`);
            return { turns, compressed: false, savedChars: 0 };
        }

        // 計算需要節省的字元數
        const charsToSave = totalChars - this.targetChars;
        const targetToCompress = charsToSave + this.summaryTargetChars;

        // 從中段頭部累積，直到達到壓縮目標
        let accumulated = 0;
        let compressUntil = 0;

        for (let i = 0; i < middle.length; i++) {
            accumulated += (middle[i].content || '').length;
            compressUntil = i + 1;
            if (accumulated >= targetToCompress) break;
        }

        // 若中段全部壓縮仍不夠，就全壓
        if (accumulated < targetToCompress) {
            compressUntil = middle.length;
        }

        const toCompress = middle.slice(0, compressUntil);
        const remaining  = middle.slice(compressUntil);

        console.log(`🗜️ [TrajectoryCompressor] 開始壓縮 ${toCompress.length} 輪（共 ${accumulated} 字元）...`);

        // 呼叫 LLM 產生摘要
        const summary = await this._generateSummary(toCompress);

        // 組裝壓縮後的對話串
        const summaryTurn = {
            role: 'system',
            content: `${SUMMARY_PREFIX}\n${summary}`
        };

        const compressed = [...head, summaryTurn, ...remaining, ...tail];
        const newChars = this._countChars(compressed);
        const savedChars = totalChars - newChars;

        console.log(`✅ [TrajectoryCompressor] 壓縮完成：${totalChars} → ${newChars} 字元（節省 ${savedChars} 字元，${(savedChars / totalChars * 100).toFixed(1)}%）`);

        return { turns: compressed, compressed: true, savedChars };
    }

    /**
     * 呼叫 LLM（_wikiChat）產生中段摘要
     * @param {Turn[]} turns
     * @returns {Promise<string>}
     */
    async _generateSummary(turns) {
        const content = turns
            .map((t, i) => {
                const role = (t.role || 'unknown').toUpperCase();
                let text = t.content || '';
                // 截斷超長單輪（避免 prompt 爆炸）
                if (text.length > 3000) {
                    text = text.slice(0, 1500) + '\n...[已截斷]...\n' + text.slice(-500);
                }
                return `[第 ${i + 1} 輪 - ${role}]:\n${text}`;
            })
            .join('\n\n');

        const prompt = `以下是一段 AI 代理對話的中間片段，需要被精簡摘要以節省上下文空間。

請用**繁體中文**撰寫一個精簡但資訊完整的摘要（目標約 ${Math.round(this.summaryTargetChars / 2)}-${this.summaryTargetChars} 字），包含：
1. 助理執行了哪些主要動作（工具調用、搜尋、文件操作等）
2. 獲得了哪些關鍵資訊或結果
3. 重要的決策或發現
4. 相關數據、檔案名稱、輸出值

保持客觀、事實性描述。只輸出摘要內容，不要加任何前言或解釋。

---
待摘要片段：
${content}
---`;

        try {
            const result = await this.brain._wikiChat(prompt);
            return result && result.trim() ? result.trim() : '（此段對話包含多輪工具調用與中間步驟，已壓縮以節省上下文空間。）';
        } catch (e) {
            console.error(`❌ [TrajectoryCompressor] LLM 摘要生成失敗:`, e.message);
            return `（此段對話已壓縮。包含 ${turns.length} 輪交互，壓縮時發生錯誤：${e.message}）`;
        }
    }

    /**
     * 計算對話串的總字元數
     * @param {Turn[]} turns
     * @returns {number}
     */
    _countChars(turns) {
        return turns.reduce((sum, t) => sum + (t.content ? t.content.length : 0), 0);
    }

    // ================================================================
    // 🛠️ Static Utilities
    // ================================================================

    /**
     * 將 ChatLogManager 原始訊息陣列轉換為 Turn 格式
     * @param {object[]} messages - SQLite messages 查詢結果
     * @returns {Turn[]}
     */
    static fromChatLogMessages(messages) {
        return messages.map(m => ({
            role: m.role || m.sender || 'unknown',
            content: m.content || ''
        }));
    }

    /**
     * 將壓縮後的 Turn 陣列轉換回可供注入的字串
     * @param {Turn[]} turns
     * @returns {string}
     */
    static toInjectionString(turns) {
        return turns
            .map(t => {
                const role = t.role.toUpperCase();
                return `[${role}]: ${t.content}`;
            })
            .join('\n\n');
    }
}

module.exports = TrajectoryCompressor;
