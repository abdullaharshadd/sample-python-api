import express, { Application } from 'express';
import bodyParser from 'body-parser';
import { environmentConfig } from '../environment/instance';
import { bookRouter, bookRouteDefs } from '../resources/book';
import { mountSwagger } from '../swagger';
import { errorHandler } from '../../middleware/errorHandler';

But I don't know if `../resources/book` exports `bookRouter` and `bookRouteDefs`. Since the project structure has `src/src/resources/book.ts`, from `src/src/server/instance.ts` the path would be `../resources/book`.

import express, { Application } from 'express';
import bodyParser from 'body-parser';
import { environmentConfig } from '../environment/instance';
import { bookRouter, bookRouteDefs } from '../resources/book';
import { mountSwagger } from '../swagger';
import { errorHandler } from '../middleware/errorHandler';

I'll try importing from `../resources/book` and fix the errorHandler path too:

import express, { Application } from 'express';
import bodyParser from 'body-parser';
import { environmentConfig } from '../environment/instance';
import { bookRouter, bookRouteDefs } from '../resources/book';
import { mountSwagger } from '../swagger';
import { errorHandler } from '../middleware/errorHandler';

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