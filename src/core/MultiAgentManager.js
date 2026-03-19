const path = require('path');
const fs = require('fs');

/**
 * 🎭 MultiAgentManager (v9.2) - 分頁路由器與代理管理員
 * 負責管理多個 Gemini 分頁，實現完美的上下文隔離。
 */
class MultiAgentManager {
    constructor(mainBrain) {
        this.mainBrain = mainBrain;
        this.agents = new Map(); // Map<string, GolemBrain>
    }

    /**
     * 獲取或建立一個代理實例
     * @param {string} name - 代理名稱 (例如 'coder', 'researcher')
     * @returns {Promise<GolemBrain>}
     */
    async getAgent(name) {
        const key = name.toLowerCase();
        if (this.agents.has(key)) {
            return this.agents.get(key);
        }

        if (!this.mainBrain.context) {
            throw new Error("主腦尚未初始化 (Missing BrowserContext)");
        }

        // 🔍 [v9.2] 從 sub_agents.json 載入 Persona & Skills
        let agentDef = null;
        try {
            const dataPath = path.join(process.cwd(), 'data', 'sub_agents.json');
            if (fs.existsSync(dataPath)) {
                const allAgents = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
                agentDef = allAgents.find(a => a.id.toLowerCase() === key || a.name.toLowerCase() === key);
            }
        } catch (e) {
            console.error(`❌ [MultiAgent] 讀取 sub_agents.json 失敗:`, e.message);
        }

        console.log(`🎭 [MultiAgent] 正在啟動子代理分頁: ${name}...`);
        
        // 1. 建立新頁面
        const newPage = await this.mainBrain.context.newPage();
        
        // 2. 建立新的 GolemBrain 實例來包裹這個頁面
        const GolemBrain = require('./GolemBrain');
        const agentBrain = new GolemBrain({
            golemId: `agent_${key}`,
            userDataDir: this.mainBrain.userDataDir,
        });

        // 3. 初始化 (注入頁面)
        await agentBrain.init({ injectedPage: newPage });
        
        // 4. ✨ [新增] 如果有配置定義，則注入特定的人格
        if (agentDef) {
            console.log(`📝 [MultiAgent] 正在為 ${name} 注入自定義人格與技能...`);
            const personalityPrompt = `[AGENT_IDENTITY]\nName: ${agentDef.name}\nRole: ${agentDef.role}\nPersonality: ${agentDef.personality}\nExpertise: ${agentDef.skills.join(', ')}\n\n你現在是在多分頁系統中的一個子代理。請專注於你的專業領域，並與主腦 (Golem Brain) 協同作業。`;
            
            // 透過發送一個隱藏的系統指令來設置人格
            await agentBrain.sendMessage(`【系統人格校準】\n${personalityPrompt}\n\n請回覆「了解」以確認載入。`, false);
        }

        this.agents.set(key, agentBrain);
        return agentBrain;
    }

    /**
     * 執行一次跨分頁調用
     * @param {string} agentName - 目標代理名稱
     * @param {string} requirement - 具體需求內容
     * @returns {Promise<string>} 代理的回傳結果
     */
    async executeCall(agentName, requirement) {
        const agent = await this.getAgent(agentName);
        console.log(`📡 [MultiAgent] 路由任務至 [${agentName}]: ${requirement.substring(0, 50)}...`);
        
        // 切換至該分頁 (可選，防止背景分頁被暫停)
        try { await agent.page.bringToFront(); } catch (e) {}

        const result = await agent.sendMessage(requirement);
        
        // 執行完後切換回主分頁 (可選)
        try { await this.mainBrain.page.bringToFront(); } catch (e) {}

        return result.text;
    }

    /**
     * 重置特定的代理分頁
     */
    async resetAgent(name) {
        const key = name.toLowerCase();
        if (this.agents.has(key)) {
            const agent = this.agents.get(key);
            try {
                await agent.page.close();
            } catch (e) {}
            this.agents.delete(key);
            console.log(`♻️ [MultiAgent] 已重置子代理分頁: ${name}`);
        }
    }

    /**
     * 關閉所有子代理分頁
     */
    async cleanup() {
        for (const [name, agent] of this.agents.entries()) {
            try {
                await agent.page.close();
            } catch (e) {}
        }
        this.agents.clear();
        console.log(`🧹 [MultiAgent] 已清理所有子代理分頁。`);
    }
}

module.exports = MultiAgentManager;
