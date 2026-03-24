"use client";

import { RefreshCw } from "lucide-react";
import { SettingField } from "../SettingFields";
import { LogInfo } from "../../types";

type AdvancedTabProps = {
    env: Record<string, string>;
    logInfo: LogInfo | null;
    onChangeEnv: (key: string, value: string) => void;
};

const EDITABLE_KEYS = new Set([
    "GEMINI_API_KEYS", "TELEGRAM_TOKEN", "TG_AUTH_MODE", "ADMIN_ID", "TG_CHAT_ID",
    "DISCORD_TOKEN", "DISCORD_ADMIN_ID", "USER_DATA_DIR", "GOLEM_TEST_MODE",
    "GOLEM_MODE", "GOLEM_MEMORY_MODE", "GOLEM_EMBEDDING_PROVIDER", "GOLEM_LOCAL_EMBEDDING_MODEL", "GITHUB_REPO",
    "GOLEM_OLLAMA_BASE_URL", "GOLEM_OLLAMA_BRAIN_MODEL", "GOLEM_OLLAMA_EMBEDDING_MODEL", "GOLEM_OLLAMA_RERANK_MODEL", "GOLEM_OLLAMA_TIMEOUT_MS",
    "MOLTBOOK_API_KEY", "MOLTBOOK_AGENT_NAME",
    "GOLEM_AWAKE_INTERVAL_MIN", "GOLEM_AWAKE_INTERVAL_MAX",
    "GOLEM_SLEEP_START", "GOLEM_SLEEP_END", "USER_INTERESTS", "COMMAND_WHITELIST", "CUSTOM_COMMANDS",
    "ENABLE_LOG_NOTIFICATIONS", "ARCHIVE_CHECK_INTERVAL", "ARCHIVE_THRESHOLD_YESTERDAY", "ARCHIVE_THRESHOLD_TODAY",
    "LOG_MAX_SIZE_MB", "LOG_RETENTION_DAYS", "ENABLE_SYSTEM_LOG", "GOLEM_BACKEND", "GOLEM_STRICT_SAFEGUARD",
    "GOLEM_INTERVENTION_LEVEL", "GOLEM_MAX_AUTO_TURNS", "GOLEM_MAX_RESPONSE_WORDS",
    "TG_ENGINE", "CB_TG_TIMEOUT_MS", "CB_TG_RESET_MS", "CB_TG_ERROR_PCT"
]);

