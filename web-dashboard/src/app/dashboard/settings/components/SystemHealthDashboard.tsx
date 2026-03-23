"use client";

import { Activity, AlertTriangle, CheckCircle2, Cpu, HardDrive, Server, ShieldCheck, AlertCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SystemStatus } from "../types";

const StatusItem = ({ label, status, icon: Icon }: { label: string; status: boolean; icon: LucideIcon }) => (
    <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 border border-border/40">
        <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-foreground/80">{label}</span>
        </div>
        {status ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
        ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500" />
        )}
    </div>
);

export default function SystemHealthDashboard({ systemStatus }: { systemStatus: SystemStatus | null }) {
    if (!systemStatus) return null;

    const { runtime, health, system } = systemStatus;
    const healthChecks = health ? Object.values(health) : [];
    const healthyCount = healthChecks.filter(Boolean).length;
    const isReady = healthyCount === healthChecks.length && healthChecks.length > 0;
    const needsAction = healthyCount < healthChecks.length;

    return (
        <div className="space-y-6 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className={cn(
                "rounded-xl p-5 shadow-sm border transition-all duration-500 flex items-center justify-between",
                isReady ? "bg-emerald-500/5 border-emerald-500/20" :
                    needsAction ? "bg-amber-500/5 border-amber-500/20" : "bg-muted/5 border-border"
            )}>
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "p-3 rounded-full shadow-inner",
                        isReady ? "bg-emerald-500/10 text-emerald-500" :
                            needsAction ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"
                    )}>
                        {isReady ? <ShieldCheck className="w-6 h-6" /> :
                            needsAction ? <AlertCircle className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-foreground">
                            系統健康診斷 (System Integrity)
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {isReady ? "所有核心模組與配置運作正常，系統處於最佳狀態。" :
                                needsAction ? `檢測到 ${healthChecks.length - healthyCount} 項異常，請檢查下方健康檢查細項。` :
                                    "正在初始化系統狀態..."}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Health Score</div>
                        <div className={cn(
                            "text-xl font-black font-mono",
                            isReady ? "text-emerald-500" : needsAction ? "text-amber-500" : "text-muted-foreground"
                        )}>
                            {healthChecks.length > 0 ? Math.round((healthyCount / healthChecks.length) * 100) : 0}%
                        </div>
                    </div>
                    <span className={cn(
                        "px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase shadow-sm border",
                        isReady ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                            needsAction ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-muted text-muted-foreground border-border"
                    )}>
                        {isReady ? "Operational" : needsAction ? "Action Required" : "Unknown"}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card border border-border hover:border-primary/30 transition-colors rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <Cpu className="w-5 h-5 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">運作環境 (Runtime)</h3>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">OS</span>
                            <span className="text-primary font-medium truncate max-w-[150px]" title={runtime?.osName}>{runtime?.osName || "Unknown"}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Node.js</span>
                            <span className="text-foreground font-mono">{runtime?.node || "Unknown"}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">npm</span>
                            <span className="text-foreground font-mono">{runtime?.npm || "Unknown"}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Platform</span>
                            <span className="text-foreground capitalize">{runtime?.platform} ({runtime?.arch})</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Uptime</span>
                            <span className="text-foreground">{Math.floor((runtime?.uptime || 0) / 3600)}h {Math.floor(((runtime?.uptime || 0) % 3600) / 60)}m</span>
                        </div>
                        {systemStatus?.allowRemote && (
                            <div className="flex justify-between text-xs pt-1 border-t border-border/50 mt-1">
                                <span className="text-cyan-500 font-bold">Access URL</span>
                                <span className="text-cyan-500 font-mono font-bold">http://{systemStatus.localIp}:{systemStatus.dashboardPort}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-card border border-border hover:border-primary/30 transition-colors rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <Activity className="w-5 h-5 text-emerald-500" />
                        <h3 className="text-sm font-semibold text-foreground">健康檢查 (Health)</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <StatusItem label="Env Config" status={!!health?.env} icon={Activity} />
                        <StatusItem label="Dependencies" status={!!health?.deps} icon={Activity} />
                        <StatusItem label="Core Files" status={!!health?.core} icon={Activity} />
                        <StatusItem label="Dashboard" status={!!health?.dashboard} icon={Activity} />
                    </div>
                </div>

                <div className="bg-card border border-border hover:border-primary/30 transition-colors rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <Server className="w-5 h-5 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">系統資源 (Resources)</h3>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                                <span>記憶體 (Memory)</span>
                                <span>{system?.freeMem} / {system?.totalMem}</span>
                            </div>
                            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-indigo-500 transition-all duration-1000 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                                    style={{ width: `${100 - (parseInt(system?.freeMem || "0") / parseInt(system?.totalMem || "1")) * 100}%` }}
                                />
                            </div>
                        </div>
                        <div className="flex justify-between text-xs pt-1">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <HardDrive className="w-4 h-4" />
                                磁碟可用空間
                            </div>
                            <span className="text-primary font-bold">{system?.diskAvail || "N/A"}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
