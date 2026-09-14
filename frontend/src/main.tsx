import { FormEvent, StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type AuthView = 'login' | 'signup' | 'forgot' | 'cookies';

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
  const response = await fetch(`${apiUrl}/games?limit=1000`);
  if (!response.ok) throw new Error('No se pudo cargar el catálogo');
  const payload = (await response.json()) as { data: Game[] };
  return payload.data;
}

function App() {
  const [page, setPage] = useState<'catalog' | 'auth'>('catalog');
  const [authView, setAuthView] = useState<AuthView>('login');

  useEffect(() => {
    const syncPageFromHash = () => {
      setPage(window.location.hash === '#auth' ? 'auth' : 'catalog');
    };

    syncPageFromHash();
    window.addEventListener('hashchange', syncPageFromHash);
    return () => window.removeEventListener('hashchange', syncPageFromHash);
  }, []);

  function goToAuth() {
    window.location.hash = 'auth';
  }

  function goToCatalog() {
    window.location.hash = 'top';
  }

  return (
    <div className="site-shell">
      <Navigation onOpenAuth={goToAuth} onGoHome={goToCatalog} />
      {page === 'auth' ? (
        <AuthPage screen={authView} onScreenChange={setAuthView} onBack={goToCatalog} />
      ) : (
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
      )}
      {page === 'catalog' ? <footer><span>GAMING CATALOG</span><span>Firestore / RAWG / 2026</span></footer> : null}
    </div>
  );
}

function Navigation({ onOpenAuth, onGoHome }: { onOpenAuth: () => void; onGoHome: () => void }) {
  return (
    <nav className="navigation" aria-label="Navegacion principal">
      <button type="button" className="brand brand-button" onClick={onGoHome}>GC<span>.</span></button>
      <div className="nav-links">
        <a href="#auth" onClick={(event) => { event.preventDefault(); onOpenAuth(); }}>Iniciar sesión</a>
        <a href="#library">Biblioteca</a>
        <a href="#about">El proyecto</a>
      </div>
      <div className="nav-actions">
        <a className="nav-action nav-action-strong" href="#library">Explorar <span aria-hidden="true">↘</span></a>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <p className="eyebrow">CATÁLOGO DIGITAL / 001</p>
        <h1>Juega.<br /><em>Descubre.</em><br />Repite.</h1>
        <p className="hero-intro">Una biblioteca viva de videojuegos para perderse un rato y encontrar algo nuevo.</p>
      </div>
      <div className="hero-art" aria-label="Coleccion de videojuegos">
        <div className="hero-card hero-card-back"><span>RPG</span><strong>03</strong></div>
        <div className="hero-card hero-card-main"><div className="card-grid"></div><span>CURATED<br />PLAY</span><strong>24</strong></div>
        <div className="hero-note">+ 1.000<br />titulos<br />indexados</div>
      </div>
    </section>
  );
}

function AuthPage({ screen, onScreenChange, onBack }: { screen: AuthView; onScreenChange: (screen: AuthView) => void; onBack: () => void }) {
  return (
    <section className="auth-shell auth-shell-split">
      <aside className="auth-visual" aria-label="Marca del proyecto">
        <button type="button" className="auth-visual-brand" onClick={onBack}>
          GC<span>.</span>
        </button>
        <p className="auth-visual-copy">Tu catálogo de videojuegos, presentado con una interfaz limpia y oscura.</p>
      </aside>
      <article className="auth-card auth-card-login auth-card-dark">
        <div className="auth-card-header auth-card-header-login">
          <div>
            <p className="eyebrow">CATÁLOGO DIGITAL / ACCESO</p>
            <h3>{screen === 'signup' ? 'Registro' : screen === 'forgot' ? 'Recuperar contraseña' : screen === 'cookies' ? 'Cookies' : 'Iniciar sesión'}</h3>
          </div>
            <a className="auth-back" href="#top" onClick={(event) => { event.preventDefault(); onBack(); }}>Volver al catálogo</a>
        </div>

        <p className="auth-description auth-description-login">{screen === 'signup' ? 'Crea tu cuenta y deja todo listo para más adelante.' : screen === 'forgot' ? 'Introduce tu correo y preparamos el flujo para recuperar el acceso.' : screen === 'cookies' ? 'Cookies técnicas para el acceso, preferencias de interfaz y, si quieres, analítica básica en el futuro.' : '¡Bienvenido! Inicia sesión para obtener descuentos y ofertas solo para ti.'}</p>

        {screen === 'login' ? <LoginView onScreenChange={onScreenChange} /> : null}
        {screen === 'signup' ? <SignupView onScreenChange={onScreenChange} /> : null}
        {screen === 'forgot' ? <ForgotView onScreenChange={onScreenChange} /> : null}
        {screen === 'cookies' ? <CookiesView onScreenChange={onScreenChange} /> : null}
      </article>
    </section>
  );
}

