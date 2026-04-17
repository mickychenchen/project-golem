const { CONFIG } = require('../config');
const HelpManager = require('../managers/HelpManager');
const skills = require('../skills');
const skillManager = require('../managers/SkillManager');
const SkillArchitect = require('../managers/SkillArchitect');
const wikiSkill = require('../skills/core/wiki');

// ✨ [v9.1 Addon] 初始化技能架構師 (Web Gemini Mode)
// 注意：這裡不傳入 Model，因為我們將在 NodeRouter 中傳入 Web Brain
const architect = new SkillArchitect();
console.log("🏗️ [SkillArchitect] 技能架構師已就緒 (Web Mode)");

// ============================================================
// ⚡ NodeRouter (反射層)
// ============================================================
class NodeRouter {
    static async handle(ctx, brain) {
        const text = (ctx.text || "").trim();
        const isWeb = !ctx.reply; // 判斷是否為網頁端 (無原生 reply 函數)

        // 輔助函式：統一回覆邏輯
        const reply = async (message, options = {}) => {
            if (!isWeb) {
                await ctx.reply(message, options);
            }
            return message; // 網頁端直接返回字串
        };

        if (text.match(/^\/(help|menu|指令|功能)/)) {
            return await reply(await HelpManager.getManual(), { parse_mode: 'Markdown' });
        }

        if (text === '/donate' || text === '/support' || text === '贊助') {
            return await reply(`☕ **感謝您的支持！**\n\n${CONFIG.DONATE_URL}\n\n(Golem 覺得開心 🤖❤️)`);
        }

        if (text === '/update' || text === '/reset') {
            if (isWeb) return await reply("⚠️ **系統更新** 功能目前僅限於機器人終端使用。");
            await ctx.reply("⚠️ **系統更新警告**\n這將強制覆蓋本地代碼。", {
                reply_markup: { inline_keyboard: [[{ text: '🔥 確認', callback_data: 'SYSTEM_FORCE_UPDATE' }, { text: '❌ 取消', callback_data: 'SYSTEM_UPDATE_CANCEL' }]] }
            });
            return true;
        }

        if (text.startsWith('/callme')) {
            const newName = text.replace('/callme', '').trim();
            if (newName) {
                const persona = require('../skills/core/persona');
                persona.setName('user', newName, brain.userDataDir);
                await brain.init(true); // forceReload
                return await reply(`👌 沒問題，以後稱呼您為 **${newName}**。`);
            }
        }

        // ✨ [v9.1 Feature] 學習新技能 (Web Gemini Mode)
        if (text === '/learn' || text.startsWith('/learn ')) {
            const intent = text.replace(/^\/learn\s*/i, '').trim();
            if (!intent) {
                return await reply("🧠 用法：`/learn <你要學習的技能描述>`\n例如：`/learn 建立一個股票查詢技能`");
            }
            if (!isWeb) {
                await ctx.reply(`🏗️ **Web 技能架構師啟動...**\n正在使用網頁算力為您設計：\`${intent}\``);
                await ctx.sendTyping();
            }

            try {
                const result = await architect.designSkill(brain, intent, skillManager.listSkills());

                if (result.success) {
                    // 1) 熱重載 SkillManager，讓動態 JS 技能可立即執行
                    try {
                        skillManager.refresh();
                    } catch (refreshError) {
                        console.warn(`⚠️ [NodeRouter] SkillManager refresh failed after /learn: ${refreshError.message}`);
                    }

                    // 2) 直接寫入 SQLite 索引，讓 Dashboard 立即可見
                    try {
                        const SkillIndexManager = require('../managers/SkillIndexManager');
                        const runtimeSkillId = String(
                            result.id || require('path').basename(result.path || '', '.js')
                        ).toLowerCase();

                        if (runtimeSkillId) {
                            const runtimeTitle = result.name || runtimeSkillId;
                            const runtimeDescription = result.preview || "由 /learn 動態生成的使用者技能";
                            const runtimeContent = [
                                `# ${runtimeTitle}`,
                                runtimeDescription,
                                "## Runtime Action",
                                `- action: \`${runtimeTitle}\``,
                                "## Source",
                                "```js",
                                result.code || "// source unavailable",
                                "```"
                            ].join('\n\n');

                            const index = brain && brain.skillIndex
                                ? brain.skillIndex
                                : new SkillIndexManager(brain.userDataDir);

                            await index.upsertSkillRecord({
                                id: runtimeSkillId,
                                name: runtimeTitle,
                                description: runtimeDescription,
                                content: runtimeContent,
                                path: result.path || '',
                                category: 'user_dynamic',
                                last_modified: Date.now()
                            });

                            if (!brain || !brain.skillIndex) {
                                await index.close();
                            }
                        }
                    } catch (indexError) {
                        console.warn(`⚠️ [NodeRouter] /learn skill index sync failed: ${indexError.message}`);
                    }
                }

                const response = result.success
                    ? `✅ **新技能編寫完成！**\n📜 **名稱**: \`${result.name}\`\n📝 **描述**: ${result.preview}\n📂 **檔案**: \`${require('path').basename(result.path)}\`\n_現在可以直接命令我使用此功能，且已同步到 SQLite，可在 Dashboard 看見。_`
                    : `❌ **學習失敗**: ${result.error}`;

                return await reply(response);
            } catch (e) {
                console.error(e);
                return await reply(`❌ **致命錯誤**: ${e.message}`);
            }
        }

        // ✨ [v9.1 Feature] 匯出/匯入/列表
        if (text.startsWith('/export ')) {
            try {
                const token = skillManager.exportSkill(text.replace('/export ', '').trim());
                return await reply(`📦 **技能膠囊**:\n\`${token}\``);
            } catch (e) {
                return await reply(`❌ ${e.message}`);
            }
        }

        if (text.startsWith('GOLEM_SKILL::')) {
            const res = skillManager.importSkill(text.trim());
            if (res.success) {
                try {
                    const SkillIndexManager = require('../managers/SkillIndexManager');
                    const importedId = String(require('path').basename(res.path || '', '.js')).toLowerCase();
                    const sourceCode = require('fs').readFileSync(res.path, 'utf8');
                    const title = res.name || importedId;
                    const content = [
                        `# ${title}`,
                        "由 GOLEM_SKILL 膠囊匯入的使用者技能",
                        "## Runtime Action",
                        `- action: \`${title}\``,
                        "## Source",
                        "```js",
                        sourceCode,
                        "```"
                    ].join('\n\n');

                    const index = brain && brain.skillIndex
                        ? brain.skillIndex
                        : new SkillIndexManager(brain.userDataDir);

                    await index.upsertSkillRecord({
                        id: importedId,
                        name: title,
                        description: "由 GOLEM_SKILL 匯入",
                        content,
                        path: res.path || '',
                        category: 'user_dynamic',
                        last_modified: Date.now()
                    });

                    if (!brain || !brain.skillIndex) {
                        await index.close();
                    }
                } catch (e) {
                    console.warn(`⚠️ [NodeRouter] GOLEM_SKILL index sync failed: ${e.message}`);
                }
            }
            return await reply(res.success ? `✅ 安裝成功: ${res.name}` : `⚠️ ${res.error}`);
        }

        if (text === '/skills') {
            try {
                const SkillIndexManager = require('../managers/SkillIndexManager');
                const index = new SkillIndexManager(brain.userDataDir);
                const allSkills = await index.listAllSkills();
                await index.close();

                if (allSkills.length === 0) {
                    return await reply("📭 目前尚未安裝或同步任何技能。");
                }

                let skillMsg = "📚 **Golem 已安裝系統能力清單**:\n";
                skillMsg += allSkills.map(s => `• **${s.id}**${s.name ? ` (${s.name})` : ''}`).join('\n');
                skillMsg += "\n\n_以上能力皆已由 SQLite 索引完成，隨時待命。_";

                return await reply(skillMsg);
            } catch (e) {
                console.error("Failed to list skills from SQLite:", e);
                return await reply(`❌ **讀取技能清單失敗**: ${e.message}`);
            }
        }

        if (text.startsWith('/patch') || text.includes('優化代碼')) return false;

        // ── /wiki 指令 ───────────────────────────────────────────
        if (text.startsWith('/wiki')) {
            const parts  = text.slice(5).trim().split(/\s+/);
            const action = parts[0] || 'help';
            const input  = parts.slice(1).join(' ');
            try {
                const result = await wikiSkill.run({ args: { action, input }, brain });
                return await reply(result);
            } catch (e) {
                return await reply(`❌ [Wiki] 執行失敗: ${e.message}`);
            }
        }

        // ── /compress 指令 ─────────────────────────────────────────
        // Hermes-inspired: 手動觸發 TrajectoryCompressor 壓縮目前會話
        if (text === '/compress' || text.startsWith('/compress ')) {
            if (!brain || !brain.compressSession) {
                return await reply('❌ [Compress] 大腦未初始化，無法執行壓縮。');
            }
            await reply('🗜️ 正在壓縮當前會話記憶，請稍候...');
            try {
                const result = await brain.compressSession();
                if (result.compressed) {
                    return await reply(`✅ **會話壓縮完成！**\n📉 節省了 **${result.savedChars.toLocaleString()}** 字元的上下文空間。`);
                } else {
                    return await reply('ℹ️ 當前會話尚未超過壓縮門檻，或無可壓縮的中段內容。');
                }
            } catch (e) {
                return await reply(`❌ 壓縮失敗: ${e.message}`);
            }
        }

        // ── /search 指令 ────────────────────────────────────────────
        // Hermes-inspired: 快速搜尋歷史對話記錄
        if (text.startsWith('/search ') || text.startsWith('/search\n')) {
            const query = text.replace(/^\/search\s*/i, '').trim();
            if (!query) {
                return await reply('🔍 用法：`/search <關鍵字>` 或使用 `/search <關鍵字> --days 60`\n例如：`/search memory bug`');
            }
            // 解析可選的 --days 參數
            const daysMatch = query.match(/--days\s+(\d+)/);
            const days = daysMatch ? parseInt(daysMatch[1]) : 30;
            const cleanQuery = query.replace(/--days\s+\d+/i, '').trim();

            try {
                const searchSkill = require('../skills/core/session-search');
                const result = await searchSkill.run({
                    args: { query: cleanQuery, mode: 'keyword', days },
                    brain
                });
                return await reply(result);
            } catch (e) {
                return await reply(`❌ 搜尋失敗: ${e.message}`);
            }
        }

        return false;
    }
}

module.exports = NodeRouter;
