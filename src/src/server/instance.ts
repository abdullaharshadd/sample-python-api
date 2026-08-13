import express, { Application } from 'express';
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

    this.app.use('/', bookRouter);

    if (environmentConfig.swaggerUrl) {
      mountSwagger(this.app, environmentConfig.swaggerUrl, bookRouteDefs, {
        version: '1.0',
        title: 'Sample Book API',
        description: 'A simple Book API',
      });
    }

    this.app.use(errorHandler);
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