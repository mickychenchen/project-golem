"use client";

import { useEffect, useState } from "react";
import { useRealtimeTelemetry } from "@/components/RealtimeTelemetryProvider";
import { DashboardMetrics, MemHistoryPoint } from "../types";

const DEFAULT_METRICS: DashboardMetrics = {
    uptime: "0h 0m",
    queueCount: 0,
    lastSchedule: "無排程",
    memUsage: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function parseString(value: unknown): string | null {
    return typeof value === "string" ? value : null;
}

function parseNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

function mergeMetrics(prev: DashboardMetrics, payload: unknown): DashboardMetrics {
    if (!isRecord(payload)) return prev;

    const uptime = parseString(payload.uptime);
    const lastSchedule = parseString(payload.lastSchedule);
    const queueCount = parseNumber(payload.queueCount);
    const memUsage = parseNumber(payload.memUsage);

    return {
        uptime: uptime ?? prev.uptime,
        lastSchedule: lastSchedule ?? prev.lastSchedule,
        queueCount: queueCount ?? prev.queueCount,
        memUsage: memUsage ?? prev.memUsage,
    };
}

export function useDashboardRealtime() {
    const telemetry = useRealtimeTelemetry();
    const [metrics, setMetrics] = useState<DashboardMetrics>(DEFAULT_METRICS);
    const [memHistory, setMemHistory] = useState<MemHistoryPoint[]>([]);

    useEffect(() => {
        if (telemetry.initEvent.id === 0) return;
        setMetrics((prev) => mergeMetrics(prev, telemetry.initEvent.payload));
    }, [telemetry.initEvent]);

    useEffect(() => {
        if (telemetry.stateUpdateEvent.id === 0) return;
        setMetrics((prev) => mergeMetrics(prev, telemetry.stateUpdateEvent.payload));
    }, [telemetry.stateUpdateEvent]);

    useEffect(() => {
        if (telemetry.heartbeatEvent.id === 0) return;
        const payload = telemetry.heartbeatEvent.payload;
        setMetrics((prev) => mergeMetrics(prev, payload));

        if (!isRecord(payload)) return;
        const memUsage = parseNumber(payload.memUsage);
        if (memUsage === null) return;

        const timeStr = new Date().toLocaleTimeString("zh-TW", { hour12: false });
        setMemHistory((prev) => {
            const next = [...prev, { time: timeStr, value: parseFloat(memUsage.toFixed(1)) }];
            return next.slice(-60);
        });
    }, [telemetry.heartbeatEvent]);

    return {
        metrics,
        memHistory,
        isConnected: telemetry.isConnected,
    };
}
