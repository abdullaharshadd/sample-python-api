import express, { Application } from 'express';
import bodyParser from 'body-parser';
import { environmentConfig } from '../environment/instance';
import { bookRouter, bookRouteDefs } from '../routes/book';
import { mountSwagger } from '../swagger';
import { errorHandler } from '../../middleware/errorHandler';

/**
 * Application server wrapper.
 *
 * MIGRATION_NOTE: The source used Flask + Flask-RESTPlus. Here we wire an
 * Express application:
 *   - body-parser (JSON) for request parsing
 *   - the book router mounted for the resource endpoints
 *   - Swagger UI mounted from `bookRouteDefs` (all five endpoints), gated on
 *     `environmentConfig.swaggerUrl` (equivalent to Flask-RESTPlus `doc`)
 *   - the centralized error handler
 *
 * The Flask-RESTPlus `Api(version, title, description, doc)` metadata is
 * expressed through the swagger definition (title/description/version) and
 * the swagger mount URL.
 */
export class Server {
  public readonly app: Application;

  constructor() {
    this.app = express();

    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: true }));

    // Mount the resource routes.
    this.app.use('/', bookRouter);

    // Mount Swagger UI when a swagger URL is configured (mirrors Flask-RESTPlus `doc`).
    if (environmentConfig.swaggerUrl) {
      mountSwagger(this.app, environmentConfig.swaggerUrl, bookRouteDefs, {
        version: '1.0',
        title: 'Sample Book API',
        description: 'A simple Book API',
      });
    }

    // Centralized error handling must be registered last.
    this.app.use(errorHandler);
  }

  public run(): void {
    const { port } = environmentConfig;
    this.app.listen(port, () => {
      // MIGRATION_NOTE: Flask's `debug` flag has no direct Express equivalent.
      // Debug behaviour (verbose logging / reloading) is handled by the
      // process/tooling layer rather than the app instance.
      // eslint-disable-next-line no-console
      console.log(
        `Server listening on port ${port}${
          environmentConfig.debug ? ' (debug)' : ''
        }`
      );
    });
  }
}

export const server = new Server();
