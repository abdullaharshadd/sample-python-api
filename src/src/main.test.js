```typescript
import { jest } from '@jest/globals';

// ─── Mocks must be hoisted before any imports ────────────────────────────────

const mockRun = jest.fn();
const mockUse = jest.fn();

const mockServer = {
  app: {
    use: mockUse,
  },
  run: mockRun,
};

const mockBookRouter = jest.fn(); // just a truthy router value

jest.mock('./server/instance', () => ({
  server: mockServer,
}));

jest.mock('./resources/book', () => ({
  bookRouter: mockBookRouter,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Re-require main.ts with a clean module registry so each test gets a fresh
 * evaluation of the module-level side-effects.
 */
function freshRequireMain() {
  jest.resetModules();

  // Re-apply the mocks after resetModules so they are still used in the new
  // module registry.
  jest.mock('./server/instance', () => ({
    server: mockServer,
  }));
  jest.mock('./resources/book', () => ({
    bookRouter: mockBookRouter,
  }));

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./main');
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('main.ts – application bootstrap', () => {
  beforeEach(() => {
    mockRun.mockClear();
    mockUse.mockClear();
  });

  // ── registerRoutes ──────────────────────────────────────────────────────

  describe('registerRoutes()', () => {
    it('mounts bookRouter at "/" on the shared server app', () => {
      const { registerRoutes } = freshRequireMain();

      // The module-level call already ran; reset counts so we only measure the
      // explicit call below.
      mockUse.mockClear();

      registerRoutes();

      expect(mockUse).toHaveBeenCalledTimes(1);
      expect(mockUse).toHaveBeenCalledWith('/', mockBookRouter);
    });

    it('uses the same shared server singleton each time it is called', () => {
      const { registerRoutes } = freshRequireMain();
      mockUse.mockClear();

      registerRoutes();
      registerRoutes();

      // Both calls should target the same mock (the singleton)
      const calls = mockUse.mock.calls;
      expect(calls.length).toBe(2);
      calls.forEach((call) => expect(call).toEqual(['/', mockBookRouter]));
    });
  });

  // ── bootstrap ───────────────────────────────────────────────────────────

  describe('bootstrap()', () => {
    it('registers routes AND starts the server', () => {
      const { bootstrap } = freshRequireMain();
      mockUse.mockClear();
      mockRun.mockClear();

      bootstrap();

      expect(mockUse).toHaveBeenCalledWith('/', mockBookRouter);
      expect(mockRun).toHaveBeenCalledTimes(1);
    });

    it('registers routes before calling server.run()', () => {
      const callOrder: string[] = [];
      mockUse.mockImplementation(() => callOrder.push('use'));
      mockRun.mockImplementation(() => callOrder.push('run'));

      const { bootstrap } = freshRequireMain();
      mockUse.mockClear();
      mockRun.mockClear();

      // Re-apply order-tracking implementations after resetModules
      mockUse.mockImplementation(() => callOrder.splice(0, callOrder.length, 'use'));
      mockRun.mockImplementation(() => callOrder.push('run'));

      bootstrap();

      expect(callOrder.indexOf('use')).toBeLessThan(callOrder.indexOf('run'));
    });
  });

  // ── Module-level side-effects ────────────────────────────────────────────

  describe('module-level side-effects on import', () => {
    it('registers routes (calls server.app.use) when the module is imported', () => {
      mockUse.mockClear();
      mockRun.mockClear();

      freshRequireMain(); // triggers module evaluation

      expect(mockUse).toHaveBeenCalledWith('/', mockBookRouter);
    });

    it('does NOT call server.run() when imported as a non-main module', () => {
      mockRun.mockClear();

      // When Jest requires the module, require.main !== module, so server.run()
      // must NOT be called at import time.
      freshRequireMain();

      expect(mockRun).not.toHaveBeenCalled();
    });

    it('imports the server instance from server/instance', () => {
      // If the mock weren't applied the module would throw; verifying mockUse
      // was called proves the correct server singleton was imported.
      mockUse.mockClear();
      freshRequireMain();
      expect(mockUse).toHaveBeenCalled();
    });

    it('imports bookRouter from resources/book so its routes are registered', () => {
      mockUse.mockClear();
      freshRequireMain();

      // The second argument passed to app.use should be the bookRouter mock,
      // proving the resource module was imported.
      expect(mockUse).toHaveBeenCalledWith('/', mockBookRouter);
    });
  });

  // ── Error / failure cases ────────────────────────────────────────────────

  describe('error cases', () => {
    it('throws (startup fails) when server/instance cannot be imported', () => {
      jest.resetModules();
      jest.mock('./server/instance', () => {
        throw new Error('Cannot find module server/instance');
      });
      jest.mock('./resources/book', () => ({ bookRouter: mockBookRouter }));

      expect(() => require('./main')).toThrow('Cannot find module server/instance');
    });

    it('throws (startup fails) when resources/book cannot be imported', () => {
      jest.resetModules();
      jest.mock('./server/instance', () => ({ server: mockServer }));
      jest.mock('./resources/book', () => {
        throw new Error('Cannot find module resources/book');
      });

      expect(() => require('./main')).toThrow('Cannot find module resources/book');
    });

    it('propagates error from server.run() when bootstrap() is called', () => {
      const runError = new Error('server.run() failed');
      mockRun.mockImplementationOnce(() => {
        throw runError;
      });

      const { bootstrap } = freshRequireMain();
      mockRun.mockClear();
      mockRun.mockImplementation(() => {
        throw runError;
      });

      expect(() => bootstrap()).toThrow('server.run() failed');
    });
  });

  // ── Invariants ───────────────────────────────────────────────────────────

  describe('invariants', () => {
    it('uses the same singleton server instance for route registration and running', () => {
      const { bootstrap } = freshRequireMain();
      mockUse.mockClear();
      mockRun.mockClear();

      bootstrap();

      // Both mockUse (route reg) and mockRun (start) belong to the same
      // mockServer object – verifying they share the same reference.
      expect(mockServer.app.use).toBe(mockUse);
      expect(mockServer.run).toBe(mockRun);
      expect(mockUse).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalled();
    });

    it('route registration completes before server starts listening', () => {
      const order: string[] = [];
      mockUse.mockImplementation(() => order.push('route-registered'));
      mockRun.mockImplementation(() => order.push('server-started'));

      const { bootstrap } = freshRequireMain();
      // Re-set implementations after module isolation
      mockUse.mockImplementation(() => order.push('route-registered'));
      mockRun.mockImplementation(() => order.push('server-started'));

      bootstrap();

      const routeIdx = order.lastIndexOf('route-registered');
      const runIdx = order.lastIndexOf('server-started');
      expect(routeIdx).toBeGreaterThanOrEqual(0);
      expect(runIdx).toBeGreaterThan(routeIdx);
    });
  });
});
```