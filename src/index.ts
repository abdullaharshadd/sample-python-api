import 'dotenv/config';
import { server } from './src/server/instance';

try {
  server.run();
} catch (err) {
  console.error('Server failed to start:', err);
}

export default server.app;