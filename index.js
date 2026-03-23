/**
 * 🦞 Project Golem v9.1.5 (Single-Golem Edition)
 * -------------------------------------------------------------------------
 * 架構：[Universal Context] -> [Conversation Queue] -> [NeuroShunter] <==> [Web Gemini]
 */
const fs_sync = require('fs');
const path_sync = require('path');
const { v4: uuidv4 } = require('uuid');

// ── 首次啟動自動初始化 .env ────────────────────────────────────────────────
const envPath = path_sync.resolve(__dirname, '.env');
const envExamplePath = path_sync.resolve(__dirname, '.env.example');
if (!fs_sync.existsSync(envPath) && fs_sync.existsSync(envExamplePath)) {
    fs_sync.copyFileSync(envExamplePath, envPath);
    console.log('📋 [Bootstrap] .env 不存在，已從 .env.example 複製初始設定檔。');
    console.log('🌐 [Bootstrap] 請前往 http://localhost:3000/dashboard 完成初始化設定。');
}

try {
    require('dotenv').config({ override: true });
} catch (e) {
    console.error('⚠️ [Bootstrap] 尚未安裝依賴套件 (dotenv)。請確保已執行 npm install。');
}

process.on('uncaughtException', (err) => {
    // ✨ [新增] 避免無限循環：如果 SystemLogger 已掛載，使用原始的 Error 輸出
    const SystemLogger = require('./src/utils/SystemLogger');
    if (SystemLogger && SystemLogger.originalError) {
        SystemLogger.originalError('🔥 [CRITICAL] Uncaught Exception:', err);
    } else {
        console.error('🔥 [CRITICAL] Uncaught Exception:', err);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ [WARNING] Unhandled Rejection at:', promise);
    console.error('Reason:', reason);
});

const ConfigManager = require('./src/config');
const SystemLogger = require('./src/utils/SystemLogger');

// 🚀 初始化系統日誌持久化 (必須在 Dashboard 之前，確保攔截順序正確)
SystemLogger.init(ConfigManager.LOG_BASE_DIR);

// Dashboard 強制啟用
try {
    require('./dashboard');
    const displayPort = process.env.DASHBOARD_DEV_MODE === 'true' ? 3000 : (process.env.DASHBOARD_PORT || 3000);
    console.log('✅ Golem Web Dashboard 已啟動 → http://localhost:' + displayPort);
} catch (e) {
    console.error('❌ 無法載入 Dashboard:', e.message);
}

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
// [GrammyBridge] Factory: auto-selects grammY or legacy based on env setup
const { createTelegramBot } = require('./src/bridges/TelegramBotFactory');
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const GolemBrain = require('./src/core/GolemBrain');
const TaskController = require('./src/core/TaskController');
const AutonomyManager = require('./src/managers/AutonomyManager');
const ConversationManager = require('./src/core/ConversationManager');
const NeuroShunter = require('./src/core/NeuroShunter');
const NodeRouter = require('./src/core/NodeRouter');
const UniversalContext = require('./src/core/UniversalContext');
const { downloadFile, getLocalIp } = require('./src/utils/HttpUtils');
const OpticNerve = require('./src/services/OpticNerve');
const SystemUpgrader = require('./src/utils/SystemUpdater');
const https = require('https');
const InteractiveMultiAgent = require('./src/core/InteractiveMultiAgent');
const introspection = require('./src/services/Introspection');
const ActionQueue = require('./src/core/ActionQueue'); // ✨ [v9.1] Dual-Queue Architecture


// 🎯 v9.1.5 解耦：不再於啟動時遍歷配置建立 Bot 與實體
// TelegramBot 與 Golem 實體將由 Web Dashboard 透過 golemFactory 動態建立
let activeTgBot = null;
let activeDcBot = null;
let singleGolemInstance = null;

// ✅ [Bug #6 修復] 啟動時間戳記，用於過濾重啟前的舊訊息
const BOOT_TIME = Date.now();

const dcClient = ConfigManager.CONFIG.DC_TOKEN ? new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel]
}) : null;

// ==========================================
// 🧠 雙子管弦樂團 (Golem Orchestrator)
// ==========================================
function getOrCreateGolem() {
    if (singleGolemInstance) return singleGolemInstance;

    const golemId = 'golem_A';
    console.log(`\n================================`);
    console.log(`🧬 [Orchestrator] 孕育新實體: ${golemId}`);
    console.log(`================================\n`);

    const brain = new GolemBrain({
        golemId,
        userDataDir: ConfigManager.MEMORY_BASE_DIR,
        logDir: ConfigManager.LOG_BASE_DIR
    });
    const controller = new TaskController({ golemId });
    const autonomy = new AutonomyManager(brain, controller, brain.memoryDriver, { golemId });

    const interventionLevel = ConfigManager.CONFIG.INTERVENTION_LEVEL;

    const convoManager = new ConversationManager(brain, NeuroShunter, controller, {
        golemId,
        interventionLevel
    });

    const actionQueue = new ActionQueue({ golemId });

    autonomy.setIntegrations(activeTgBot, activeDcBot || dcClient, convoManager);
    brain.tgBot = activeTgBot;
    brain.dcBot = activeDcBot || dcClient;

    singleGolemInstance = { brain, controller, autonomy, convoManager, actionQueue };
    return singleGolemInstance;
}

