import { StrictMode, useEffect, useMemo, useState } from 'react';
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
  const response = await fetch(`${apiUrl}/games?limit=5000`);
  if (!response.ok) throw new Error('No se pudo cargar el catalogo');
  const payload = (await response.json()) as { data: Game[] };
  return payload.data;
}

function App() {
  return (
    <div className="site-shell">
      <Navigation />
      <main>
        <Hero />
        <Library />
        <section className="about-section" id="about">
          <div>
            <p className="eyebrow">UNA BASE, MIL HISTORIAS</p>
            <h2>Todo tu archivo de juegos, ordenado para descubrirlo.</h2>
          </div>
          <p className="about-copy">Una biblioteca nacida de RAWG, normalizada en Firestore y lista para explorar desde una sola interfaz. Busca por nombre, filtra por plataforma y deja que tu curiosidad marque el siguiente juego.</p>
        </section>
      </main>
      <footer><span>GAMING CATALOG</span><span>Firestore / RAWG / 2026</span></footer>
    </div>
  );
}

function Navigation() {
  return (
    <nav className="navigation" aria-label="Navegacion principal">
      <a className="brand" href="#top">GC<span>.</span></a>
      <div className="nav-links">
        <a href="#library">Biblioteca</a>
        <a href="#about">El proyecto</a>
      </div>
      <a className="nav-action" href="#library">Explorar <span aria-hidden="true">↘</span></a>
    </nav>
  );
}

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <p className="eyebrow">CATALOGO DIGITAL / 001</p>
        <h1>Juega.<br /><em>Descubre.</em><br />Repite.</h1>
        <p className="hero-intro">Una biblioteca viva de videojuegos para perderse un rato y encontrar algo nuevo.</p>
        <a className="hero-link" href="#library">Entrar en la biblioteca <span aria-hidden="true">↓</span></a>
      </div>
      <div className="hero-art" aria-label="Coleccion de videojuegos">
        <div className="hero-card hero-card-back"><span>RPG</span><strong>03</strong></div>
        <div className="hero-card hero-card-main"><div className="card-grid"></div><span>CURATED<br />PLAY</span><strong>24</strong></div>
        <div className="hero-note">+ 5.000<br />titulos<br />indexados</div>
      </div>
    </section>
  );
}

function Library() {
  const [games, setGames] = useState<Game[]>([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('all');
  const [rating, setRating] = useState('all');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);
  const gamesPerPage = 20;

  useEffect(() => {
    loadGames().then(setGames).catch((reason: Error) => setError(reason.message));
  }, []);

  const platforms = useMemo(() => Array.from(new Set(games.flatMap((game) => game.platforms))).sort(), [games]);
  const filteredGames = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();
    const result = games.filter((game) => {
      const matchesSearch = !normalizedSearch || game.name.toLowerCase().includes(normalizedSearch);
      const matchesPlatform = platform === 'all' || game.platforms.includes(platform);
      const matchesRating = rating === 'all' || (game.rating ?? 0) >= Number(rating);
      return matchesSearch && matchesPlatform && matchesRating;
    });
    return result.sort((first, second) => {
      if (sort === 'rating') return (second.rating ?? -1) - (first.rating ?? -1);
      if (sort === 'newest') return (second.released ?? '').localeCompare(first.released ?? '');
      if (sort === 'oldest') return (first.released ?? '').localeCompare(second.released ?? '');
      return first.name.localeCompare(second.name);
    });
  }, [games, platform, rating, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredGames.length / gamesPerPage));
  const visibleGames = filteredGames.slice((page - 1) * gamesPerPage, page * gamesPerPage);
  const goToPage = (nextPage: number) => setPage(Math.min(Math.max(nextPage, 1), totalPages));

  return (
    <section className="library-section" id="library">
      <div className="section-heading">
        <div><p className="eyebrow">01 / BIBLIOTECA</p><h2>Encuentra tu<br /><em>siguiente partida.</em></h2></div>
        <p className="section-description">{games.length ? `${games.length.toLocaleString('es-ES')} juegos en el archivo` : 'Conectando con tu archivo'}</p>
      </div>
      <div className="library-tools">
        <label className="search-field"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar por nombre..." aria-label="Buscar por nombre" /></label>
        <select value={platform} onChange={(event) => { setPlatform(event.target.value); setPage(1); }} aria-label="Filtrar por plataforma"><option value="all">Todas las plataformas</option>{platforms.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <select value={rating} onChange={(event) => { setRating(event.target.value); setPage(1); }} aria-label="Filtrar por rating"><option value="all">Cualquier rating</option><option value="4">4.0 o más</option><option value="3">3.0 o más</option><option value="2">2.0 o más</option></select>
        <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} aria-label="Ordenar biblioteca"><option value="name">Nombre A-Z</option><option value="rating">Mejor valorados</option><option value="newest">Más recientes</option><option value="oldest">Más antiguos</option></select>
      </div>
      {error ? <p className="status error">{error}. Comprueba que la API esté activa.</p> : !games.length ? <p className="status">Cargando biblioteca...</p> : <>
        <div className="library-meta"><span>{filteredGames.length.toLocaleString('es-ES')} resultados</span><span>Página {page} de {totalPages}</span></div>
        <div className="catalog" aria-label="Catalogo de juegos">{visibleGames.map((game) => <GameCard game={game} key={game.id} />)}</div>
        <div className="pagination"><button onClick={() => goToPage(page - 1)} disabled={page === 1} aria-label="Página anterior">←</button><span>{String(page).padStart(2, '0')} <small>/ {String(totalPages).padStart(2, '0')}</small></span><button onClick={() => goToPage(page + 1)} disabled={page === totalPages} aria-label="Página siguiente">→</button></div>
      </>}
    </section>
  );
}

function GameCard({ game }: { game: Game }) {
  return (
    <article className="game">
      <div className="game-image">{game.background_image ? <img src={game.background_image} alt={`Portada de ${game.name}`} loading="lazy" /> : <div className="no-image">SIN PORTADA</div>}<span className="game-id">#{game.id}</span><div className="game-hover"><span>Ver ficha</span><span aria-hidden="true">↗</span></div></div>
      <div className="game-body"><div><h3>{game.name}</h3><p>{game.released ?? 'Fecha desconocida'}</p></div><strong>{game.rating?.toFixed(1) ?? '—'}</strong></div>
      <div className="platform-list">{game.platforms.slice(0, 3).map((item) => <span key={item}>{item}</span>)}</div>
    </article>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
