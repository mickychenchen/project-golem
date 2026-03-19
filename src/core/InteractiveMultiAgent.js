// ============================================================
// 🎭 InteractiveMultiAgent (v9.1 New Feature)
// ============================================================
class InteractiveMultiAgent {
    constructor(brain) {
        this.brain = brain;
        this.activeConversation = null;
    }

    async startConversation(ctx, task, agentConfigs, options = {}) {
        const conversationId = `conv_${Date.now()}`;
        this.activeConversation = {
            id: conversationId,
            chatId: ctx.chatId,
            task: task,
            agents: agentConfigs,
            agentMap: new Map(agentConfigs.map(a => [a.name.toLowerCase(), a])),
            context: '',
            round: 0,
            maxRounds: options.maxRounds || 3,
            messages: [],
            sharedMemory: [],
            status: 'active',
            waitingForUser: false,
            interruptRequested: false
        };

        const teamIntro = agentConfigs.map((agent, idx) =>
            `${idx + 1}. 🤖 **${agent.name}** - ${agent.role}\n   *${agent.expertise.slice(0, 2).join('、')}*`
        ).join('\n');

        await ctx.reply(
            `🎭 **互動式多 Agent 協作啟動**\n\n` +
            `📋 **任務**: ${task}\n\n` +
            `👥 **團隊成員**:\n${teamIntro}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `💡 **互動指令**:\n` +
            `• 每輪結束後可發言（30秒內輸入）\n` +
            `• 用 \`@Agent名\` 指定某個成員發言\n` +
            `• 輸入 \`中斷\` 暫停討論（稍後可恢復）\n` +
            `• 輸入 \`結束\` 提前結束並生成總結\n` +
            `• 輸入 \`繼續\` 跳過發言\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        );

        await this._interactiveLoop(ctx);

        if (this.activeConversation.status !== 'interrupted') {
            await this._generateSummary(ctx);
        }
        this._cleanup();
    }

    async _interactiveLoop(ctx) {
        const conv = this.activeConversation;
        conv.context = `【團隊任務】${conv.task}\n【成員】${conv.agents.map(a => a.name).join('、')}\n\n【對話記錄】\n`;

        for (let round = 1; round <= conv.maxRounds; round++) {
            if (conv.status === 'completed' || conv.status === 'interrupted') break;
            conv.round = round;
            await ctx.reply(`\n**━━━ Round ${round} / ${conv.maxRounds} ━━━**`);

            for (const agent of conv.agents) {
                if (conv.status !== 'active') break;
                await this._agentSpeak(ctx, agent, round);
                await this._delay(1500);
            }

            if (conv.status === 'active' && round < conv.maxRounds) {
                const userAction = await this._userTurn(ctx, round);
                if (userAction === 'END') {
                    conv.status = 'completed';
                    await ctx.reply(`✅ _會議已結束，正在生成總結..._`);
                    break;
                } else if (userAction === 'INTERRUPT') {
                    conv.status = 'interrupted';
                    await ctx.reply(
                        `⏸️ **會議已暫停**\n\n` +
                        `💾 當前進度已保存 (Round ${round})\n` +
                        `📊 已有 ${conv.messages.length} 則發言\n\n` +
                        `輸入「恢復會議」可繼續討論`
                    );
                    return;
                }
            }

            if (this._checkEarlyConsensus(conv.messages)) {
                await ctx.reply(`\n✅ _團隊已達成共識，提前結束討論_`);
                conv.status = 'completed';
                break;
            }
        }
        if (conv.status === 'active') {
            conv.status = 'completed';
        }
    }

    async _agentSpeak(ctx, agent, round) {
        const conv = this.activeConversation;
        try {
            await ctx.sendTyping();
            const rolePrompt = this._buildProtocolPrompt(agent, round);
            
            // 🚀 [v9.2] 切換為真實多分頁路由模式
            const rawResponse = await this.brain.multiAgentManager.executeCall(agent.name, rolePrompt);
            
            const parsed = await this._parseAgentOutput(rawResponse, agent);

            if (parsed.memories.length > 0) {
                for (const memory of parsed.memories) {
                    conv.sharedMemory.push({
                        agent: agent.name,
                        content: memory,
                        round: round,
                        timestamp: Date.now()
                    });
                }
                console.log(`[MultiAgent] ${agent.name} 寫入 ${parsed.memories.length} 條記憶`);
            }

            if (parsed.actions.length > 0) {
                await ctx.reply(`⚡ _${agent.name} 正在執行操作..._`);
                for (const action of parsed.actions) {
                    if (this._isAllowedAction(action)) {
                        await this._executeAgentAction(ctx, action, agent);
                    }
                }
            }

            const message = {
                round: round,
                speaker: agent.name,
                role: agent.role,
                type: 'agent',
                content: parsed.reply,
                hadMemory: parsed.memories.length > 0,
                hadAction: parsed.actions.length > 0,
                timestamp: Date.now()
            };
            conv.messages.push(message);
            conv.context += `[Round ${round}] ${agent.name}: ${parsed.reply}\n`;

            const badges = [];
            if (parsed.memories.length > 0) badges.push('🧠');
            if (parsed.actions.length > 0) badges.push('⚡');

            await ctx.reply(
                `🤖 **${agent.name}** _(${agent.role})_ ${badges.join(' ')}\n` +
                `${parsed.reply}`
            );
            console.log(`[MultiAgent] [${agent.name}] ${parsed.reply.replace(/\n/g, ' ')}`);
            this.brain._appendChatLog({
                timestamp: Date.now(),
                sender: agent.name,
                content: parsed.reply,
                type: 'agent',
                role: agent.role,
                isSystem: false
            });
        } catch (e) {
            console.error(`[InteractiveMultiAgent] ${agent.name} 發言失敗:`, e.message);
            await ctx.reply(`⚠️ ${agent.name} 暫時無法發言`);
        }
    }

    async _userTurn(ctx, round) {
        const conv = this.activeConversation;
        conv.waitingForUser = true;
        await ctx.reply(
            `\n💬 **輪到您發言** _(30秒內輸入，或輸入「繼續」跳過)_\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        );
        const userInput = await this._waitForUserInput(ctx, 30000);
        conv.waitingForUser = false;
        if (!userInput) {
            await ctx.reply(`⏱️ _超時，自動繼續下一輪_`);
            return 'CONTINUE';
        }
        const input = userInput.trim();
        const lowerInput = input.toLowerCase();

        if (['繼續', 'continue', 'skip', 'c', 'next'].includes(lowerInput)) return 'CONTINUE';
        if (['結束', 'end', 'stop', 'finish', '結束會議'].includes(lowerInput)) return 'END';
        if (['中斷', 'interrupt', 'pause', 'break', '暫停'].includes(lowerInput)) return 'INTERRUPT';

        const mentionMatch = input.match(/@(\w+)/gi);
        if (mentionMatch) {
            await this._handleMention(ctx, input, mentionMatch, round);
        } else {
            await this._recordUserMessage(ctx, input, round);
        }
        return 'CONTINUE';
    }

