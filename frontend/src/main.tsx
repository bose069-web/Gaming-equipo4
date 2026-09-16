import { FormEvent, StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User
} from 'firebase/auth';
import { getFirebaseAuth, getMissingFirebaseAuthConfig, getUserProfile, markUserRegistration, saveUserProfile, updateUserProfile, type UserProfileData } from './firebase.js';
import './styles.css';

type AuthView = 'login' | 'signup' | 'forgot' | 'cookies' | 'profile';
type SessionKind = 'error' | 'info' | 'success';

interface Game {
  id: string;
  name: string;
  rating: number | null;
  released: string | null;
  background_image: string | null;
  platforms: string[];
}

interface SessionNotice {
  kind: SessionKind;
  text: string;
}

interface ProfileDraft {
  displayName: string;
  bio: string;
  favoritePlatform: string;
  favoriteGenre: string;
  favoriteGame: string;
}

interface ProfileCollections {
  savedGames: string[];
  favoriteGames: string[];
  recentlyViewedGames: string[];
}

const emptyProfileDraft: ProfileDraft = {
  displayName: '',
  bio: '',
  favoritePlatform: '',
  favoriteGenre: '',
  favoriteGame: ''
};

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3002';
const firebaseAuth = getFirebaseAuth();
const missingFirebaseAuthConfig = getMissingFirebaseAuthConfig();

interface GamesPage {
  data: Game[];
}

interface LibraryPageResult {
  games: Game[];
  hasNextPage: boolean;
}

async function loadGames(authToken: string, page: number, search: string): Promise<LibraryPageResult> {
  const searchQuery = search.trim();
  const url = new URL(`${apiUrl}/games`);
  url.searchParams.set('limit', '21');
  url.searchParams.set('offset', String((page - 1) * 20));
  if (searchQuery) {
    url.searchParams.set('search', searchQuery);
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  });

  if (response.status === 401) {
    throw new Error('Debes iniciar sesión para ver la biblioteca.');
  }

  if (response.status === 403) {
    throw new Error('Debes verificar tu correo antes de entrar a la biblioteca.');
  }

  if (!response.ok) throw new Error('No se pudo cargar la base de datos');
  const payload = (await response.json()) as GamesPage;
  return {
    games: payload.data.slice(0, 20),
    hasNextPage: payload.data.length > 20
  };
}

async function loadFeaturedGames(): Promise<Game[]> {
  const response = await fetch(`${apiUrl}/games/featured?limit=2`);

  if (!response.ok) throw new Error('No se pudieron cargar los juegos destacados');
  const payload = (await response.json()) as { data: Game[] };
  return payload.data;
}

