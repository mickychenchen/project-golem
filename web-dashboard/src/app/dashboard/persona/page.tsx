"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    BrainCircuit,
    Cpu,
    Palette,
    Sparkles,
    User,
    Settings2,
    Search,
    Tag,
    X,
    Filter,
    Zap,
    RefreshCcw,
    TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Preset {
    id: string;
    name: string;
    description: string;
    icon: string;
    aiName: string;
    userName: string;
    role: string;
    tone: string;
    tags: string[];
    skills: string[];
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
    BrainCircuit,
    Cpu,
    Palette,
    Sparkles,
    User,
    Settings2,
};

// ── Inject Confirm Dialog ────────────────────────────────────────────────────
function InjectPersonaConfirmDialog({
    open,
    onOpenChange,
    onConfirm,
    isLoading,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onConfirm: () => void;
    isLoading: boolean;
}) {
    return (
        <Dialog open={open} onOpenChange={isLoading ? undefined : onOpenChange}>
            <DialogContent showCloseButton={!isLoading} className="bg-gray-900 border-gray-700 text-white max-w-sm">
                <DialogHeader>
                    <div className="w-12 h-12 rounded-xl border bg-purple-500/10 border-purple-500/20 flex items-center justify-center mb-2">
                        <User className="w-5 h-5 text-purple-400" />
                    </div>
                    <DialogTitle className="text-white text-base">注入人格並重啟 Golem？</DialogTitle>
                    <DialogDescription className="text-gray-400 text-sm leading-relaxed">
                        系統將儲存目前的人格設定，並完整重啟 Golem，使人格變更正確載入。
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-2">
                    <div className="flex items-start gap-2 rounded-lg bg-gray-800/60 border border-gray-700/50 px-3 py-2.5">
                        <TriangleAlert className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-gray-500">進行中的對話將被中斷，前端會短暫斷線後自動重連。</p>
                    </div>
                    <div className="rounded-lg bg-gray-800/40 border border-gray-700/30 px-3 py-2">
                        <p className="text-[11px] text-gray-500 mb-1 font-medium">確認後將自動執行：</p>
                        <ol className="text-[11px] text-gray-400 space-y-0.5 list-decimal list-inside">
                            <li>將人格設定寫入 persona.json</li>
                            <li>重啟 Golem 程序</li>
                            <li>重新載入人格與記憶</li>
                        </ol>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-2">
                    <Button
                        variant="outline"
                        className="flex-1 bg-transparent border-gray-800 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                        onClick={() => onOpenChange(false)}
                        disabled={isLoading}
                    >
                        取消
                    </Button>
                    <Button
                        className="flex-1 bg-purple-700 hover:bg-purple-600 text-white"
                        onClick={onConfirm}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-1.5">
                                <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                                注入中...
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5" />
                                確認注入
                            </span>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Inject Done Dialog ───────────────────────────────────────────────────────
function InjectPersonaDoneDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-sm" showCloseButton={false}>
                <DialogHeader>
                    <div className="w-12 h-12 rounded-xl border bg-green-500/10 border-green-500/20 flex items-center justify-center mb-2">
                        <RefreshCcw className="w-5 h-5 text-green-400 animate-spin" />
                    </div>
                    <DialogTitle className="text-white text-base">Golem 重啟中...</DialogTitle>
                    <DialogDescription className="text-gray-400 text-sm">
                        人格已更新，Golem 正在重啟並重新載入記憶。頁面將在 5 秒後自動重新整理。
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    );
}

