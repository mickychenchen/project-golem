let mockRouterInstance = null;

jest.mock('express', () => ({
    Router: jest.fn(() => mockRouterInstance),
}), { virtual: true });

function createRouterMock() {
    const routes = {
        GET: new Map(),
        POST: new Map(),
    };

    return {
        routes,
        get(path, ...handlers) {
            routes.GET.set(path, handlers);
            return this;
        },
        post(path, ...handlers) {
            routes.POST.set(path, handlers);
            return this;
        },
    };
}

function createResponseMock() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
        cookie() {
            return this;
        },
        setHeader() {
            return this;
        },
    };
}

async function invokeHandlers(handlers, req = {}) {
    const res = createResponseMock();
    let index = 0;

    const next = async () => {
        const handler = handlers[index++];
        if (!handler) return;
        if (handler.length >= 3) {
            return handler(req, res, () => next());
        }
        return handler(req, res);
    };

    await next();
    return res;
}

describe('System runtime routes', () => {
    let registerSystemRoutes;
    let serverContext;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});

        mockRouterInstance = createRouterMock();
        jest.resetModules();
        registerSystemRoutes = require('../web-dashboard/routes/api.system');

        serverContext = {
            allowRemote: false,
            contexts: new Map(),
            isBooting: false,
            requiresRemoteAuth: jest.fn(() => false),
            isAuthenticatedRequest: jest.fn(() => true),
            isAuthSessionFresh: jest.fn(() => true),
            runtimeController: {
                getRuntimeSnapshot: jest.fn(() => ({
                    mode: 'supervisor-worker',
                    supervisor: { pid: 1, status: 'running', uptimeSec: 10 },
                    worker: { pid: 2, status: 'running', uptimeSec: 8, restarts: 1, lastExitReason: '' },
                    memory: { pressure: 'warning', rssMb: 128, heapUsedMb: 64, heapTotalMb: 96, lastMitigation: 'warning:gc' },
                    managedChildren: { total: 3, protected: 2, recyclable: 1 },
                })),
                restartWorker: jest.fn().mockResolvedValue(undefined),
                shutdownSupervisor: jest.fn().mockResolvedValue(undefined),
            },
        };

        registerSystemRoutes(serverContext);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        mockRouterInstance = null;
    });

    test('GET /api/system/status exposes runtimeEnv and runtime snapshot', async () => {
        const handlers = mockRouterInstance.routes.GET.get('/api/system/status');
        const res = await invokeHandlers(handlers, { query: {}, headers: {}, path: '/api/system/status', method: 'GET' });

        expect(res.statusCode).toBe(200);
        expect(res.body.runtimeEnv).toEqual(expect.objectContaining({
            node: expect.any(String),
            platform: expect.any(String),
        }));
        expect(res.body.runtime).toEqual(expect.objectContaining({
            mode: 'supervisor-worker',
            worker: expect.objectContaining({
                pid: 2,
                status: 'running',
            }),
            memory: expect.objectContaining({
                pressure: 'warning',
            }),
        }));
    });

    test('POST /api/system/restart recycles worker via runtime controller', async () => {
        const handlers = mockRouterInstance.routes.POST.get('/api/system/restart');
        const res = await invokeHandlers(handlers, { headers: {}, path: '/api/system/restart', method: 'POST' });

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(expect.objectContaining({ success: true }));
        expect(serverContext.runtimeController.restartWorker).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1000);
        await Promise.resolve();

        expect(serverContext.runtimeController.restartWorker).toHaveBeenCalledWith('api-system-restart');
    });

    test('POST /api/system/shutdown delegates to supervisor controller', async () => {
        const handlers = mockRouterInstance.routes.POST.get('/api/system/shutdown');
        const res = await invokeHandlers(handlers, { headers: {}, path: '/api/system/shutdown', method: 'POST' });

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(expect.objectContaining({ success: true }));
        expect(serverContext.runtimeController.shutdownSupervisor).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1000);
        await Promise.resolve();

        expect(serverContext.runtimeController.shutdownSupervisor).toHaveBeenCalledWith('api-system-shutdown');
    });
});
