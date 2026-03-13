/**
 * CommandSafeguard - Project Golem 安全防線
 * ---------------------------------------------------------
 * 職責：過濾、驗證並轉義所有即將執行的 Shell 指令，防止指令注入。
 */
class CommandSafeguard {
    constructor() {
        // 基礎白名單指令格式 (Regex)
        this.whitelist = [
            /^node src\/skills\/core\/[a-zA-Z0-9_-]+\.js\s+".*"$/,
            /^node src\/skills\/lib\/[a-zA-Z0-9_-]+\.js\s+".*"$/,
            /^node scripts\/doctor\.js$/,
            /^ls\s+.*$/,
            /^cat\s+.*$/
        ];

        // 敏感關鍵字黑名單 (即便符合白名單格式也會攔截)
        this.blacklistedKeywords = [
            ';', '&&', '||', '>', '`', '$(', '|',
            'rm -rf', 'sudo', 'chmod', 'chown',
            '/etc/passwd', '/etc/shadow', '.env'
        ];
    }

    /**
     * 驗證指令是否安全
     * @param {string} cmd 原始指令字串
     * @returns {Object} { safe: boolean, reason?: string, sanitizedCmd?: string }
     */
    validate(cmd) {
        if (!cmd || typeof cmd !== 'string') {
            return { safe: false, reason: '指令格式無效' };
        }

        const trimmedCmd = cmd.trim();

        // 1. 檢查黑名單關鍵字 (基本防禦)
        // 排除掉 legitimate 的引號內字串，這裡簡易處理
        for (const keyword of this.blacklistedKeywords) {
            if (trimmedCmd.includes(keyword)) {
                // 如果是 node skills.js "xxx" 格式，允許引號內出現某些字元，但這裡先採保守策略
                return { safe: false, reason: `偵測到敏感關鍵字: ${keyword}` };
            }
        }

        // 2. 檢查白名單模式
        const isMatched = this.whitelist.some(regex => regex.test(trimmedCmd));

        if (!isMatched) {
            return { safe: false, reason: '指令未列於白名單中' };
        }

        return { safe: true, sanitizedCmd: trimmedCmd };
    }
}

module.exports = new CommandSafeguard();
