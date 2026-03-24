"use client";

import { AlertTriangle, CheckCircle2, HardDrive, RefreshCw, ShieldCheck } from "lucide-react";
import { SettingField, SettingSelectField } from "../SettingFields";

type SecurityTabProps = {
    env: Record<string, string>;
    onChangeEnv: (key: string, value: string) => void;
};

const DANGEROUS_COMMANDS = [
    "rm -rf /",
    "rd /s /q",
    "> /dev/sd",
    ":(){:|:&};:",
    "mkfs",
    "Format-Volume",
    "dd if=",
    "chmod -x"
];

const SYSTEM_SAFE_LIBRARY = [
    "dir",
    "pwd",
    "date",
    "echo",
    "cat",
    "grep",
    "find",
    "whoami",
    "tail",
    "head",
    "df",
    "free",
    "Get-ChildItem",
    "Select-String",
    "golem-check"
];

const SYSTEM_SAFE_WHITELIST = [
    "ls",
    ...SYSTEM_SAFE_LIBRARY
];

const parseCsv = (value?: string): string[] => {
    if (!value) return [];
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
};

export default function SecurityTab({ env, onChangeEnv }: SecurityTabProps) {
    const whitelist = parseCsv(env.COMMAND_WHITELIST);
    const customCommands = parseCsv(env.CUSTOM_COMMANDS);
    const availableSystemCommands = SYSTEM_SAFE_LIBRARY.filter((cmd) => !whitelist.includes(cmd));

    const moveToWhitelist = (item: string) => {
        if (!item || whitelist.includes(item)) return;
        onChangeEnv("COMMAND_WHITELIST", [...whitelist, item].join(","));
        onChangeEnv(
            "CUSTOM_COMMANDS",
            customCommands.filter((cmd) => cmd !== item).join(",")
        );
    };

    const removeFromWhitelist = (cmd: string) => {
        const nextWhitelist = whitelist.filter((item) => item !== cmd);
        onChangeEnv("COMMAND_WHITELIST", nextWhitelist.join(","));

        if (!SYSTEM_SAFE_WHITELIST.includes(cmd) && !customCommands.includes(cmd)) {
            onChangeEnv("CUSTOM_COMMANDS", [...customCommands, cmd].join(","));
        }
    };

    const moveToCustomPool = (item: string) => {
        if (!item) return;

        if (!customCommands.includes(item)) {
            onChangeEnv("CUSTOM_COMMANDS", [...customCommands, item].join(","));
        }

        if (whitelist.includes(item)) {
            onChangeEnv(
                "COMMAND_WHITELIST",
                whitelist.filter((cmd) => cmd !== item).join(",")
            );
        }
    };

    const removeFromCustomPool = (cmd: string) => {
        onChangeEnv(
            "CUSTOM_COMMANDS",
            customCommands.filter((item) => item !== cmd).join(",")
        );
    };

    const addCustomCommand = (value: string) => {
        if (!value || customCommands.includes(value)) return;
        onChangeEnv("CUSTOM_COMMANDS", [...customCommands, value].join(","));
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    🛡️ 指令安全與自主模式設定
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <SettingSelectField
                        label="自主介入等級 (Intervention Level)"
                        desc="保守: 僅重大錯誤 | 一般: 常規建議 | 積極: 專家主動引導"
                        value={env.GOLEM_INTERVENTION_LEVEL || "NORMAL"}
                        onChange={(val) => onChangeEnv("GOLEM_INTERVENTION_LEVEL", val)}
                        options={[
                            { value: "CONSERVATIVE", label: "CONSERVATIVE (保守)" },
                            { value: "NORMAL", label: "NORMAL (一般)" },
                            { value: "PROACTIVE", label: "PROACTIVE (積極)" }
                        ]}
                    />
                    <SettingField
                        label="自動模式回合上限 (Max Auto Turns)"
                        keyName="GOLEM_MAX_AUTO_TURNS"
                        placeholder="5"
                        desc="防止 ReAct 循環陷入死循環，達到上限後會暫停並詢問使用者。"
                        value={env.GOLEM_MAX_AUTO_TURNS || ""}
                        onChange={(val) => onChangeEnv("GOLEM_MAX_AUTO_TURNS", val)}
                    />
                </div>
                <SettingField
                    label="嚴格指令防護 (Strict Safeguard)"
                    keyName="GOLEM_STRICT_SAFEGUARD"
                    placeholder="false"
                    desc="是否在 initial validation 階段就攔截 dangerousOps (如 rm -rf)。"
                    value={env.GOLEM_STRICT_SAFEGUARD || ""}
                    onChange={(val) => onChangeEnv("GOLEM_STRICT_SAFEGUARD", val)}
                />
                <SettingField
                    label="信任系統安全庫指令 (Trust System Library)"
                    keyName="GOLEM_TRUST_SYSTEM_COMMANDS"
                    placeholder="false"
                    desc="是否自動放行系統預設的安全指令 (如 ls, cat, grep, pwd) 而不需每次手動核准。"
                    value={env.GOLEM_TRUST_SYSTEM_COMMANDS || ""}
                    onChange={(val) => onChangeEnv("GOLEM_TRUST_SYSTEM_COMMANDS", val)}
                />

                <div className="mt-6 p-4 border border-red-500/30 bg-red-500/5 rounded-lg">
                    <div className="flex items-center gap-2 text-red-400 font-bold mb-2">
                        <span className="text-xl">⚠️</span>
                        <span>危險區域 (Dangerous Zone)</span>
                    </div>
                    <SettingField
                        label="全自動指令執行 (Full Auto-Approve)"
                        keyName="GOLEM_AUTO_APPROVE_ALL"
                        placeholder="false"
                        desc="允許所有指令直接執行而不需經過任何通知或核准。核心阻斷清單除外。開啟此項代表您完全信任 AI 的行為。"
                        value={env.GOLEM_AUTO_APPROVE_ALL || ""}
                        onChange={(val) => onChangeEnv("GOLEM_AUTO_APPROVE_ALL", val)}
                    />
                    <SettingField
                        label="沈默自動執行 (Silent Auto-Approve)"
                        keyName="GOLEM_SILENT_AUTO_APPROVE"
                        placeholder="false"
                        desc="當全自動執行開啟時，隱藏中間過程的 AI 解說文字，僅顯示最終結果與錯誤訊息。"
                        value={env.GOLEM_SILENT_AUTO_APPROVE || ""}
                        onChange={(val) => onChangeEnv("GOLEM_SILENT_AUTO_APPROVE", val)}
                    />
                </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    🛡️ 指令安全與白名單設定 (Drag & Drop)
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 pb-4">
                    <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex flex-col h-full">
                        <h4 className="text-sm font-semibold text-destructive flex items-center gap-2 mb-3">
                            <AlertTriangle className="w-4 h-4" /> 系統阻擋 (危險)
                        </h4>
                        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar h-[22rem]">
                            {DANGEROUS_COMMANDS.map((cmd, idx) => (
                                <div
                                    key={`danger-${idx}`}
                                    className="px-3 py-2 bg-destructive/20 border border-destructive/40 text-destructive text-xs font-mono rounded cursor-not-allowed opacity-80"
                                >
                                    {cmd}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-secondary/30 border border-border rounded-xl p-4 flex flex-col h-full">
                        <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3">
                            🛡️ 系統安全庫 (預設)
                        </h4>
                        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar h-[22rem]">
                            {availableSystemCommands.map((cmd, idx) => (
                                <div
                                    key={`safe-drv-${idx}`}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData("text/plain", cmd);
                                        e.dataTransfer.effectAllowed = "move";
                                    }}
                                    className="px-3 py-2 bg-secondary border border-border text-foreground/80 text-xs font-mono rounded cursor-grab hover:border-primary shadow-sm active:cursor-grabbing group flex items-center justify-between"
                                >
                                    <span>{cmd}</span>
                                    <span className="text-[10px] text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">拖曳啟用</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div
                        className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-col h-full transition-colors relative"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                            e.preventDefault();
                            moveToWhitelist(e.dataTransfer.getData("text/plain"));
                        }}
                    >
                        <h4 className="text-sm font-semibold text-primary flex items-center gap-2 mb-3">
                            <CheckCircle2 className="w-4 h-4" /> 允許清單 (免審批)
                        </h4>
                        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar h-[22rem]">
                            {whitelist.map((cmd, idx) => (
                                <div
                                    key={`whitelist-${idx}`}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData("text/plain", cmd);
                                        e.dataTransfer.effectAllowed = "move";
                                    }}
                                    className="px-3 py-2 bg-primary/10 border border-primary/30 text-primary text-xs font-mono rounded cursor-grab flex items-center justify-between group shadow-sm"
                                >
                                    <span>{cmd}</span>
                                    <button
                                        onClick={() => removeFromWhitelist(cmd)}
                                        className="opacity-0 group-hover:opacity-100 text-red-400 p-0.5"
                                    >
                                        <RefreshCw className="w-3 h-3 rotate-45" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div
                        className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex flex-col h-full transition-colors relative"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                            e.preventDefault();
                            moveToCustomPool(e.dataTransfer.getData("text/plain"));
                        }}
                    >
                        <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-2 mb-3">
                            <HardDrive className="w-4 h-4" /> 自訂備選池
                        </h4>
                        <input
                            type="text"
                            placeholder="新增指令 (如 docker)"
                            className="w-full bg-secondary border border-border rounded px-2 py-1.5 text-xs font-mono mb-3"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    const val = e.currentTarget.value.trim();
                                    addCustomCommand(val);
                                    if (val) {
                                        e.currentTarget.value = "";
                                    }
                                }
                            }}
                        />
                        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar h-[19rem]">
                            {customCommands.map((cmd, idx) => (
                                <div
                                    key={`pool-${idx}`}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData("text/plain", cmd);
                                        e.dataTransfer.effectAllowed = "move";
                                    }}
                                    className="px-3 py-2 bg-secondary border border-border text-foreground/80 text-xs font-mono rounded cursor-grab flex items-center justify-between group shadow-sm hover:border-blue-500"
                                >
                                    <span>{cmd}</span>
                                    <button
                                        onClick={() => removeFromCustomPool(cmd)}
                                        className="opacity-0 group-hover:opacity-100 text-red-400 p-0.5"
                                    >
                                        <RefreshCw className="w-3 h-3 rotate-45" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
