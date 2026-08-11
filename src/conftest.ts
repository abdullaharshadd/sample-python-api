import { Application } from 'express';
import { server } from './src/server/instance';

// MIGRATION_NOTE: The Python source was a pytest `conftest.py` that exposed an
// `app` fixture returning `server.app` for reuse across tests. Jest has no
// direct `conftest.py` equivalent (there is no auto-discovered per-directory
// fixture file). The idiomatic replacement is a small helper module that tests
// import explicitly to obtain the Express application instance.
//
// Usage in a Jest + supertest test:
//   import request from 'supertest';
//   import { getApp } from '../conftest';
//   const app = getApp();
//   await request(app).get('/health').expect(200);

/**
 * Returns the shared Express application instance, mirroring the pytest
 * `app` fixture (`server.app`).
 */
export function getApp(): Application {
  return server.app;
}

// Convenience direct export for tests that prefer a value over a factory call.
export const app: Application = server.app;
