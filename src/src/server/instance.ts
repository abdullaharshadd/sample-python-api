import express, { Application, RequestHandler, ErrorRequestHandler } from 'express';
import bodyParser from 'body-parser';
import { environmentConfig } from '../environment/instance';
import { bookRouter, bookRouteDefs } from '../resources/book';
import { mountSwagger } from '../swagger';
import { errorHandler } from '../../middleware/errorHandler';

export class Server {
  public readonly app: Application;

  constructor() {
    this.app = express();

    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: true }));

    if (bookRouter) {
      this.app.use('/', bookRouter);
    }

    if (environmentConfig.swaggerUrl) {
      mountSwagger(this.app, environmentConfig.swaggerUrl, Array.isArray(bookRouteDefs) ? bookRouteDefs : [], {
        version: '1.0',
        title: 'Sample Book API',
        description: 'A simple Book API',
      });
    }

    if (errorHandler) {
      this.app.use(errorHandler as ErrorRequestHandler);
    }
  }

  public run(): void {
    const { port } = environmentConfig;
    this.app.listen(port, () => {
      console.log(
        `Server listening on port ${port}${
          environmentConfig.debug ? ' (debug)' : ''
        }`
      );
    });
  }
}

export const server = new Server();