function App() {
  const [page, setPage] = useState<'catalog' | 'auth'>('catalog');
  const [authView, setAuthView] = useState<AuthView>('login');
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [sessionNotice, setSessionNotice] = useState<SessionNotice | null>(null);
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileCollections, setProfileCollections] = useState<ProfileCollections>({ savedGames: [], favoriteGames: [], recentlyViewedGames: [] });
  const [games, setGames] = useState<Game[]>([]);
  const [libraryPage, setLibraryPage] = useState(1);
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryHasNextPage, setLibraryHasNextPage] = useState(false);
  const [gamesError, setGamesError] = useState('');
  const [gamesLoading, setGamesLoading] = useState(false);
  const [heroSeed, setHeroSeed] = useState(() => crypto.randomUUID());
  const [featuredGames, setFeaturedGames] = useState<Game[]>([]);

  useEffect(() => {
    const syncPageFromHash = () => {
      setPage(window.location.hash === '#auth' ? 'auth' : 'catalog');
    };

    syncPageFromHash();
    window.addEventListener('hashchange', syncPageFromHash);
    return () => window.removeEventListener('hashchange', syncPageFromHash);
  }, []);

  useEffect(() => {
    if (page === 'catalog') {
      setHeroSeed(crypto.randomUUID());
      loadFeaturedGames().then(setFeaturedGames).catch(() => setFeaturedGames([]));
    }
  }, [page]);

  useEffect(() => {
    if (!firebaseAuth) {
      setAuthReady(true);
      setAuthUser(null);
      setAuthToken('');
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        setAuthUser(null);
        setAuthToken('');
        setAuthReady(true);
        return;
      }

      await reload(user);
      if (!user.emailVerified) {
        setAuthUser(null);
        setAuthToken('');
        setProfileData(null);
        setProfileCollections({ savedGames: [], favoriteGames: [], recentlyViewedGames: [] });
        setSessionNotice({ kind: 'info', text: 'Revisa tu correo y confirma la cuenta para desbloquear la biblioteca.' });
        setAuthReady(true);
        return;
      }

      const token = await user.getIdToken(true);
      try {
        await saveUserProfile(user, true);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo guardar el perfil en Firestore';
        setSessionNotice({ kind: 'error', text: message });
      }
      setAuthUser(user);
      setAuthToken(token);
      setAuthReady(true);
      setSessionNotice((current) => current?.kind === 'error' ? current : { kind: 'success', text: 'Sesión verificada. La biblioteca está desbloqueada.' });

      setProfileLoading(true);
      try {
        const profile = await getUserProfile(user.uid);
        setProfileData(profile);
        setProfileCollections({
          savedGames: profile?.savedGames ?? [],
          favoriteGames: profile?.favoriteGames ?? [],
          recentlyViewedGames: profile?.recentlyViewedGames ?? []
        });
      } catch {
        setProfileData(null);
        setProfileCollections({ savedGames: [], favoriteGames: [], recentlyViewedGames: [] });
      } finally {
        setProfileLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authReady || !authUser || !authToken) {
      setGames([]);
      setLibraryPage(1);
      setLibrarySearch('');
      setLibraryHasNextPage(false);
      setGamesError('');
      setGamesLoading(false);
      return;
    }

    let isActive = true;
    setGamesLoading(true);
    setGamesError('');

    loadGames(authToken, libraryPage, librarySearch)
      .then((result) => {
        if (!isActive) return;
        setGames(result.games);
        setLibraryHasNextPage(result.hasNextPage);
      })
      .catch((reason: Error) => {
        if (!isActive) return;
        setGames([]);
        setLibraryHasNextPage(false);
        setGamesError(reason.message);
      })
      .finally(() => {
        if (!isActive) return;
        setGamesLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [authReady, authToken, authUser, libraryPage, librarySearch]);

  function goToAuth() {
    setAuthView('login');
    window.location.hash = 'auth';
  }

  function goToProfile() {
    setAuthView('profile');
    window.location.hash = 'auth';
  }

  const gamesById = useMemo(() => new Map(games.map((game) => [game.id, game])), [games]);

  async function persistProfileCollections(nextCollections: ProfileCollections) {
    if (!authUser) return;

    setProfileSaving(true);
    try {
      await updateUserProfile(authUser.uid, nextCollections);
      const refreshed = await getUserProfile(authUser.uid);
      setProfileData(refreshed);
      setProfileCollections({
        savedGames: refreshed?.savedGames ?? [],
        favoriteGames: refreshed?.favoriteGames ?? [],
        recentlyViewedGames: refreshed?.recentlyViewedGames ?? []
      });
      setSessionNotice({ kind: 'success', text: 'Perfil actualizado.' });
    } finally {
      setProfileSaving(false);
    }
  }

  function toggleProfileCollection(field: keyof ProfileCollections, gameId: string) {
    const current = profileCollections[field];
    const next = current.includes(gameId) ? current.filter((item) => item !== gameId) : [...current, gameId];
    void persistProfileCollections({ ...profileCollections, [field]: next } as ProfileCollections);
  }

  function markRecentGame(gameId: string) {
    const current = profileCollections.recentlyViewedGames;
    const next = [gameId, ...current.filter((item) => item !== gameId)].slice(0, 10);
    void persistProfileCollections({ ...profileCollections, recentlyViewedGames: next });
  }

  function goToCatalog() {
    window.location.hash = 'top';
  }

  async function handleSignOut() {
    if (!firebaseAuth) return;
    await signOut(firebaseAuth);
    setAuthView('login');
    setProfileData(null);
    setSessionNotice({ kind: 'info', text: 'Has cerrado la sesión.' });
    window.location.hash = 'auth';
  }

  const catalogUnlocked = authReady && Boolean(authUser && authToken);
  const shuffledFeaturedGames = useMemo(() => pickFeaturedGames(featuredGames, 2, heroSeed), [featuredGames, heroSeed]);
  const profileBubbleLabel = getProfileBubbleLabel(profileData ?? undefined, authUser?.displayName ?? null, authUser?.email ?? null);

  return (
    <div className="site-shell">
      <Navigation
        onOpenAuth={goToAuth}
        onGoHome={goToCatalog}
        onOpenProfile={goToProfile}
        onSignOut={handleSignOut}
        isAuthenticated={catalogUnlocked}
        userEmail={authUser?.email ?? null}
        profileBubbleLabel={profileBubbleLabel}
      />
      {page === 'auth' ? (
        <AuthPage
          screen={authView}
          onScreenChange={setAuthView}
          onBack={goToCatalog}
          auth={firebaseAuth}
          sessionNotice={sessionNotice}
          profileData={profileData}
          profileLoading={profileLoading}
          profileSaving={profileSaving}
          gamesById={gamesById}
          savedGames={profileCollections.savedGames}
          favoriteGames={profileCollections.favoriteGames}
          recentlyViewedGames={profileCollections.recentlyViewedGames}
          onProfileSave={async (draft) => {
            if (!authUser) return;
            setProfileSaving(true);
            try {
              await updateProfile(authUser, { displayName: draft.displayName.trim() || null });
              await updateUserProfile(authUser.uid, {
                displayName: draft.displayName.trim(),
                bio: draft.bio.trim(),
                favoritePlatform: draft.favoritePlatform.trim(),
                favoriteGenre: draft.favoriteGenre.trim(),
                favoriteGame: draft.favoriteGame.trim(),
                savedGames: profileCollections.savedGames,
                favoriteGames: profileCollections.favoriteGames,
                recentlyViewedGames: profileCollections.recentlyViewedGames
              });
              await saveUserProfile(authUser, true);
              const refreshed = await getUserProfile(authUser.uid);
              setProfileData(refreshed);
              setProfileCollections({
                savedGames: refreshed?.savedGames ?? [],
                favoriteGames: refreshed?.favoriteGames ?? [],
                recentlyViewedGames: refreshed?.recentlyViewedGames ?? []
              });
              setSessionNotice({ kind: 'success', text: 'Perfil actualizado.' });
            } finally {
              setProfileSaving(false);
            }
          }}
          missingFirebaseAuthConfig={missingFirebaseAuthConfig}
        />
      ) : (
        <main>
          <Hero featuredGames={shuffledFeaturedGames} />
          <Library
            games={games}
            gamesError={gamesError}
            gamesLoading={gamesLoading}
            hasNextPage={libraryHasNextPage}
            page={libraryPage}
            search={librarySearch}
            isUnlocked={catalogUnlocked}
            onOpenAuth={goToAuth}
            onPageChange={setLibraryPage}
            onSearchChange={setLibrarySearch}
            savedGames={profileCollections.savedGames}
            favoriteGames={profileCollections.favoriteGames}
            onOpenGame={markRecentGame}
            onToggleSavedGame={(gameId) => toggleProfileCollection('savedGames', gameId)}
            onToggleFavoriteGame={(gameId) => toggleProfileCollection('favoriteGames', gameId)}
            sessionNotice={sessionNotice}
          />
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

function pickFeaturedGames(games: Game[], count: number, seed: string): Game[] {
  if (games.length === 0) {
    return [];
  }

  const pool = [...games];
  let randomState = seed.split('').reduce((accumulator, character) => accumulator + character.charCodeAt(0), 0);

  const seededRandom = () => {
    randomState = (randomState * 1664525 + 1013904223) % 4294967296;
    return randomState / 4294967296;
  };

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(seededRandom() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }

  return pool.slice(0, Math.min(count, pool.length));
}

function Navigation({ onOpenAuth, onGoHome, onOpenProfile, onSignOut, isAuthenticated, userEmail, profileBubbleLabel }: { onOpenAuth: () => void; onGoHome: () => void; onOpenProfile: () => void; onSignOut: () => void; isAuthenticated: boolean; userEmail: string | null; profileBubbleLabel: string; }) {
  return (
    <nav className="navigation" aria-label="Navegacion principal">
      <button type="button" className="brand brand-button" onClick={onGoHome}>GC<span>.</span></button>
      <div className="nav-links">
        {isAuthenticated ? null : <a href="#auth" onClick={(event) => { event.preventDefault(); onOpenAuth(); }}>Iniciar sesión</a>}
        <a href="#library">Biblioteca</a>
        <a href="#about">El proyecto</a>
      </div>
      <div className="nav-actions">
        {isAuthenticated ? <button type="button" className="nav-action" onClick={onSignOut}>Cerrar sesión</button> : null}
        {userEmail ? <span className="nav-user">{userEmail}</span> : null}
        {isAuthenticated ? <button type="button" className="profile-bubble" onClick={onOpenProfile} aria-label="Abrir perfil">{profileBubbleLabel}</button> : null}
        <a className="nav-action nav-action-strong" href="#library">Explorar <span aria-hidden="true">↘</span></a>
      </div>
    </nav>
  );
}

function Hero({ featuredGames }: { featuredGames: Game[]; }) {
  const [firstGame, secondGame] = featuredGames;
  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <p className="eyebrow">CATÁLOGO DIGITAL / 001</p>
        <h1>Juega.<br /><em>Descubre.</em><br />Repite.</h1>
        <p className="hero-intro">Una biblioteca viva de videojuegos para perderse un rato y encontrar algo nuevo.</p>
      </div>
      <div className="hero-art" aria-label="Coleccion de videojuegos">
        <div className="hero-card hero-card-back">
          {firstGame?.background_image ? <img className="hero-card-cover" src={firstGame.background_image} alt={`Portada de ${firstGame.name}`} loading="eager" /> : null}
          <span>{firstGame ? firstGame.name : 'RPG'}</span>
          <strong>{firstGame?.rating ? Math.round(firstGame.rating).toString().padStart(2, '0') : '03'}</strong>
        </div>
        <div className="hero-card hero-card-main">
          {secondGame?.background_image ? <img className="hero-card-cover" src={secondGame.background_image} alt={`Portada de ${secondGame.name}`} loading="eager" /> : null}
          <span>{secondGame ? secondGame.name : 'CURATED PLAY'}</span>
          <strong>{secondGame?.rating ? Math.round(secondGame.rating).toString() : '24'}</strong>
        </div>
        <div className="hero-note">+ 5.000<br />titulos<br />indexados</div>
      </div>
    </section>
  );
}

function AuthPage({ screen, onScreenChange, onBack, auth, sessionNotice, profileData, profileLoading, profileSaving, onProfileSave, gamesById, savedGames, favoriteGames, recentlyViewedGames, missingFirebaseAuthConfig }: { screen: AuthView; onScreenChange: (screen: AuthView) => void; onBack: () => void; auth: typeof firebaseAuth; sessionNotice: SessionNotice | null; profileData: UserProfileData | null; profileLoading: boolean; profileSaving: boolean; onProfileSave: (draft: ProfileDraft) => Promise<void>; gamesById: Map<string, Game>; savedGames: string[]; favoriteGames: string[]; recentlyViewedGames: string[]; missingFirebaseAuthConfig: string[]; }) {
  return (
    <section className="auth-shell auth-shell-split">
      <aside className="auth-visual" aria-label="Marca del proyecto">
        <button type="button" className="auth-visual-brand" onClick={onBack}>
          GC<span>.</span>
        </button>
        <p className="auth-visual-copy">Tu catálogo de videojuegos, presentado con una interfaz limpia y oscura.</p>
        {missingFirebaseAuthConfig.length > 0 ? <p className="auth-config-warning">Faltan variables de Firebase Auth: {missingFirebaseAuthConfig.join(', ')}</p> : null}
        {sessionNotice ? <p className={`auth-session-note auth-session-note-${sessionNotice.kind}`}>{sessionNotice.text}</p> : null}
      </aside>
      <article className="auth-card auth-card-login auth-card-dark">
        <div className="auth-card-header auth-card-header-login">
          <div>
            <p className="eyebrow">CATÁLOGO DIGITAL / ACCESO</p>
            <h3>{screen === 'signup' ? 'Registro' : screen === 'forgot' ? 'Recuperar contraseña' : screen === 'cookies' ? 'Cookies' : screen === 'profile' ? 'Tu perfil' : 'Iniciar sesión'}</h3>
          </div>
          <div className="auth-header-actions">
            <a className="auth-back" href="#top" onClick={(event) => { event.preventDefault(); onBack(); }}>Volver al catálogo</a>
          </div>
        </div>

        <p className="auth-description auth-description-login">{screen === 'signup' ? 'Crea tu cuenta. Después tendrás que verificar el correo para entrar a la biblioteca.' : screen === 'forgot' ? 'Introduce tu correo y te enviaremos un enlace para recuperar el acceso.' : screen === 'cookies' ? 'Cookies técnicas para el acceso, preferencias de interfaz y, si quieres, analítica básica en el futuro.' : screen === 'profile' ? 'Tu perfil funciona como una burbuja editable con tus datos básicos y tus gustos principales.' : 'Inicia sesión con tu correo verificado para desbloquear la biblioteca.'}</p>

        {screen === 'login' ? <LoginView auth={auth} onScreenChange={onScreenChange} onSessionNotice={missingFirebaseAuthConfig.length > 0 ? 'Configura Firebase Auth en las variables VITE_* antes de intentar entrar.' : ''} /> : null}
        {screen === 'signup' ? <SignupView auth={auth} onScreenChange={onScreenChange} onBack={onBack} /> : null}
        {screen === 'forgot' ? <ForgotView auth={auth} onScreenChange={onScreenChange} /> : null}
        {screen === 'cookies' ? <CookiesView onScreenChange={onScreenChange} /> : null}
        {screen === 'profile' ? <ProfileView profileData={profileData} profileLoading={profileLoading} profileSaving={profileSaving} gamesById={gamesById} savedGames={savedGames} favoriteGames={favoriteGames} recentlyViewedGames={recentlyViewedGames} onSave={onProfileSave} onBack={onBack} /> : null}
      </article>
    </section>
  );
}

function getProfileBubbleLabel(profileData: UserProfileData | undefined, displayName: string | null, email: string | null): string {
  const source = profileData?.displayName?.trim() || displayName?.trim() || email?.trim() || 'GC';
  const parts = source.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? 'G';
  const second = parts[1]?.[0] ?? (parts[0]?.[1] ?? 'C');
  return `${first}${second}`.toUpperCase();
}

function getAuthErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: string }).code) : '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-email':
      return 'Correo o contraseña no válidos.';
    case 'auth/email-already-in-use':
      return 'Ese correo ya está registrado.';
    case 'auth/weak-password':
      return 'La contraseña es demasiado débil.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'No se pudo encontrar esa cuenta.';
    case 'auth/missing-password':
      return 'Introduce una contraseña válida.';
    default:
      return 'No se pudo completar la operación.';
  }
}