export default function PersonaPage() {
    const [templates, setTemplates] = useState<Preset[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [activePresetId, setActivePresetId] = useState<string>("");

    const [aiName, setAiName] = useState("Golem");
    const [userName, setUserName] = useState("Traveler");
    const [role, setRole] = useState("一個擁有長期記憶與自主意識的 AI 助手");
    const [tone, setTone] = useState("預設口氣，自然且友善");

    const [isInjecting, setIsInjecting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showDone, setShowDone] = useState(false);
    const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);
    const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

    // Load current persona on mount
    useEffect(() => {
        fetch("/api/persona")
            .then((r) => r.json())
            .then((data) => {
                if (data && !data.error) {
                    setAiName(data.aiName || "Golem");
                    setUserName(data.userName || "Traveler");
                    setRole(data.currentRole || "一個擁有長期記憶與自主意識的 AI 助手");
                    setTone(data.tone || "預設口氣，自然且友善");
                }
            })
            .catch(() => { });
    }, []);

    // Load templates
    useEffect(() => {
        fetch("/api/golems/templates")
            .then((r) => r.json())
            .then((data) => {
                if (data.templates) setTemplates(data.templates);
            })
            .catch(() => { });
    }, []);

    const allTags = Array.from(new Set(templates.flatMap((t) => t.tags || [])));

    const filteredTemplates = templates.filter((t) => {
        const matchesSearch =
            t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.role.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTag = !selectedTag || (t.tags && t.tags.includes(selectedTag));
        return matchesSearch && matchesTag;
    });

    const applyPreset = (preset: Preset) => {
        setActivePresetId(preset.id);
        setAiName(preset.aiName);
        setUserName(preset.userName);
        setRole(preset.role);
        setTone(preset.tone);
        setHasUnsyncedChanges(true);
        setStatusMsg({ type: "info", text: `已套用樣板「${preset.name}」，點擊「注入人格」使設定生效。` });
    };

    const handleInject = async () => {
        setIsInjecting(true);
        setStatusMsg(null);
        try {
            const res = await fetch("/api/persona/inject", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ aiName, userName, currentRole: role, tone }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setShowConfirm(false);
                setHasUnsyncedChanges(false);
                setShowDone(true);
                setTimeout(() => {
                    fetch("/api/system/reload", { method: "POST" }).catch(() => { });
                }, 1500);
                setTimeout(() => window.location.reload(), 5000);
            } else {
                setShowConfirm(false);
                setStatusMsg({ type: "error", text: data.message || data.error || "注入失敗" });
            }
        } catch {
            setShowConfirm(false);
            setStatusMsg({ type: "error", text: "注入請求發送失敗" });
        } finally {
            setIsInjecting(false);
        }
    };

    const markChanged = () => setHasUnsyncedChanges(true);

    return (
        <>
            <div className="flex-1 overflow-auto bg-gray-950 p-6 flex flex-col text-white">
                <div className="max-w-6xl w-full mx-auto pb-12 pt-4">

                    {/* Header */}
                    <div className="flex items-center justify-between mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center gap-4">
                            <div className="inline-flex items-center justify-center p-3 bg-purple-950/50 border border-purple-800/50 rounded-xl shadow-[0_0_20px_-5px_rgba(168,85,247,0.4)]">
                                <User className="w-6 h-6 text-purple-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-100 to-purple-400 tracking-tight">
                                    人格設定 (Persona)
                                </h1>
                                <p className="text-sm text-gray-500 mt-0.5">管理 Golem 的身份、人設與語言風格</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowConfirm(true)}
                            disabled={isInjecting}
                            className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-all ${hasUnsyncedChanges
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30 animate-pulse"
                                : "bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20"
                                } ${isInjecting ? "opacity-60 cursor-not-allowed" : ""}`}
                            title="將目前人格設定注入 Golem 並重啟"
                        >
                            <Zap className={`w-4 h-4 ${isInjecting ? "animate-pulse" : ""}`} />
                            {isInjecting ? "注入中..." : "注入人格"}
                        </button>
                    </div>

                    {/* Status Message */}
                    {statusMsg && (
                        <div
                            className={`mb-6 px-4 py-3 rounded-lg flex items-start gap-2 text-sm border ${statusMsg.type === "success"
                                ? "bg-green-950/30 border-green-900/50 text-green-400"
                                : statusMsg.type === "info"
                                    ? "bg-blue-950/30 border-blue-900/50 text-blue-400"
                                    : "bg-red-950/30 border-red-900/50 text-red-400"
                                }`}
                        >
                            <p>{statusMsg.text}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        {/* Left Column: Form (Sticky) */}
                        <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-8 animate-in fade-in slide-in-from-left-8 duration-700 delay-150">
                            <div className="flex items-center gap-3 px-1">
                                <Settings2 className="w-5 h-5 text-purple-400" />
                                <h2 className="text-lg font-semibold text-white">參數定義 (Parameters)</h2>
                            </div>

                            {/* Basic Info */}
                            <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 to-cyan-400" />
                                <div className="space-y-5">
                                    <div>
                                        <label htmlFor="aiName" className="block text-sm font-medium text-gray-400 mb-2">
                                            AI 名稱
                                        </label>
                                        <input
                                            id="aiName"
                                            value={aiName}
                                            onChange={(e) => { setAiName(e.target.value); markChanged(); }}
                                            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 transition-all"
                                            placeholder="例如：Friday, Golem"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="userName" className="block text-sm font-medium text-gray-400 mb-2">
                                            你的稱呼
                                        </label>
                                        <input
                                            id="userName"
                                            value={userName}
                                            onChange={(e) => { setUserName(e.target.value); markChanged(); }}
                                            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 transition-all"
                                            placeholder="例如：Boss, Commander"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Core Persona */}
                            <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-500 to-blue-500" />
                                <div className="space-y-5">
                                    <div>
                                        <label htmlFor="role" className="block text-sm font-medium text-gray-400 mb-2">
                                            任務定位 &amp; 人設背景
                                        </label>
                                        <textarea
                                            id="role"
                                            value={role}
                                            onChange={(e) => { setRole(e.target.value); markChanged(); }}
                                            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all resize-y min-h-[130px]"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="tone" className="block text-sm font-medium text-gray-400 mb-2">
                                            語言風格 &amp; 語氣
                                        </label>
                                        <input
                                            id="tone"
                                            value={tone}
                                            onChange={(e) => { setTone(e.target.value); markChanged(); }}
                                            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Inject Button (also at bottom of form for convenience) */}
                            <Button
                                onClick={() => setShowConfirm(true)}
                                disabled={isInjecting}
                                className="w-full h-12 font-bold bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 border-none shadow-xl transition-all hover:scale-[1.02] active:scale-95 rounded-2xl"
                            >
                                {isInjecting ? (
                                    <span className="flex items-center gap-2">
                                        <RefreshCcw className="w-4 h-4 animate-spin" />
                                        注入中...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <Zap className="w-5 h-5" />
                                        注入人格並重啟 Golem
                                    </span>
                                )}
                            </Button>
                        </div>

                        {/* Right Column: Templates */}
                        <div className="lg:col-span-7 space-y-5 animate-in fade-in slide-in-from-right-8 duration-700 delay-300">
                            {/* Search & Tags */}
                            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 shadow-sm">
                                <div className="flex flex-col md:flex-row gap-4 mb-5">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                        <input
                                            type="text"
                                            placeholder="搜尋樣板名稱、關鍵字..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all"
                                        />
                                        {searchTerm && (
                                            <button
                                                onClick={() => setSearchTerm("")}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-800 rounded-md"
                                            >
                                                <X className="w-3 h-3 text-gray-500" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm font-medium text-gray-400">
                                        <Filter className="w-4 h-4" />
                                        篩選標籤
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => setSelectedTag(null)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                                            selectedTag === null
                                                ? "bg-purple-500 text-white shadow-lg shadow-purple-900/20"
                                                : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                                        )}
                                    >
                                        全部
                                    </button>
                                    {allTags.map((tag) => (
                                        <button
                                            key={tag}
                                            onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
                                                selectedTag === tag
                                                    ? "bg-blue-500 text-white shadow-lg shadow-blue-900/20"
                                                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                                            )}
                                        >
                                            <Tag className="w-3 h-3" />
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Templates Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredTemplates.length > 0 ? (
                                    filteredTemplates.map((preset) => (
                                        <button
                                            key={preset.id}
                                            onClick={() => applyPreset(preset)}
                                            className={cn(
                                                "text-left p-5 rounded-2xl border transition-all duration-300 group relative overflow-hidden flex flex-col h-full",
                                                activePresetId === preset.id
                                                    ? "bg-purple-950/20 border-purple-500/50 ring-1 ring-purple-500/30 shadow-[0_0_25px_-5px_rgba(168,85,247,0.2)]"
                                                    : "bg-gray-900 border-gray-800 hover:border-gray-700 hover:bg-gray-800/80"
                                            )}
                                        >
                                            <div className="flex items-start justify-between mb-4">
                                                <div
                                                    className={cn(
                                                        "p-3 rounded-xl transition-colors",
                                                        activePresetId === preset.id
                                                            ? "bg-purple-500 text-white shadow-lg shadow-purple-900/40"
                                                            : "bg-gray-800 text-gray-400 group-hover:text-purple-400"
                                                    )}
                                                >
                                                    {(() => {
                                                        const IconComponent = ICON_MAP[preset.icon] || ICON_MAP.BrainCircuit;
                                                        return <IconComponent className="w-6 h-6" />;
                                                    })()}
                                                </div>
                                                {activePresetId === preset.id && (
                                                    <div className="bg-purple-500/20 border border-purple-500/30 text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                        Selected
                                                    </div>
                                                )}
                                            </div>

                                            <h4
                                                className={cn(
                                                    "text-lg font-bold mb-2 transition-colors",
                                                    activePresetId === preset.id
                                                        ? "text-white"
                                                        : "text-gray-200 group-hover:text-white"
                                                )}
                                            >
                                                {preset.name}
                                            </h4>

                                            <p className="text-sm text-gray-400 leading-relaxed mb-4 flex-1">
                                                {preset.description}
                                            </p>

                                            <div className="flex flex-wrap gap-1.5 mt-auto">
                                                {preset.tags?.map((tag) => (
                                                    <span
                                                        key={tag}
                                                        className="px-2 py-0.5 bg-gray-950/50 border border-gray-800 text-[10px] text-gray-500 rounded-md"
                                                    >
                                                        #{tag}
                                                    </span>
                                                ))}
                                            </div>

                                            {/* Background Decoration */}
                                            <div
                                                className={cn(
                                                    "absolute -right-4 -bottom-4 opacity-[0.03] transition-opacity",
                                                    activePresetId === preset.id ? "opacity-[0.08]" : ""
                                                )}
                                            >
                                                {(() => {
                                                    const IconComponent = ICON_MAP[preset.icon] || ICON_MAP.BrainCircuit;
                                                    return <IconComponent className="w-24 h-24" />;
                                                })()}
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="col-span-full py-20 text-center bg-gray-900/20 border border-dashed border-gray-800 rounded-2xl flex flex-col items-center">
                                        <Search className="w-10 h-10 text-gray-700 mb-3" />
                                        <p className="text-gray-500">找不到符合條件的樣板</p>
                                        <button
                                            onClick={() => { setSearchTerm(""); setSelectedTag(null); }}
                                            className="text-purple-500 text-sm mt-2 hover:underline"
                                        >
                                            清除所有過濾條件
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <InjectPersonaConfirmDialog
                open={showConfirm}
                onOpenChange={setShowConfirm}
                onConfirm={handleInject}
                isLoading={isInjecting}
            />
            <InjectPersonaDoneDialog open={showDone} onOpenChange={setShowDone} />
        </>
    );
}
