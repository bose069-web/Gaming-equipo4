import { ChangeEvent, FormEvent, StrictMode, useEffect, useMemo, useState } from 'react';
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
import { deleteUserProfile, getFirebaseAuth, getMissingFirebaseAuthConfig, getUserProfile, saveUserProfile, updateUserProfile, type UserProfileData } from './firebase.js';
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
  fullName: string;
  bio: string;
  favoritePlatform: string;
  favoriteGenre: string;
  favoriteGame: string;
  avatarImage: string;
  avatarColor: string;
}

interface ProfileCollections {
  savedGames: string[];
  favoriteGames: string[];
  recentlyViewedGames: string[];
}

const emptyProfileDraft: ProfileDraft = {
  displayName: '',
  fullName: '',
  bio: '',
  favoritePlatform: '',
  favoriteGenre: '',
  favoriteGame: '',
  avatarImage: '',
  avatarColor: '#d6ed52'
};

const avatarPaletteRows = [
  [
    { value: '#d6ed52', label: 'Lima' },
    { value: '#8dd3ff', label: 'Azul' },
    { value: '#ff9f68', label: 'Coral' },
    { value: '#d8a7ff', label: 'Lila' },
    { value: '#83e6bd', label: 'Menta' }
  ],
  [
    { value: '#ffe66d', label: 'Amarillo' },
    { value: '#9b8cff', label: 'Violeta' },
    { value: '#ff7aa2', label: 'Rosa' },
    { value: '#54d6c7', label: 'Turquesa' },
    { value: '#f2f1e9', label: 'Blanco' }
  ],
  [
    { value: 'linear-gradient(135deg, #d6ed52 0 50%, #dc6947 50% 100%)', label: 'Lima y coral' },
    { value: 'linear-gradient(135deg, #8dd3ff 0 50%, #d8a7ff 50% 100%)', label: 'Azul y lila' }
  ]
];
const defaultAvatarColor = avatarPaletteRows[0][0].value;

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
  const [cookieConsent, setCookieConsent] = useState(() => window.localStorage.getItem('gamingcloude-cookie-consent') === 'accepted');
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
        try {
          await deleteUserProfile(user.uid);
        } catch {
        }
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

  function handleCookieConsent(nextConsent: boolean) {
    setCookieConsent(nextConsent);
    if (nextConsent) {
      window.localStorage.setItem('gamingcloude-cookie-consent', 'accepted');
    } else {
      window.localStorage.removeItem('gamingcloude-cookie-consent');
    }
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
    setSessionNotice(null);
    window.location.hash = 'auth';
  }

  const catalogUnlocked = authReady && Boolean(authUser && authToken);
  const shuffledFeaturedGames = useMemo(() => pickFeaturedGames(featuredGames, 2, heroSeed), [featuredGames, heroSeed]);
  const profileBubbleLabel = getProfileBubbleLabel(profileData ?? undefined, authUser?.displayName ?? null, authUser?.email ?? null);
  const profileDisplayName = profileData?.displayName?.trim() || authUser?.displayName?.trim() || 'Perfil';

  return (
    <div className="site-shell">
      <Navigation
        onOpenAuth={goToAuth}
        onGoHome={goToCatalog}
        onOpenProfile={goToProfile}
        isAuthenticated={catalogUnlocked}
        profileDisplayName={profileDisplayName}
        profileBubbleLabel={profileBubbleLabel}
        profileImage={profileData?.avatarImage}
        profileColor={profileData?.avatarColor}
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
                fullName: draft.fullName.trim(),
                bio: draft.bio.trim(),
                favoritePlatform: draft.favoritePlatform.trim(),
                favoriteGenre: draft.favoriteGenre.trim(),
                favoriteGame: draft.favoriteGame.trim(),
                avatarImage: draft.avatarImage.trim(),
                avatarColor: draft.avatarColor,
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
          onSignOut={handleSignOut}
          cookieConsent={cookieConsent}
          onCookieConsentChange={handleCookieConsent}
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
      {page === 'catalog' ? <GamingFooter /> : null}
    </div>
  );
}

function GamingFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <p className="footer-kicker">GAMINGCLOUDE / 001</p>
        <strong>Gaming<span>cloude</span>.</strong>
        <p>Un archivo vivo para encontrar tu próximo juego.</p>
      </div>
      <div className="footer-block">
        <p className="footer-label">Contacto</p>
        <a href="mailto:hola@gamingcloude.com">hola@gamingcloude.com</a>
        <span>Respondemos cuando termine la partida.</span>
      </div>
      <div className="footer-block">
        <p className="footer-label">Redes sociales</p>
        <div className="footer-socials">
          <a href="https://facebook.com/gamingcloude" target="_blank" rel="noreferrer"><span className="social-mark social-mark-facebook" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M14 8h3V4h-3c-3.3 0-5 1.9-5 5v3H6v4h3v8h4v-8h3.2l.8-4H13V9c0-.7.3-1 1-1Z" /></svg></span>Facebook</a>
          <a href="https://instagram.com/gamingcloude" target="_blank" rel="noreferrer"><span className="social-mark social-mark-instagram" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" className="social-icon-fill" /></svg></span>Instagram</a>
          <a href="https://tiktok.com/@gamingcloude" target="_blank" rel="noreferrer"><span className="social-mark social-mark-tiktok" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M14 4v10.2a4.8 4.8 0 1 1-3.8-4.7v3.2a1.7 1.7 0 1 0 .8 1.5V4h3c.4 2 1.6 3.2 3.5 3.7v3c-1.4-.2-2.6-.8-3.5-1.7V14Z" /></svg></span>TikTok</a>
        </div>
      </div>
      <div className="footer-note">
        <span>CATÁLOGO LOCAL</span>
        <span>Firestore / RAWG / 2026</span>
      </div>
    </footer>
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

function Navigation({ onOpenAuth, onGoHome, onOpenProfile, isAuthenticated, profileDisplayName, profileBubbleLabel, profileImage, profileColor }: { onOpenAuth: () => void; onGoHome: () => void; onOpenProfile: () => void; isAuthenticated: boolean; profileDisplayName: string; profileBubbleLabel: string; profileImage?: string; profileColor?: string; }) {
  return (
    <nav className="navigation" aria-label="Navegacion principal">
      <div className="nav-left">
        <button type="button" className="brand brand-button" onClick={onGoHome}>GC<span>.</span></button>
      </div>
      <div className="nav-links">
        {isAuthenticated ? null : <a href="#auth" onClick={(event) => { event.preventDefault(); onOpenAuth(); }}>Iniciar sesión</a>}
        <a href="#library">Biblioteca</a>
        <a href="#about">El proyecto</a>
      </div>
      <div className="nav-actions">
        {isAuthenticated ? <span className="nav-user">{profileDisplayName}</span> : null}
        {isAuthenticated ? <ProfileBubble className="profile-bubble" label={profileBubbleLabel} image={profileImage} color={profileColor} onClick={onOpenProfile} /> : null}
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
        <div className="hero-note">+ 1.000<br />titulos<br />indexados</div>
      </div>
    </section>
  );
}

function AuthPage({ screen, onScreenChange, onBack, auth, sessionNotice, profileData, profileLoading, profileSaving, onProfileSave, onSignOut, cookieConsent, onCookieConsentChange, gamesById, savedGames, favoriteGames, recentlyViewedGames, missingFirebaseAuthConfig }: { screen: AuthView; onScreenChange: (screen: AuthView) => void; onBack: () => void; auth: typeof firebaseAuth; sessionNotice: SessionNotice | null; profileData: UserProfileData | null; profileLoading: boolean; profileSaving: boolean; onProfileSave: (draft: ProfileDraft) => Promise<void>; onSignOut: () => void; cookieConsent: boolean; onCookieConsentChange: (consent: boolean) => void; gamesById: Map<string, Game>; savedGames: string[]; favoriteGames: string[]; recentlyViewedGames: string[]; missingFirebaseAuthConfig: string[]; }) {
  return (
    <section className={screen === 'profile' ? 'auth-shell auth-shell-profile' : 'auth-shell auth-shell-split'}>
      <aside className="auth-visual" aria-label="Marca del proyecto">
        <button type="button" className="auth-visual-brand" onClick={onBack}>
          GC<span>.</span>
        </button>
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
        {screen === 'signup' ? <SignupView auth={auth} onScreenChange={onScreenChange} cookieConsent={cookieConsent} onCookieConsentChange={onCookieConsentChange} /> : null}
        {screen === 'forgot' ? <ForgotView auth={auth} onScreenChange={onScreenChange} /> : null}
        {screen === 'cookies' ? <CookiesView onScreenChange={onScreenChange} cookieConsent={cookieConsent} onCookieConsentChange={onCookieConsentChange} /> : null}
        {screen === 'profile' ? <ProfileView profileData={profileData} profileLoading={profileLoading} profileSaving={profileSaving} gamesById={gamesById} savedGames={savedGames} favoriteGames={favoriteGames} recentlyViewedGames={recentlyViewedGames} onSave={onProfileSave} onSignOut={onSignOut} onBack={onBack} /> : null}
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
      return 'No existe el correo.';
    case 'auth/wrong-password':
      return 'La contraseña no es correcta.';
    case 'auth/missing-password':
      return 'Introduce una contraseña válida.';
    default:
      return 'No se pudo completar la operación.';
  }
}

