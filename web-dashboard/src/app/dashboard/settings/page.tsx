"use client";

import React, { useEffect, useState } from "react";
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Cpu,
    MessageSquare,
    RefreshCw,
    Save,
    Server,
    Settings,
    Settings2,
    ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ui/toast-provider";
import { apiGet, apiPost, apiPostWrite } from "@/lib/api-client";
import EngineTab from "./components/tabs/EngineTab";
import MessagingTab from "./components/tabs/MessagingTab";
import TgAdvancedTab from "./components/tabs/TgAdvancedTab";
import ScheduleTab from "./components/tabs/ScheduleTab";
import SecurityTab from "./components/tabs/SecurityTab";
import AdvancedTab from "./components/tabs/AdvancedTab";
import SystemHealthDashboard from "./components/SystemHealthDashboard";
import SystemUpdateSection from "./components/SystemUpdateSection";
import UrlsTab from "./tabs/UrlsTab";
import { ConfigData, LogInfo, SystemStatus } from "./types";

type StatusMessage = {
    type: "success" | "error" | "warning";
    text: string;
};

function getErrorMessage(error: unknown, fallback = "操作失敗，請稍後再試"): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

const TAB_ITEMS = [
    { id: "overview", name: "系統概況", icon: Activity },
    { id: "engine", name: "核心引擎", icon: Cpu },
    { id: "messaging", name: "通訊平台", icon: MessageSquare },
    { id: "tg_advanced", name: "Telegram 進階", icon: Settings2 },
    { id: "urls", name: "網址管理", icon: Server },
    { id: "schedule", name: "自動化作息", icon: Clock },
    { id: "security", name: "安全與指令", icon: ShieldCheck },
    { id: "advanced", name: "進階維護", icon: Settings2 }
] as const;

