import cors from 'cors';
import express from 'express';
import { env } from './config.js';
import gamesRouter from './routes/games.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_request, response) => {
  response.json({ status: 'ok', service: 'gaming-catalog-backend' });
});

app.use('/games', gamesRouter);

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : 'Error interno';
  response.status(500).json({ error: message });
});

app.listen(env.PORT, () => {
  console.log(`Gaming Catalog API listening on http://localhost:${env.PORT}`);
});