function PasswordField({ value, onChange }: { value: string; onChange: (value: string) => void; }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Contraseña" aria-label="Contraseña" />
      <button type="button" className="password-visibility" onPointerDown={(event) => { event.preventDefault(); setVisible(true); }} onPointerUp={() => setVisible(false)} onPointerLeave={() => setVisible(false)} onPointerCancel={() => setVisible(false)} aria-label="Mantener pulsado para mostrar la contraseña">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>
      </button>
    </div>
  );
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
        await updateUserProfile(result.user.uid, { fullName: result.user.displayName ?? '' });
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
          <PasswordField value={password} onChange={setPassword} />
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
    </>
  );
}

function SignupView({ auth, onScreenChange, cookieConsent, onCookieConsentChange }: { auth: typeof firebaseAuth; onScreenChange: (screen: AuthView) => void; cookieConsent: boolean; onCookieConsentChange: (consent: boolean) => void; }) {
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

    if (!cookieConsent) {
      setStatus('Debes aceptar las cookies para crear una cuenta.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(result.user, { displayName: name.trim() || null });
      await sendEmailVerification(result.user, { url: `${window.location.origin}${window.location.pathname}#auth` });
      await signOut(auth);
      onScreenChange('login');
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
          <span>Nombre personal</span>
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre personal" aria-label="Nombre personal" />
        </label>
        <label>
          <span>Correo electrónico</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Correo electrónico" aria-label="Correo electrónico" />
        </label>
        <label>
          <span>Contraseña</span>
          <PasswordField value={password} onChange={setPassword} />
        </label>
        <label className="checkbox-row checkbox-row-login checkbox-row-top">
          <input type="checkbox" checked={cookieConsent} onChange={(event) => onCookieConsentChange(event.target.checked)} />
          <span>Privacidad y cookies aceptadas</span>
          <button type="button" className="cookie-mini-link" onClick={() => onScreenChange('cookies')}>Ver cookies</button>
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
      </div>
    </>
  );
}

function ProfileBubble({ className, label, image, color, onClick }: { className: string; label: string; image?: string; color?: string; onClick?: () => void; }) {
  const content = image ? <img src={image} alt="Imagen de perfil" /> : label;
  const style = image ? undefined : { background: color || '#d6ed52' };
  return <button type="button" className={className} style={style} onClick={onClick} aria-label="Abrir perfil">{content}</button>;
}

function ProfileGameItem({ gameId, gamesById }: { gameId: string; gamesById: Map<string, Game>; }) {
  const game = gamesById.get(gameId);
  return (
    <div className="profile-game-item">
      <div className="profile-game-thumb">
        {game?.background_image ? <img src={game.background_image} alt={`Portada de ${game.name}`} loading="lazy" /> : <span>GC</span>}
      </div>
      <span className="profile-game-name">{game?.name ?? gameId}</span>
    </div>
  );
}

function ProfileView({ profileData, profileLoading, profileSaving, gamesById, savedGames, favoriteGames, recentlyViewedGames, onSave, onSignOut, onBack }: { profileData: UserProfileData | null; profileLoading: boolean; profileSaving: boolean; gamesById: Map<string, Game>; savedGames: string[]; favoriteGames: string[]; recentlyViewedGames: string[]; onSave: (draft: ProfileDraft) => Promise<void>; onSignOut: () => void; onBack: () => void; }) {
  const [draft, setDraft] = useState<ProfileDraft>(emptyProfileDraft);
  const [activeTab, setActiveTab] = useState<'datos' | 'colecciones' | 'historial'>('datos');
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const [avatarMode, setAvatarMode] = useState<'default' | 'custom'>('default');
  const [avatarError, setAvatarError] = useState('');

  useEffect(() => {
    setDraft({
      displayName: profileData?.displayName ?? '',
      fullName: profileData?.fullName ?? '',
      bio: profileData?.bio ?? '',
      favoritePlatform: profileData?.favoritePlatform ?? '',
      favoriteGenre: profileData?.favoriteGenre ?? '',
      favoriteGame: profileData?.favoriteGame ?? '',
      avatarImage: profileData?.avatarImage ?? '',
      avatarColor: profileData?.avatarColor ?? defaultAvatarColor
    });
    setAvatarMode(profileData?.avatarImage ? 'custom' : 'default');
  }, [profileData]);

  function handleAvatarFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 300 * 1024) {
      setAvatarError('La imagen debe pesar menos de 300 KB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const avatarImage = typeof reader.result === 'string' ? reader.result : '';
      const nextDraft = { ...draft, avatarImage };
      setDraft(nextDraft);
      setAvatarEditorOpen(false);
      void onSave(nextDraft);
      setAvatarError('');
    };
    reader.readAsDataURL(file);
  }

  function updateAvatar(avatarImage: string, avatarColor = draft.avatarColor) {
    const nextDraft = { ...draft, avatarImage, avatarColor };
    setDraft(nextDraft);
    setAvatarEditorOpen(false);
    void onSave(nextDraft);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave(draft);
  }

  return (
    <>
      <div className="profile-bubble-hero">
        <ProfileBubble className="profile-bubble-large" label={getProfileBubbleLabel(profileData ?? undefined, profileData?.displayName ?? null, profileData?.email ?? null)} image={draft.avatarImage} color={draft.avatarColor} />
        <div className="profile-avatar-controls">
          <p className="auth-bottom-title">Burbuja de perfil</p>
          <p className="auth-description auth-description-login">{profileLoading ? 'Cargando tu perfil...' : 'Edita tus datos y gustos cuando quieras.'}</p>
          <p className="profile-counter">{savedGames.length} guardados · {favoriteGames.length} favoritos</p>
          <div className="avatar-popup-anchor">
            <button type="button" className="profile-avatar-edit" onClick={() => setAvatarEditorOpen((current) => !current)}>{avatarEditorOpen ? 'Cerrar opciones' : 'Editar burbuja'}</button>
            {avatarEditorOpen ? (
              <div className="avatar-editor" role="dialog" aria-label="Editar burbuja de perfil">
                <p className="auth-bottom-title">Apariencia</p>
                <div className="avatar-editor-modes">
                  <button type="button" className={avatarMode === 'default' ? 'avatar-mode avatar-mode-active' : 'avatar-mode'} onClick={() => { setAvatarMode('default'); setDraft((current) => ({ ...current, avatarImage: '' })); }}>Por defecto</button>
                  <button type="button" className={avatarMode === 'custom' ? 'avatar-mode avatar-mode-active' : 'avatar-mode'} onClick={() => setAvatarMode('custom')}>Imagen propia</button>
                </div>
                {avatarMode === 'default' ? (
                  <div className="avatar-palette" role="group" aria-label="Paleta de perfil">
                    {avatarPaletteRows.map((row, rowIndex) => <div className="avatar-palette-row" key={`avatar-row-${rowIndex}`}>{row.map((color) => <button type="button" key={color.value} className={`avatar-swatch${draft.avatarColor === color.value && !draft.avatarImage ? ' avatar-swatch-active' : ''}`} style={{ background: color.value }} onClick={() => updateAvatar('', color.value)} aria-label={`Usar color ${color.label}`} />)}</div>)}
                  </div>
                ) : (
                  <div className="avatar-custom-fields">
                    <input type="url" value={draft.avatarImage.startsWith('data:') ? '' : draft.avatarImage} onChange={(event) => setDraft((current) => ({ ...current, avatarImage: event.target.value }))} onBlur={(event) => updateAvatar(event.target.value)} placeholder="Pega un enlace de imagen" aria-label="Enlace de imagen de perfil" />
                    <label className="avatar-file-label">
                      <span>Seleccionar archivo</span>
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleAvatarFile} aria-label="Imagen de perfil del ordenador" />
                    </label>
                    {avatarError ? <p className="auth-status profile-avatar-error">{avatarError}</p> : null}
                  </div>
                )}
                <button type="button" className="avatar-editor-close" onClick={() => setAvatarEditorOpen(false)}>Cerrar</button>
              </div>
            ) : null}
            </div>
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
            <span>Nombre personal</span>
            <input type="text" value={draft.fullName} onChange={(event) => setDraft((current) => ({ ...current, fullName: event.target.value }))} placeholder="Nombre personal" aria-label="Nombre personal" />
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
              {savedGames.length ? savedGames.map((gameId) => <ProfileGameItem key={gameId} gameId={gameId} gamesById={gamesById} />) : <p className="library-lock-copy">Todavía no has guardado ningún juego.</p>}
            </div>
          </div>
          <div className="auth-bottom-block">
            <p className="auth-bottom-title">Favoritos</p>
            <div className="profile-chip-list">
              {favoriteGames.length ? favoriteGames.map((gameId) => <ProfileGameItem key={gameId} gameId={gameId} gamesById={gamesById} />) : <p className="library-lock-copy">Aún no tienes juegos favoritos.</p>}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'historial' ? (
        <div className="auth-bottom-block">
          <p className="auth-bottom-title">Historial reciente</p>
          <div className="profile-chip-list">
            {recentlyViewedGames.length ? recentlyViewedGames.map((gameId) => <ProfileGameItem key={gameId} gameId={gameId} gamesById={gamesById} />) : <p className="library-lock-copy">Aún no has abierto ningún juego.</p>}
          </div>
        </div>
      ) : null}
      {activeTab === 'datos' ? (
        <div className="auth-links-bottom auth-links-bottom-dark profile-footer-actions">
          <button type="button" className="auth-footer-link auth-footer-link-muted" onClick={onBack}>Volver</button>
          <button type="button" className="profile-signout" onClick={onSignOut}>Cerrar sesión</button>
        </div>
      ) : null}
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
      </div>
    </>
  );
}

