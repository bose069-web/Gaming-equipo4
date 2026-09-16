import { getDatabase } from '../firebase.js';
import type { Game, GameQuery } from '../types/game.js';

const collectionName = 'games';
const featuredPoolTtlMs = 1000 * 60 * 30;

let featuredPoolCache: { games: Game[]; fetchedAt: number } | null = null;

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

export async function searchGames(search: string, limit: number): Promise<Game[]> {
  const normalizedSearch = search.trim();
  const snapshot = await getDatabase()
    .collection(collectionName)
    .orderBy('name')
    .startAt(normalizedSearch)
    .endAt(`${normalizedSearch}\uf8ff`)
    .limit(limit)
    .get();
  return snapshot.docs.map((document) => toGame(document.id, document.data()));
}

export async function findTopRatedGames(limit: number): Promise<Game[]> {
  const snapshot = await getDatabase().collection(collectionName).orderBy('rating', 'desc').limit(limit).get();
  return snapshot.docs.map((document) => toGame(document.id, document.data()));
}

export async function findFeaturedGames(limit: number): Promise<Game[]> {
  const now = Date.now();
  if (!featuredPoolCache || now - featuredPoolCache.fetchedAt > featuredPoolTtlMs) {
    const snapshot = await getDatabase().collection(collectionName).orderBy('name').limit(20).get();
    featuredPoolCache = {
      games: snapshot.docs.map((document) => toGame(document.id, document.data())),
      fetchedAt: now
    };
  }

  const games = featuredPoolCache.games;

  if (games.length <= limit) {
    return games;
  }

  const shuffled = [...games];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled.slice(0, limit);
}
