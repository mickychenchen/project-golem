'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { socket } from '@/lib/socket';

type TelemetryEvent<T = unknown> = {
    id: number;
    payload: T | null;
};

type RealtimeTelemetryContextValue = {
    isConnected: boolean;
    initEvent: TelemetryEvent;
    stateUpdateEvent: TelemetryEvent;
    heartbeatEvent: TelemetryEvent;
};

const DEFAULT_EVENT: TelemetryEvent = {
    id: 0,
    payload: null,
};

const RealtimeTelemetryContext = createContext<RealtimeTelemetryContextValue>({
    isConnected: false,
    initEvent: DEFAULT_EVENT,
    stateUpdateEvent: DEFAULT_EVENT,
    heartbeatEvent: DEFAULT_EVENT,
});

function parsePositiveInteger(value: unknown, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
}

function getNumericField(payload: unknown, key: 'seq' | 'ts'): number | null {
    if (!payload || typeof payload !== 'object') return null;
    const value = (payload as Record<string, unknown>)[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

const HEARTBEAT_VISIBLE_INTERVAL_MS = parsePositiveInteger(
    process.env.NEXT_PUBLIC_GOLEM_HEARTBEAT_INTERVAL_MS || process.env.GOLEM_HEARTBEAT_INTERVAL_MS,
    2000
);
const HEARTBEAT_HIDDEN_INTERVAL_MS = parsePositiveInteger(
    process.env.NEXT_PUBLIC_GOLEM_HEARTBEAT_HIDDEN_INTERVAL_MS || process.env.GOLEM_HEARTBEAT_HIDDEN_INTERVAL_MS,
    5000
);

export function RealtimeTelemetryProvider({ children }: { children: React.ReactNode }) {
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [initEvent, setInitEvent] = useState<TelemetryEvent>(DEFAULT_EVENT);
    const [stateUpdateEvent, setStateUpdateEvent] = useState<TelemetryEvent>(DEFAULT_EVENT);
    const [heartbeatEvent, setHeartbeatEvent] = useState<TelemetryEvent>(DEFAULT_EVENT);

    const eventIdRef = useRef(0);
    const lastHeartbeatSeqRef = useRef<number | null>(null);
    const lastHeartbeatTsRef = useRef<number | null>(null);
    const lastHeartbeatEmitAtRef = useRef(0);

    useEffect(() => {
        const nextEvent = (payload: unknown): TelemetryEvent => ({
            id: ++eventIdRef.current,
            payload,
        });

        const handleConnect = () => setIsConnected(true);
        const handleDisconnect = () => setIsConnected(false);

        const handleInit = (payload: unknown) => {
            setInitEvent(nextEvent(payload));
        };

        const handleStateUpdate = (payload: unknown) => {
            setStateUpdateEvent(nextEvent(payload));
        };

        const handleHeartbeat = (payload: unknown) => {
            const now = Date.now();
            const seq = getNumericField(payload, 'seq');
            const ts = getNumericField(payload, 'ts');

            if (seq !== null && lastHeartbeatSeqRef.current !== null && seq <= lastHeartbeatSeqRef.current) {
                return;
            }
            if (ts !== null && lastHeartbeatTsRef.current !== null && ts <= lastHeartbeatTsRef.current) {
                return;
            }

            const minInterval = document.hidden ? HEARTBEAT_HIDDEN_INTERVAL_MS : Math.max(250, HEARTBEAT_VISIBLE_INTERVAL_MS / 2);
            if (now - lastHeartbeatEmitAtRef.current < minInterval) {
                if (document.hidden || (seq === null && ts === null)) {
                    return;
                }
            }

            lastHeartbeatEmitAtRef.current = now;
            if (seq !== null) lastHeartbeatSeqRef.current = seq;
            if (ts !== null) lastHeartbeatTsRef.current = ts;
            setHeartbeatEvent(nextEvent(payload));
        };

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('init', handleInit);
        socket.on('state_update', handleStateUpdate);
        socket.on('heartbeat', handleHeartbeat);
        setIsConnected(socket.connected);

        return () => {
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('init', handleInit);
            socket.off('state_update', handleStateUpdate);
            socket.off('heartbeat', handleHeartbeat);
        };
    }, []);

    const value = useMemo<RealtimeTelemetryContextValue>(() => ({
        isConnected,
        initEvent,
        stateUpdateEvent,
        heartbeatEvent,
    }), [heartbeatEvent, initEvent, isConnected, stateUpdateEvent]);

    return (
        <RealtimeTelemetryContext.Provider value={value}>
            {children}
        </RealtimeTelemetryContext.Provider>
    );
}

export function useRealtimeTelemetry() {
    return useContext(RealtimeTelemetryContext);
}