    async _handleMention(ctx, input, mentions, round) {
        const conv = this.activeConversation;
        await ctx.reply(`👤 **您的發言**\n${input}`);
        console.log(`[MultiAgent] [User] ${input.replace(/\n/g, ' ')}`);
        this.brain._appendChatLog({
            timestamp: Date.now(),
            sender: 'User',
            content: input,
            type: 'user',
            role: 'User',
            isSystem: false
        });
        conv.messages.push({
            round: round,
            speaker: '您',
            role: 'User',
            type: 'user',
            content: input,
            timestamp: Date.now()
        });
        conv.context += `[用戶]: ${input}\n`;

        for (const mention of mentions) {
            const agentName = mention.substring(1).toLowerCase();
            const agent = conv.agentMap.get(agentName);
            if (agent) {
                await ctx.reply(`\n🎤 _邀請 ${agent.name} 回應..._`);
                await this._delay(1000);
                await this._agentRespondToUser(ctx, agent, input, round);
            } else {
                const availableAgents = Array.from(conv.agentMap.keys()).join('、');
                await ctx.reply(
                    `⚠️ 找不到 Agent「${mention.substring(1)}」\n` +
                    `可用成員：${availableAgents}`
                );
            }
        }
    }

    async _agentRespondToUser(ctx, agent, userMessage, round) {
        const conv = this.activeConversation;
        try {
            await ctx.sendTyping();
            const prompt = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【系統指令：用戶詢問回應】
你是 ${agent.name} (${agent.role})，性格：${agent.personality}
【當前情境】
團隊正在討論：${conv.task}
【對話歷史】
${conv.context}
【用戶剛才對你說】
${userMessage}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
請按照 Titan Protocol 格式回應用戶：
[GOLEM_MEMORY]
（如果用戶提供了重要資訊）
[GOLEM_REPLY]
（直接回應用戶的問題，保持你的角色性格，2-3句話）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
            const rawResponse = await this.brain.sendMessage(prompt);
            const parsed = await this._parseAgentOutput(rawResponse, agent);
            if (parsed.memories.length > 0) {
                for (const memory of parsed.memories) {
                    conv.sharedMemory.push({
                        agent: agent.name,
                        content: memory,
                        round: round,
                        source: 'user_interaction'
                    });
                }
            }
            conv.messages.push({
                round: round,
                speaker: agent.name,
                role: agent.role,
                type: 'agent_response',
                content: parsed.reply,
                replyTo: 'user',
                timestamp: Date.now()
            });
            conv.context += `[${agent.name} 回應用戶]: ${parsed.reply}\n`;
            await ctx.reply(
                `🤖 **${agent.name}** _(回應您)_ ${parsed.memories.length > 0 ? '🧠' : ''}\n` +
                `${parsed.reply}`
            );
        } catch (e) {
            console.error(`[InteractiveMultiAgent] ${agent.name} 回應失敗:`, e.message);
            await ctx.reply(`⚠️ ${agent.name} 無法回應`);
        }
    }

