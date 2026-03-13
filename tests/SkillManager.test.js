const SkillManager = require('../src/managers/SkillManager');
const fs = require('fs');

jest.mock('fs');

describe('SkillManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync.mockReturnValue([]);
        SkillManager.skills.clear();
    });

    test('refresh should scan directories', () => {
        fs.readdirSync.mockReturnValue([]);
        SkillManager.refresh();
        expect(fs.readdirSync).toHaveBeenCalled();
    });

    test('importSkill should write file and return success', () => {
        const payload = { n: 'imported', c: 'console.log("hello")' };
        const token = `GOLEM_SKILL::${Buffer.from(JSON.stringify(payload)).toString('base64')}`;
        
        const result = SkillManager.importSkill(token);
        expect(result.success).toBe(true);
        expect(fs.writeFileSync).toHaveBeenCalled();
    });

    test('exportSkill should handle core skills', () => {
        SkillManager.skills.set('core-skill', { name: 'core-skill', _type: 'CORE' });
        expect(() => SkillManager.exportSkill('core-skill')).toThrow();
    });
});
