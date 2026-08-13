```typescript
import { jest } from '@jest/globals';

// ── Mocks must be hoisted before any real imports ────────────────────────────

const mockStart = jest.fn<() => Promise<void>>();

jest.mock('./server/instance', () => ({
  server: {
    start: mockStart,
  },
}));

jest.mock('./environment/instance', () => ({
  environmentConfig: {
    port: 3000,
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Re-import `main` with a clean module registry so that each test gets a
 * fresh execution context.
 */
async function importMain(): Promise<{ main: () => Promise<void> }> {
  jest.resetModules();

  // Re-apply mocks after resetModules so the fresh registry picks them up.
  jest.mock('./server/instance', () => ({
    server: {
      start: mockStart,
    },
  }));

  jest.mock('./environment/instance', () => ({
    environmentConfig: {
      port: 3000,
    },
  }));

  return import('./main');
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('main (application entry point)', () => {
  let processExitSpy: jest.SpiedFunction<typeof process.exit>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    jest.clearAllMocks();

    processExitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((_code?: string | number | null | undefined) => {
        // prevent the test process from actually exiting
        return undefined as never;
      });

    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    processExitSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  // ── Successful startup ──────────────────────────────────────────────────

  describe('when main() is called directly', () => {
    it('calls server.start() with the configured port', async () => {
      mockStart.mockResolvedValueOnce(undefined);

      const { main } = await importMain();
      await main();

      expect(mockStart).toHaveBeenCalledTimes(1);
      expect(mockStart).toHaveBeenCalledWith(3000);
    });

    it('does not call process.exit when the server starts successfully', async () => {
      mockStart.mockResolvedValueOnce(undefined);

      const { main } = await importMain();
      await main();

      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('does not log any errors when the server starts successfully', async () => {
      mockStart.mockResolvedValueOnce(undefined);

      const { main } = await importMain();
      await main();

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  // ── Startup failure (port in use / bad config) ──────────────────────────

  describe('when server.start() throws an error', () => {
    it('logs the error to stderr', async () => {
      const startupError = new Error('listen EADDRINUSE :::3000');
      mockStart.mockRejectedValueOnce(startupError);

      const { main } = await importMain();
      await main();

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to start server:',
        startupError,
      );
    });

    it('calls process.exit(1) to fail fast', async () => {
      const startupError = new Error('listen EADDRINUSE :::3000');
      mockStart.mockRejectedValueOnce(startupError);

      const { main } = await importMain();
      await main();

      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('still calls process.exit(1) for non-Error rejections', async () => {
      mockStart.mockRejectedValueOnce('some string error');

      const { main } = await importMain();
      await main();

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── Module import vs direct execution ──────────────────────────────────

  describe('module guard (require.main === module)', () => {
    it('does NOT start the server automatically when imported as a module', async () => {
      // When `require.main !== module` (i.e. imported by tests), the
      // top-level `if (require.main === module)` guard prevents the auto-start.
      // Simply importing the module must not trigger server.start().
      mockStart.mockResolvedValue(undefined);

      await importMain();

      // main() should NOT have been called automatically
      expect(mockStart).not.toHaveBeenCalled();
    });

    it('exports the main function so callers can invoke it explicitly', async () => {
      const mod = await importMain();

      expect(typeof mod.main).toBe('function');
    });
  });

  // ── Invariants ──────────────────────────────────────────────────────────

  describe('invariants', () => {
    it('uses a single shared server instance (server.start is called on the mocked singleton)', async () => {
      mockStart.mockResolvedValueOnce(undefined);

      const { main } = await importMain();
      await main();

      // The mock is the same reference that the module resolves to,
      // confirming a shared singleton is used.
      expect(mockStart).toHaveBeenCalledTimes(1);
    });

    it('server.start is only called once per main() invocation', async () => {
      mockStart.mockResolvedValue(undefined);

      const { main } = await importMain();
      await main();

      expect(mockStart).toHaveBeenCalledTimes(1);
    });
  });
});
```