function LoginView({ auth, onScreenChange, onSessionNotice }: { auth: typeof firebaseAuth; onScreenChange: (screen: AuthView) => void; onSessionNotice: string; }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!auth) {
      setStatus(onSessionNotice || 'Falta configurar Firebase Auth.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      await reload(result.user);

      if (!result.user.emailVerified) {
        await sendEmailVerification(result.user, { url: `${window.location.origin}${window.location.pathname}#auth` });
        await signOut(auth);
        setStatus('Tu correo no estaba verificado. Te hemos reenviado el enlace de confirmación.');
        return;
      }

      try {
        await saveUserProfile(result.user, true);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo guardar el perfil en Firestore';
        setStatus(message);
        return;
      }
      setStatus('Sesión iniciada. La biblioteca se desbloqueará en breve.');
      window.location.hash = 'library';
    } catch (error) {
      setStatus(getAuthErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form className="auth-form auth-form-login" onSubmit={handleSubmit}>
        <label>
          <span>Correo electrónico</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Correo electrónico" aria-label="Correo electrónico" />
        </label>
        <label>
          <span>Contraseña</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Contraseña" aria-label="Contraseña" />
        </label>
        <button className="auth-submit auth-submit-login" type="submit" disabled={busy}>{busy ? 'Entrando...' : 'Entrar'}</button>
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

function SignupView({ auth, onScreenChange, onBack }: { auth: typeof firebaseAuth; onScreenChange: (screen: AuthView) => void; onBack: () => void; }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!auth) {
      setStatus('Falta configurar Firebase Auth.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(result.user, { displayName: name.trim() || null });
      try {
        await markUserRegistration(result.user);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo guardar el perfil en Firestore';
        setStatus(message);
        return;
      }
      await sendEmailVerification(result.user, { url: `${window.location.origin}${window.location.pathname}#auth` });
      await signOut(auth);
      setStatus('Cuenta creada. Revisa tu correo para verificarla y luego entrar a la biblioteca.');
    } catch (error) {
      setStatus(getAuthErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form className="auth-form auth-form-login" onSubmit={handleSubmit}>
        <label>
          <span>Nombre completo</span>
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre completo" aria-label="Nombre completo" />
        </label>
        <label>
          <span>Correo electrónico</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Correo electrónico" aria-label="Correo electrónico" />
        </label>
        <label>
          <span>Contraseña</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Contraseña" aria-label="Contraseña" />
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
        <button className="auth-submit auth-submit-login" type="submit" disabled={busy}>{busy ? 'Registrando...' : 'Registrarme'}</button>
        {status ? <p className="auth-status">{status}</p> : null}
      </form>
      <div className="auth-signup-footer">
        <span className="auth-signup-footer-text">¿Ya tienes una cuenta?</span>
        <button type="button" className="auth-footer-link auth-footer-link-green" onClick={() => onScreenChange('login')}>Inicia sesión</button>
        <button type="button" className="auth-footer-link auth-footer-link-muted" onClick={onBack}>Saltar por ahora</button>
      </div>
    </>
  );
}

function ProfileView({ profileData, profileLoading, profileSaving, gamesById, savedGames, favoriteGames, recentlyViewedGames, onSave, onBack }: { profileData: UserProfileData | null; profileLoading: boolean; profileSaving: boolean; gamesById: Map<string, Game>; savedGames: string[]; favoriteGames: string[]; recentlyViewedGames: string[]; onSave: (draft: ProfileDraft) => Promise<void>; onBack: () => void; }) {
  const [draft, setDraft] = useState<ProfileDraft>(emptyProfileDraft);
  const [activeTab, setActiveTab] = useState<'datos' | 'colecciones' | 'historial'>('datos');

  useEffect(() => {
    setDraft({
      displayName: profileData?.displayName ?? '',
      bio: profileData?.bio ?? '',
      favoritePlatform: profileData?.favoritePlatform ?? '',
      favoriteGenre: profileData?.favoriteGenre ?? '',
      favoriteGame: profileData?.favoriteGame ?? ''
    });
  }, [profileData]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave(draft);
  }

  return (
    <>
      <div className="profile-bubble-hero">
        <div className="profile-bubble-large">{getProfileBubbleLabel(profileData ?? undefined, profileData?.displayName ?? null, profileData?.email ?? null)}</div>
        <div>
          <p className="auth-bottom-title">Burbuja de perfil</p>
          <p className="auth-description auth-description-login">{profileLoading ? 'Cargando tu perfil...' : 'Edita tus datos y gustos cuando quieras.'}</p>
          <p className="profile-counter">{savedGames.length} guardados · {favoriteGames.length} favoritos</p>
        </div>
      </div>
      <div className="profile-tabs" role="tablist" aria-label="Secciones de perfil">
        <button type="button" className={activeTab === 'datos' ? 'profile-tab profile-tab-active' : 'profile-tab'} onClick={() => setActiveTab('datos')}>Datos</button>
        <button type="button" className={activeTab === 'colecciones' ? 'profile-tab profile-tab-active' : 'profile-tab'} onClick={() => setActiveTab('colecciones')}>Guardados</button>
        <button type="button" className={activeTab === 'historial' ? 'profile-tab profile-tab-active' : 'profile-tab'} onClick={() => setActiveTab('historial')}>Historial</button>
      </div>
      {activeTab === 'datos' ? (
        <form className="auth-form auth-form-login profile-form" onSubmit={handleSubmit}>
          <label>
            <span>Nombre público</span>
            <input type="text" value={draft.displayName} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} placeholder="Nombre público" aria-label="Nombre público" />
          </label>
          <label>
            <span>Biografía</span>
            <textarea value={draft.bio} onChange={(event) => setDraft((current) => ({ ...current, bio: event.target.value }))} placeholder="Cuenta algo sobre ti" aria-label="Biografía" rows={4} />
          </label>
          <label>
            <span>Plataforma favorita</span>
            <input type="text" value={draft.favoritePlatform} onChange={(event) => setDraft((current) => ({ ...current, favoritePlatform: event.target.value }))} placeholder="PC, PS5, Switch..." aria-label="Plataforma favorita" />
          </label>
          <label>
            <span>Género favorito</span>
            <input type="text" value={draft.favoriteGenre} onChange={(event) => setDraft((current) => ({ ...current, favoriteGenre: event.target.value }))} placeholder="RPG, acción, estrategia..." aria-label="Género favorito" />
          </label>
          <label>
            <span>Juego favorito</span>
            <input type="text" value={draft.favoriteGame} onChange={(event) => setDraft((current) => ({ ...current, favoriteGame: event.target.value }))} placeholder="Tu juego favorito" aria-label="Juego favorito" />
          </label>
          <button className="auth-submit auth-submit-login" type="submit" disabled={profileSaving}>{profileSaving ? 'Guardando...' : 'Guardar perfil'}</button>
        </form>
      ) : null}

      {activeTab === 'colecciones' ? (
        <div className="profile-collections">
          <div className="auth-bottom-block">
            <p className="auth-bottom-title">Guardados</p>
            <div className="profile-chip-list">
              {savedGames.length ? savedGames.map((gameId) => <span key={gameId} className="profile-chip">{gamesById.get(gameId)?.name ?? gameId}</span>) : <p className="library-lock-copy">Todavía no has guardado ningún juego.</p>}
            </div>
          </div>
          <div className="auth-bottom-block">
            <p className="auth-bottom-title">Favoritos</p>
            <div className="profile-chip-list">
              {favoriteGames.length ? favoriteGames.map((gameId) => <span key={gameId} className="profile-chip">{gamesById.get(gameId)?.name ?? gameId}</span>) : <p className="library-lock-copy">Aún no tienes juegos favoritos.</p>}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'historial' ? (
        <div className="auth-bottom-block">
          <p className="auth-bottom-title">Historial reciente</p>
          <div className="profile-chip-list">
            {recentlyViewedGames.length ? recentlyViewedGames.map((gameId) => <span key={gameId} className="profile-chip">{gamesById.get(gameId)?.name ?? gameId}</span>) : <p className="library-lock-copy">Aún no has abierto ningún juego.</p>}
          </div>
        </div>
      ) : null}
      <div className="auth-links-bottom auth-links-bottom-dark">
        <button type="button" className="auth-footer-link auth-footer-link-muted" onClick={onBack}>Volver</button>
      </div>
    </>
  );
}

function ForgotView({ auth, onScreenChange }: { auth: typeof firebaseAuth; onScreenChange: (screen: AuthView) => void; }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!auth) {
      setStatus('Falta configurar Firebase Auth.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setStatus('Te hemos enviado un correo para restablecer la contraseña.');
    } catch (error) {
      setStatus(getAuthErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form className="auth-form auth-form-login" onSubmit={handleSubmit}>
        <label>
          <span>Correo electrónico</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Correo electrónico" aria-label="Correo electrónico" />
        </label>
        <button className="auth-submit auth-submit-login" type="submit" disabled={busy}>{busy ? 'Enviando...' : 'Restablecer contraseña'}</button>
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

function Library({ games, gamesError, gamesLoading, hasNextPage, page, search, isUnlocked, onOpenAuth, onPageChange, onSearchChange, savedGames, favoriteGames, onOpenGame, onToggleSavedGame, onToggleFavoriteGame, sessionNotice }: { games: Game[]; gamesError: string; gamesLoading: boolean; hasNextPage: boolean; page: number; search: string; isUnlocked: boolean; onOpenAuth: () => void; onPageChange: (page: number) => void; onSearchChange: (search: string) => void; savedGames: string[]; favoriteGames: string[]; onOpenGame: (gameId: string) => void; onToggleSavedGame: (gameId: string) => void; onToggleFavoriteGame: (gameId: string) => void; sessionNotice: SessionNotice | null; }) {
  const [error, setError] = useState('');
  const [platform, setPlatform] = useState('all');
  const [rating, setRating] = useState('all');
  const [sort, setSort] = useState('name');

  useEffect(() => {
    setError(gamesError);
  }, [gamesError]);
  const platforms = useMemo(() => Array.from(new Set(games.flatMap((game) => game.platforms))).sort(), [games]);
  const filteredGames = useMemo(() => {
    const result = games.filter((game) => {
      const matchesPlatform = platform === 'all' || game.platforms.includes(platform);
      const matchesRating = rating === 'all' || (game.rating ?? 0) >= Number(rating);
      return matchesPlatform && matchesRating;
    });
    return result.sort((first, second) => {
      if (sort === 'rating') return (second.rating ?? -1) - (first.rating ?? -1);
      if (sort === 'newest') return (second.released ?? '').localeCompare(first.released ?? '');
      if (sort === 'oldest') return (first.released ?? '').localeCompare(second.released ?? '');
      return first.name.localeCompare(second.name);
    });
  }, [games, platform, rating, sort]);

  const visibleGames = filteredGames;

  if (!isUnlocked) {
    return (
      <section className="library-section" id="library">
        <div className="section-heading">
          <div><p className="eyebrow">01 / BIBLIOTECA</p><h2>Acceso<br /><em>bloqueado.</em></h2></div>
          <p className="section-description">La biblioteca solo se carga con una cuenta verificada.</p>
        </div>
        <div className="library-lock">
          <p className="library-lock-copy">Inicia sesión con tu correo verificado para cargar los juegos desde Firebase.</p>
          {sessionNotice ? <p className={`status ${sessionNotice.kind === 'error' ? 'error' : ''}`}>{sessionNotice.text}</p> : null}
          <button className="auth-submit auth-submit-login" type="button" onClick={onOpenAuth}>Ir a inicio de sesión</button>
        </div>
      </section>
    );
  }

  return (
    <section className="library-section" id="library">
      <div className="section-heading">
        <div><p className="eyebrow">01 / BIBLIOTECA</p><h2>Encuentra tu<br /><em>siguiente partida.</em></h2></div>
        <p className="section-description">{games.length ? `${games.length.toLocaleString('es-ES')} juegos en el archivo` : 'Conectando con tu archivo'}</p>
      </div>
      <div className="library-tools">
        <label className="search-field"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => { onSearchChange(event.target.value); onPageChange(1); }} placeholder="Buscar por nombre..." aria-label="Buscar por nombre" /></label>
        <select value={platform} onChange={(event) => { setPlatform(event.target.value); onPageChange(1); }} aria-label="Filtrar por plataforma"><option value="all">Todas las plataformas</option>{platforms.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <select value={rating} onChange={(event) => { setRating(event.target.value); onPageChange(1); }} aria-label="Filtrar por rating"><option value="all">Cualquier rating</option><option value="4">4.0 o más</option><option value="3">3.0 o más</option><option value="2">2.0 o más</option></select>
        <select value={sort} onChange={(event) => { setSort(event.target.value); onPageChange(1); }} aria-label="Ordenar biblioteca"><option value="name">Nombre A-Z</option><option value="rating">Mejor valorados</option><option value="newest">Más recientes</option><option value="oldest">Más antiguos</option></select>
      </div>
      {error ? <p className="status error">{error}</p> : gamesLoading ? <p className="status">Cargando catálogo...</p> : !games.length ? <p className="status">No hay juegos disponibles todavía.</p> : <>
        <div className="library-meta"><span>{filteredGames.length.toLocaleString('es-ES')} resultados</span><span>Página {page}</span></div>
        <div className="catalog" aria-label="Catálogo de juegos">{visibleGames.map((game) => <GameCard game={game} key={game.id} savedGames={savedGames} favoriteGames={favoriteGames} onOpenGame={onOpenGame} onToggleSavedGame={onToggleSavedGame} onToggleFavoriteGame={onToggleFavoriteGame} />)}</div>
        <div className="pagination"><button onClick={() => onPageChange(page - 1)} disabled={page === 1} aria-label="Página anterior">←</button><span>{String(page).padStart(2, '0')}</span><button onClick={() => onPageChange(page + 1)} disabled={!hasNextPage} aria-label="Página siguiente">→</button></div>
      </>}
    </section>
  );
}

function GameCard({ game, savedGames, favoriteGames, onOpenGame, onToggleSavedGame, onToggleFavoriteGame }: { game: Game; savedGames: string[]; favoriteGames: string[]; onOpenGame: (gameId: string) => void; onToggleSavedGame: (gameId: string) => void; onToggleFavoriteGame: (gameId: string) => void; }) {
  const isSaved = savedGames.includes(game.id);
  const isFavorite = favoriteGames.includes(game.id);
  return (
    <article className="game">
      <div className="game-image">{game.background_image ? <img src={game.background_image} alt={`Portada de ${game.name}`} loading="lazy" /> : <div className="no-image">SIN PORTADA</div>}<span className="game-id">#{game.id}</span><div className="game-hover"><button type="button" className="game-hover-button" onClick={() => onOpenGame(game.id)}>Ver ficha</button><span aria-hidden="true">↗</span></div></div>
      <div className="game-body"><div><h3>{game.name}</h3><p>{game.released ?? 'Fecha desconocida'}</p></div><strong>{game.rating?.toFixed(1) ?? '—'}</strong></div>
      <div className="game-actions">
        <button type="button" className={isSaved ? 'game-pill game-pill-active' : 'game-pill'} onClick={() => onToggleSavedGame(game.id)}>{isSaved ? 'Guardado' : 'Guardar'}</button>
        <button type="button" className={isFavorite ? 'game-pill game-pill-active' : 'game-pill'} onClick={() => onToggleFavoriteGame(game.id)}>{isFavorite ? 'Favorito' : 'Favorito +'}</button>
      </div>
      <div className="platform-list">{game.platforms.slice(0, 3).map((item) => <span key={item}>{item}</span>)}</div>
    </article>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
