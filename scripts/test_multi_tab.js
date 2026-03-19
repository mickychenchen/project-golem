const GolemBrain = require('../src/core/GolemBrain');
const TaskController = require('../src/core/TaskController');
const InteractiveMultiAgent = require('../src/core/InteractiveMultiAgent');

async function testMultiTab() {
    console.log("🧪 Starting Multi-Tab Agent Verification...");
    
    const brain = new GolemBrain({ golemId: 'test_main' });
    const controller = new TaskController();
    
    try {
        await brain.init();
        
        console.log("📦 Triggering Multi-Agent task via InteractiveMultiAgent...");
        const multiAgent = new InteractiveMultiAgent(brain);
        
        const mockCtx = {
            chatId: 'test_chat',
            reply: async (msg) => console.log(`[UI] ${msg}`),
            sendTyping: async () => {},
            isAdmin: true
        };
        
        const task = "請幫我寫一個簡單的 Python 爬蟲，並讓另一個 Agent 進行 Code Review。";
        const agents = [
            { name: 'Coder', role: 'Python 工程師', personality: '專業乾淨', expertise: ['Python', 'Scrapy'] },
            { name: 'Reviewer', role: '資深架構師', personality: '毒舌但中肯', expertise: ['Code Review', 'Security'] }
        ];
        
        // 此處會觸發 _agentSpeak，內部已改用 multiAgentManager.executeCall
        await multiAgent.startConversation(mockCtx, task, agents, { maxRounds: 1 });
        
        console.log("✅ Basic InteractiveMultiAgent test completed.");
        
        console.log("📦 Testing direct <CALL_AGENT> routing via NeuroShunter...");
        const NeuroShunter = require('../src/core/NeuroShunter');
        const rawResponse = `好的，我請 Coder 幫你寫。 <CALL_AGENT name="coder">寫一個印出 Hello World 的 Python 程式</CALL_AGENT>`;
        
        await NeuroShunter.dispatch(mockCtx, rawResponse, brain, controller);
        
        console.log("✅ NeuroShunter routing test completed.");

    } catch (e) {
        console.error("❌ Test failed:", e);
    } finally {
        if (brain.multiAgentManager) {
            await brain.multiAgentManager.cleanup();
        }
        if (brain.context) {
            await brain.context.close();
        }
        process.exit();
    }
}

testMultiTab();