    async _recordUserMessage(ctx, input, round) {
        const conv = this.activeConversation;
        await ctx.reply(`👤 **您的發言已加入討論**\n${input}`);
        console.log(`[MultiAgent] [User] ${input.replace(/\n/g, ' ')}`);
        this.brain._appendChatLog({
            timestamp: Date.now(),
            sender: 'User',
            content: input,
            type: 'user',
            role: 'User',
            isSystem: false
        });
        conv.messages.push({
            round: round,
            speaker: '您',
            role: 'User',
            type: 'user',
            content: input,
            timestamp: Date.now()
        });
        conv.context += `[用戶]: ${input}\n`;
    }

    async _waitForUserInput(ctx, timeout) {
        return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
                this._removeInputListener(ctx.chatId);
                resolve(null);
            }, timeout);
            this._registerInputListener(ctx.chatId, (input) => {
                clearTimeout(timeoutId);
                this._removeInputListener(ctx.chatId);
                resolve(input);
            });
        });
    }

    _registerInputListener(chatId, callback) {
        if (!global.multiAgentListeners) global.multiAgentListeners = new Map();
        global.multiAgentListeners.set(chatId, callback);
        console.log(`[InteractiveMultiAgent] 監聽器已註冊: ${chatId}`);
    }

    _removeInputListener(chatId) {
        if (global.multiAgentListeners) {
            global.multiAgentListeners.delete(chatId);
            console.log(`[InteractiveMultiAgent] 監聽器已移除: ${chatId}`);
        }
    }

    static canResume(chatId) {
        return global.pausedConversations && global.pausedConversations.has(chatId);
    }

    static async resumeConversation(ctx, brain) {
        if (!global.pausedConversations || !global.pausedConversations.has(ctx.chatId)) {
            await ctx.reply('⚠️ 沒有暫停的會議可以恢復');
            return;
        }
        const savedConv = global.pausedConversations.get(ctx.chatId);
        global.pausedConversations.delete(ctx.chatId);
        await ctx.reply(
            `▶️ **恢復會議**\n\n` +
            `📋 任務: ${savedConv.task}\n` +
            `📊 已有 ${savedConv.messages.length} 則發言\n` +
            `🔄 從 Round ${savedConv.round + 1} 繼續...\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        );
        const instance = new InteractiveMultiAgent(brain);
        instance.activeConversation = savedConv;
        instance.activeConversation.status = 'active';
        await instance._interactiveLoop(ctx);
        await instance._generateSummary(ctx);
        instance._cleanup();
    }

    _cleanup() {
        const conv = this.activeConversation;
        if (conv.status === 'interrupted') {
            if (!global.pausedConversations) global.pausedConversations = new Map();
            global.pausedConversations.set(conv.chatId, conv);
            console.log(`[InteractiveMultiAgent] 會議已暫停並保存: ${conv.chatId}`);
        }
        this._removeInputListener(conv.chatId);
        this.activeConversation = null;
    }

    _buildProtocolPrompt(agent, round) {
        const conv = this.activeConversation;
        let sharedMemoryContext = '';
        if (conv.sharedMemory.length > 0) {
            const recentMemories = conv.sharedMemory.slice(-5);
            sharedMemoryContext = '\n【團隊共享記憶】\n' +
                recentMemories.map(m => `- [${m.agent}] ${m.content}`).join('\n') + '\n';
        }
        const isLastRound = round >= conv.maxRounds;
        return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【系統指令：多 Agent 協作模式】
🎭 **你的角色**：
- 身份：${agent.name}
- 職位：${agent.role}
- 性格：${agent.personality}
- 專長：${agent.expertise.join('、')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【當前情境】
任務："${conv.task}"
成員：${conv.agents.map(a => a.name).join('、')} + 用戶
進度：第 ${round} / ${conv.maxRounds} 輪
【對話歷史】
${conv.context}
${sharedMemoryContext}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【輸出格式 - Titan Protocol】
[GOLEM_MEMORY]
（記錄重要資訊：決策、數據、共識等）
[GOLEM_REPLY]
${round === 1
                ? '提出你的專業建議和初步想法'
                : '回應其他成員的觀點，可以用 @成員名 指定回應對象'
            }
${isLastRound ? '\n⚠️ 這是最後一輪，請給出最終結論！' : ''}
（保持簡潔：2-3句話，50-80字）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
請以 ${agent.name} 的身份發言：
`;
    }

    async _parseAgentOutput(rawResponse, agent) {
        const result = { memories: [], actions: [], reply: '' };
        const memoryRegex = /\[GOLEM_MEMORY\]([\s\S]*?)(?=\[GOLEM_|$)/i;
        const memoryMatch = rawResponse.match(memoryRegex);
        if (memoryMatch) {
            result.memories = memoryMatch[1]
                .trim().split('\n').map(line => line.trim())
                .filter(line => line && !line.startsWith('[') && line.length > 5);
        }
        const actionRegex = /\[GOLEM_ACTION\]([\s\S]*?)(?=\[GOLEM_|$)/i;
        const actionMatch = rawResponse.match(actionRegex);
        if (actionMatch) {
            const jsonMatches = actionMatch[1].match(/\{[\s\S]*?\}/g) || [];
            for (const jsonStr of jsonMatches) {
                try {
                    const action = JSON.parse(jsonStr);
                    action._agent = agent.name;
                    result.actions.push(action);
                } catch (e) { }
            }
        }
        const replyRegex = /\[GOLEM_REPLY\]([\s\S]*?)(?=\[GOLEM_|$)/i;
        const replyMatch = rawResponse.match(replyRegex);
        if (replyMatch) {
            result.reply = replyMatch[1].trim();
        } else {
            result.reply = rawResponse
                .replace(/\[GOLEM_MEMORY\][\s\S]*?(?=\[GOLEM_|$)/gi, '')
                .replace(/\[GOLEM_ACTION\][\s\S]*?(?=\[GOLEM_|$)/gi, '')
                .trim();
        }
        result.reply = this._cleanResponse(result.reply, agent.name);
        return result;
    }

    _cleanResponse(response, agentName) {
        let cleaned = response.trim();
        const prefixes = [`${agentName}:`, `${agentName}：`, `**${agentName}**:`, `[${agentName}]`];
        for (const prefix of prefixes) {
            if (cleaned.startsWith(prefix)) {
                cleaned = cleaned.substring(prefix.length).trim();
            }
        }
        cleaned = cleaned.replace(/^>\s*/gm, '');
        if (cleaned.length > 300) cleaned = cleaned.substring(0, 297) + '...';
        return cleaned;
    }

    _isAllowedAction(action) {
        const allowed = ['search', 'calculate', 'translate'];
        const forbidden = ['shell', 'file_write', 'patch'];
        const actionType = action.action || action.type;
        if (forbidden.includes(actionType)) return false;
        return allowed.includes(actionType);
    }

    async _executeAgentAction(ctx, action, agent) {
        console.log(`[MultiAgent] ${agent.name} 執行 Action:`, action.action);
    }

    _checkEarlyConsensus(messages) {
        if (messages.length < 6) return false;
        const recent = messages.slice(-3);
        const keywords = ['達成共識', '就這樣決定', '沒問題', '我同意', '就照這個方案'];
        return recent.some(msg => keywords.some(kw => msg.content.includes(kw)));
    }

    async _generateSummary(ctx) {
        const conv = this.activeConversation;
        await ctx.reply(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎯 **正在整合團隊意見...**`);
        const memoryContext = conv.sharedMemory.length > 0
            ? '\n【團隊記憶庫】\n' + conv.sharedMemory.map(m => `- ${m.content}`).join('\n') : '';
        const summaryPrompt = `
【系統指令：會議總結】
整合以下討論，生成專業總結。
【任務】${conv.task}
【成員】${conv.agents.map(a => `${a.name}(${a.role})`).join('、')} + 用戶
【完整討論】
${conv.context}
${memoryContext}
【統計】
- 發言數: ${conv.messages.length}
- 輪數: ${conv.round}
- 記憶: ${conv.sharedMemory.length} 條
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
請按格式輸出：
[GOLEM_MEMORY]
（最重要的 3-5 條決策）
[GOLEM_REPLY]
## 核心結論
（2-3句話）
## 關鍵決策
- 決策1
- 決策2
## 後續行動
- 行動1
- 行動2
`;
        try {
            const rawSummary = await this.brain.sendMessage(summaryPrompt);
            const parsed = await this._parseAgentOutput(rawSummary, { name: 'Master' });
            await ctx.reply(
                `🎯 **團隊總結報告**\n\n${parsed.reply}\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `📊 統計: ${conv.messages.length} 則發言 / ${conv.round} 輪對話 / ${conv.sharedMemory.length} 條記憶`
            );
        } catch (e) {
            console.error('[InteractiveMultiAgent] 總結失敗:', e.message);
            await ctx.reply('⚠️ 總結生成失敗');
        }
    }
    _delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}

InteractiveMultiAgent.PRESETS = {
    TECH_TEAM: [
        { name: 'Alex', role: '前端工程師', personality: '注重 UX，追求美感', expertise: ['React', 'Next.js', 'UI/UX', 'CSS'] },
        { name: 'Bob', role: '後端工程師', personality: '謹慎務實，重視安全', expertise: ['Node.js', 'Database', 'API', '系統架構'] },
        { name: 'Carol', role: '產品經理', personality: '用戶導向，商業思維', expertise: ['需求分析', '產品規劃', '市場策略'] }
    ],
    DEBATE_TEAM: [
        { name: 'Devil', role: '魔鬼代言人', personality: '批判性思維，挑戰假設', expertise: ['風險分析', '邏輯辯證'] },
        { name: 'Angel', role: '樂觀主義者', personality: '正向思考，尋找機會', expertise: ['願景規劃', '機會挖掘'] },
        { name: 'Judge', role: '中立評審', personality: '理性客觀，平衡觀點', expertise: ['決策分析', '綜合評估'] }
    ],
    CREATIVE_TEAM: [
        { name: 'Writer', role: '文案創作者', personality: '富有想像力', expertise: ['故事撰寫', '文案設計', '內容策略'] },
        { name: 'Designer', role: '視覺設計師', personality: '藝術感強', expertise: ['平面設計', '品牌形象'] },
        { name: 'Strategist', role: '策略顧問', personality: '邏輯清晰', expertise: ['市場分析', '策略規劃'] }
    ],
    BUSINESS_TEAM: [
        { name: 'Finance', role: '財務顧問', personality: '數字敏銳', expertise: ['財務規劃', '成本分析', '投資評估'] },
        { name: 'Marketing', role: '行銷專家', personality: '創意豐富', expertise: ['品牌策略', '用戶增長', '市場推廣'] },
        { name: 'Operations', role: '營運專家', personality: '注重執行', expertise: ['流程設計', '效率提升'] }
    ]
};

module.exports = InteractiveMultiAgent;
