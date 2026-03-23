"use client";

import { Sparkles } from "lucide-react";
import { LOCAL_MODELS, SettingField, SettingSelectField } from "../SettingFields";

type EngineTabProps = {
    env: Record<string, string>;
    onChangeEnv: (key: string, value: string) => void;
};

const getEmbeddingProvider = (provider?: string) => {
    if (provider === "local" || provider === "ollama") {
        return provider;
    }
    return "local";
};

export default function EngineTab({ env, onChangeEnv }: EngineTabProps) {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                            🤖 AI 引擎選取 (AI Backend)
                        </h2>
                        <div className="flex flex-col mb-4">
                            <label className="text-sm font-medium text-muted-foreground mb-1 flex items-center justify-between gap-1 overflow-hidden">
                                <span className="truncate mr-1" title="核心引擎 (Primary Engine)">核心引擎 (Primary Engine)</span>
                            </label>
                            <select
                                value={env.GOLEM_BACKEND || "gemini"}
                                onChange={(e) => onChangeEnv("GOLEM_BACKEND", e.target.value)}
                                className="w-full bg-secondary/30 border border-border focus:border-primary rounded-lg px-3 py-2 text-sm text-foreground transition-colors"
                            >
                                <option value="gemini">Web Gemini (自動化瀏覽器)</option>
                                <option value="ollama">Ollama API (本地/私有部署)</option>
                            </select>
                        </div>

                        {env.GOLEM_BACKEND === "ollama" && (
                            <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 space-y-4 animate-in zoom-in-95">
                                <SettingField
                                    label="Ollama Base URL"
                                    keyName="GOLEM_OLLAMA_BASE_URL"
                                    placeholder="http://127.0.0.1:11434"
                                    desc="Ollama 服務位址（本機預設 11434）。"
                                    value={env.GOLEM_OLLAMA_BASE_URL || ""}
                                    onChange={(val) => onChangeEnv("GOLEM_OLLAMA_BASE_URL", val)}
                                />
                                <SettingField
                                    label="Ollama Brain Model"
                                    keyName="GOLEM_OLLAMA_BRAIN_MODEL"
                                    placeholder="llama3.1:8b"
                                    desc="作為大腦回應的主要模型。"
                                    value={env.GOLEM_OLLAMA_BRAIN_MODEL || ""}
                                    onChange={(val) => onChangeEnv("GOLEM_OLLAMA_BRAIN_MODEL", val)}
                                />
                                <SettingField
                                    label="Ollama Timeout (ms)"
                                    keyName="GOLEM_OLLAMA_TIMEOUT_MS"
                                    placeholder="60000"
                                    desc="Ollama HTTP 請求逾時（毫秒）。"
                                    value={env.GOLEM_OLLAMA_TIMEOUT_MS || ""}
                                    onChange={(val) => onChangeEnv("GOLEM_OLLAMA_TIMEOUT_MS", val)}
                                />
                            </div>
                        )}
                    </div>

                    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                            📝 回應風格與限制
                        </h2>
                        <SettingField
                            label="回應字數上限 (Max Response Words)"
                            keyName="GOLEM_MAX_RESPONSE_WORDS"
                            placeholder="0"
                            desc="設為 0 則不限制。若設定，將要求 Golem 縮短回覆長度。"
                            value={env.GOLEM_MAX_RESPONSE_WORDS || ""}
                            onChange={(val) => onChangeEnv("GOLEM_MAX_RESPONSE_WORDS", val)}
                        />
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                            ⚙️ 記憶與嵌入引擎設定
                        </h2>
                        <div className="space-y-6">
                            <SettingSelectField
                                label="記憶引擎模式 (Memory Mode)"
                                desc="系統已鎖定為 LanceDB 高效向量資料庫，以確保最佳效能與穩定性。"
                                value={env.GOLEM_MEMORY_MODE || "lancedb-pro"}
                                onChange={(val) => onChangeEnv("GOLEM_MEMORY_MODE", val)}
                                options={[
                                    { value: "lancedb-pro", label: "LanceDB (高效能 Pro 版)" }
                                ]}
                            />

                            <div className="pt-4 border-t border-border/50">
                                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-primary" /> 嵌入模型配置 (Embedding Config)
                                </h3>

                                <SettingSelectField
                                    label="提供者 (Provider)"
                                    desc="選擇生成向量的引擎。Local 具備隱私性。"
                                    value={getEmbeddingProvider(env.GOLEM_EMBEDDING_PROVIDER)}
                                    onChange={(val) => onChangeEnv("GOLEM_EMBEDDING_PROVIDER", val)}
                                    options={[
                                        { value: "local", label: "Local (Transformers.js)" },
                                        { value: "ollama", label: "Ollama Embedding" }
                                    ]}
                                />

                                {env.GOLEM_EMBEDDING_PROVIDER === "local" && (
                                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 space-y-4 animate-in zoom-in-95">
                                        <SettingSelectField
                                            label="本地模型選擇 (Model Selection)"
                                            desc="選擇預設推薦模型。"
                                            value={env.GOLEM_LOCAL_EMBEDDING_MODEL}
                                            onChange={(val) => onChangeEnv("GOLEM_LOCAL_EMBEDDING_MODEL", val)}
                                            options={LOCAL_MODELS.map((model) => ({ value: model.id, label: model.name }))}
                                        />

                                        {(() => {
                                            const activeModelInfo = LOCAL_MODELS.find((model) => model.id === env.GOLEM_LOCAL_EMBEDDING_MODEL);
                                            if (!activeModelInfo) return null;
                                            return (
                                                <div className="bg-background/50 border border-border/40 rounded-lg p-3 space-y-2">
                                                    <div className="text-[11px] text-foreground/80 leading-relaxed">
                                                        <span className="font-bold text-primary">特色：</span> {activeModelInfo.features}
                                                    </div>
                                                    <div className="text-[11px] text-foreground/80 leading-relaxed">
                                                        <span className="font-bold text-primary">推薦：</span> {activeModelInfo.recommendation}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {env.GOLEM_EMBEDDING_PROVIDER === "ollama" && (
                                    <div className="bg-cyan-500/5 p-4 rounded-xl border border-cyan-500/20 space-y-4 animate-in zoom-in-95">
                                        <SettingField
                                            label="Ollama Base URL"
                                            keyName="GOLEM_OLLAMA_BASE_URL"
                                            placeholder="http://127.0.0.1:11434"
                                            desc="嵌入模型共用同一個 Ollama 端點。"
                                            value={env.GOLEM_OLLAMA_BASE_URL || ""}
                                            onChange={(val) => onChangeEnv("GOLEM_OLLAMA_BASE_URL", val)}
                                        />
                                        <SettingField
                                            label="Ollama Embedding Model"
                                            keyName="GOLEM_OLLAMA_EMBEDDING_MODEL"
                                            placeholder="nomic-embed-text"
                                            desc="用於向量化文本的模型名稱。"
                                            value={env.GOLEM_OLLAMA_EMBEDDING_MODEL || ""}
                                            onChange={(val) => onChangeEnv("GOLEM_OLLAMA_EMBEDDING_MODEL", val)}
                                        />
                                        <SettingField
                                            label="Ollama Rerank Model (Optional)"
                                            keyName="GOLEM_OLLAMA_RERANK_MODEL"
                                            placeholder="bge-reranker-v2-m3"
                                            desc="選填。填寫後會在 recall 結果做二次排序。"
                                            value={env.GOLEM_OLLAMA_RERANK_MODEL || ""}
                                            onChange={(val) => onChangeEnv("GOLEM_OLLAMA_RERANK_MODEL", val)}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
