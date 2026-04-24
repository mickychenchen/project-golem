const commands = require('../src/config/commands');

describe('commands config', () => {
    test('includes /research command', () => {
        const hasResearch = commands.some((cmd) => cmd && cmd.command === '/research');
        expect(hasResearch).toBe(true);
    });
});