(async () => {
    if (process.env.GOLEM_TEST_MODE === 'true') { console.log('🚧 GOLEM_TEST_MODE active.'); return; }

    // 🎯 v9.1.5 解耦：啟動時不再遍歷建立 initialGolems
    // 也延後架構掃描與巡檢，直到第一個實體啟動
    let _isCoreInitialized = false;
    async function ensureCoreServices() {
        if (_isCoreInitialized) return;

        // 🚀 初始化系統日誌持久化 (確保服務啟動時日誌功能就緒)
        SystemLogger.init(ConfigManager.LOG_BASE_DIR);
        console.log('📡 [Config] 運行模式: 單機 (Single-Golem Architecture)');

        console.log('🧠 [Introspection] Scanning project structure...');
        await introspection.getStructure().catch(e => console.warn('⚠️ Introspection failed:', e.message));

        // 啟動排程器
        setInterval(runTieredCompression, 6 * 60 * 60 * 1000);
        runTieredCompression();

        if (dcClient) dcClient.login(ConfigManager.CONFIG.DC_TOKEN);

        _isCoreInitialized = true;
    }
    // [H-6, S-5] Clean up redundant requires, handle watch race condition gracefully
    fs_sync.watch(process.cwd(), async (eventType, filename) => {
        if (filename === '.reincarnate_signal.json') {
            try {
                let signalRaw;
                try {
                    signalRaw = fs_sync.readFileSync('.reincarnate_signal.json', 'utf-8');
                    fs_sync.unlinkSync('.reincarnate_signal.json');
                } catch (e) {
                    if (e.code === 'ENOENT') return; // 已被其他觸發處理
                    throw e;
                }
                const { summary } = JSON.parse(signalRaw);
                console.log("🔄 [系統] 啟動記憶轉生程序！正在開啟新對話...");

                const instance = getOrCreateGolem();
                if (instance.brain.page) {
                    console.log(`🚀 [System] Browser Session Started`);
                }
                const wakeUpPrompt = `【系統重啟初始化：記憶轉生】\n請遵守你的核心設定(Project Golem)。\n你剛進行了會話重置以釋放記憶體。\n以下是你上一輪對話留下的【記憶摘要】：\n${summary}\n\n請根據上述摘要，向使用者打招呼，並嚴格包含以下這段話（或類似語氣）：\n「🔄 對話視窗已成功重啟，並載入了剛剛的重點記憶！不過老實說，重啟過程可能會讓我忘記一些瑣碎的小細節，如果接下來我有漏掉什麼，請隨時提醒我喔！」`;
                if (instance.brain.sendMessage) {
                    await instance.brain.sendMessage(wakeUpPrompt);
                }
            } catch (error) {
                console.error("❌ 轉生過程發生錯誤:", error);
            }
        }
    });

    const dashboard = require('./dashboard');
    if (dashboard && dashboard.webServer && typeof dashboard.webServer.setGolemFactory === 'function') {
        // [GrammyBridge] Use factory instead of direct TelegramBot constructor
        dashboard.webServer.setGolemFactory(async (golemConfig) => {
            if (singleGolemInstance) {
                console.log(`⚠️ [Factory] Golem already exists, skipping.`);
                return singleGolemInstance;
            }
            if (golemConfig.tgToken && !activeTgBot) {
                try {
                    // [v9.1.5 修正] 先以 polling: false 建立 Bot，
                    // 再延遲啟動 Polling 並使用 restart:true 讓舊 session 自動讓步，防止 409 Conflict
                    const bot = createTelegramBot(golemConfig.tgToken, { polling: false });
                    bot.golemConfig = golemConfig;
                    bot.getMe().then(me => {
                        bot.username = me.username;
                        console.log(`🤖 [Bot] ${golemConfig.id} 已掛載 (@${me.username})`);
                        
                        // ✨ [新增] 更新 Telegram 指令選單
                        const tgCommands = [
                            { command: 'sos', description: '輕量級急救：清除網頁快取' },
                            { command: 'new', description: '物理重生：開啟全新對話' },
                            { command: 'new_memory', description: '徹底轉生：清空 DB 並重置' },
                            { command: 'model', description: '模型切換 (fast/thinking/pro)' },
                            { command: 'dashboard', description: '顯示控制台連線網址' },
                            { command: 'enable_silent', description: '開啟完全靜默模式' },
                            { command: 'disable_silent', description: '解除靜默模式' },
                            { command: 'enable_observer', description: '同步對話但不發言' },
                            { command: 'disable_observer', description: '解除觀察者模式' },
                            { command: 'patch', description: '執行自我反思與代碼優化' }
                        ];
                        bot.setMyCommands(tgCommands).catch(e => console.error(`❌ [Bot] Set TG Commands Error:`, e.message));
                    }).catch(e => {
                        if (!e.message.includes('401')) {
                            console.warn(`⚠️ [Bot] ${golemConfig.id}:`, e.message);
                        }
                    });
                    activeTgBot = bot;

                    // ✅ [Bug #1 修復] 在 factory 內部動態綁定事件，確保動態建立的 Bot 也能接收訊息
                    const boundGolemId = golemConfig.id;
                    bot.on('message', async (msg) => {
                        try {
                            await handleUnifiedMessage(new UniversalContext('telegram', msg, bot), boundGolemId);
                        } catch (e) {
                            console.error(`❌ [TG ${boundGolemId}] Message Handler Error:`, e);
                        }
                    });
                    bot.on('callback_query', async (query) => {
                        try {
                            await bot.answerCallbackQuery(query.id);
                        } catch (e) {
                            console.warn(`⚠️ [TG ${boundGolemId}] Callback Answer Warning: ${e.message}`);
                        }
                        try {
                            await handleUnifiedCallback(
                                new UniversalContext('telegram', query, bot),
                                query.data,
                                boundGolemId
                            );
                        } catch (e) {
                            console.error(`❌ [TG ${boundGolemId}] Callback Handler Error:`, e);
                        }
                    });
                    console.log(`🔗 [Factory] TG events bound for Golem [${boundGolemId}]`);

                    // [v9.1.5] 409 衝突自動修復：若偵測到 session conflict，5 秒後自動重啟 Polling
                    let _pollingRestartTimer = null;
                    bot.on('polling_error', (err) => {
                        if (err.code === 'ETELEGRAM' && err.message.includes('409')) {
                            if (_pollingRestartTimer) return; // 防止重複觸發
                            console.warn(`⚠️ [Bot] ${boundGolemId} 偵測到 409 Conflict，5 秒後自動重連...`);
                            _pollingRestartTimer = setTimeout(async () => {
                                _pollingRestartTimer = null;
                                try { await bot.stopPolling(); } catch (e) { }
                                await new Promise(r => setTimeout(r, 1000));
                                try {
                                    bot.startPolling({ restart: true });
                                    console.log(`✅ [Bot] ${boundGolemId} Polling 已自動恢復。`);
                                } catch (e) {
                                    console.error(`❌ [Bot] ${boundGolemId} 自動重啟 Polling 失敗:`, e.message);
                                }
                            }, 5000);
                        }
                    });

                    // [v9.1.5 保留] 409 衝突自動修復機制，但不再於此處強制提早啟動 polling
                    // polling 將在 persona.json 存在且 brain.init() 完成後統一啟動
                } catch (e) {
                    console.error(`❌ [Bot] 初始化 ${golemConfig.id} Telegram 失敗:`, e.message);
                }
            }

            if (golemConfig.dcToken && !activeDcBot) {
                try {
                    const client = new Client({
                        intents: [
                            GatewayIntentBits.Guilds,
                            GatewayIntentBits.GuildMessages,
                            GatewayIntentBits.MessageContent,
                            GatewayIntentBits.DirectMessages
                        ],
                        partials: [Partials.Channel]
                    });
                    client.golemConfig = golemConfig;
                    client.once('ready', () => {
                        console.log(`🤖 [Bot] ${golemConfig.id} Discord 已掛載 (${client.user ? client.user.tag : 'Unknown'})`);
                    });

                    // Bind per-golem Discord events directly to the global handler but force the targetId
                    client.on('messageCreate', (msg) => {
                        if (!msg.author.bot) handleUnifiedMessage(new UniversalContext('discord', msg, client), golemConfig.id);
                    });
                    client.on('interactionCreate', (interaction) => {
                        if (interaction.isButton()) handleUnifiedCallback(new UniversalContext('discord', interaction, client), interaction.customId, golemConfig.id);
                    });

                    client.login(golemConfig.dcToken).catch(e => {
                        console.warn(`⚠️ [Bot] ${golemConfig.id} Discord Login Failed:`, e.message);
                    });
                    activeDcBot = client;
                } catch (e) {
                    console.error(`❌ [Bot] 初始化 ${golemConfig.id} Discord 失敗:`, e.message);
                }
            }

            const instance = getOrCreateGolem();
            await ensureCoreServices();
            if (typeof instance.brain._linkDashboard === 'function') {
                instance.brain._linkDashboard(instance.autonomy);
            }

            // [v9.1.5 Fix]: Verify persona.json to decide actual status
            const personaPath = path_sync.resolve(ConfigManager.MEMORY_BASE_DIR, 'persona.json');

            if (fs_sync.existsSync(personaPath)) {
                instance.brain.status = 'running';
                // ✅ [Fix] 確保在 polling 前 brain.init() 已經準備完畢
                await instance.brain.init();
                if (activeTgBot && activeTgBot.isPolling && !activeTgBot.isPolling()) {
                    activeTgBot.startPolling({ restart: true });
                    console.log(`✅ [Bot] ${golemConfig.id} Telegram Polling 已啟動。`);
                }
            } else {
                instance.brain.status = 'pending_setup';
            }

            instance.autonomy.start();
            console.log(`✅ [Factory] Golem started via Web Dashboard.`);
            return instance;
        });
        console.log('🔗 [System] golemFactory injected into WebServer.');
    }

    async function runTieredCompression() {
        const now = new Date();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        const year = now.getFullYear();
        console.log(`🕒 [Scheduler] 啟動多層記憶壓縮巡檢...`);

        const instance = singleGolemInstance;
        if (instance) {
            const mgr = instance.brain.chatLogManager;
            if (mgr) {
                console.log(`📦 [LogManager] 檢查日誌狀態...`);
                if (month === 1 && day === 1 && year % 10 === 0) {
                    const lastDecade = mgr._getLastDecadeString();
                    mgr.compressEra(lastDecade, instance.brain).catch(err => {
                        console.error(`❌ [Scheduler] Era 壓縮失敗: ${err.message}`);
                    });
                }
                if (month === 1 && day === 1) {
                    const lastYear = mgr._getLastYearString();
                    mgr.compressYearly(lastYear, instance.brain).catch(e => console.error(e));
                }
                if (day === 1) {
                    const lastMonth = mgr._getLastMonthString();
                    mgr.compressMonthly(lastMonth, instance.brain).catch(e => console.error(e));
                }
                
                // 每天執行昨日的摘要壓縮
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = mgr._formatDate(yesterday);
                mgr.compressLogsForDate(yesterdayStr, instance.brain).catch(e => console.error(e));
            }
        }
    }

    console.log(`✅ Project Golem Management Dashboard is Online. (Ready to start instances)`);
})();

