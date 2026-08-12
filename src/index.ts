import 'dotenv/config';
import { server } from './src/server/instance';
import { registerRoutes } from './src/main';

registerRoutes();
server.run();

export default server.app;
