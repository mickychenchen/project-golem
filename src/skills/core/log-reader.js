// src/skills/core/log-reader.js
// 負責讀取與檢索每日日誌摘要

const fs = require('fs');
const path = require('path');

async function run(ctx) {
    const args = ctx.args || {};

    // ✅ [H-2 Fix] 優先複用 brain.chatLogManager，否則傳入正確路徑建構
    let logManager;
    if (ctx.brain && ctx.brain.chatLogManager) {
        logManager = ctx.brain.chatLogManager;
    } else {
        const ChatLogManager = require('../../managers/ChatLogManager');
        const { LOG_BASE_DIR, GOLEM_MODE } = require('../../config');
        logManager = new ChatLogManager({
            logDir: LOG_BASE_DIR,
            isSingleMode: GOLEM_MODE === 'SINGLE'
        });
    }
    // 每日摘要存放於 daily/ 子目錄（金字塔記憶架構 Tier 1）
    const dailyDir = logManager.dirs.daily;

    try {
        const task = args.task || 'list';

        if (task === 'list') {
            console.log(`📂 [LogReader] 正在檢索已存在的摘要列表...`);
            const files = fs.readdirSync(dailyDir)
                .filter(f => f.length === 12 && f.endsWith('.log')) // YYYYMMDD.log (8+4=12 chars)
                .sort()
                .reverse(); // 最新優先

            if (files.length === 0) {
                return "ℹ️ 目前系統中尚無產生的每日摘要。";
            }

            const list = files.map(f => f.replace('.log', '')).join(', ');
            return `📅 現有摘要日期列表：\n${list}\n\n你可以使用 {"action": "log_read", "task": "get", "date": "日期"} 來讀取內容。`;
        }

        if (task === 'get') {
            if (!args.date) return "❌ 缺少 date 參數。";

            const summaryPath = path.join(dailyDir, `${args.date}.log`);
            if (!fs.existsSync(summaryPath)) {
                return `❌ 找不到 ${args.date} 的摘要。`;
            }

            console.log(`📄 [LogReader] 正在讀取 ${args.date} 的摘要內容...`);
            const content = fs.readFileSync(summaryPath, 'utf8');
            try {
                const data = JSON.parse(content);
                let output = `📜 [${args.date} 每日摘要]\n`;
                data.forEach((entry, index) => {
                    output += `\n--- 摘要 #${index + 1} (${new Date(entry.timestamp).toLocaleTimeString()}) ---\n${entry.content}\n`;
                });
                return output;
            } catch (e) {
                return `⚠️ 檔案內容解析失敗，原始內容如下：\n${content}`;
            }
        }

        return "❌ 未知的任務類型 (list/get)。";
    } catch (e) {
        return `❌ 讀取失敗: ${e.message}`;
    }
}

module.exports = {
    name: "log_read",
    description: "檢索並閱讀每日對話摘要",
    run: run
};