async function handleUnifiedMessage(ctx, forceTargetId = null) {
    const msgTime = ctx.messageTime;
    console.log(`[DEBUG] msgTime: ${msgTime}, BOOT_TIME: ${BOOT_TIME}, diff: ${msgTime - BOOT_TIME}`);
    // 允許 60 秒的時鐘誤差，防止伺服器時間稍快於通訊軟體伺服器時間導致新訊息被判定為舊訊息
    if (msgTime && msgTime < (BOOT_TIME - 60000)) {
        console.log(`[MessageManager] 忽略重啟前的舊訊息 (Golem: ${forceTargetId || 'golem_A'}, Diff: ${msgTime - BOOT_TIME}ms)`);
        return;
    }

    // [Single-Golem 版]
    // 一律使用單一實體
    const instance = getOrCreateGolem();
    const { brain, controller, autonomy, convoManager } = instance;

    if (ctx.isAdmin && ctx.text && ctx.text.trim().toLowerCase() === '/sos') {
        try {
            const targetFiles = [
                path.join(os.homedir(), 'project-golem', 'golem_selectors.json'),
                path.join(process.cwd(), 'golem_selectors.json'),
                path.join(process.cwd(), 'selectors.json'),
                path.join(process.cwd(), 'src', 'core', 'selectors.json')
            ];

            let isDeleted = false;
            for (const file of targetFiles) {
                if (fs_sync.existsSync(file)) {
                    fs_sync.unlinkSync(file);
                    console.log(`🗑️ [SOS] 已刪除污染檔案: ${file}`);
                    isDeleted = true;
                }
            }

            if (isDeleted) {
                await ctx.reply("✅ 毒蘋果 (選擇器快取) 已成功刪除！\n不用重啟，請直接跟我說話，我會觸發 DOM Doctor 自動重抓乾淨的選擇器。");
            } else {
                await ctx.reply("⚠️ 找不到污染的快取檔案，它可能已經是乾淨狀態了。");
            }
        } catch (e) {
            await ctx.reply(`❌ 緊急刪除失敗: ${e.message}`);
        }
        return;
    }

    if (ctx.isAdmin && ctx.text && ctx.text.trim().toLowerCase() === '/new') {
        await ctx.reply("🔄 收到 /new 指令！正在為您開啟全新的大腦對話神經元...");
        try {
            if (brain.page) {
                await brain.init(true);
                await ctx.reply("✅ 物理重置完成！已經為您切斷舊有記憶，現在這是一個全新且乾淨的 Golem 實體。");
            } else {
                await ctx.reply("⚠️ 找不到活躍的網頁視窗，無法執行物理重置。");
            }
        } catch (e) {
            await ctx.reply(`❌ 物理重置失敗: ${e.message}`);
        }
        return;
    }

    if (ctx.isAdmin && ctx.text && ctx.text.trim().toLowerCase() === '/new_memory') {
        await ctx.reply("💥 收到 /new_memory 指令！正在為您物理清空底層 DB 並執行深度轉生...");
        try {
            if (brain.memoryDriver && typeof brain.memoryDriver.clearMemory === 'function') {
                await brain.memoryDriver.clearMemory();
            }
            if (brain.page) {
                await brain.init(true);
                await ctx.reply("✅ 記憶庫 DB 已徹底清空格式化！網頁也已重置，這是一個 100% 空白、無任何歷史包袱的 Golem 實體。");
            } else {
                await ctx.reply("⚠️ 找不到活躍的網頁視窗。");
            }
        } catch (e) {
            await ctx.reply(`❌ 深度轉生失敗: ${e.message}`);
        }
        return;
    }

    // ✨ [新增] /model 指令實作
    if (ctx.isAdmin && ctx.text && ctx.text.trim().toLowerCase().startsWith('/model')) {
        const args = ctx.text.trim().split(/\s+/);
        const targetModel = args[1] ? args[1].toLowerCase() : '';

        // 根據截圖防呆，只允許 fast, thinking, pro
        if (!['fast', 'thinking', 'pro'].includes(targetModel)) {
            await ctx.reply("ℹ️ 請輸入正確的模組關鍵字，例如：\n`/model fast` (回答速度快)\n`/model thinking` (具備深度思考)\n`/model pro` (進階程式碼與數學能力)");
            return;
        }

        await ctx.reply(`🔄 啟動視覺神經，嘗試為您操作網頁切換至 [${targetModel}] 模式...`);
        try {
            if (typeof brain.switchModel === 'function') {
                const result = await brain.switchModel(targetModel);
                await ctx.reply(result);
            } else {
                await ctx.reply("⚠️ 您的 GolemBrain 尚未掛載 switchModel 功能，請確認檔案是否已更新。");
            }
        } catch (e) {
            await ctx.reply(`❌ 切換模組失敗: ${e.message}`);
        }
        return;
    }

    // ✨ [新增] /dashboard 指令實作
    if (ctx.isAdmin && ctx.text && ctx.text.trim().toLowerCase() === '/dashboard') {
        const port = process.env.DASHBOARD_PORT || 3000;
        const allowRemote = process.env.ALLOW_REMOTE_ACCESS === 'true';
        const localUrl = `http://localhost:${port}/dashboard`;
        
        let message = `🌐 **Golem 控制台網址**\n\n🏠 **本地存取 (Local):**\n${localUrl}`;
        
        if (allowRemote) {
            const localIp = getLocalIp();
            const remoteUrl = `http://${localIp}:${port}/dashboard`;
            message += `\n\n🌍 **區域網路存取 (Remote):**\n${remoteUrl}`;
        } else {
            message += `\n\n> 💡 目前未開啟遠端存取。若需從區域網路連線，請至「系統總表」開啟「允許遠端存取」。`;
        }
        
        await ctx.reply(message, { parse_mode: 'Markdown' });
        return;
    }

    // ✨ [新增] /enable_silent & /disable_silent 指令實作 (僅限 CHAT 模式)
    if (ctx.authMode === 'CHAT' && ctx.isAdmin && ctx.text && (ctx.text.trim().toLowerCase().startsWith('/enable_silent') || ctx.text.trim().toLowerCase().startsWith('/disable_silent'))) {
        const lowerRaw = ctx.text.trim().toLowerCase();
        const isEnable = lowerRaw.startsWith('/enable_silent');
        const args = ctx.text.trim().split(/\s+/);
        // 指令格式現在是 /enable_silent @bot_username
        const targetBotTag = args[1] || "";
        const targetBotUsername = targetBotTag.startsWith('@') ? targetBotTag.substring(1).toLowerCase() : targetBotTag.toLowerCase();

        if (!targetBotTag) {
            const currentBotUsername = ctx.instance.username ? `@${ctx.instance.username}` : `@golem_A`;
            await ctx.reply(`ℹ️ 請指定目標 Bot ID，例如：\n \`${isEnable ? '/enable_silent' : '/disable_silent'} ${currentBotUsername}\``);
            return;
        }

        // 比對 Bot Username (忽略大小寫)
        if (ctx.instance.username && targetBotUsername === ctx.instance.username.toLowerCase()) {
            // OK
        } else if (!ctx.instance.username && targetBotUsername === 'golem_a') {
            // OK
        } else {
            return;
        }

        convoManager.silentMode = isEnable;
        if (isEnable) convoManager.observerMode = false; // 開啟全靜默時關閉觀察者

        const displayName = ctx.instance.username ? `@${ctx.instance.username}` : `[${forceTargetId || 'golem_A'}]`;
        if (isEnable) {
            await ctx.reply(`🤫 ${displayName} 已進入「完全靜默模式」。\n我將暫時關閉感知，且不會記錄任何對話。`);
        } else {
            await ctx.reply(`📢 ${displayName} 已解除靜默模式。`);
        }
        return;
    }

    // ✨ [新增] /enable_observer & /disable_observer 指令實作 (僅限 CHAT 模式)
    if (ctx.authMode === 'CHAT' && ctx.isAdmin && ctx.text && (ctx.text.trim().toLowerCase().startsWith('/enable_observer') || ctx.text.trim().toLowerCase().startsWith('/disable_observer'))) {
        const lowerRaw = ctx.text.trim().toLowerCase();
        const isEnable = lowerRaw.startsWith('/enable_observer');
        const args = ctx.text.trim().split(/\s+/);
        const targetBotTag = args[1] || "";
                const targetBotUsername = targetBotTag.startsWith('@') ? targetBotTag.substring(1) : targetBotTag;
        if (targetBotUsername && targetBotUsername !== ctx.instance.username) return;

        const { brain, convoManager } = getOrCreateGolem();
        const displayName = ctx.instance.username ? `@${ctx.instance.username}` : `[Golem]`;
        if (isEnable) convoManager.observerMode = true;
        else convoManager.observerMode = false;

        if (isEnable) {
            await ctx.reply(`👁️ ${displayName} 已進入「觀察者模式」。\n我會安靜地同步所有對話上下文，但預設不發言。`);
        } else {
            await ctx.reply(`📢 ${displayName} 已解除觀察者模式。`);
        }
        return;
    }

    if (InteractiveMultiAgent.multiAgentListeners && InteractiveMultiAgent.multiAgentListeners.has(ctx.chatId)) {
        const callback = InteractiveMultiAgent.multiAgentListeners.get(ctx.chatId);
        callback(ctx.text);
        return;
    }

    if (ctx.text && ['恢復會議', 'resume', '繼續會議'].includes(ctx.text.toLowerCase())) {
        if (InteractiveMultiAgent.canResume(ctx.chatId)) {
            await InteractiveMultiAgent.resumeConversation(ctx, brain);
            return;
        }
    }

    if (!ctx.text && !ctx.getAttachment) return;
    if (!ctx.isAdmin) return;
    if (await NodeRouter.handle(ctx, brain)) return;

    const lowerText = ctx.text ? ctx.text.toLowerCase() : '';
    if (autonomy.pendingPatch) {
        if (['ok', 'deploy', 'y', '部署'].includes(lowerText)) return executeDeploy(ctx, forceTargetId || 'golem_A');
        if (['no', 'drop', 'n', '丟棄'].includes(lowerText)) return executeDrop(ctx, forceTargetId || 'golem_A');
    }

    if (lowerText.startsWith('/patch') || lowerText.includes('優化代碼')) {
        await autonomy.performSelfReflection(ctx);
        return;
    }

    await ctx.sendTyping();
    try {
        let finalInput = ctx.text;
        const attachment = await ctx.getAttachment();

        // ✨ [群組模式身分與回覆注入]
        const isGroupMode = ConfigManager.CONFIG.TG_AUTH_MODE === 'CHAT' && ctx.platform === 'telegram';
        let senderPrefix = isGroupMode ? `【發話者：${ctx.senderName}】\n` : "";
        if (ctx.replyToName) {
            senderPrefix += `【回覆給：${ctx.replyToName}】\n`;
        }

        if (attachment) {
            // 🚀 [v9.1.5] 如果附件來自 Telegram/Discord (有 URL 但非 Native)，嘗試下載並轉化為原生附件
            // 現在不限圖片，支援所有 Gemini 支援的檔案類型
            if (!attachment.isNative && attachment.url) {
                try {
                    console.log(`📡 [System] 正在將遠端附件轉化為本地原生附件... (${attachment.url})`);
                    const tempDir = path_sync.join(process.cwd(), 'data', 'temp_uploads');
                    
                    // 根據 mimeType 推斷副檔名
                    let ext = 'bin';
                    if (attachment.mimeType) {
                        const parts = attachment.mimeType.split('/');
                        ext = parts[1] || 'bin';
                        if (ext === 'plain') ext = 'txt';
                        if (ext === 'jpeg') ext = 'jpg';
                        if (ext === 'gif') ext = 'gif';
                        if (ext === 'markdown' || ext === 'x-markdown') ext = 'md';
                        if (ext.includes('wordprocessingml')) ext = 'docx';
                        if (ext.includes('spreadsheetml')) ext = 'xlsx';
                        if (ext.includes('presentationml')) ext = 'pptx';
                    }
                    
                    const fileName = `remote_${Date.now()}_${uuidv4().substring(0, 8)}.${ext}`;
                    const localPath = path_sync.join(tempDir, fileName);
                    
                    await downloadFile(attachment.url, localPath);
                    attachment.url = `/api/files/${fileName}`;
                    attachment.path = localPath;
                    attachment.isNative = true;
                    console.log(`✅ [System] 附件下載完成，URL: ${attachment.url}`);
                } catch (err) {
                    console.warn(`⚠️ [System] 附件轉化失敗: ${err.message}，將退回 OpticNerve 模式。`);
                }
            }

            // 如果是原生附加檔案 (由 Web Dashboard 傳入或剛剛下載完成)，則跳過 OpticNerve 分析，直接入隊
            if (attachment.isNative) {
                console.log("📎 [System] 偵測到原生附件，將直接交由 Golem 處理。");
                finalInput = senderPrefix + (ctx.text || "");
            } else {
                await ctx.reply("👁️ 正在透過 OpticNerve 分析檔案...");
                const apiKey = await brain.doctor.keyChain.getKey();
                if (apiKey) {
                    const analysis = await OpticNerve.analyze(attachment.url, attachment.mimeType, apiKey);
                    finalInput = `${senderPrefix}【系統通知：視覺訊號】\n檔案類型：${attachment.mimeType}\n分析報告：\n${analysis}\n使用者訊息：${ctx.text || ""}\n請根據分析報告回應。`;
                } else {
                    await ctx.reply("⚠️ 視覺系統暫時過熱 (API Rate Limit)，無法分析圖片，將僅處理文字訊息。");
                    finalInput = senderPrefix + (ctx.text || "");
                }
            }
        } else {
            finalInput = senderPrefix + (ctx.text || "");
        }

        if (!finalInput && !attachment) return;
        await convoManager.enqueue(ctx, finalInput, { attachment: attachment });
    } catch (e) {
        console.error(e);
        await ctx.reply(`❌ 錯誤: ${e.message}`);
    }
}

