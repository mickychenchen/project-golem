const KeyChain = require('../src/services/KeyChain');

describe('KeyChain', () => {
    let keychain;

    beforeEach(() => {
        keychain = new KeyChain();
        keychain.keys = ['key1', 'key2'];
        // Disable throttling for basic rotation test
        keychain.THROTTLE_MS = 0;
    });

    test('should rotate keys correctly', async () => {
        const k1 = await keychain.getKey();
        const k2 = await keychain.getKey();
        const k3 = await keychain.getKey();

        expect(k1).toBe('key1');
        expect(k2).toBe('key2');
        expect(k3).toBe('key1');
    });

    test('markCooldown should temporarily skip a key', async () => {
        keychain.markCooldown('key1', 1000);
        const k = await keychain.getKey();
        expect(k).toBe('key2');
    });
});
