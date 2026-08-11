import 'dotenv/config';
import { server } from './src/server/instance';

server.run();

export default server.app;

Now I need to create the missing book router and environment config, and provide a .env file.





import 'dotenv/config';
import { server } from './src/server/instance';

server.run();

export default server.app;