import { Router } from 'express';
import { z } from 'zod';
import { findGameById, findTopRatedGames, listGames } from '../repositories/gameRepository.js';

const router = Router();
const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().trim().min(1).optional()
});

router.get('/', async (request, response, next) => {
  try {
    const query = listQuery.parse(request.query);
    response.json({ data: await listGames(query), meta: query });
  } catch (error) {
    next(error);
  }
});

router.get('/top-rated', async (request, response, next) => {
  try {
    const limit = z.coerce.number().int().min(1).max(100).default(10).parse(request.query.limit);
    response.json({ data: await findTopRatedGames(limit) });
  } catch (error) {
    next(error);
  }
});

router.get('/search', async (request, response, next) => {
  try {
    const query = listQuery.extend({ search: z.string().trim().min(1) }).parse(request.query);
    response.json({ data: await listGames(query), meta: query });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (request, response, next) => {
  try {
    const game = await findGameById(request.params.id);
    if (!game) {
      response.status(404).json({ error: 'Juego no encontrado' });
      return;
    }
    response.json({ data: game });
  } catch (error) {
    next(error);
  }
});

export default router;
