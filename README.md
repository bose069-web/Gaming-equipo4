# Gaming Catalog

Catálogo de videojuegos en castellano. El proyecto importa juegos desde RAWG, los normaliza en Firestore y los sirve mediante una API REST local que consume el frontend React.

> Estado actual: el proyecto se ejecuta únicamente en local. No hay despliegue activo ni URL pública.

## Índice

- [Qué hace el proyecto](#qué-hace-el-proyecto)
- [Arquitectura rápida](#arquitectura-rápida)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Requisitos](#requisitos)
- [Configuración local](#configuración-local)
- [Arrancar la aplicación](#arrancar-la-aplicación)
- [Flujo de usuario](#flujo-de-usuario)
- [Documentación técnica](#documentación-técnica)
- [Comprobaciones](#comprobaciones)
- [Reglas importantes](#reglas-importantes)

## Qué hace el proyecto

La aplicación ofrece:

- landing pública con dos juegos destacados;
- registro e inicio de sesión con Firebase Auth;
- verificación obligatoria del correo electrónico;
- biblioteca protegida para usuarios verificados;
- búsqueda y paginación de juegos;
- perfil en forma de burbuja, sin avatar;
- datos editables del perfil;
- juegos guardados y favoritos;
- historial de juegos abiertos recientemente.

El frontend nunca accede directamente al catálogo de Firestore. Las lecturas de juegos pasan por el backend. El perfil del usuario se guarda en `users/{uid}` mediante el SDK de Firebase del frontend.

## Arquitectura rápida

```text
RAWG API
   |
   v
Importador ETL -> Firestore/games
                       |
                       v
               Backend REST local
                       |
                       v
                Frontend React/Vite
```

El endpoint público `/games/featured` usa un pool de 20 juegos cacheado durante 30 minutos. La biblioteca protegida carga páginas de 20 juegos para reducir lecturas en el plan gratuito de Firebase.

## Estructura del repositorio

```text
.
├── docs/
│   ├── architecture.md   # arquitectura y decisiones técnicas
│   ├── data-model.md      # colecciones y campos de Firestore
│   ├── etl.md             # importación y normalización desde RAWG
│   └── git-workflow.md    # flujo de cambios y validación
├── frontend/
│   ├── src/main.tsx       # shell de la aplicación y vistas
│   ├── src/firebase.ts     # Auth y perfil de usuario
│   └── src/styles.css      # estilos de la interfaz
├── scripts/backend/
│   └── src/
│       ├── server.ts       # Express, middleware y rutas públicas
│       ├── firebase.ts     # Firebase Admin
│       ├── repositories/   # acceso y normalización de juegos
│       └── routes/         # rutas protegidas de juegos
├── firestore.rules         # reglas recomendadas de Firestore
├── web/index.html          # preview estática independiente
├── package.json            # workspaces y comandos raíz
└── package-lock.json
```

### Qué hace cada carpeta

#### `docs/`

Documentación funcional y técnica del proyecto. Existe para separar las explicaciones del código y evitar que el README se convierta en un documento demasiado difícil de mantener.

- `architecture.md`: capas, responsabilidades, seguridad, flujo de datos y ejecución local.
- `data-model.md`: colecciones de Firestore, campos y reglas de propiedad.
- `etl.md`: proceso para importar datos desde RAWG.
- `git-workflow.md`: forma de organizar cambios y validarlos.

#### `frontend/`

Workspace independiente de Vite, React y TypeScript. Existe para contener toda la interfaz que ve el usuario y su estado de sesión.

- `src/`: código fuente de la aplicación.
        - `main.tsx`: shell principal, navegación, autenticación, landing, biblioteca, perfil y tarjetas de juegos.
        - `firebase.ts`: inicialización del SDK cliente, lectura y escritura del perfil privado y helpers de Firebase Auth.
        - `styles.css`: diseño visual de todas las vistas.
        - `vite-env.d.ts`: tipos de Vite disponibles en TypeScript.
- `index.html`: documento HTML base que monta React en `#root`.
- `vite.config.ts`: configuración del servidor de desarrollo y del plugin React.
- `tsconfig.json`: reglas de compilación y comprobación TypeScript del frontend.
- `.env`: configuración local real; no se sube al repositorio.
- `.env.example`: plantilla de variables sin secretos.
- `package.json`: comandos y dependencias del frontend.
- `dist/`: salida generada por `vite build`; no es código fuente.
- `node_modules/`: dependencias instaladas; se genera con npm y no se versiona.

#### `scripts/`

Contenedor de tareas operativas que no forman parte directamente de la interfaz. Existe para separar la importación, los servicios y otros procesos auxiliares del código visual.

- `.gitkeep`: conserva la carpeta en Git aunque todavía no haya más scripts en su raíz.
- `backend/`: workspace del servidor local.

#### `scripts/backend/`

API REST local con Express, Firebase Admin y TypeScript. Existe para encapsular el acceso compartido a `games`, validar tokens y exponer contratos HTTP.

- `src/`: código fuente del backend.
        - `server.ts`: crea Express, configura CORS y JSON, registra `/health`, publica `/games/featured` y aplica el middleware de verificación.
        - `config.ts`: carga y valida la configuración de entorno del servidor.
        - `firebase.ts`: inicializa Firebase Admin y expone Firestore para el backend.
        - `repositories/`: acceso a datos sin mezclarlo con HTTP.
                - `gameRepository.ts`: lee juegos, normaliza documentos, pagina, busca, obtiene destacados y aplica la caché del pool de 20 juegos.
        - `routes/`: endpoints protegidos agrupados por recurso.
                - `games.ts`: listado, búsqueda, mejores valorados y detalle de juegos.
        - `types/`: tipos compartidos del dominio del backend.
                - `game.ts`: modelo `Game` y parámetros de consulta.
- `credentials/`: ubicación local para credenciales de Firebase Admin; está excluida por `.gitignore` y nunca debe subirse.
- `.env`: configuración local real del backend; no se sube.
- `.env.example`: plantilla de configuración del backend.
- `tsconfig.json`: configuración TypeScript del servidor.
- `package.json`: scripts `dev`, `build`, `start` y `typecheck` del backend.
- `dist/`: JavaScript generado por la compilación; no es código fuente.
- `node_modules/`: dependencias instaladas del backend.

#### `web/`

Preview estática independiente. Existe para poder abrir una demostración sencilla sin arrancar Node, Firebase ni el backend. Usa datos de ejemplo y no representa el flujo completo de autenticación.

- `index.html`: HTML, estilos y lógica local de la preview.

#### Archivos de configuración de la raíz

- `package.json`: workspace npm y comandos para ejecutar o validar ambos proyectos.
- `package-lock.json`: versiones exactas de dependencias instaladas.
- `firestore.rules`: reglas recomendadas de acceso a `users` y `games`.
- `.gitignore`: evita subir dependencias, compilaciones, entornos y credenciales.

#### Carpetas generadas o locales

- `node_modules/`: dependencias instaladas por npm.
- `frontend/dist/` y `scripts/backend/dist/`: compilaciones generadas.
- `frontend/.env` y `scripts/backend/.env`: configuración local.
- `scripts/backend/credentials/`: credenciales privadas locales.

Estas carpetas existen durante el desarrollo, pero no contienen código que deba editarse manualmente ni formar parte del repositorio.

## Requisitos

- Node.js 20 o superior.
- npm.
- Un proyecto de Firebase con Authentication y Firestore.
- Proveedor `Email/Password` activo en Firebase Authentication.
- Credenciales de Firebase Admin para el backend local.

## Configuración local

### Frontend

Crea `frontend/.env`:

```bash
VITE_API_URL=http://localhost:3002
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto
VITE_FIREBASE_APP_ID=tu_app_id
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id
```

### Backend

Crea `scripts/backend/.env`:

```bash
PORT=3002
FIREBASE_PROJECT_ID=tu-proyecto
GOOGLE_APPLICATION_CREDENTIALS=Credentials/firebase-service-account.json
```

No subas archivos `.env`, claves privadas ni el JSON de la cuenta de servicio.

### Firestore

Las reglas recomendadas están en [firestore.rules](firestore.rules). En Firebase Console, entra en `Build > Firestore Database > Rules`, pega las reglas y publícalas.

La aplicación usa estas colecciones:

- `games`: catálogo leído por el backend.
- `users/{uid}`: perfil y listas personales del usuario.

## Arrancar la aplicación

Desde la raíz, instala las dependencias:

```bash
npm install
```

En una terminal, arranca el backend:

```bash
npm run dev
```

Queda disponible en `http://localhost:3002`.

En otra terminal, arranca el frontend:

```bash
npm run dev:frontend
```

Vite mostrará la URL local del frontend, normalmente `http://localhost:5173`.

También se pueden ejecutar desde sus carpetas respectivas:

```bash
cd scripts/backend
npm run dev
```

```bash
cd frontend
npm run dev
```

Para ver solo la preview estática, abre [web/index.html](web/index.html) directamente en el navegador. Esa preview usa datos de ejemplo y no necesita backend ni Firebase.

## Flujo de usuario

1. El visitante entra en la landing y ve juegos destacados.
2. Al abrir `Iniciar sesión`, puede entrar, registrarse, recuperar la contraseña o consultar cookies.
3. Al registrarse, Firebase crea la cuenta y envía un correo de verificación.
4. El usuario confirma el correo y vuelve a iniciar sesión.
5. El backend acepta el token solo si el correo está verificado.
6. La biblioteca se carga en páginas de 20 juegos.
7. Las tarjetas permiten guardar juegos o marcarlos como favoritos.
8. `Ver ficha` actualiza los 10 juegos más recientes del historial.
9. La burbuja del header abre el perfil con las pestañas `Datos`, `Guardados` e `Historial`.

## Documentación técnica

- [Arquitectura](docs/architecture.md): capas, flujo de datos, seguridad, coste y ejecución local.
- [Modelo de datos](docs/data-model.md): documentos `games` y `users/{uid}`.
- [ETL](docs/etl.md): importación, normalización y control de errores.
- [Flujo Git](docs/git-workflow.md): cambios, validaciones y trabajo local.
- [Reglas de Firestore](firestore.rules): permisos para usuarios y juegos.

## Comprobaciones

TypeScript de backend y frontend:

```bash
npm run typecheck
```

Build local:

```bash
npm run build
```

El proyecto no tiene actualmente un entorno de despliegue configurado. Las comprobaciones están orientadas al desarrollo local.

## Reglas importantes

- El backend es la única capa que lee la colección `games` desde la aplicación.
- La biblioteca requiere Firebase Auth y correo verificado.
- Las listas personales guardan IDs de juegos, no copias completas de documentos.
- No se deben subir secretos, `.env` ni credenciales de Firebase.
- Los cambios deben validarse con `npm run typecheck` antes de considerarse terminados.
