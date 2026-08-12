import { server } from './server/instance';
import { environmentConfig } from './environment/instance';

/**
 * Application entry point.
 *
 * MIGRATION_NOTE: The source `main.py` used a wildcard import
 * (`from resources.book import *`) purely for its side effect of registering
 * the book routes onto the Flask server before calling `server.run()`.
 *
 * In this project route registration is not a module-import side effect.
 * Routes are mounted explicitly by the `Server` instance (see
 * `src/src/server/instance.ts`), so there is no need to import the book
 * resource here just to trigger registration. Importing `server` and calling
 * `server.start()` is sufficient and is the idiomatic Express equivalent of
 * the Python `if __name__ == '__main__': server.run()` main guard.
 */

async function main(): Promise<void> {
  try {
    await server.start(environmentConfig.port);
  } catch (err) {
    // Fail fast on startup errors (port in use, bad config, etc.).
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// MIGRATION_NOTE: Equivalent of Python's `if __name__ == '__main__':` guard.
// `require.main === module` is true only when this file is run directly
// (e.g. `node dist/src/main.js`), not when it is imported by tests.
if (require.main === module) {
  void main();
}

export { main };
