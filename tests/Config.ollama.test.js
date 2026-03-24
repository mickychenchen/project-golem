jest.mock('../src/utils/EnvManager', () => ({
    readEnv: jest.fn(() => ({}))
}));

const EnvManager = require('../src/utils/EnvManager');
const ConfigManager = require('../src/config');

describe('Config reload for Ollama settings', () => {
    const backup = {};
    const trackedKeys = [
        'GOLEM_BACKEND',
        'GOLEM_EMBEDDING_PROVIDER',
        'GOLEM_OLLAMA_BASE_URL',
        'GOLEM_OLLAMA_BRAIN_MODEL',
        'GOLEM_OLLAMA_EMBEDDING_MODEL',
        'GOLEM_OLLAMA_RERANK_MODEL',
        'GOLEM_OLLAMA_TIMEOUT_MS'
    ];

    beforeEach(() => {
        for (const key of trackedKeys) {
            backup[key] = process.env[key];
            delete process.env[key];
        }
    });

    afterEach(() => {
        for (const key of trackedKeys) {
            if (backup[key] === undefined) delete process.env[key];
            else process.env[key] = backup[key];
        }
    });

    test('reloadConfig applies Ollama backend and model settings', () => {
        EnvManager.readEnv.mockReturnValue({
            GOLEM_BACKEND: 'ollama',
            GOLEM_EMBEDDING_PROVIDER: 'ollama',
            GOLEM_OLLAMA_BASE_URL: 'http://localhost:11434',
            GOLEM_OLLAMA_BRAIN_MODEL: 'qwen2.5:7b',
            GOLEM_OLLAMA_EMBEDDING_MODEL: 'nomic-embed-text',
            GOLEM_OLLAMA_RERANK_MODEL: 'bge-reranker-v2-m3',
            GOLEM_OLLAMA_TIMEOUT_MS: '45000'
        });

        ConfigManager.reloadConfig();

        expect(ConfigManager.CONFIG.GOLEM_BACKEND).toBe('ollama');
        expect(ConfigManager.CONFIG.EMBEDDING_PROVIDER).toBe('ollama');
        expect(ConfigManager.CONFIG.OLLAMA_BASE_URL).toBe('http://localhost:11434');
        expect(ConfigManager.CONFIG.OLLAMA_BRAIN_MODEL).toBe('qwen2.5:7b');
        expect(ConfigManager.CONFIG.OLLAMA_EMBEDDING_MODEL).toBe('nomic-embed-text');
        expect(ConfigManager.CONFIG.OLLAMA_RERANK_MODEL).toBe('bge-reranker-v2-m3');
        expect(ConfigManager.CONFIG.OLLAMA_TIMEOUT_MS).toBe(45000);
    });

    test('reloadConfig normalizes invalid backend and provider', () => {
        EnvManager.readEnv.mockReturnValue({
            GOLEM_BACKEND: 'not-exists',
            GOLEM_EMBEDDING_PROVIDER: '???'
        });

        ConfigManager.reloadConfig();

        expect(ConfigManager.CONFIG.GOLEM_BACKEND).toBe('gemini');
        expect(ConfigManager.CONFIG.EMBEDDING_PROVIDER).toBe('local');
    });

    test('reloadConfig forces gemini embedding provider back to local', () => {
        EnvManager.readEnv.mockReturnValue({
            GOLEM_BACKEND: 'ollama',
            GOLEM_EMBEDDING_PROVIDER: 'gemini'
        });

        ConfigManager.reloadConfig();

        expect(ConfigManager.CONFIG.GOLEM_BACKEND).toBe('ollama');
        expect(ConfigManager.CONFIG.EMBEDDING_PROVIDER).toBe('local');
    });
});
