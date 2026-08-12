import 'dotenv/config';
import { server } from './src/server/instance';
import { environmentConfig } from './src/environment/instance';

server.app.listen(environmentConfig.port, () => {
  console.log(
    `Server listening on port ${environmentConfig.port}${
      environmentConfig.debug ? ' (debug)' : ''
    }`
  );
});

export default server.app;