export default function AdvancedTab({ env, logInfo, onChangeEnv }: AdvancedTabProps) {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-6">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        ⚙️ 系統進階與維護
                    </h2>

                    <div className="space-y-4">
                        <SettingField
                            label="測試模式"
                            keyName="GOLEM_TEST_MODE"
                            desc="設為 true 將在部分功能使用模擬數據"
                            placeholder="false"
                            value={env.GOLEM_TEST_MODE || ""}
                            onChange={(val) => onChangeEnv("GOLEM_TEST_MODE", val)}
                        />
                        <SettingField
                            label="系統維護推播通知"
                            keyName="ENABLE_LOG_NOTIFICATIONS"
                            desc="是否在 Telegram/Discord 接收通知"
                            placeholder="false"
                            value={env.ENABLE_LOG_NOTIFICATIONS || ""}
                            onChange={(val) => onChangeEnv("ENABLE_LOG_NOTIFICATIONS", val)}
                        />
                        <SettingField
                            label="日誌檢查間隔 (分)"
                            keyName="ARCHIVE_CHECK_INTERVAL"
                            placeholder="30"
                            value={env.ARCHIVE_CHECK_INTERVAL || ""}
                            onChange={(val) => onChangeEnv("ARCHIVE_CHECK_INTERVAL", val)}
                        />
                        <SettingField
                            label="資料暫存路徑"
                            keyName="USER_DATA_DIR"
                            placeholder="./.golem_data"
                            value={env.USER_DATA_DIR || ""}
                            onChange={(val) => onChangeEnv("USER_DATA_DIR", val)}
                        />
                        <SettingField
                            label="OTA 升級節點"
                            keyName="GITHUB_REPO"
                            placeholder="Arvincreator/project-golem"
                            value={env.GITHUB_REPO || ""}
                            onChange={(val) => onChangeEnv("GITHUB_REPO", val)}
                        />

                        <div className="flex flex-col mb-4">
                            <label className="text-sm font-medium text-muted-foreground mb-1 flex items-center justify-between gap-1 overflow-hidden">
                                <span className="truncate mr-1" title="允許遠端存取 (Remote Access)">允許遠端存取 (Remote Access)</span>
                            </label>
                            <div
                                onClick={() => {
                                    const newValue = env.ALLOW_REMOTE_ACCESS === "true" ? "false" : "true";
                                    onChangeEnv("ALLOW_REMOTE_ACCESS", newValue);
                                }}
                                className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out ${env.ALLOW_REMOTE_ACCESS === "true" ? "bg-emerald-600" : "bg-gray-700"}`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ease-in-out ${env.ALLOW_REMOTE_ACCESS === "true" ? "translate-x-6" : "translate-x-0"}`} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">開啟後可允許區域網路或其他 IP 連線。若關閉則僅限 localhost。</p>
                        </div>

                        {env.ALLOW_REMOTE_ACCESS === "true" && (
                            <div className="mt-2 animate-in fade-in zoom-in-95">
                                <SettingField
                                    label="自定義遠端存取密碼 (選填)"
                                    keyName="REMOTE_ACCESS_PASSWORD"
                                    isSecret
                                    placeholder="若留空，則遠端存取不需要密碼"
                                    desc="設定密碼後，非本機連線皆須輸入此密碼才可登入控制台。"
                                    value={env.REMOTE_ACCESS_PASSWORD || ""}
                                    onChange={(val) => onChangeEnv("REMOTE_ACCESS_PASSWORD", val)}
                                />
                            </div>
                        )}
                    </div>

                    <div className="pt-4 border-t border-border">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-medium text-foreground flex items-center gap-2">
                                啟用系統日誌 (System Log)
                                {logInfo && (
                                    <span className={`px-2 py-0.5 rounded text-xs font-mono ml-2 ${logInfo.bytes > 10 * 1024 * 1024 ? "bg-red-900/50 text-red-400" : "bg-green-900/30 text-green-400"}`}>
                                        大小: {logInfo.size}
                                    </span>
                                )}
                            </span>
                        </div>
                        <SettingField
                            label=""
                            keyName="ENABLE_SYSTEM_LOG"
                            desc="設為 false 將完全不記錄 system.log"
                            placeholder="false"
                            value={env.ENABLE_SYSTEM_LOG || ""}
                            onChange={(val) => onChangeEnv("ENABLE_SYSTEM_LOG", val)}
                        />
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-secondary/30 p-5 rounded-xl border border-border">
                        <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 text-primary" /> 日誌輪替策略
                        </h4>
                        <div className="space-y-4">
                            <SettingField
                                label="單檔儲存上限 (MB)"
                                keyName="LOG_MAX_SIZE_MB"
                                desc="設 0 則不限制單個日誌檔大小"
                                placeholder="10"
                                value={env.LOG_MAX_SIZE_MB || ""}
                                onChange={(val) => onChangeEnv("LOG_MAX_SIZE_MB", val)}
                            />
                            <SettingField
                                label="保留歷史檔案天數"
                                keyName="LOG_RETENTION_DAYS"
                                desc="過舊的壓縮日誌將會自動刪除"
                                placeholder="7"
                                value={env.LOG_RETENTION_DAYS || ""}
                                onChange={(val) => onChangeEnv("LOG_RETENTION_DAYS", val)}
                            />
                            <SettingField
                                label="昨日歸檔門檻 (份)"
                                keyName="ARCHIVE_THRESHOLD_YESTERDAY"
                                desc="昨日日誌超過此數量即觸發歸檔"
                                placeholder="5"
                                value={env.ARCHIVE_THRESHOLD_YESTERDAY || ""}
                                onChange={(val) => onChangeEnv("ARCHIVE_THRESHOLD_YESTERDAY", val)}
                            />
                            <SettingField
                                label="本日歸檔門檻 (份)"
                                keyName="ARCHIVE_THRESHOLD_TODAY"
                                desc="今日日誌超過此數量即觸發歸檔"
                                placeholder="20"
                                value={env.ARCHIVE_THRESHOLD_TODAY || ""}
                                onChange={(val) => onChangeEnv("ARCHIVE_THRESHOLD_TODAY", val)}
                            />
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                        <h2 className="text-sm font-bold text-muted-foreground mb-4">🔧 其他唯讀參數</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                            {Object.keys(env)
                                .filter((key) => !EDITABLE_KEYS.has(key))
                                .map((key) => (
                                    <div key={key} className="bg-secondary/20 p-2 rounded border border-border/40">
                                        <label className="text-[10px] text-muted-foreground block mb-1 uppercase font-bold tracking-wider">{key}</label>
                                        <div className="text-xs font-mono truncate text-foreground/80">{env[key] || "N/A"}</div>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