export default function SettingsPage() {
    const toast = useToast();
    const [config, setConfig] = useState<ConfigData>({ env: {}, golems: [] });
    const [originalConfig, setOriginalConfig] = useState<ConfigData>({ env: {}, golems: [] });
    const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
    const [logInfo, setLogInfo] = useState<LogInfo | null>(null);
    const [isRestartConfirmOpen, setIsRestartConfirmOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("overview");

    useEffect(() => {
        fetchConfig();
        fetchStatus();
        fetchLogInfo();
    }, []);

    const fetchConfig = async () => {
        setIsLoading(true);
        setStatusMessage(null);
        try {
            const data = await apiGet<ConfigData>("/api/config");
            setConfig(data);
            setOriginalConfig(data);
        } catch (error: unknown) {
            setStatusMessage({ type: "error", text: getErrorMessage(error, "讀取設定失敗") });
        } finally {
            setIsLoading(false);
        }
    };

    const fetchStatus = async () => {
        try {
            const data = await apiGet<SystemStatus>("/api/system/status");
            setSystemStatus(data);
        } catch (error) {
            console.error("Failed to fetch system status:", error);
        }
    };

    const fetchLogInfo = async () => {
        try {
            const data = await apiGet<{ success?: boolean; size?: string; bytes?: number }>("/api/system/log-info");
            if (data.success === true && data.size && typeof data.bytes === "number") {
                setLogInfo({ size: data.size, bytes: data.bytes });
            }
        } catch (error) {
            console.error("Failed to fetch log info:", error);
        }
    };

    const handleChangeEnv = (key: string, value: string) => {
        setConfig((prev) => ({
            ...prev,
            env: { ...prev.env, [key]: value }
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setStatusMessage(null);

        const changedEnv: Record<string, string> = {};
        let hasEnvChanges = false;

        Object.keys(config.env).forEach((key) => {
            if (config.env[key] !== originalConfig.env[key]) {
                changedEnv[key] = config.env[key];
                hasEnvChanges = true;
            }
        });

        if (hasEnvChanges === false) {
            setStatusMessage({ type: "warning", text: "沒有任何變更需要儲存" });
            setIsSaving(false);
            return;
        }

        try {
            const data = await apiPostWrite<{ success?: boolean; message?: string; error?: string }>("/api/config", {
                env: changedEnv
            });

            if (data.success === true) {
                setOriginalConfig(config);
                setStatusMessage({ type: "warning", text: "部分設定已儲存，但需要重啟總開關（Restart System）才能完全生效。" });
            } else {
                throw new Error(data.message || data.error || "儲存失敗");
            }
        } catch (error: unknown) {
            setStatusMessage({ type: "error", text: getErrorMessage(error, "儲存失敗") });
        } finally {
            setIsSaving(false);
        }
    };

    const handleRestartSystem = () => {
        setIsRestartConfirmOpen(true);
    };

    const executeRestart = async () => {
        setIsRestartConfirmOpen(false);

        try {
            await apiPost("/api/system/reload");
            setStatusMessage({ type: "warning", text: "重新啟動指令已發送... 等待系統恢復中！" });

            let retries = 0;
            const maxRetries = 30;

            const pollInterval = setInterval(async () => {
                retries += 1;

                try {
                    const data = await apiGet<{ isBooting?: boolean }>("/api/system/status");
                    if (data.isBooting === false) {
                        clearInterval(pollInterval);
                        setStatusMessage({ type: "success", text: "重新啟動完成！頁面即將重新載入..." });
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                    } else {
                        setStatusMessage({ type: "warning", text: "系統正在初始化中..." });
                    }
                } catch {
                    // Ignore errors while backend is still rebooting.
                }

                if (retries >= maxRetries) {
                    clearInterval(pollInterval);
                    setStatusMessage({ type: "error", text: "重啟超時。請手動檢查終端機日誌。" });
                }
            }, 1000);
        } catch (error: unknown) {
            toast.error("重啟失敗", getErrorMessage(error, "重啟請求發送失敗。"));
        }
    };

    if (isLoading) {
        return (
            <div className="flex-1 p-6 flex items-center justify-center">
                <div className="flex flex-col items-center space-y-4">
                    <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-muted-foreground font-mono text-sm">讀取總開關系統中...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4 sticky top-0 bg-background/95 backdrop-blur z-20">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Settings className="w-6 h-6 text-primary" />
                            系統配置總表 (System Settings)
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            管理 Golem 的全域配置與 API 金鑰。所有變更均需重啟系統才能完全生效。
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleRestartSystem}
                            className="px-4 py-2 bg-secondary hover:bg-destructive/10 text-muted-foreground hover:text-destructive border border-border hover:border-destructive/30 rounded-lg text-sm transition-all flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Restart System
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                                isSaving
                                    ? "bg-muted text-muted-foreground cursor-not-allowed border border-border"
                                    : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 hover:border-primary"
                            )}
                        >
                            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {isSaving ? "Saving..." : "Save Settings"}
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border border-border/50 overflow-x-auto no-scrollbar">
                    {TAB_ITEMS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                                activeTab === tab.id
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                            )}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.name}
                        </button>
                    ))}
                </div>

                {statusMessage && (
                    <div
                        className={cn(
                            "p-4 rounded-lg flex items-start gap-3 border",
                            statusMessage.type === "success" && "bg-green-950/30 border-green-900/50 text-green-400",
                            statusMessage.type === "warning" && "bg-orange-950/30 border-orange-900/50 text-orange-400",
                            statusMessage.type === "error" && "bg-red-950/30 border-red-900/50 text-red-400"
                        )}
                    >
                        {statusMessage.type === "success" && <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                        {(statusMessage.type === "warning" || statusMessage.type === "error") && (
                            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        )}
                        <p className="text-sm">{statusMessage.text}</p>
                    </div>
                )}

                {activeTab === "overview" && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                        <SystemHealthDashboard systemStatus={systemStatus} />
                        <SystemUpdateSection />
                    </div>
                )}

                {activeTab === "engine" && (
                    <EngineTab env={config.env} onChangeEnv={handleChangeEnv} />
                )}

                {activeTab === "messaging" && (
                    <MessagingTab env={config.env} onChangeEnv={handleChangeEnv} />
                )}

                {activeTab === "tg_advanced" && (
                    <TgAdvancedTab env={config.env} onChangeEnv={handleChangeEnv} />
                )}

                {activeTab === "urls" && (
                    <UrlsTab
                        geminiUrls={config.env.GEMINI_URLS || ""}
                        onChange={(value) => handleChangeEnv("GEMINI_URLS", value)}
                    />
                )}

                {activeTab === "schedule" && (
                    <ScheduleTab env={config.env} onChangeEnv={handleChangeEnv} />
                )}

                {activeTab === "security" && (
                    <SecurityTab env={config.env} onChangeEnv={handleChangeEnv} />
                )}

                {activeTab === "advanced" && (
                    <AdvancedTab env={config.env} logInfo={logInfo} onChangeEnv={handleChangeEnv} />
                )}

                <ConfirmModal
                    isOpen={isRestartConfirmOpen}
                    onClose={() => setIsRestartConfirmOpen(false)}
                    onConfirm={executeRestart}
                    variant="warning"
                    title="確定要重啟 Golem 嗎？"
                    description="重啟將會中斷目前的對話並重置系統狀態。"
                    confirmText="立即重啟"
                    cancelText="先不要"
                />
            </div>
        </div>
    );
}