function CookiesView({ onScreenChange, cookieConsent, onCookieConsentChange }: { onScreenChange: (screen: AuthView) => void; cookieConsent: boolean; onCookieConsentChange: (consent: boolean) => void; }) {
  return (
    <>
      <p className="auth-description auth-description-login">Usamos cookies mínimas para recordar tu consentimiento y mantener una experiencia de acceso coherente.</p>
      <div className="cookie-screen cookie-screen-login">
        <div className="auth-bottom-block auth-bottom-block-full">
          <p className="auth-bottom-title">Cookies</p>
          <p>Las cookies técnicas recuerdan tu decisión de consentimiento. Firebase Auth las necesita para mantener el acceso y la aplicación no activa publicidad ni analítica de terceros.</p>
          <button className={cookieConsent ? 'cookie-button cookie-button-active' : 'cookie-button'} type="button" onClick={() => onCookieConsentChange(!cookieConsent)}>
            {cookieConsent ? 'Cookies aceptadas' : 'Aceptar cookies'}
          </button>
        </div>
      </div>
      <div className="auth-links-bottom">
        <button type="button" className="auth-footer-link" onClick={() => onScreenChange('login')}>Iniciar sesión</button>
        <button type="button" className="auth-footer-link" onClick={() => onScreenChange('signup')}>Registro</button>
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
      <div className="game-image">{game.background_image ? <img src={game.background_image} alt={`Portada de ${game.name}`} loading="lazy" /> : <div className="no-image">SIN PORTADA</div>}<span className="game-id">#{game.id}</span><div className="game-image-actions"><button type="button" className={isFavorite ? 'game-favorite game-favorite-active' : 'game-favorite'} onClick={() => onToggleFavoriteGame(game.id)} aria-label={isFavorite ? `Quitar ${game.name} de favoritos` : `Añadir ${game.name} a favoritos`} aria-pressed={isFavorite}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5S4 15.8 4 9.7C4 6.9 6 5 8.6 5c1.6 0 2.8.8 3.4 2  .6-1.2 1.8-2 3.4-2C18 5 20 6.9 20 9.7c0 6.1-8 10.8-8 10.8Z" /></svg></button><button type="button" className={isSaved ? 'game-saved game-saved-active' : 'game-saved'} onClick={() => onToggleSavedGame(game.id)} aria-label={isSaved ? `Quitar ${game.name} de guardados` : `Guardar ${game.name}`} aria-pressed={isSaved}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5A2.5 2.5 0 0 1 8.5 2h7A2.5 2.5 0 0 1 18 4.5V22l-6-4-6 4V4.5Z" /></svg></button></div><div className="game-hover"><button type="button" className="game-hover-button" onClick={() => onOpenGame(game.id)}>Ver ficha</button><span aria-hidden="true">↗</span></div></div>
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
