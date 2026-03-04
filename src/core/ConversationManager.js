const { v4: uuidv4 } = require('uuid');

// ============================================================
// 🚦 Conversation Manager (隊列與防抖系統 - 多用戶隔離版)
// ============================================================
class ConversationManager {
    constructor(brain, neuroShunterClass, controller, options = {}) {
        this.golemId = options.golemId || 'default';
        this.brain = brain;
        this.NeuroShunter = neuroShunterClass;
        this.controller = controller;
        this.queue = [];
        this.isProcessing = false;
        this.userBuffers = new Map();
        this.silentMode = false;
        this.observerMode = false;
        this.interventionLevel = options.interventionLevel || 'CONSERVATIVE';
        this.DEBOUNCE_MS = 1500;
    }

    async enqueue(ctx, text, options = { isPriority: false, bypassDebounce: false }) {
        const chatId = ctx.chatId;

        // 🚨 Highest Privilege: priority tasks bypass user buffers completely and inject straight into queue
        if (options.bypassDebounce) {
            console.log(`⚡ [Queue] 高優先級請求繞過防抖機制 (${chatId}): "${text.substring(0, 15)}..."`);
            this._commitDirectly(ctx, text, options.isPriority);
            return;
        }

        let userState = this.userBuffers.get(chatId) || { text: "", timer: null, ctx: ctx };
        userState.text = userState.text ? `${userState.text}\n${text}` : text;
        userState.ctx = ctx;
        console.log(`⏳ [Queue] 收到片段 (${chatId}): "${text.substring(0, 15)}..."`);
        if (userState.timer) clearTimeout(userState.timer);
        userState.timer = setTimeout(() => {
            this._commitToQueue(chatId);
        }, this.DEBOUNCE_MS);
        this.userBuffers.set(chatId, userState);
    }

    _commitDirectly(ctx, text, isPriority) {
        console.log(`📦 [Queue] 訊息封包完成 (Direct) ${isPriority ? '[插隊 VIP]' : ''}，加入隊列。`);
        if (isPriority) {
            this.queue.unshift({ ctx, text }); // Priority goes to the front of the line
        } else {
            this.queue.push({ ctx, text });
        }
        this._processQueue();
    }

    _commitToQueue(chatId) {
        const userState = this.userBuffers.get(chatId);
        if (!userState || !userState.text) return;
        const fullText = userState.text;
        const currentCtx = userState.ctx;
        this.userBuffers.delete(chatId);
        this._commitDirectly(currentCtx, fullText, false);
    }

    async _processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;
        this.isProcessing = true;
        const task = this.queue.shift();
        try {
            console.log(`🚀 [Queue:${this.golemId}] 開始處理訊息...`);
            console.log(`🗣️ [User->${this.golemId}] 說: ${task.text}`);

            // ✨ [Log] 記錄用戶輸入 (Fix missing user logs)
            this.brain._appendChatLog({
                timestamp: Date.now(),
                sender: 'User', // 統一顯示為 User，也可由 ctx.userId 區分
                content: task.text,
                type: 'user',
                role: 'User',
                isSystem: false
            });

            await task.ctx.sendTyping();
            const memories = await this.brain.recall(task.text);
            let finalInput = task.text;
            if (memories.length > 0) {
                finalInput = `【相關記憶】\n${memories.map(m => `• ${m.text}`).join('\n')}\n---\n${finalInput}`;
            }
            const isMentioned = task.ctx.isMentioned ? task.ctx.isMentioned(task.text) : false;

            if (this.silentMode && !isMentioned) {
                console.log(`🤫 [Queue:${this.golemId}] 完全靜默模式啟動中，且未被標記，跳過大腦處理。`);
                return;
            }

            const shouldSuppressReply = this.observerMode && !isMentioned;

            if (shouldSuppressReply) {
                console.log(`👁️ [Queue:${this.golemId}] 觀察者模式監聽中 (背景同步上下文)...`);
            }

            if (isMentioned && (this.silentMode || this.observerMode)) {
                console.log(`📢 [Queue:${this.golemId}] 模式中偵測到標記，強制恢復回應。`);
            }

            const raw = await this.brain.sendMessage(finalInput, false, {
                isObserver: this.observerMode,
                interventionLevel: this.interventionLevel
            });
            await this.NeuroShunter.dispatch(task.ctx, raw, this.brain, this.controller, { suppressReply: shouldSuppressReply });
        } catch (e) {
            console.error("❌ [Queue] 處理失敗:", e);
            // ✅ [M-4 Fix] 對外只顯示友善錯誤，避免洩露路徑/Selector 等內部資訊
            await task.ctx.reply(`⚠️ 系統暫時無法回應，請稍後再試。`);
        } finally {
            this.isProcessing = false;
            setTimeout(() => this._processQueue(), 500);
        }
    }
}

module.exports = ConversationManager;
