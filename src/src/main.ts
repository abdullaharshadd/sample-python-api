import { server } from './server/instance';
import { bookRouter } from './resources/book';

// MIGRATION_NOTE: The Python source (`main.py`) was the Flask application entry
// point. It relied on a side-effect wildcard import (`from resources.book import *`)
// to trigger the @api.route decorators that registered the book resource routes
// on the shared server singleton. Node/TypeScript does not register routes via
// import side-effects the same way, so instead we explicitly mount the migrated
// `bookRouter` (from src/resources/book.ts) onto the server's Express app.
//
// The Python `if __name__ == '__main__': server.run()` idiom is replaced by the
// standard Node entry-point check `require.main === module`, so importing this
// module (e.g. from tests) does not start the HTTP listener.

/**
 * Wires all resource routers onto the shared server's Express application.
 * Kept explicit (no import side-effects) so route registration is deterministic
 * and testable.
 */
export function registerRoutes(): void {
  server.app.use('/', bookRouter);
}

/**
 * Bootstraps the application: registers routes, then starts the HTTP server.
 */
export function bootstrap(): void {
  registerRoutes();
  server.run();
}

// Ensure routes are mounted whenever this module is imported (mirrors the
// source's side-effect resource import), but only start listening when run
// directly as the process entry point.
registerRoutes();

if (require.main === module) {
  server.run();
}
