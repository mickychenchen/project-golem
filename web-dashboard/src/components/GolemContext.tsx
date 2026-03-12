"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { socket } from "@/lib/socket";
import { apiUrl } from "@/lib/api";

interface GolemInfo {
    id: string;
    status: string;
}

interface GolemContextType {
    activeGolem: string;
    activeGolemStatus: string;
    setActiveGolem: (id: string) => void;
    golems: GolemInfo[];
    hasGolems: boolean;
    isLoadingGolems: boolean;
    refreshGolems: () => Promise<void>;
    startGolem: (id: string) => Promise<boolean>;
    isSystemConfigured: boolean;
    isLoadingSystem: boolean;
    isSingleNode: boolean;
    version: string;
}

const GolemContext = createContext<GolemContextType>({
    activeGolem: "",
    activeGolemStatus: "", // ✅ [Bug #3 修復] 預設為空字串，避免載入中誤顯示 "running"
    setActiveGolem: () => { },
    golems: [],
    hasGolems: false,
    isLoadingGolems: true,
    refreshGolems: async () => { },
    startGolem: async () => false,
    isSystemConfigured: true,
    isLoadingSystem: true,
    isSingleNode: true,
    version: "v9.0",
});

export const useGolem = () => useContext(GolemContext);

export function GolemProvider({ children }: { children: React.ReactNode }) {
    const [golems, setGolems] = useState<GolemInfo[]>([]);
    const [activeGolem, setActiveGolem] = useState<string>("");
    const [isLoadingGolems, setIsLoadingGolems] = useState(true);
    const [isSystemConfigured, setIsSystemConfigured] = useState(false);
    const [isLoadingSystem, setIsLoadingSystem] = useState(true);
    const [isSingleNode] = useState(true);
    const [version, setVersion] = useState("v9.0");

    const fetchGolems = async () => {
        setIsLoadingGolems(true);
        try {
            const res = await fetch(apiUrl("/api/golems"));
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data = await res.json();
            if (data.golems && data.golems.length > 0) {
                setGolems(data.golems);
                setActiveGolem((currentActive) => {
                    const ids = data.golems.map((g: GolemInfo) => g.id);
                    if (!currentActive || !ids.includes(currentActive)) {
                        const saved = localStorage.getItem("golem_active_id");
                        if (saved && ids.includes(saved)) {
                            return saved;
                        }
                        return data.golems[0].id;
                    }
                    return currentActive;
                });
            } else {
                setGolems([]);
                setActiveGolem("");
            }
        } catch (err) {
            console.error("Failed to fetch golems", err);
        } finally {
            setIsLoadingGolems(false);
        }
    };

    const fetchSystemStatus = () => {
        setIsLoadingSystem(true);
        fetch(apiUrl("/api/system/status"))
            .then(res => {
                if (!res.ok) throw new Error("Status failed");
                return res.json();
            })
            .then(data => {
                setIsSystemConfigured(data.isSystemConfigured ?? true);
            })
            .catch(() => setIsSystemConfigured(true)) // on error, don't block
            .finally(() => setIsLoadingSystem(false));

        // Also fetch version from system config
        fetch(apiUrl("/api/system/config"))
            .then(res => {
                if (!res.ok) throw new Error("Config failed");
                return res.json();
            })
            .then(data => {
                if (data.version) setVersion(`v${data.version}`);
            })
            .catch(err => console.error("Failed to fetch version", err));
    };

    const startGolem = async (id: string) => {
        try {
            const res = await fetch(apiUrl("/api/golems/start"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            const data = await res.json();
            if (data.success) {
                fetchGolems();
                return true;
            }
            return false;
        } catch (err) {
            console.error("Failed to start golem", err);
            return false;
        }
    };

    useEffect(() => {
        fetchGolems();
        fetchSystemStatus();

        const handleInit = (data: any) => {
            if (data.golems) {
                const formattedGolems = typeof data.golems[0] === 'string'
                    ? data.golems.map((id: string) => ({ id, status: 'running' }))
                    : data.golems;

                setGolems(formattedGolems);
                setActiveGolem(prev => {
                    if (!prev && formattedGolems.length > 0) return formattedGolems[0].id;
                    return prev;
                });
                setIsLoadingGolems(false);
            }
        };

        const handleConnect = () => {
            fetchGolems();
            fetchSystemStatus();
        };

        socket.on("init", handleInit);
        socket.on("connect", handleConnect);

        return () => {
            socket.off("init", handleInit);
            socket.off("connect", handleConnect);
        };
    }, []);

    const handleSetGolem = (id: string) => {
        setActiveGolem(id);
        localStorage.setItem("golem_active_id", id);
    };

    const activeGolemObj = golems.find((g: GolemInfo) => g.id === activeGolem);
    const activeGolemStatus = activeGolemObj?.status ?? ""; // ✅ [Bug #3 修復] 空字串，避免誤顯示為 running
    const hasGolems = golems.length > 0;

    return (
        <GolemContext.Provider value={{
            activeGolem,
            activeGolemStatus,
            setActiveGolem: handleSetGolem,
            golems,
            hasGolems,
            isLoadingGolems,
            refreshGolems: fetchGolems,
            startGolem,
            isSystemConfigured,
            isLoadingSystem,
            isSingleNode,
            version,
        }}>
            {children}
        </GolemContext.Provider>
    );
}
