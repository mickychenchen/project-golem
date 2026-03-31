const fsSync = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const envPath = path.resolve(PROJECT_ROOT, '.env');
const envExamplePath = path.resolve(PROJECT_ROOT, '.env.example');

if (!fsSync.existsSync(envPath) && fsSync.existsSync(envExamplePath)) {
    fsSync.copyFileSync(envExamplePath, envPath);
    console.log('📋 [Bootstrap] .env 不存在，已從 .env.example 複製初始設定檔。');
    console.log('🌐 [Bootstrap] 請前往 http://localhost:3000/dashboard 完成初始化設定。');
}

try {
    require('dotenv').config({ override: true });
} catch (error) {
    console.error('⚠️ [Bootstrap] 尚未安裝依賴套件 (dotenv)。請確保已執行 npm install。');
}

process.on('uncaughtException', (error) => {
    console.error('🔥 [Supervisor] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ [Supervisor] Unhandled Rejection at:', promise);
    console.error('Reason:', reason);
});

const ConfigManager = require('../../src/config');
const SystemLogger = require('../../src/utils/SystemLogger');
const RuntimeController = require('../../src/runtime/RuntimeController');

SystemLogger.init(ConfigManager.LOG_BASE_DIR);

let dashboard = null;
try {
    dashboard = require('../../dashboard');
    const displayPort = process.env.DASHBOARD_DEV_MODE === 'true'
        ? 3000
        : (process.env.DASHBOARD_PORT || 3000);
    console.log(`✅ Golem Web Dashboard 已啟動 → http://localhost:${displayPort}`);
} catch (error) {
    console.error('❌ 無法載入 Dashboard:', error.message);
}

const runtimeController = new RuntimeController({
    workerPath: path.resolve(__dirname, 'worker.js'),
});

if (dashboard && dashboard.webServer) {
    runtimeController.attachServer(dashboard.webServer);
    dashboard.webServer.setGolemFactory(async (golemConfig) => {
        return runtimeController.ensureGolem(golemConfig, { autoStart: true });
    });
}

async function serializeDashboardContext(ctx, golemId) {
    let attachment = null;
    if (ctx && typeof ctx.getAttachment === 'function') {
        try {
            attachment = await ctx.getAttachment();
        } catch {}
    } else if (ctx && ctx.attachment) {
        attachment = ctx.attachment;
    }

    return {
        golemId,
        message: ctx && ctx.text ? ctx.text : '',
        attachment,
        meta: {
            platform: ctx && ctx.platform ? ctx.platform : 'web',
            chatId: ctx && ctx.chatId ? ctx.chatId : 'web-dashboard',
            senderName: ctx && ctx.senderName ? ctx.senderName : 'User',
            isAdmin: !!(ctx && ctx.isAdmin),
        },
    };
}

global.getOrCreateGolem = function getOrCreateGolem(id = 'golem_A') {
    return runtimeController.getOrCreateContext(id);
};

global.handleDashboardMessage = async function handleDashboardMessage(ctx, golemId = 'golem_A') {
    return runtimeController.sendDashboardChat(await serializeDashboardContext(ctx, golemId));
};

global.handleUnifiedMessage = global.handleDashboardMessage;

global.handleUnifiedCallback = async function handleUnifiedCallback(ctx, callbackData, golemId = 'golem_A') {
    return runtimeController.sendDashboardCallback({
        golemId,
        callbackData,
        meta: {
            platform: ctx && ctx.platform ? ctx.platform : 'web',
            chatId: ctx && ctx.chatId ? ctx.chatId : 'web-dashboard',
        },
    });
};

global.stopGolem = async function stopGolem(id = 'golem_A') {
    return runtimeController.rpc('golem.stop', { golemId: id }, { timeoutMs: 30000 });
};

global.gracefulRestart = async function gracefulRestart() {
    return runtimeController.restartWorker('dashboard-recycle');
};

global.fullShutdown = async function fullShutdown() {
    return runtimeController.shutdownSupervisor('dashboard-shutdown');
};

module.exports = {
    runtimeController,
    getOrCreateGolem: global.getOrCreateGolem,
    handleUnifiedMessage: global.handleUnifiedMessage,
    handleDashboardMessage: global.handleDashboardMessage,
    handleUnifiedCallback: global.handleUnifiedCallback,
};
