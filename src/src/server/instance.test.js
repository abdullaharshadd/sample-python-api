```typescript
import request from 'supertest';
import express, { Application } from 'express';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock environmentConfig before importing the module under test
const mockEnvironmentConfig = {
  swaggerUrl: '/api/docs',
  debug: false,
  port: 3000,
};

jest.mock('../environment/instance', () => ({
  environmentConfig: mockEnvironmentConfig,
}));

jest.mock('../../middleware/errorHandler', () => ({
  errorHandler: (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    res.status(500).json({ error: 'Internal server error' });
  },
}));

jest.mock('swagger-ui-express', () => ({
  serve: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  setup: jest.fn(() => (_req: express.Request, res: express.Response) => {
    res.status(200).send('<html>Swagger UI</html>');
  }),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import { Server, server } from './instance';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildServer(config: Partial<typeof mockEnvironmentConfig> = {}): Server {
  // Mutate the shared mock object so the already-required module picks up changes.
  Object.assign(mockEnvironmentConfig, config);
  // Re-instantiate to pick up the mutated config.
  return new Server();
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Server class', () => {
  beforeEach(() => {
    // Reset to defaults before each test
    mockEnvironmentConfig.swaggerUrl = '/api/docs';
    mockEnvironmentConfig.debug = false;
    mockEnvironmentConfig.port = 3000;
  });

  // ── Constructor ────────────────────────────────────────────────────────────

  describe('constructor / __init__', () => {
    it('creates an instance with an app attribute holding an Express application', () => {
      const s = new Server();
      expect(s.app).toBeDefined();
      expect(typeof s.app).toBe('function'); // Express app is a function
    });

    it('the app attribute is always a valid Express application', () => {
      const s = new Server();
      // Express apps expose .use, .get, .listen, etc.
      expect(typeof s.app.use).toBe('function');
      expect(typeof s.app.listen).toBe('function');
      expect(typeof s.app.get).toBe('function');
    });

    it('mounts Swagger UI at the configured swaggerUrl when swaggerUrl is provided', async () => {
      mockEnvironmentConfig.swaggerUrl = '/api/docs';
      const s = new Server();

      const res = await request(s.app).get('/api/docs');
      // Swagger UI serve middleware passes through; setup handler responds
      expect(res.status).toBe(200);
    });

    it('does not mount Swagger UI when swaggerUrl is null', async () => {
      (mockEnvironmentConfig as any).swaggerUrl = null;
      const s = new Server();

      const res = await request(s.app).get('/api/docs');
      expect(res.status).toBe(404);
    });

    it('does not mount Swagger UI when swaggerUrl is an empty string (falsy)', async () => {
      (mockEnvironmentConfig as any).swaggerUrl = '';
      const s = new Server();

      const res = await request(s.app).get('/api/docs');
      expect(res.status).toBe(404);
    });

    it('mounts Swagger UI at a custom path', async () => {
      mockEnvironmentConfig.swaggerUrl = '/docs';
      const s = new Server();

      const res = await request(s.app).get('/docs');
      expect(res.status).toBe(200);
    });

    it('parses JSON request bodies', async () => {
      const s = new Server();
      // Add a simple test route to echo back the body
      s.app.post('/echo', (req, res) => {
        res.json(req.body);
      });

      const res = await request(s.app)
        .post('/echo')
        .send({ key: 'value' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ key: 'value' });
    });

    it('returns 400 with "Invalid JSON payload" for malformed JSON bodies', async () => {
      const s = new Server();
      s.app.post('/echo', (req, res) => {
        res.json(req.body);
      });

      const res = await request(s.app)
        .post('/echo')
        .send('{ invalid json }')
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid JSON payload' });
    });

    it('passes non-JSON-parse errors to the shared errorHandler (returns 500)', async () => {
      const s = new Server();
      s.app.get('/boom', (_req, _res, next) => {
        const err = new Error('Something went wrong');
        next(err);
      });

      const res = await request(s.app).get('/boom');
      expect(res.status).toBe(500);
    });

    it('the swagger document has the correct metadata', () => {
      // Access the swaggerDocument indirectly by verifying setup was called
      // with an object containing the right openapi fields.
      const swaggerUi = require('swagger-ui-express');
      const setupMock = swaggerUi.setup as jest.Mock;

      // setup should have been called at least once (from prior instantiations)
      const calls = setupMock.mock.calls;
      const lastCall = calls[calls.length - 1];
      const doc = lastCall[0];

      expect(doc.openapi).toBe('3.0.0');
      expect(doc.info.version).toBe('1.0');
      expect(doc.info.title).toBe('Sample Book API');
      expect(doc.info.description).toBe('A simple Book API');
    });
  });

  // ── run() ──────────────────────────────────────────────────────────────────

  describe('run()', () => {
    let listenSpy: jest.SpyInstance;
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      listenSpy?.mockRestore();
      consoleSpy.mockRestore();
    });

    it('calls app.listen with the port from environmentConfig', () => {
      mockEnvironmentConfig.port = 3000;
      const s = new Server();

      listenSpy = jest
        .spyOn(s.app, 'listen')
        .mockImplementation((_port: any, cb?: any) => {
          if (typeof cb === 'function') cb();
          return {} as any;
        });

      s.run();

      expect(listenSpy).toHaveBeenCalledWith(3000, expect.any(Function));
    });

    it('logs server start message with the correct port', () => {
      mockEnvironmentConfig.port = 4000;
      const s = new Server();

      listenSpy = jest
        .spyOn(s.app, 'listen')
        .mockImplementation((_port: any, cb?: any) => {
          if (typeof cb === 'function') cb();
          return {} as any;
        });

      s.run();

      expect(consoleSpy).toHaveBeenCalledWith(
        `Server listening on port ${4000}`
      );
    });

    it('logs debug mode message when debug is true', () => {
      mockEnvironmentConfig.debug = true;
      const s = new Server();

      listenSpy = jest
        .spyOn(s.app, 'listen')
        .mockImplementation((_port: any, cb?: any) => {
          if (typeof cb === 'function') cb();
          return {} as any;
        });

      s.run();

      expect(consoleSpy).toHaveBeenCalledWith('Starting server in debug mode');
    });

    it('does not log debug mode message when debug is false', () => {
      mockEnvironmentConfig.debug = false;
      const s = new Server();

      listenSpy = jest
        .spyOn(s.app, 'listen')
        .mockImplementation((_port: any, cb?: any) => {
          if (typeof cb === 'function') cb();
          return {} as any;
        });

      s.run();

      expect(consoleSpy).not.toHaveBeenCalledWith('Starting server in debug mode');
    });

    it('always runs on the port specified in environmentConfig', () => {
      mockEnvironmentConfig.port = 8080;
      const s = new Server();

      listenSpy = jest
        .spyOn(s.app, 'listen')
        .mockImplementation((_port: any, cb?: any) => {
          if (typeof cb === 'function') cb();
          return {} as any;
        });

      s.run();

      expect(listenSpy).toHaveBeenCalledWith(8080, expect.any(Function));
    });

    it('debug mode matches environmentConfig.debug when true', () => {
      mockEnvironmentConfig.debug = true;
      const s = new Server();

      listenSpy = jest
        .spyOn(s.app, 'listen')
        .mockImplementation(() => ({} as any));

      s.run();

      expect(consoleSpy).toHaveBeenCalledWith('Starting server in debug mode');
    });

    it('debug mode matches environmentConfig.debug when false', () => {
      mockEnvironmentConfig.debug = false;
      const s = new Server();

      listenSpy = jest
        .spyOn(s.app, 'listen')
        .mockImplementation(() => ({} as any));

      s.run();

      expect(consoleSpy).not.toHaveBeenCalledWith('Starting server in debug mode');
    });
  });

  // ── JSON parse error handler ───────────────────────────────────────────────

  describe('JSON parse error middleware', () => {
    it('returns 400 with "Invalid JSON payload" when type is entity.parse.failed', async () => {
      const s = new Server();
      s.app.post('/test', (req, res) => {
        res.json(req.body);
      });

      const res = await request(s.app)
        .post('/test')
        .set('Content-Type', 'application/json')
        .send('{"unclosed": ');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid JSON payload');
    });

    it('forwards non-parse errors to the next error handler', async () => {
      const s = new Server();
      s.app.get('/error', (_req, _res, next) => {
        const err: any = new Error('Some other error');
        err.type = 'some.other.type';
        next(err);
      });

      const res = await request(s.app).get('/error');
      expect(res.status).toBe(500);
    });
  });
});

// ─── Module-level singleton ───────────────────────────────────────────────────

describe('module-level singleton', () => {
  it("exports a 'server' singleton of type Server", () => {
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(Server);
  });

  it("the singleton 'server' exposes an 'app' attribute after import", () => {
    expect(server.app).toBeDefined();
    expect(typeof server.app.use).toBe('function');
  });

  it("the singleton's app is a valid Express application", () => {
    expect(typeof server.app).toBe('function');
    expect(typeof server.app.listen).toBe('function');
  });

  it('the singleton is created once at import time (referential equality)', async () => {
    const { server: importedAgain } = await import('./instance');
    expect(importedAgain).toBe(server);
  });
});
```