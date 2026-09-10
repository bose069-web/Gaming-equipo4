# Gaming Catalog

Repositorio propio de videojuegos alimentado desde RAWG y servido mediante una API propia.

## Arquitectura

```text
RAWG -> Importacion ETL -> Firestore -> Backend REST -> Frontend React
```

El frontend no accede directamente a Firestore. Toda lectura pasa por el backend.

## Estructura

- `backend/`: API REST con Express, TypeScript y Firebase Admin.
- `frontend/`: interfaz React preparada para consumir la API.
- `web/`: preview estatico que puede abrirse directamente en el navegador sin Node.js.
- `docs/`: arquitectura, modelo de datos, ETL y flujo Git.
- `scripts/`: espacio reservado para importadores y tareas operativas.

## Puesta en marcha

Requisitos: Node.js 20+ y npm.

```bash
npm install
copy backend/.env.example backend/.env
npm run dev
```

La API queda disponible en `http://localhost:3000`.

Para ejecutar el frontend:

```bash
npm run dev:frontend
```

Si no puedes instalar Node.js, abre `web/index.html` directamente en el navegador para ver una preview funcional con busqueda local y datos de ejemplo.

El frontend usa `VITE_API_URL` y por defecto apunta a `http://localhost:3000`.

## Firebase

Configura las credenciales de Firebase Admin en `backend/.env`. No subas claves privadas al repositorio.
Mientras no exista una credencial válida, el backend arranca pero devuelve un error claro al consultar Firestore.
