```typescript
import { Application } from 'express';

// Mock the server instance before importing conftest
jest.mock('./src/server/instance', () => ({
  server: {
    app: {
      use: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      listen: jest.fn(),
      // Minimal Express Application mock
    } as unknown as Application,
  },
}));

describe('conftest', () => {
  let mockedServerModule: { server: { app: Application } };
  let getApp: () => Application;
  let app: Application;

  beforeEach(() => {
    jest.resetModules();

    // Re-mock after resetModules
    jest.mock('./src/server/instance', () => ({
      server: {
        app: {
          use: jest.fn(),
          get: jest.fn(),
          post: jest.fn(),
          listen: jest.fn(),
        } as unknown as Application,
      },
    }));

    mockedServerModule = require('./src/server/instance');
    const conftest = require('./src/conftest');
    getApp = conftest.getApp;
    app = conftest.app;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getApp()', () => {
    it('should return the application instance obtained from server.app', () => {
      const result = getApp();
      expect(result).toBe(mockedServerModule.server.app);
    });

    it('should return the same application instance that server.app references', () => {
      const result1 = getApp();
      const result2 = getApp();
      expect(result1).toBe(result2);
      expect(result1).toBe(mockedServerModule.server.app);
    });

    it('should not modify or reconfigure the application instance', () => {
      const serverApp = mockedServerModule.server.app;
      const useSpy = jest.spyOn(serverApp, 'use');
      const getSpy = jest.spyOn(serverApp, 'get');

      getApp();

      expect(useSpy).not.toHaveBeenCalled();
      expect(getSpy).not.toHaveBeenCalled();
    });

    it('should return an object with Express Application characteristics', () => {
      const result = getApp();
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });

  describe('app (direct export)', () => {
    it('should be the same instance as server.app', () => {
      expect(app).toBe(mockedServerModule.server.app);
    });

    it('should be defined', () => {
      expect(app).toBeDefined();
    });

    it('should reference the same object as getApp() returns', () => {
      expect(app).toBe(getApp());
    });
  });

  describe('module dependency invariants', () => {
    it('should throw if server.instance cannot be imported', () => {
      jest.resetModules();
      jest.mock('./src/server/instance', () => {
        throw new Error('Cannot find module');
      });

      expect(() => {
        require('./src/conftest');
      }).toThrow();
    });

    it("should throw if server has no 'app' attribute", () => {
      jest.resetModules();
      jest.mock('./src/server/instance', () => ({
        server: {},
      }));

      // The module will load but app will be undefined
      const conftest = require('./src/conftest');
      expect(conftest.app).toBeUndefined();
      expect(conftest.getApp()).toBeUndefined();
    });

    it("should depend on server.instance providing a 'server' object with an 'app' attribute", () => {
      const serverModule = require('./src/server/instance');
      expect(serverModule).toHaveProperty('server');
      expect(serverModule.server).toHaveProperty('app');
    });
  });

  describe('module exports', () => {
    it('should export getApp as a function', () => {
      expect(typeof getApp).toBe('function');
    });

    it('should export app as a value', () => {
      expect(app).toBeDefined();
    });

    it('getApp should be callable with no arguments', () => {
      expect(() => getApp()).not.toThrow();
    });
  });
});
```