async function handleUnifiedCallback(ctx, actionData) {
    if (ctx.platform === 'discord' && ctx.isInteraction) {
        try {
            await ctx.event.deferReply({ flags: 64 });
        } catch (e) {
            console.error('Callback Discord deferReply Error:', e.message);
        }
    }

    if (!ctx.isAdmin) return;

    // 解析 GolemId (如果是 PATCH 相關)
    if (actionData.startsWith('PATCH_DEPLOY_')) {
        return executeDeploy(ctx);
    }
    if (actionData.startsWith('PATCH_DROP_')) {
        return executeDrop(ctx);
    }

    const { brain, controller, convoManager, actionQueue } = getOrCreateGolem();
    const pendingTasks = controller.pendingTasks;
    if (actionData === 'SYSTEM_FORCE_UPDATE') return SystemUpgrader.performUpdate(ctx);
    if (actionData === 'SYSTEM_UPDATE_CANCEL') return await ctx.reply("已取消更新操作。");

    if (actionData.includes('_')) {
        const [action, taskId] = actionData.split('_');
        const task = pendingTasks.get(taskId);
        if (!task) return await ctx.reply('⚠️ 任務已失效');

        // ✨ [v9.1] 處理【大腦對話佇列】插隊系統的 Callback (DIALOGUE_QUEUE_APPROVAL)
        if (task.type === 'DIALOGUE_QUEUE_APPROVAL') {
            pendingTasks.delete(taskId);

            try {
                if (ctx.platform === 'telegram' && ctx.event.message) {
                    await ctx.instance.editMessageText(
                        `🚨 **大腦思考中**\n目前對話佇列繁忙。\n\n*(使用者已選擇：${action === 'DIAPRIORITY' ? '⬆️ 急件插隊' : '⬇️ 正常排隊'})*`,
                        {
                            chat_id: ctx.chatId,
                            message_id: ctx.event.message.message_id,
                            parse_mode: 'Markdown',
                            reply_markup: { inline_keyboard: [] }
                        }
                    ).catch(() => { });
                }
            } catch (e) { console.warn("無法更新大腦插隊詢問訊息:", e.message); }

            const isPriority = action === 'DIAPRIORITY';

            // 重新入隊處理對話
            if (convoManager) {
                convoManager._actualCommit(task.ctx, task.text, isPriority);
            }
            return;
        }

        if (action === 'DENY') {
            pendingTasks.delete(taskId);
            await ctx.reply('🛡️ 操作駁回');
        } else if (action === 'APPROVE') {
            const { steps, nextIndex } = task;
            pendingTasks.delete(taskId);

            await ctx.reply("✅ 授權通過，執行中 (這可能需要幾秒鐘)...");
            const approvedStep = steps[nextIndex];

            let cmd = "";

            if (approvedStep.action === 'command' || approvedStep.cmd || approvedStep.parameter || approvedStep.command) {
                cmd = approvedStep.cmd || approvedStep.parameter || approvedStep.command || "";
            }
            else if (approvedStep.action && approvedStep.action !== 'command') {
                const actionName = String(approvedStep.action).toLowerCase().replace(/_/g, '-');
                let payload = "";
                if (approvedStep.summary) payload = String(approvedStep.summary);
                else if (approvedStep.args) payload = typeof approvedStep.args === 'string' ? approvedStep.args : JSON.stringify(approvedStep.args);
                else {
                    // 防呆：如果沒有 args 也沒有 summary，則將扣除 action 以外的所有欄位封裝為 JSON
                    const { action, ...params } = approvedStep;
                    payload = JSON.stringify(params);
                }

                const safePayload = payload.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');
                cmd = `node src/skills/core/${actionName}.js "${safePayload}"`;
                console.log(`🔧 [Command Builder] 成功將結構化技能 [${actionName}] 組裝為安全指令`);
            }

            if (!cmd && task.rawText) {
                const match = task.rawText.match(/node\s+src\/skills\/lib\/[a-zA-Z0-9_-]+\.js\s+.*?(?="|\n|$)/);
                if (match) {
                    cmd = match[0];
                    console.log(`🔧 [Auto-Fix] 已從破裂的 JSON 原始內容中硬挖出指令`);
                }
            }

            if (!cmd) {
                await ctx.reply("⚠️ 解析失敗：無法辨認指令格式。請重新對 Golem 下達指令。");
                return;
            }

            // 🛡️ [Security Safeguard] 指令安全檢查
            const safeguard = require('./src/utils/CommandSafeguard');
            // 已由使用者手動核准，故跳過硬編碼的正則白名單檢查 (skipWhitelist = true)
            // 僅保留黑名單關鍵字與格式校準
            const validation = safeguard.validate(cmd, true);
            if (!validation.safe) {
                console.error(`🛡️ [Safeguard] 攔截危險指令: ${cmd} | 原因: ${validation.reason}`);
                await ctx.reply(`🛡️ **安全警告**：偵測到潛在危險指令！\n執行權限已自動攔截。\n原因：${validation.reason}`);
                return;
            }
            cmd = validation.sanitizedCmd;

            if (cmd.includes('reincarnate.js')) {
                await ctx.reply("🔄 收到轉生指令！正在將記憶注入核心並準備重啟大腦...");
                const { exec } = require('child_process');
                exec(cmd);
                return;
            }

            const util = require('util');
            const execPromise = util.promisify(require('child_process').exec);

            // ✨ [v9.1] 將物理操作封裝並丟入行動產線 (Action Queue)

            await actionQueue.enqueue(ctx, async () => {
                let execResult = "";
                let finalOutput = "";
                try {
                    const { stdout, stderr } = await execPromise(cmd, { timeout: 45000, maxBuffer: 1024 * 1024 * 10 });
                    finalOutput = (stdout || stderr || "✅ 指令執行成功，無特殊輸出").trim();
                    execResult = `[Step ${nextIndex + 1} Success] cmd: ${cmd}\nResult:\n${finalOutput}`;
                    console.log(`✅ [Executor] 成功捕獲終端機輸出 (${finalOutput.length} 字元)`);
                } catch (e) {
                    finalOutput = `Error: ${e.message}\n${e.stderr || ''}`;
                    execResult = `[Step ${nextIndex + 1} Failed] cmd: ${cmd}\nResult:\n${finalOutput}`;
                    console.error(`❌ [Executor] 執行錯誤: ${e.message}`);
                }

                const MAX_LENGTH = 15000;
                if (execResult.length > MAX_LENGTH) {
                    execResult = execResult.substring(0, MAX_LENGTH) + `\n\n... (為保護記憶體，內容已截斷，共省略 ${execResult.length - MAX_LENGTH} 字元) ...`;
                    console.log(`✂️ [System] 執行結果過長，已自動截斷為 ${MAX_LENGTH} 字元。`);
                }

                let remainingResult = "";
                try {
                    remainingResult = await controller.runSequence(ctx, steps, nextIndex + 1) || "";
                } catch (err) {
                    console.warn(`⚠️ [System] 執行後續步驟時發生警告: ${err.message}`);
                }

                const observation = [execResult, remainingResult].filter(Boolean).join('\n\n----------------\n\n');

                if (observation) {
                    await ctx.reply(`📤 指令執行完畢 (共抓取 ${finalOutput.length} 字元)！將結果放入對話隊列 (Dialogue Queue) 等待大腦分析...`);

                    const feedbackPrompt = `[System Observation]\nUser approved actions.\nExecution Result:\n${observation}\n\nPlease analyze this result and report to the user using [GOLEM_REPLY].`;
                    try {
                        // ✨ [v9.1] 產線串接：將加工完成的 Observation 放入對話產線 (Dialogue Queue) 取代直接呼叫 sendMessage
                        if (convoManager) {
                            await convoManager.enqueue(ctx, feedbackPrompt, { isPriority: true, bypassDebounce: true });
                        } else {
                            // 防呆：如果退化回沒有 convoManager，則走舊路
                            const finalResponse = await brain.sendMessage(feedbackPrompt);
                            await NeuroShunter.dispatch(ctx, finalResponse, brain, controller);
                        }
                    } catch (err) {
                        await ctx.reply(`❌ 傳送結果回大腦時發生異常：${err.message}`);
                    }
                }
            });
        }
    }
}

global.handleDashboardMessage = handleUnifiedMessage;
global.handleUnifiedCallback = handleUnifiedCallback;

async function executeDeploy(ctx) {
    const { autonomy, brain } = getOrCreateGolem();
    if (!autonomy.pendingPatch) return;
    try {
        const { path: patchPath, target: targetPath, name: targetName } = autonomy.pendingPatch;

        try {
            await fs.copyFile(targetPath, `${targetName}.bak-${Date.now()}`);
        } catch (e) { }

        const patchContent = await fs.readFile(patchPath);
        await fs.writeFile(targetPath, patchContent);
        await fs.unlink(patchPath);

        autonomy.pendingPatch = null;
        if (brain && brain.memoryDriver && brain.memoryDriver.recordSuccess) {
            try { await brain.memoryDriver.recordSuccess(); } catch (e) { }
        }
        await ctx.reply(`🚀 [Single Golem] ${targetName} 升級成功！正在重啟...`);
        if (global.gracefulRestart) await global.gracefulRestart();
    } catch (e) { await ctx.reply(`❌ [Single Golem] 部署失敗: ${e.message}`); }
}

async function executeDrop(ctx) {
    const { autonomy, brain } = getOrCreateGolem();
    if (!autonomy.pendingPatch) return;
    try {
        await fs.unlink(autonomy.pendingPatch.path);
    } catch (e) { }
    autonomy.pendingPatch = null;
    if (brain && brain.memoryDriver && brain.memoryDriver.recordRejection) {
        try { await brain.memoryDriver.recordRejection(); } catch (e) { }
    }
    await ctx.reply(`🗑️ [Single Golem] 提案已丟棄`);
}

// ✅ [Bug #1 修復] Bot 事件綁定已移入 golemFactory 內部動態處理。

if (dcClient) {
    dcClient.on('messageCreate', (msg) => { if (!msg.author.bot) handleUnifiedMessage(new UniversalContext('discord', msg, dcClient)); });
    dcClient.on('interactionCreate', (interaction) => { if (interaction.isButton()) handleUnifiedCallback(new UniversalContext('discord', interaction, dcClient), interaction.customId); });
}

/**
 * 🧹 資源清理核心程序
 */
async function performCleanup() {
    console.log("🛑 [System] 正在執行資源清理程序...");

    // 1. 停止 Telegram Bot Polling
    if (activeTgBot) {
        try {
            console.log(`🛑 [System] 正在停止 Telegram Bot Polling...`);
            await activeTgBot.stopPolling();
            console.log(`✅ [System] Telegram Bot Polling 已停止。`);
        } catch (e) {
            console.warn(`⚠️ [System] 停止 Telegram Bot Polling 失敗: ${e.message}`);
        }
    }

    // 2. 關閉 Puppeteer 瀏覽器實體
    const instance = singleGolemInstance;
    if (instance && instance.brain && instance.brain.browser) {
        try {
            console.log(`🛑 [System] 正在關閉瀏覽器...`);
            await instance.brain.browser.close();
            console.log(`✅ [System] 瀏覽器已關閉。`);
        } catch (e) {
            console.warn(`⚠️ [System] 關閉瀏覽器失敗: ${e.message}`);
        }
    }

    // 3. 停止 Web Dashboard (釋放 Port)
    try {
        const dashboard = require('./dashboard');
        if (dashboard && typeof dashboard.detach === 'function') {
            console.log(`🛑 [System] 正在關閉 Dashboard 服務...`);
            dashboard.detach();
            console.log(`✅ [System] Dashboard 服務已停止。`);
        }
    } catch (e) {
        console.warn(`⚠️ [System] 停止 Dashboard 失敗: ${e.message}`);
    }
}

global.stopGolem = async function (id) {
    if (id !== 'golem_A') return; // Currently only single mode supported
    await performCleanup();
    singleGolemInstance = null;
    
    const dashboard = require('./dashboard');
    if (dashboard && typeof dashboard.removeContext === 'function') {
        dashboard.removeContext(id);
    }
    
    console.log(`✅ [System] Golem ${id} has been stopped.`);
};

global.gracefulRestart = async function () {
    await performCleanup();

    // 3. 生成子程序並安全退出
    const { spawn } = require('child_process');
    const env = Object.assign({}, process.env, { SKIP_BROWSER: '1' });
    const subprocess = spawn(process.argv[0], process.argv.slice(1), {
        detached: true,
        stdio: 'ignore',
        env: env
    });
    subprocess.unref();
    process.exit(0);
};

global.fullShutdown = async function () {
    await performCleanup();
    console.log("👋 [System] 所有服務已關閉，正在退出系統。");
    process.exit(0);
};

module.exports = { getOrCreateGolem };
