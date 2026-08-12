import { Application } from 'express';
import { server } from './src/server/instance';

/**
 * Test harness helpers.
 *
 * MIGRATION_NOTE: The source `conftest.py` defined a pytest `app` fixture that
 * exposed `server.app` (the Flask application) to tests via auto-discovery.
 * Jest has no equivalent auto-discovered fixture mechanism, so this file
 * exports plain helper functions that tests import explicitly.
 *
 * MIGRATION_NOTE (from agent debate): tests were migrated from a bare
 * `makeClient()` to a paired `{ client, repo }` harness. `createTestHarness()`
 * below is the decided pattern that all tests in `book.test.ts` must follow.
 */

/**
 * Returns the underlying Express application instance for use with supertest.
 *
 * Mirrors the pytest `app` fixture which returned `server.app`.
 */
export function getApp(): Application {
  return server.app;
}

export interface TestHarness {
  /** The Express application, passed directly to supertest(app). */
  app: Application;
}

/**
 * Builds the shared test harness.
 *
 * MIGRATION_NOTE: The Python fixture only exposed the app. The `{ client, repo }`
 * pairing referenced in the migration notes is assembled per-test in
 * `book.test.ts` (client = supertest(harness.app); repo = the book repository).
 * Here we provide the app; tests wrap it with supertest and pair it with their
 * repository instance.
 */
export function createTestHarness(): TestHarness {
  return {
    app: server.app,
  };
}
