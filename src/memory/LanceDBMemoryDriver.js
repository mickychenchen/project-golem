const fs = require('fs');
const path = require('path');
const lancedb = require('@lancedb/lancedb');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const KeyChain = require('../services/KeyChain');
const { CONFIG, KNOWLEDGE_BASE_DIR } = require('../config');

/**
 * 🎨 Embedding Providers
 */
class GeminiProvider {
    constructor(keyChain, modelName = 'text-embedding-004') {
        this.keyChain = keyChain;
        this.modelName = modelName;
    }
    async getEmbedding(text) {
        const apiKey = await this.keyChain.getKey();
        if (!apiKey) throw new Error("No API key available for Gemini embedding");
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: this.modelName });
        const result = await model.embedContent(text);
        return Array.from(result.embedding.values);
    }
    getIdentifier() { return `gemini_${this.modelName.replace(/[^a-z0-9]/gi, '_')}`; }
}

class TransformersProvider {
    constructor(modelName = 'Xenova/bge-small-zh-v1.5') {
        this.modelName = modelName;
        this.pipeline = null;
    }
    async _init() {
        if (this.pipeline) return;
        const { pipeline } = await import('@xenova/transformers');
        console.log(`📥 [Memory:LanceDB] 正在加載本地模型: ${this.modelName}...`);
        this.pipeline = await pipeline('feature-extraction', this.modelName);
    }
    async getEmbedding(text) {
        await this._init();
        const output = await this.pipeline(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
    }
    getIdentifier() { return `local_${this.modelName.replace(/[^a-z0-9]/gi, '_')}`; }
}

/**
 * 🧠 LanceDB Memory Driver (Pro Mode)
 * 支援混合檢索 (Hybrid Search) 與 記憶衰減機制 (Memory Decay)
 */
class LanceDBMemoryDriver {
    constructor() {
        this.baseDir = KNOWLEDGE_BASE_DIR;
        this.dbPath = path.join(this.baseDir, 'lancedb');
        this.db = null;
        this.table = null;
        this.keyChain = new KeyChain();
        
        // 初始化 Provider
        const providerType = CONFIG.EMBEDDING_PROVIDER || 'gemini';
        if (providerType === 'local') {
            this.provider = new TransformersProvider(CONFIG.LOCAL_EMBEDDING_MODEL);
        } else {
            this.provider = new GeminiProvider(this.keyChain);
        }
        
        // 根據模型決定 Table 名稱，避免維度衝突
        this.tableName = `memories_${this.provider.getIdentifier()}`;
    }

    async init() {
        if (!fs.existsSync(this.baseDir)) fs.mkdirSync(this.baseDir, { recursive: true });
        
        try {
            if (!this.db) {
                console.log(`🧠 [Memory:LanceDB] 正在初始化資料庫: ${this.dbPath}`);
                this.db = await lancedb.connect(this.dbPath);
            }
            
            const tableNames = await this.db.tableNames();
            if (!tableNames.includes(this.tableName)) {
                console.log(`✨ [Memory:LanceDB] 建立新資料表: ${this.tableName}`);
                // Table 將在第一次 memorize 時自動建立 schema
            } else {
                this.table = await this.db.openTable(this.tableName);
            }
            console.log(`✅ [Memory:LanceDB] 驅動就緒 (Provider: ${CONFIG.EMBEDDING_PROVIDER}, Table: ${this.tableName})`);
        } catch (e) {
            console.error("❌ [Memory:LanceDB] 初始化失敗:", e.message);
            throw e;
        }
    }

    async _getEmbedding(text) {
        return await this.provider.getEmbedding(text);
    }

    /**
     * 計算混合分數 (簡化版 RRF)
     */
    async recall(query, limit = 5) {
        if (!this.db || !this.table) await this.init();
        if (!this.table) return [];

        try {
            const queryVector = await this._getEmbedding(query);
            
            // 向量檢索
            const results = await this.table
                .vectorSearch(queryVector)
                .limit(limit * 2)
                .toArray();

            const now = Date.now();
            const scoredResults = results.map(row => {
                const ageHours = (now - row.last_accessed) / (1000 * 60 * 60);
                const decayFactor = Math.exp(-0.01 * ageHours); // 指數衰減
                const finalScore = row._distance !== undefined ? (1 - row._distance) * row.importance * decayFactor : 0;
                
                return {
                    text: row.text,
                    score: finalScore,
                    metadata: JSON.parse(row.metadata || '{}'),
                    timestamp: row.last_accessed
                };
            });

            return scoredResults
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);

        } catch (e) {
            console.warn("⚠️ [Memory:LanceDB] Recall error:", e.message);
            return [];
        }
    }

    async memorize(text, metadata = {}) {
        if (!this.db || !this.table) await this.init();
        
        try {
            const embedding = await this._getEmbedding(text);
            const importance = metadata.importance || 0.5;
            const timestamp = Date.now();

            const record = {
                vector: embedding,
                text: text,
                importance: importance,
                last_accessed: timestamp,
                metadata: JSON.stringify(metadata)
            };

            const tableNames = await this.db.tableNames();
            if (!tableNames.includes(this.tableName)) {
                this.table = await this.db.createTable(this.tableName, [record]);
            } else {
                await this.table.add([record]);
            }
            
            console.log(`🧠 [Memory:LanceDB] 已紀錄記憶 (${text.substring(0, 20)}...)`);
        } catch (e) {
            console.warn("⚠️ [Memory:LanceDB] Memorize error:", e.message);
        }
    }

    async addSchedule(task, time) {
        console.log(`📅 [Memory:LanceDB] 排程暫未實作`);
    }

    async checkDueTasks() {
        return [];
    }

    async clearMemory() {
        if (!this.db) return;
        try {
            const tableNames = await this.db.tableNames();
            if (tableNames.includes(this.tableName)) {
                await this.db.dropTable(this.tableName);
            }
            console.log(`🗑️ [Memory:LanceDB] 資料表已物理清空: ${this.tableName}`);
            this.table = null;
        } catch (e) {
            console.error("❌ [Memory:LanceDB] 清空失敗:", e.message);
        }
    }
}

module.exports = LanceDBMemoryDriver;
