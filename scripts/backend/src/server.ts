import cors from 'cors';
import express from 'express';
import { getAuth } from 'firebase-admin/auth';
import { env } from './config.js';
import { getAdminApp } from './firebase.js';
import { findFeaturedGames } from './repositories/gameRepository.js';
import gamesRouter from './routes/games.js';

const app = express();
app.use(cors());
app.use(express.json());

async function requireVerifiedFirebaseUser(request: express.Request, response: express.Response, next: express.NextFunction) {
  const authorizationHeader = request.header('authorization');
  const token = authorizationHeader?.startsWith('Bearer ') ? authorizationHeader.slice(7) : '';

  if (!token) {
    response.status(401).json({ error: 'Debes iniciar sesión para ver la biblioteca' });
    return;
  }

  try {
    const decodedToken = await getAuth(getAdminApp()).verifyIdToken(token);
    if (!decodedToken.email_verified) {
      response.status(403).json({ error: 'Debes verificar tu correo antes de acceder a la biblioteca' });
      return;
    }

    next();
  } catch {
    response.status(401).json({ error: 'Sesión no válida. Vuelve a iniciar sesión' });
  }
}

app.get('/health', (_request, response) => {
  response.json({ status: 'ok', service: 'gaming-catalog-backend' });
});

app.get('/games/featured', async (request, response, next) => {
  try {
    const limit = Number(request.query.limit ?? 2);
    response.json({ data: await findFeaturedGames(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 2) : 2), meta: { limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 2) : 2 } });
  } catch (error) {
    next(error);
  }
});

app.use('/games', requireVerifiedFirebaseUser, gamesRouter);

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : 'Error interno';
  response.status(500).json({ error: message });
});

app.listen(env.PORT, () => {
  console.log(`Gaming Catalog API listening on http://localhost:${env.PORT}`);
});
