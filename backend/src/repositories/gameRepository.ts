import { getDatabase } from '../firebase.js';
import type { Game, GameQuery } from '../types/game.js';

const collectionName = 'games';

function toGame(id: string, data: FirebaseFirestore.DocumentData): Game {
  return {
    id,
    name: String(data.name ?? ''),
    rating: typeof data.rating === 'number' ? data.rating : null,
    released: typeof data.released === 'string' ? data.released : null,
    background_image: typeof data.background_image === 'string' ? data.background_image : null,
    platforms: Array.isArray(data.platforms) ? data.platforms.map(String) : []
  };
}

export async function listGames(query: GameQuery): Promise<Game[]> {
  const snapshot = await getDatabase().collection(collectionName).orderBy('name').offset(query.offset).limit(query.limit).get();
  const games = snapshot.docs.map((document) => toGame(document.id, document.data()));
  return query.search ? games.filter((game) => game.name.toLowerCase().includes(query.search!.toLowerCase())) : games;
}

export async function findGameById(id: string): Promise<Game | null> {
  const document = await getDatabase().collection(collectionName).doc(id).get();
  return document.exists ? toGame(document.id, document.data() ?? {}) : null;
}

export async function findTopRatedGames(limit: number): Promise<Game[]> {
  const snapshot = await getDatabase().collection(collectionName).orderBy('rating', 'desc').limit(limit).get();
  return snapshot.docs.map((document) => toGame(document.id, document.data()));
}
