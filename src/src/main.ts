import { server } from './server/instance';
import { bookRouter } from './resources/book';

/**
 * Wires all resource routers onto the shared server's Express application.
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

// Ensure routes are mounted whenever this module is imported.
try {
  registerRoutes();
} catch (err) {
  console.error('Failed to register routes:', err);
}

if (require.main === module) {
  try {
    server.run();
  } catch (err) {
    console.error('Server failed to start:', err);
  }
}