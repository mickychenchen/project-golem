class CommandHandler {
    static async execute(ctx, normalActions, controller, brain, dispatchFn) {
        if (!normalActions || normalActions.length === 0) return;

        let result;
        try {
            result = await controller.runSequence(ctx, normalActions);
        } catch (err) {
            // runSequence 本身拋出例外（罕見，通常是安全管理器內部錯誤）
            console.error('[CommandHandler] runSequence 拋出例外:', err);
            await ctx.reply(`❌ **指令執行失敗**\n\`\`\`\n${err.message}\n\`\`\``, { parse_mode: 'Markdown' });
            return;
        }

        if (!result) return;

        // 1. 處理需要外部審批的情況
        if (typeof result === 'object') {
            if (result.status === 'PENDING_APPROVAL') {
                const cmdBlock = result.cmd ? `\n\`\`\`shell\n${result.cmd}\n\`\`\`` : "";
                await ctx.reply(
                    `⚠️ ${result.riskLevel === 'DANGER' ? '🔴 危險指令' : '🟡 警告'}${cmdBlock}\n\n${result.reason}`,
                    {
                        parse_mode: 'Markdown',
                        disable_web_page_preview: true,
                        reply_markup: {
                            inline_keyboard: [[
                                { text: '✅ 批准', callback_data: `APPROVE_${result.approvalId}` },
                                { text: '❌ 拒絕', callback_data: `DENY_${result.approvalId}` }
                            ]]
                        }
                    }
                );
                return;
            } else {
                console.warn('[CommandHandler] 未知的 Object 回傳狀態:', result);
                return;
            }
        }

        // 2. 處理正常的執行回報 (String Observation)
        if (typeof result === 'string') {
            // ✨ [錯誤偵測] 掃描是否有失敗的步驟，先通知用戶
            const failedSteps = result
                .split('\n\n----------------\n\n')
                .filter(block => block.includes('[Step') && block.includes(' Failed]'));

            if (failedSteps.length > 0) {
                // 擷取每個失敗步驟的指令名稱與錯誤訊息，格式化後通知
                const errorSummary = failedSteps.map(block => {
                    // 解析 "[Step N Failed] cmd: <cmd>\nError:\n<msg>"
                    const cmdMatch = block.match(/cmd:\s*(.+)/);
                    const errMatch = block.match(/Error:\n([\s\S]+)/);
                    const cmd = cmdMatch ? cmdMatch[1].trim() : '（未知指令）';
                    const errMsg = errMatch ? errMatch[1].trim().slice(0, 300) : block.trim().slice(0, 300);
                    return `🔴 \`${cmd}\`\n\`\`\`\n${errMsg}\n\`\`\``;
                }).join('\n\n');

                await ctx.reply(
                    `❌ **指令執行失敗 (${failedSteps.length} 個步驟)**\n\n${errorSummary}`,
                    { parse_mode: 'Markdown' }
                );
            }

            // 無論成功或失敗，都將完整觀察結果送給大腦分析（讓 AI 知道發生什麼事並作出回應）
            if (ctx.sendTyping) await ctx.sendTyping();
            const feedbackPrompt = `[System Observation]\n${result}\n\nPlease reply to user naturally using [GOLEM_REPLY].`;
            const finalRes = await brain.sendMessage(feedbackPrompt);
            await dispatchFn(ctx, finalRes, brain, controller);
        }
    }
}

module.exports = CommandHandler;