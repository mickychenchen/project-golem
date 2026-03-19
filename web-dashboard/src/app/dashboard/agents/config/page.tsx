"use client";

import React, { useState, useEffect } from "react";
import { 
    Cpu, Users, Save, ShieldCheck, AlertTriangle, 
    RefreshCw, ChevronRight, UserPlus, Trash2, 
    MessageSquare, Settings2, Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Toast, ToastType } from "@/components/Toast";

type AgentDef = {
    id: string;
    name: string;
    role: string;
    personality: string;
    skills: string[];
    enabled: boolean;
};

const Card = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <div className={cn("rounded-xl border bg-card text-card-foreground shadow-sm", className)}>
        {children}
    </div>
);

export default function MultiAgentConfigPage() {
    const [agents, setAgents] = useState<AgentDef[]>([]);
    const [env, setEnv] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isRestarting, setIsRestarting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType; visible: boolean }>({
        message: "",
        type: "success",
        visible: false
    });

    const showToast = (message: string, type: ToastType = "success") => {
        setToast({ message, type, visible: true });
    };

    const handleRestart = async () => {
        if (!confirm("確定要重新啟動系統嗎？這將會暫時切斷目前的連線。")) return;
        
        setIsRestarting(true);
        showToast("正在發生重啟指令...", "warning");
        
        try {
            await fetch("/api/system/reload", { method: "POST" });
            
            // Poll for status
            let retries = 0;
            const maxRetries = 20;
            const checkStatus = setInterval(async () => {
                retries++;
                try {
                    const res = await fetch("/api/system/status");
                    if (res.ok) {
                        clearInterval(checkStatus);
                        showToast("✅ 系統已重啟完成！頁面即將重新載入...", "success");
                        setTimeout(() => window.location.reload(), 1500);
                    }
                } catch (e) { /* server down */ }
                
                if (retries >= maxRetries) {
                    clearInterval(checkStatus);
                    setIsRestarting(false);
                    showToast("❌ 重啟超時，請檢查控制台日誌。", "error");
                }
            }, 1000);
        } catch (e) {
            setIsRestarting(false);
            showToast("❌ 無法發送重啟指令", "error");
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [agentsRes, configRes] = await Promise.all([
                    fetch('/api/multi-agent/agents'),
                    fetch('/api/config')
                ]);
                
                if (!agentsRes.ok) throw new Error(`Agents API returned ${agentsRes.status}`);
                if (!configRes.ok) throw new Error(`Config API returned ${configRes.status}`);

                const agentsData = await agentsRes.json();
                const configData = await configRes.json();
                setAgents(agentsData);
                setEnv(configData.env);
            } catch (err: any) {
                console.error("Failed to fetch data", err);
                showToast(`無法載入資料: ${err.message}`, "error");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleSaveAll = async () => {
        setIsSaving(true);
        try {
            await Promise.all([
                fetch('/api/multi-agent/agents', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ agents })
                }),
                fetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        env: { 
                            ENABLE_MULTI_AGENT: env.ENABLE_MULTI_AGENT,
                            MAX_SUB_AGENTS: env.MAX_SUB_AGENTS
                        } 
                    })
                })
            ]);
            showToast("✅ 所有多代理設定已儲存！請重新啟動系統以生效。", "success");
        } catch (e) {
            showToast("❌ 儲存失敗，請檢查網路連線或後端日誌。", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const updateAgent = (id: string, updates: Partial<AgentDef>) => {
        setAgents(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    };

    const addAgent = () => {
        const newId = `agent_${Date.now()}`;
        setAgents([...agents, {
            id: newId,
            name: "新代理",
            role: "描述功能",
            personality: "描述個性",
            skills: [],
            enabled: true
        }]);
    };

    const removeAgent = (id: string) => {
        if (confirm("確定要刪除此代理定義嗎？")) {
            setAgents(agents.filter(a => a.id !== id));
        }
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center p-6 bg-background">
                <RefreshCw className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex-1 p-6 overflow-y-auto bg-background space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6 sticky top-0 bg-background/95 backdrop-blur z-20">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3 tracking-tight">
                        <Settings2 className="w-8 h-8 text-primary" />
                        多代理調度中心 (Multi-Agent)
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm max-w-2xl">
                        此功能允許主腦 (Golem Brain) 把任務拆解後同時交由多個 Gemini 分頁 (子代理) 處理，實現完美的技術隔離與高效併發。
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRestart}
                        disabled={isRestarting}
                        className="flex items-center gap-2 bg-secondary text-muted-foreground hover:text-foreground px-5 py-2.5 rounded-xl font-bold border border-border transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={cn("w-4 h-4", isRestarting && "animate-spin")} />
                        {isRestarting ? "Restarting..." : "Restart System"}
                    </button>
                    <button
                        onClick={handleSaveAll}
                        disabled={isSaving || isRestarting}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100"
                    >
                        {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        儲存所有變更
                    </button>
                </div>
            </div>

            {/* Global Settings */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="p-6 space-y-4 lg:col-span-2">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-500" />
                        核心路由開關
                    </h3>
                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-secondary/20 border border-border/50">
                            <div className="space-y-1">
                                <p className="font-bold">開啟多分頁模式 (Dynamic Tabs)</p>
                                <p className="text-xs text-muted-foreground">啟用後，當偵測到特殊標籤時將自動開啟子分頁。</p>
                            </div>
                            <div 
                                onClick={() => setEnv({ ...env, ENABLE_MULTI_AGENT: env.ENABLE_MULTI_AGENT === 'true' ? 'false' : 'true' })}
                                className={cn(
                                    "w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-300",
                                    env.ENABLE_MULTI_AGENT === 'true' ? "bg-primary" : "bg-muted"
                                )}
                            >
                                <div className={cn(
                                    "w-4 h-4 bg-white rounded-full transition-transform duration-300",
                                    env.ENABLE_MULTI_AGENT === 'true' ? "translate-x-6" : "translate-x-0"
                                )} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-sm">
                                <span className="font-medium">併發分頁限制 (Max Concurrency)</span>
                                <span className="text-primary font-mono font-bold bg-primary/10 px-2 py-0.5 rounded">{env.MAX_SUB_AGENTS || 3} Tabs</span>
                            </div>
                            <input 
                                type="range" 
                                min="1" 
                                max="10" 
                                value={env.MAX_SUB_AGENTS || "3"}
                                onChange={(e) => setEnv({ ...env, MAX_SUB_AGENTS: e.target.value })}
                                className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                            />
                            <p className="text-[10px] text-muted-foreground">建議設定為 3-5。數值過高會導致主機 RAM 消耗劇增。</p>
                        </div>
                    </div>
                </Card>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 flex flex-col justify-center gap-3">
                    <div className="flex items-center gap-2 text-amber-500">
                        <AlertTriangle className="w-5 h-5" />
                        <span className="font-bold text-sm">重要提示</span>
                    </div>
                    <p className="text-xs text-amber-200/80 leading-relaxed">
                        每個子代理分頁大約會消耗 800MB - 1.2GB 的 RAM。若開啟 5 個代理，加上主腦與 Dashboard，建議主機擁有至少 16GB RAM。
                    </p>
                </div>
            </div>

            {/* Agent List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-400" />
                        子代理註冊表 (Registry)
                    </h2>
                    <button 
                        onClick={addAgent}
                        className="flex items-center gap-2 text-xs bg-secondary hover:bg-primary/10 hover:text-primary transition-all px-4 py-2 rounded-xl border border-border"
                    >
                        <Plus className="w-4 h-4" />
                        新增代理定義
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {agents.map((agent) => (
                        <Card key={agent.id} className="overflow-hidden group border-border/60 hover:border-primary/40 transition-all duration-300">
                            <div className="grid grid-cols-1 lg:grid-cols-4">
                                {/* Left Side: Identity */}
                                <div className="p-6 bg-muted/20 border-r border-border/50 lg:col-span-1 space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className={cn("w-2 h-2 rounded-full", agent.enabled ? "bg-emerald-500 animate-pulse" : "bg-muted")} />
                                            <input 
                                                className="bg-transparent text-lg font-bold outline-none border-b border-transparent focus:border-primary w-full"
                                                value={agent.name}
                                                onChange={(e) => updateAgent(agent.id, { name: e.target.value })}
                                            />
                                        </div>
                                        <p className="text-[10px] font-mono text-muted-foreground uppercase">ID: {agent.id}</p>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer group/label">
                                            <input 
                                                type="checkbox" 
                                                checked={agent.enabled}
                                                onChange={(e) => updateAgent(agent.id, { enabled: e.target.checked })}
                                                className="w-4 h-4 rounded border-border bg-secondary text-primary"
                                            />
                                            <span className="text-xs text-muted-foreground group-hover/label:text-foreground transition-colors">啟用代理</span>
                                        </label>
                                        <button 
                                            onClick={() => removeAgent(agent.id)}
                                            className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" /> 刪除
                                        </button>
                                    </div>
                                </div>

                                {/* Right Side: Personality & Role */}
                                <div className="p-6 lg:col-span-3 space-y-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                                <ChevronRight className="w-3 h-3 text-primary" /> 角色定義 (Primary Role)
                                            </label>
                                            <input 
                                                className="w-full bg-secondary/30 border border-border/50 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary transition-all"
                                                value={agent.role}
                                                placeholder="例如：資深架構師"
                                                onChange={(e) => updateAgent(agent.id, { role: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                                <ChevronRight className="w-3 h-3 text-primary" /> 能力標籤 (Expertise)
                                            </label>
                                            <input 
                                                className="w-full bg-secondary/30 border border-border/50 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary transition-all"
                                                value={agent.skills.join(', ')}
                                                placeholder="例如：coding, debugging"
                                                onChange={(e) => updateAgent(agent.id, { skills: e.target.value.split(',').map(s => s.trim()) })}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                            <MessageSquare className="w-3 h-3 text-primary" /> 人格特質與溝通風格 (Personality)
                                        </label>
                                        <textarea 
                                            className="w-full bg-secondary/30 border border-border/50 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary transition-all h-24 resize-none leading-relaxed"
                                            value={agent.personality}
                                            placeholder="描述此代理的說話風格、思考邏輯..."
                                            onChange={(e) => updateAgent(agent.id, { personality: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>

            <Toast 
                isVisible={toast.visible}
                message={toast.message}
                type={toast.type}
                onClose={() => setToast({ ...toast, visible: false })}
            />
        </div>
    );
}
