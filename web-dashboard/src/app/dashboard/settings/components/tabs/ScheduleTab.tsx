"use client";

import { SettingField } from "../SettingFields";

type ScheduleTabProps = {
    env: Record<string, string>;
    onChangeEnv: (key: string, value: string) => void;
};

export default function ScheduleTab({ env, onChangeEnv }: ScheduleTabProps) {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
            <div className="bg-card border border-border hover:border-primary/30 transition-colors rounded-xl p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    ⏳ 自動化與作息設定
                </h2>
                <div className="grid grid-cols-2 gap-4">
                    <SettingField
                        label="喚醒間隔 (最小)"
                        keyName="GOLEM_AWAKE_INTERVAL_MIN"
                        placeholder="10"
                        desc="分鐘 (最小 1)"
                        value={env.GOLEM_AWAKE_INTERVAL_MIN || ""}
                        onChange={(val) => onChangeEnv("GOLEM_AWAKE_INTERVAL_MIN", val)}
                    />
                    <SettingField
                        label="喚醒間隔 (最大)"
                        keyName="GOLEM_AWAKE_INTERVAL_MAX"
                        placeholder="10080"
                        desc="分鐘 (最大 10080 / 一週)"
                        value={env.GOLEM_AWAKE_INTERVAL_MAX || ""}
                        onChange={(val) => onChangeEnv("GOLEM_AWAKE_INTERVAL_MAX", val)}
                    />
                    <SettingField
                        label="夜間休眠開始"
                        keyName="GOLEM_SLEEP_START"
                        placeholder="23:00"
                        desc="格式: HH:mm (24小時制)"
                        value={env.GOLEM_SLEEP_START || ""}
                        onChange={(val) => onChangeEnv("GOLEM_SLEEP_START", val)}
                    />
                    <SettingField
                        label="夜間休眠結束"
                        keyName="GOLEM_SLEEP_END"
                        placeholder="07:00"
                        desc="格式: HH:mm (24小時制)"
                        value={env.GOLEM_SLEEP_END || ""}
                        onChange={(val) => onChangeEnv("GOLEM_SLEEP_END", val)}
                    />
                </div>
                <div className="mt-4">
                    <SettingField
                        label="興趣標籤 (User Interests)"
                        keyName="USER_INTERESTS"
                        placeholder="科技圈熱門話題,全球趣聞"
                        desc="用於自主搜尋與聊天，請使用半形逗號「,」分隔多個興趣項目。"
                        value={env.USER_INTERESTS || ""}
                        onChange={(val) => onChangeEnv("USER_INTERESTS", val)}
                    />
                </div>
            </div>
        </div>
    );
}
