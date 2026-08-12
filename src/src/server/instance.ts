import express, { Application, Request, Response, NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import { errorHandler } from '../../middleware/errorHandler';
import { environmentConfig } from '../environment/instance';

// MIGRATION_NOTE: The Python source used Flask + Flask-RESTPlus's `Api` wrapper
// which auto-generates Swagger docs. There is no direct Express equivalent, so
// this uses `swagger-ui-express` to serve an OpenAPI document at the configured
// doc path (environmentConfig.swaggerUrl). Resource/route registration that
// Flask-RESTPlus did via decorators is done explicitly with express.Router in
// this codebase; mount those routers on `app` here as they are migrated.

// Minimal OpenAPI document mirroring the Flask-RESTPlus Api metadata.
const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    version: '1.0',
    title: 'Sample Book API',
    description: 'A simple Book API',
  },
  paths: {},
};

export class Server {
  public readonly app: Application;

  constructor() {
    this.app = express();
    this.app.use(express.json());

    // Mount Swagger UI at the configured doc path when one is provided.
    // In the source, `doc` may be false/None to disable docs; here `swaggerUrl`
    // being null disables the docs route.
    if (environmentConfig.swaggerUrl) {
      this.app.use(
        environmentConfig.swaggerUrl,
        swaggerUi.serve,
        swaggerUi.setup(swaggerDocument)
      );
    }

    // MIGRATION_NOTE: The migration notes specify mounting an error handler that
    // narrowly handles body-parser JSON parse failures (`entity.parse.failed`),
    // explicitly avoiding an over-broad `status === 400` match. This runs before
    // the shared errorHandler so genuine parse errors return a 400 with a
    // consistent JSON shape rather than a 500.
    this.app.use(
      (err: unknown, _req: Request, res: Response, next: NextFunction): void => {
        if (
          err !== null &&
          typeof err === 'object' &&
          'type' in err &&
          (err as { type?: unknown }).type === 'entity.parse.failed'
        ) {
          res.status(400).json({ error: 'Invalid JSON payload' });
          return;
        }
        next(err as Error);
      }
    );

    // Shared 500 error handler (imported from the already-migrated middleware).
    this.app.use(errorHandler);
  }

  public run(): void {
    // MIGRATION_NOTE: Flask's `debug` flag has no direct Express equivalent; it
    // is preserved via config but only affects logging here.
    if (environmentConfig.debug) {
      // eslint-disable-next-line no-console
      console.log('Starting server in debug mode');
    }

    this.app.listen(environmentConfig.port, () => {
      // eslint-disable-next-line no-console
      console.log(`Server listening on port ${environmentConfig.port}`);
    });
  }
}

// Module-level singleton, mirroring the source's `server = Server()`.
export const server = new Server();
