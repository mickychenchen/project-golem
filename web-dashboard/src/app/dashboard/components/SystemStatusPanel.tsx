"use client";

import { PowerOff, RefreshCcw } from "lucide-react";

type SystemStatusPanelProps = {
    isSingleNode: boolean;
    allowRemote: boolean;
    localIp?: string;
    dashboardPort?: string | number;
    isConnected: boolean;
    isLoading: boolean;
    onRestart: () => void;
    onShutdown: () => void;
};

export default function SystemStatusPanel({
    isSingleNode,
    allowRemote,
    localIp,
    dashboardPort,
    isConnected,
    isLoading,
    onRestart,
    onShutdown,
}: SystemStatusPanelProps) {
    return (
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col justify-between">
            <div>
                <h2 className="text-lg font-semibold mb-4">System Status</h2>
                <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm border-b border-border pb-2">
                        <span className="text-muted-foreground">Environment</span>
                        <span className="text-foreground">Production</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-border pb-2">
                        <span className="text-muted-foreground">Mode</span>
                        <span className="text-primary font-medium">
                            {isSingleNode ? "Single Node" : "Multi Node"}
                        </span>
                    </div>
                    {allowRemote && (
                        <div className="flex justify-between items-center text-sm border-b border-border pb-2">
                            <span className="text-muted-foreground">Access URL</span>
                            <span className="text-cyan-500 font-bold">
                                http://{localIp}:{dashboardPort}
                            </span>
                        </div>
                    )}
                    <div className="flex justify-between items-center text-sm border-b border-border pb-2">
                        <span className="text-muted-foreground">Backend</span>
                        <span className={isConnected ? "text-green-600 dark:text-green-400" : "text-destructive animate-pulse"}>
                            {isConnected ? "Connected" : "Disconnected"}
                        </span>
                    </div>
                </div>
            </div>

            <div className="mt-6 pt-6 border-t border-border space-y-2">
                <button
                    onClick={onRestart}
                    disabled={isLoading}
                    className="w-full group flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border bg-secondary/50 hover:bg-secondary transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                        <RefreshCcw className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="text-left">
                        <p className="text-xs font-medium text-foreground">重新啟動</p>
                        <p className="text-[10px] text-muted-foreground">Hot-reload · 自動重連</p>
                    </div>
                </button>

                <button
                    onClick={onShutdown}
                    disabled={isLoading}
                    className="w-full group flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border bg-secondary/50 hover:bg-destructive/5 hover:border-destructive/20 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <div className="w-7 h-7 rounded-md bg-destructive/10 border border-destructive/20 flex items-center justify-center flex-shrink-0 group-hover:bg-destructive/20 transition-colors">
                        <PowerOff className="w-3.5 h-3.5 text-destructive" />
                    </div>
                    <div className="text-left">
                        <p className="text-xs font-medium text-destructive">關閉 Golem</p>
                        <p className="text-[10px] text-muted-foreground">完全停止 · 需手動重啟</p>
                    </div>
                </button>
            </div>
        </div>
    );
}
