const ResponseParser = require('../utils/ResponseParser');
const MultiAgentHandler = require('./action_handlers/MultiAgentHandler');
const SkillHandler = require('./action_handlers/SkillHandler');
const CommandHandler = require('./action_handlers/CommandHandler');

// ============================================================
// 🧬 NeuroShunter (神經分流中樞 - 核心路由器)
// ============================================================
class NeuroShunter {
    static async dispatch(ctx, rawResponse, brain, controller, options = {}) {
        let textToParse = rawResponse;
        let attachments = options.attachments || [];

        // 📥 [v9.1.10] 支援結構化回應物件 { text, attachments }
        if (rawResponse && typeof rawResponse === 'object' && !Array.isArray(rawResponse)) {
            textToParse = rawResponse.text || "";
            attachments = [...attachments, ...(rawResponse.attachments || [])];
        }

        const parsed = ResponseParser.parse(textToParse);
        let shouldSuppressReply = options.suppressReply === true;

        // 核心：偵測 [INTERVENE] 標籤以實現觀察者模式自主介入
        if (textToParse.includes('[INTERVENE]')) {
            console.log(`🚀 [NeuroShunter] 偵測到 AI 自主介入請求 [INTERVENE]！`);
            shouldSuppressReply = false;
        }

        if (parsed.reply && parsed.reply.includes('[INTERVENE]')) {
            parsed.reply = parsed.reply.replace(/\[INTERVENE\]/g, '').trim();
        }

        // 1. 處理長期記憶寫入
        if (parsed.memory) {
            console.log(`[GOLEM_MEMORY]\n${parsed.memory}`);
            await brain.memorize(parsed.memory, { type: 'fact', timestamp: Date.now() });
        }

        // 1. 處理直接回覆 (讓 AI 的解說文字在行動之前出現)
        if (parsed.reply && !shouldSuppressReply) {
            let finalReply = parsed.reply;
            if (ctx.platform === 'telegram' && ctx.shouldMentionSender) {
                finalReply = `${ctx.senderMention} ${parsed.reply}`;
            }
            console.log(`[TERMINAL] 🤖 [Golem] 說: ${finalReply}${attachments.length > 0 ? ' 📎 含有附件' : ''}`);

            // ✨ [Log] 記錄 AI 回應
            if (brain && typeof brain._appendChatLog === 'function') {
                brain._appendChatLog({
                    sender: 'Golem',
                    content: finalReply,
                    type: 'ai',
                    role: 'Assistant',
                    isSystem: false,
                    attachments: attachments
                });
            }

            // 附件處理：若是 Dashbaord 或有支援 attachments 的平台
            await ctx.reply(finalReply, { attachments: attachments });
        } else if (parsed.reply && shouldSuppressReply) {
            console.log(`🤫 [NeuroShunter] 檢測到靜默模式，已攔截回覆內容。`);
        }

        // 2. 處理結構化 Action 分配 (讓批准視窗在回覆之後彈出)
        if (parsed.actions.length > 0 && !shouldSuppressReply) {
            console.log(`[GOLEM_ACTION]\n${JSON.stringify(parsed.actions, null, 2)}`);
            const normalActions = [];

            for (const act of parsed.actions) {
                switch (act.action) {
                    case 'multi_agent':
                        await MultiAgentHandler.execute(ctx, act, controller, brain);
                        break;
                    default:
                        // 檢查是否為動態擴充技能
                        const isSkillHandled = await SkillHandler.execute(ctx, act, brain);
                        if (!isSkillHandled) {
                            // 若不是已知框架 Action 且非動態技能，則視為底層 Shell 指令
                            normalActions.push(act);
                        }
                        break;
                }
            }

            // 處理剩餘的終端指令序列並自動啟動回饋循環 (Feedback Loop)
            if (normalActions.length > 0) {
                await CommandHandler.execute(ctx, normalActions, controller, brain, (c, r, b, ctrl) => this.dispatch(c, r, b, ctrl, options));
            }
        } else if (parsed.actions.length > 0 && shouldSuppressReply) {
            console.log(`🤫 [NeuroShunter] 靜默模式，跳過 ${parsed.actions.length} 個 Action 的執行。`);
        }

        // 3. ✨ [新增] 處理 <CALL_AGENT> 跨分頁調用 (v9.2 路由器模式)
        if (parsed.calls && parsed.calls.length > 0) {
            for (const call of parsed.calls) {
                console.log(`🎭 [NeuroShunter] 偵測到跨分頁 Agent 調用: ${call.name}`);
                
                try {
                    // 執行子代理任務
                    const agentResponse = await brain.multiAgentManager.executeCall(call.name, call.requirement);
                    
                    // 將結果包裝回系統回報，重新進入分流中樞 (遞迴)
                    const feedback = `[系統回報 - 來自 ${call.name} 代理]:\n${agentResponse}`;
                    console.log(`📥 [NeuroShunter] 已取得 ${call.name} 回應，正在將結果回傳給主核心...`);
                    
                    // 再次發送給主腦 (遞迴調用 dispatch)
                    const nextResponse = await brain.sendMessage(feedback, false);
                    await NeuroShunter.dispatch(ctx, nextResponse, brain, controller, options);
                    
                } catch (e) {
                    console.error(`❌ [NeuroShunter] Agent [${call.name}] 調用失敗:`, e.message);
                    await ctx.reply(`⚠️ 子代理 [${call.name}] 調用發生錯誤: ${e.message}`);
                }
            }
        }
    }
}

module.exports = NeuroShunter;
