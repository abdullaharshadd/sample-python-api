import 'dotenv/config';
import { server } from './src/server/instance';

server.run();

export default server.app;