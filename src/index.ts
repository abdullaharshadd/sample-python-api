import 'dotenv/config';
import express from 'express';
import { errorHandler } from './middleware/errorHandler';
import { bookRouter } from './src/resources/book';

const app = express();
app.use(express.json());

app.use('/', bookRouter);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
