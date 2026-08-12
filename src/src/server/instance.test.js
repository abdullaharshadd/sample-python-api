```typescript
import request from 'supertest';
import express, { Application, Request, Response, NextFunction } from 'express';

// ─── Mocks declared before any imports that trigger module execution ───────────

// Mock environmentConfig
const mockEnvironmentConfig = {
  swaggerUrl: '/api/docs',
  port: 3000,
  debug: false,
};

jest.mock('../environment/instance', () => ({
  environmentConfig: mockEnvironmentConfig,
}));

// Mock bookRouter and bookRouteDefs
jest.mock('../routes/book', () => ({
  bookRouter: (() => {
    const router = require('express').Router();
    router.get('/health', (_req: Request, res: Response) => res.status(200).json({ status: 'ok' }));
    return router;
  })(),
  bookRouteDefs: [
    { method: 'get', path: '/books', summary: 'List books' },
    { method: 'post', path: '/books', summary: 'Create book' },
    { method: 'get', path: '/books/:id', summary: 'Get book' },
    { method: 'put', path: '/books/:id', summary: 'Update book' },
    { method: 'delete', path: '/books/:id', summary: 'Delete book' },
  ],
}));

// Mock mountSwagger
const mockMountSwagger = jest.fn();
jest.mock('../swagger', () => ({
  mountSwagger: (...args: unknown[]) => mockMountSwagger(...args),
}));

// Mock errorHandler
const mockErrorHandler = jest.fn(
  (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: err.message });
  }
);
jest.mock('../../middleware/errorHandler', () => ({
  errorHandler: (err: Error, req: Request, res: Response, next: NextFunction) =>
    mockErrorHandler(err, req, res, next),
}));

// ─── Import after mocks ────────────────────────────────────────────────────────

import { Server, server } from './instance';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resetModuleConfig(overrides: Partial<typeof mockEnvironmentConfig>) {
  Object.assign(mockEnvironmentConfig, {
    swaggerUrl: '/api/docs',
    port: 3000,
    debug: false,
    ...overrides,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Server', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // restore defaults
    resetModuleConfig({});
  });

  // ── Module-level singleton ─────────────────────────────────────────────────

  describe('module-level singleton', () => {
    it('exports a singleton "server" instance at import time', () => {
      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(Server);
    });

    it('singleton has an "app" attribute that is an Express application', () => {
      expect(server.app).toBeDefined();
      // Express apps expose a function with a "listen" method
      expect(typeof server.app).toBe('function');
      expect(typeof server.app.listen).toBe('function');
    });
  });

  // ── Server constructor ─────────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates a Server instance with an "app" property', () => {
      const s = new Server();
      expect(s).toBeInstanceOf(Server);
      expect(s.app).toBeDefined();
    });

    it('app is an Express Application (has listen, use, get methods)', () => {
      const s = new Server();
      expect(typeof s.app.listen).toBe('function');
      expect(typeof s.app.use).toBe('function');
      expect(typeof s.app.get).toBe('function');
    });

    it('parses JSON request bodies', async () => {
      const s = new Server();
      // Add a test route that echoes the parsed body
      s.app.post('/echo', (req: Request, res: Response) => {
        res.status(200).json(req.body);
      });

      const payload = { title: 'Test Book', author: 'Jane Doe' };
      const response = await request(s.app)
        .post('/echo')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(payload));

      expect(response.status).toBe(200);
      expect(response.body).toEqual(payload);
    });

    it('parses URL-encoded request bodies', async () => {
      const s = new Server();
      s.app.post('/form', (req: Request, res: Response) => {
        res.status(200).json(req.body);
      });

      const response = await request(s.app)
        .post('/form')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('name=Book&author=Author');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ name: 'Book', author: 'Author' });
    });

    it('mounts the bookRouter at "/"', async () => {
      const s = new Server();
      const response = await request(s.app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });

    it('mounts Swagger when swaggerUrl is configured', () => {
      resetModuleConfig({ swaggerUrl: '/api/docs' });
      new Server();
      expect(mockMountSwagger).toHaveBeenCalledTimes(1);
    });

    it('calls mountSwagger with correct arguments', () => {
      const { bookRouteDefs } = require('../routes/book');
      resetModuleConfig({ swaggerUrl: '/api/docs' });
      const s = new Server();

      expect(mockMountSwagger).toHaveBeenCalledWith(
        s.app,
        '/api/docs',
        bookRouteDefs,
        {
          version: '1.0',
          title: 'Sample Book API',
          description: 'A simple Book API',
        }
      );
    });

    it('passes API metadata with version "1.0"', () => {
      new Server();
      const callArgs = mockMountSwagger.mock.calls[0];
      expect(callArgs[3]).toMatchObject({ version: '1.0' });
    });

    it('passes API metadata with title "Sample Book API"', () => {
      new Server();
      const callArgs = mockMountSwagger.mock.calls[0];
      expect(callArgs[3]).toMatchObject({ title: 'Sample Book API' });
    });

    it('passes API metadata with description "A simple Book API"', () => {
      new Server();
      const callArgs = mockMountSwagger.mock.calls[0];
      expect(callArgs[3]).toMatchObject({ description: 'A simple Book API' });
    });

    it('passes swaggerUrl from environmentConfig to mountSwagger', () => {
      resetModuleConfig({ swaggerUrl: '/custom-docs' });
      new Server();
      const callArgs = mockMountSwagger.mock.calls[0];
      expect(callArgs[1]).toBe('/custom-docs');
    });

    it('does NOT mount Swagger when swaggerUrl is falsy (empty string)', () => {
      resetModuleConfig({ swaggerUrl: '' });
      new Server();
      expect(mockMountSwagger).not.toHaveBeenCalled();
    });

    it('does NOT mount Swagger when swaggerUrl is null', () => {
      (mockEnvironmentConfig as any).swaggerUrl = null;
      new Server();
      expect(mockMountSwagger).not.toHaveBeenCalled();
    });

    it('does NOT mount Swagger when swaggerUrl is undefined', () => {
      (mockEnvironmentConfig as any).swaggerUrl = undefined;
      new Server();
      expect(mockMountSwagger).not.toHaveBeenCalled();
    });

    it('registers the centralized error handler', async () => {
      const s = new Server();
      // Add a route that throws
      s.app.get('/throw', (_req: Request, _res: Response, next: NextFunction) => {
        next(new Error('test error'));
      });

      const response = await request(s.app).get('/throw');
      expect(mockErrorHandler).toHaveBeenCalled();
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'test error' });
    });
  });

  // ── Server.run ─────────────────────────────────────────────────────────────

  describe('run()', () => {
    let listenMock: jest.SpyInstance;
    let consoleSpy: jest.SpyInstance;
    let mockListenServer: { close: jest.Mock };

    beforeEach(() => {
      mockListenServer = { close: jest.fn() };
      consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      listenMock = jest
        .spyOn(express.application, 'listen')
        .mockImplementation((_port: any, callback?: any) => {
          if (typeof callback === 'function') {
            callback();
          }
          return mockListenServer as any;
        });
    });

    afterEach(() => {
      listenMock.mockRestore();
      consoleSpy.mockRestore();
    });

    it('calls app.listen with the configured port', () => {
      resetModuleConfig({ port: 4000 });
      const s = new Server();
      s.run();
      expect(listenMock).toHaveBeenCalledWith(4000, expect.any(Function));
    });

    it('uses port from environmentConfig', () => {
      resetModuleConfig({ port: 8080 });
      const s = new Server();
      s.run();
      expect(listenMock).toHaveBeenCalledWith(8080, expect.any(Function));
    });

    it('logs a message including the port when the server starts', () => {
      resetModuleConfig({ port: 3000, debug: false });
      const s = new Server();
      s.run();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('3000')
      );
    });

    it('logs "(debug)" when debug is true', () => {
      resetModuleConfig({ port: 3000, debug: true });
      const s = new Server();
      s.run();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('(debug)')
      );
    });

    it('does NOT log "(debug)" when debug is false', () => {
      resetModuleConfig({ port: 3000, debug: false });
      const s = new Server();
      s.run();
      const logCall = consoleSpy.mock.calls[0][0] as string;
      expect(logCall).not.toContain('(debug)');
    });

    it('returns void (undefined)', () => {
      const s = new Server();
      const result = s.run();
      expect(result).toBeUndefined();
    });
  });

  // ── Invariants ─────────────────────────────────────────────────────────────

  describe('invariants', () => {
    it('every new Server() instance has its own Express app', () => {
      const s1 = new Server();
      const s2 = new Server();
      expect(s1.app).not.toBe(s2.app);
    });

    it('bookRouteDefs contains all five endpoint definitions', () => {
      const { bookRouteDefs } = require('../routes/book');
      expect(bookRouteDefs).toHaveLength(5);
    });

    it('app property is always set after construction', () => {
      const s = new Server();
      expect(s.app).toBeTruthy();
    });
  });
});
```