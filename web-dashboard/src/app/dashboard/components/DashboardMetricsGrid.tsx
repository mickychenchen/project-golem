"use client";

import { Activity, Clock, Cpu, Server } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { DashboardMetrics, MemHistoryPoint } from "../types";

type DashboardMetricsGridProps = {
    metrics: DashboardMetrics;
    memHistory: MemHistoryPoint[];
};

export default function DashboardMetricsGrid({ metrics, memHistory }: DashboardMetricsGridProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
                title="Memory Usage"
                value={`${metrics.memUsage.toFixed(1)} MB`}
                icon={Activity}
                data={memHistory}
                color="#10b981"
            />
            <MetricCard title="Queue Load" value={metrics.queueCount} icon={Server} />
            <MetricCard title="System Uptime" value={metrics.uptime} icon={Clock} />
            <MetricCard title="Next Schedule" value={metrics.lastSchedule} icon={Cpu} />
        </div>
    );
}
