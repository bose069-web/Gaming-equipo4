import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

interface Game {
  id: string;
  name: string;
  rating: number | null;
  released: string | null;
  background_image: string | null;
  platforms: string[];
}

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function loadGames(): Promise<Game[]> {
  const response = await fetch(`${apiUrl}/games?limit=12`);
  if (!response.ok) throw new Error('No se pudo cargar el catalogo');
  const payload = (await response.json()) as { data: Game[] };
  return payload.data;
}

function App() {
  return (
    <main className="shell">
      <header className="header">
        <p className="eyebrow">GAMING CATALOG</p>
        <h1>Tu biblioteca, bajo tu control.</h1>
        <p className="intro">Explora el catalogo local alimentado desde Firestore.</p>
      </header>
      <Catalog />
    </main>
  );
}

function Catalog() {
  const [games, setGames] = useState<Game[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    loadGames().then(setGames).catch((reason: Error) => setError(reason.message));
  }, []);

  if (error) return <p className="status error">{error}</p>;
  if (!games.length) return <p className="status">Cargando juegos...</p>;

  return (
    <section className="catalog" aria-label="Catalogo de juegos">
      {games.map((game) => (
        <article className="game" key={game.id}>
          {game.background_image && <img src={game.background_image} alt="" />}
          <div className="game-body">
            <h2>{game.name}</h2>
            <p>{game.released ?? 'Fecha desconocida'}</p>
            <strong>{game.rating?.toFixed(1) ?? 'Sin rating'}</strong>
          </div>
        </article>
      ))}
    </section>
  );
}

import { useEffect, useState } from 'react';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
