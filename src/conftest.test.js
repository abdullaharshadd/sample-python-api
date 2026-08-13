```typescript
import { Application } from 'express';
import { getApp, createTestHarness, TestHarness } from './conftest';

// Mock the server instance so we control what server.app returns
jest.mock('./src/server/instance', () => {
  const mockApp = {
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    listen: jest.fn(),
    _isMockApp: true,
  };
  return {
    server: {
      app: mockApp,
    },
  };
});

describe('conftest helpers', () => {
  // Import the mocked server for reference comparisons
  let mockedServerApp: Application;

  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { server } = require('./src/server/instance');
    mockedServerApp = server.app;
  });

  describe('getApp()', () => {
    it('returns the application instance from server.app', () => {
      const app = getApp();
      expect(app).toBeDefined();
      expect(app).toBe(mockedServerApp);
    });

    it('always returns the same application instance (referential equality)', () => {
      const first = getApp();
      const second = getApp();
      expect(first).toBe(second);
    });

    it('does not modify the server or app state when called', () => {
      const appBefore = getApp();
      // Capture the keys/shape before
      const keysBefore = Object.keys(appBefore as object);

      getApp();

      const appAfter = getApp();
      const keysAfter = Object.keys(appAfter as object);

      expect(keysAfter).toEqual(keysBefore);
      expect(appBefore).toBe(appAfter);
    });

    it('returns the exact object referenced by server.app', () => {
      const app = getApp();
      // Verify it is the same reference as what was set up in the mock
      expect(app).toBe(mockedServerApp);
    });
  });

  describe('createTestHarness()', () => {
    it('returns a TestHarness object with an app property', () => {
      const harness: TestHarness = createTestHarness();
      expect(harness).toBeDefined();
      expect(harness).toHaveProperty('app');
    });

    it('harness.app is the same instance as server.app', () => {
      const harness = createTestHarness();
      expect(harness.app).toBe(mockedServerApp);
    });

    it('harness.app matches the value returned by getApp()', () => {
      const harness = createTestHarness();
      const app = getApp();
      expect(harness.app).toBe(app);
    });

    it('always returns the same application instance on repeated calls', () => {
      const harness1 = createTestHarness();
      const harness2 = createTestHarness();
      expect(harness1.app).toBe(harness2.app);
    });

    it('does not modify the server or app state when called', () => {
      const keysBefore = Object.keys(mockedServerApp as object);

      createTestHarness();
      createTestHarness();

      const keysAfter = Object.keys(mockedServerApp as object);
      expect(keysAfter).toEqual(keysBefore);
    });
  });

  describe('error cases', () => {
    it('raises an error if the server module cannot be imported', () => {
      // Simulate import failure by temporarily unmocking and using a bad path
      jest.resetModules();

      // Re-mock with a module that throws on access
      jest.doMock('./src/server/instance', () => {
        throw new Error('Cannot find module server/instance');
      });

      expect(() => {
        // Re-require conftest to trigger the fresh import
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./conftest');
      }).toThrow();

      // Restore mocks for subsequent tests
      jest.resetModules();
      jest.doMock('./src/server/instance', () => {
        const mockApp = {
          use: jest.fn(),
          get: jest.fn(),
          post: jest.fn(),
          listen: jest.fn(),
          _isMockApp: true,
        };
        return {
          server: {
            app: mockApp,
          },
        };
      });
    });

    it('raises an error if server.app is not accessible (server is undefined)', () => {
      jest.resetModules();

      jest.doMock('./src/server/instance', () => ({
        server: undefined,
      }));

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { getApp: freshGetApp } = require('./conftest');
        freshGetApp();
      }).toThrow();

      // Restore
      jest.resetModules();
    });
  });
});
```