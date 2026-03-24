"use client";

import { SettingField, SettingSelectField } from "../SettingFields";

type TgAdvancedTabProps = {
    env: Record<string, string>;
    onChangeEnv: (key: string, value: string) => void;
};

export default function TgAdvancedTab({ env, onChangeEnv }: TgAdvancedTabProps) {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
            <div className="bg-card border border-border hover:border-primary/30 transition-colors rounded-xl p-5 shadow-sm space-y-6">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    🚀 Telegram 進階與保護機制
                </h2>
                <SettingSelectField
                    label="Telegram 引擎模式 (TG_ENGINE)"
                    desc="設定底層通訊架構。推薦使用具備斷路器與防呆機制的 grammy，若遇到相容性狀況可降級回 legacy。"
                    value={env.TG_ENGINE || "grammy"}
                    onChange={(val) => onChangeEnv("TG_ENGINE", val)}
                    options={[
                        { value: "grammy", label: "grammY (推薦，新版架構)" },
                        { value: "legacy", label: "Legacy (舊版 node-telegram-bot-api)" }
                    ]}
                />

                <div className="pt-4 border-t border-border">
                    <h3 className="text-sm font-bold text-foreground mb-4">🛡️ Opossum 斷路器設定 (Circuit Breaker)</h3>
                    <p className="text-xs text-muted-foreground mb-4">保護輪詢機制，當網路異常時自動斷開避免連線風暴。</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SettingField
                            label="超時閾值 (ms)"
                            keyName="CB_TG_TIMEOUT_MS"
                            placeholder="10000"
                            desc="API 呼叫超過此時間視為失敗"
                            value={env.CB_TG_TIMEOUT_MS || ""}
                            onChange={(val) => onChangeEnv("CB_TG_TIMEOUT_MS", val)}
                        />
                        <SettingField
                            label="重置等待時間 (ms)"
                            keyName="CB_TG_RESET_MS"
                            placeholder="15000"
                            desc="斷開後等待多久嘗試恢復連線"
                            value={env.CB_TG_RESET_MS || ""}
                            onChange={(val) => onChangeEnv("CB_TG_RESET_MS", val)}
                        />
                    </div>
                    <div className="mt-4">
                        <SettingField
                            label="容忍錯誤率 (%)"
                            keyName="CB_TG_ERROR_PCT"
                            placeholder="30"
                            desc="錯誤率大於此數值時觸發斷路器"
                            value={env.CB_TG_ERROR_PCT || ""}
                            onChange={(val) => onChangeEnv("CB_TG_ERROR_PCT", val)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
