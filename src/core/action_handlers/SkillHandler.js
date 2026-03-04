const skillManager = require('../../managers/SkillManager');

class SkillHandler {
    static async execute(ctx, act, brain) {
        const skillName = act.action;
        const dynamicSkill = skillManager.getSkill(skillName);

        if (dynamicSkill) {
            await ctx.reply(`🔌 執行技能: **${dynamicSkill.name}**...`);
            try {
                const result = await dynamicSkill.run({
                    page: brain.page,
                    browser: brain.browser,
                    brain: brain,
                    log: console,
                    io: { ask: (q) => ctx.reply(q) },
                    args: act
                });
                // ✅ [L-3 Fix] 截斷過長回傳，避免超過 Telegram 4096 字元上限
                if (result) {
                    const MAX_RESULT_LENGTH = 3800;
                    const displayResult = result.length > MAX_RESULT_LENGTH
                        ? result.slice(0, MAX_RESULT_LENGTH) + '\n...(已截斷)'
                        : result;
                    await ctx.reply(`✅ 技能回報: ${displayResult}`);
                }
            } catch (e) {
                await ctx.reply(`❌ 技能執行錯誤: ${e.message}`);
            }
            return true; // Indicates the skill was handled
        }
        return false; // Not a dynamic skill, indicates pass-through
    }
}

module.exports = SkillHandler;