function LoginView({ onScreenChange }: { onScreenChange: (screen: AuthView) => void }) {
  const [status, setStatus] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('Pantalla de inicio de sesión lista. La conexión real se puede añadir después.');
  }

  return (
    <>
      <form className="auth-form auth-form-login" onSubmit={handleSubmit}>
        <label>
          <span>Nombre de usuario</span>
          <input type="text" placeholder="Nombre de usuario" aria-label="Nombre de usuario" />
        </label>
        <label>
          <span>Contraseña</span>
          <input type="password" placeholder="Contraseña" aria-label="Contraseña" />
        </label>
        <button className="auth-submit auth-submit-login" type="submit">Entrar</button>
        {status ? <p className="auth-status">{status}</p> : null}
      </form>
      <div className="auth-links-bottom auth-links-bottom-dark">
        <span className="auth-bottom-label">¿Nuevo usuario?</span>
        <button type="button" className="auth-footer-link" onClick={() => onScreenChange('signup')}>Registro</button>
        <span className="auth-bottom-spacer"></span>
        <button type="button" className="auth-footer-link auth-footer-link-green" onClick={() => onScreenChange('forgot')}>¿Olvidaste tu contraseña?</button>
      </div>
      <div className="auth-cookies-inline">
        <button type="button" className="auth-footer-link auth-footer-link-muted" onClick={() => onScreenChange('cookies')}>Cookies</button>
      </div>
    </>
  );
}

function SignupView({ onScreenChange }: { onScreenChange: (screen: AuthView) => void }) {
  const [status, setStatus] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('Pantalla de registro lista.');
  }

  return (
    <>
      <form className="auth-form auth-form-login" onSubmit={handleSubmit}>
        <label>
          <span>Nombre completo</span>
          <input type="text" placeholder="Nombre completo" aria-label="Nombre completo" />
        </label>
        <label>
          <span>Correo electrónico</span>
          <input type="email" placeholder="Correo electrónico" aria-label="Correo electrónico" />
        </label>
        <label>
          <span>Contraseña</span>
          <input type="password" placeholder="Contraseña" aria-label="Contraseña" />
        </label>
        <label className="checkbox-row checkbox-row-login checkbox-row-top">
          <input type="checkbox" />
          <span>Privacidad</span>
        </label>
        <label className="checkbox-row checkbox-row-login checkbox-row-middle">
          <input type="checkbox" />
          <span>Notificaciones</span>
        </label>
        <label className="checkbox-row checkbox-row-login checkbox-row-bottom">
          <input type="checkbox" defaultChecked />
          <span>Recuérdame</span>
        </label>
        <button className="auth-submit auth-submit-login" type="submit">Registrarme</button>
        {status ? <p className="auth-status">{status}</p> : null}
      </form>
      <div className="auth-signup-footer">
        <span className="auth-signup-footer-text">¿Ya tienes una cuenta?</span>
        <button type="button" className="auth-footer-link auth-footer-link-green" onClick={() => onScreenChange('login')}>Inicia sesión</button>
      </div>
    </>
  );
}

function ForgotView({ onScreenChange }: { onScreenChange: (screen: AuthView) => void }) {
  const [status, setStatus] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('Pantalla de recuperación lista.');
  }

  return (
    <>
      <form className="auth-form auth-form-login" onSubmit={handleSubmit}>
        <label>
          <span>Correo electrónico</span>
          <input type="email" placeholder="Correo electrónico" aria-label="Correo electrónico" />
        </label>
        <button className="auth-submit auth-submit-login" type="submit">Restablecer contraseña</button>
        {status ? <p className="auth-status">{status}</p> : null}
      </form>
      <div className="auth-links-bottom">
        <button type="button" className="auth-footer-link" onClick={() => onScreenChange('login')}>Iniciar sesión</button>
        <button type="button" className="auth-footer-link" onClick={() => onScreenChange('signup')}>Registro</button>
        <button type="button" className="auth-footer-link" onClick={() => onScreenChange('cookies')}>Cookies</button>
      </div>
    </>
  );
}

function CookiesView({ onScreenChange }: { onScreenChange: (screen: AuthView) => void }) {
  const [cookieConsent, setCookieConsent] = useState(false);

  return (
    <>
      <p className="auth-description auth-description-login">Cookies técnicas para el acceso, preferencias de interfaz y, si quieres, analítica básica en el futuro.</p>
      <div className="cookie-screen cookie-screen-login">
        <div className="auth-bottom-block auth-bottom-block-full">
          <p className="auth-bottom-title">Cookies</p>
          <p>Puedes mostrar aquí el aviso de cookies y dejar el control de consentimiento dentro de la pantalla de inicio de sesión.</p>
          <button className={cookieConsent ? 'cookie-button cookie-button-active' : 'cookie-button'} type="button" onClick={() => setCookieConsent((current) => !current)}>
            {cookieConsent ? 'Cookies aceptadas' : 'Aceptar cookies'}
          </button>
        </div>
      </div>
      <div className="auth-links-bottom">
        <button type="button" className="auth-footer-link" onClick={() => onScreenChange('login')}>Iniciar sesión</button>
        <button type="button" className="auth-footer-link" onClick={() => onScreenChange('signup')}>Registro</button>
        <button type="button" className="auth-footer-link" onClick={() => onScreenChange('forgot')}>¿Olvidaste tu contraseña?</button>
      </div>
    </>
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
      {error ? <p className="status error">{error}. Comprueba que la API esté activa.</p> : !games.length ? <p className="status">Cargando catálogo...</p> : <>
        <div className="library-meta"><span>{filteredGames.length.toLocaleString('es-ES')} resultados</span><span>Página {page} de {totalPages}</span></div>
        <div className="catalog" aria-label="Catálogo de juegos">{visibleGames.map((game) => <GameCard game={game} key={game.id} />)}</div>
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
