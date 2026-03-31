export type GolemConfig = {
    id: string;
    tgToken?: string;
    role?: string;
    tgAuthMode?: string;
    adminId?: string;
    chatId?: string;
};

export type ConfigData = {
    env: Record<string, string>;
    golems: GolemConfig[];
};

export type RuntimeEnvInfo = {
    node?: string;
    npm?: string;
    platform?: string;
    arch?: string;
    uptime?: number;
    osName?: string;
};

export type RuntimeSnapshot = {
    mode?: string;
    supervisor?: {
        pid?: number;
        status?: string;
        uptimeSec?: number;
    };
    worker?: {
        pid?: number;
        status?: string;
        uptimeSec?: number;
        restarts?: number;
        lastExitReason?: string;
    };
    memory?: {
        pressure?: string;
        rssMb?: number;
        heapUsedMb?: number;
        heapTotalMb?: number;
        lastMitigation?: string;
        memoryLimitMb?: number;
        memoryLimitSource?: string;
        fatalEligible?: boolean;
        fatalConsecutive?: number;
        fatalRequired?: number;
        fatalStartupGraceMs?: number;
        fatalSuppressedReason?: string;
        fatalReason?: string;
    };
    managedChildren?: {
        total?: number;
        protected?: number;
        recyclable?: number;
    };
};

export type SystemStatus = {
    hasGolems?: boolean;
    liveCount?: number;
    configuredCount?: number;
    isSystemConfigured?: boolean;
    runtimeEnv?: RuntimeEnvInfo;
    runtime?: RuntimeSnapshot;
    health?: { node: boolean; env: boolean; keys: boolean; deps: boolean; core: boolean; dashboard: boolean };
    system?: { totalMem: string; freeMem: string; diskAvail: string };
    allowRemote?: boolean;
    localIp?: string;
    dashboardPort?: string | number;
};

export type UpdateInfo = {
    currentVersion: string;
    remoteVersion?: string;
    isOutdated?: boolean;
    installMode: string;
    gitInfo?: {
        currentBranch: string;
        currentCommit: string;
        latestCommit: string;
        behindCount: number;
    };
};

export type LogInfo = { size: string; bytes: number };
