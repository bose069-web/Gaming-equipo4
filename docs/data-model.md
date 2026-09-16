# Modelo de datos

Este documento describe las colecciones que usa la aplicación y la forma en que el backend las transforma en respuestas seguras.

## 1. Colección `games`

`games` contiene el catálogo normalizado desde RAWG. Los documentos son la fuente de lectura del backend y no se editan desde la aplicación.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---:|---|
| `id` | string | sí | ID público del documento de Firestore. |
| `name` | string | sí | Nombre del juego. |
| `rating` | number o `null` | no | Valoración numérica. |
| `released` | string o `null` | no | Fecha de lanzamiento en formato ISO. |
| `background_image` | string o `null` | no | URL de la imagen de portada. |
| `platforms` | string[] | sí | Plataformas disponibles. |

### Ejemplo

```json
{
  "id": "10001",
  "name": "Serious Sam Fusion 2017 (beta)",
  "rating": 3.05,
  "released": "2017-03-20",
  "background_image": "https://media.rawg.io/media/games/21b/21...",
  "platforms": ["PC", "macOS", "Linux"]
}
```

El backend utiliza el ID del documento de Firestore como identificador público y lo normaliza a texto. Por eso los IDs numéricos importados desde RAWG siguen siendo compatibles con la API.

## 2. Colección `users`

Cada usuario autenticado tiene un documento en `users/{uid}`. El `uid` coincide con el identificador de Firebase Authentication.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---:|---|
| `uid` | string | sí | Identificador de Firebase Auth. |
| `email` | string | sí | Correo de la cuenta. |
| `displayName` | string | sí | Nombre visible del usuario. |
| `emailVerified` | boolean | sí | Estado de verificación del correo. |
| `registeredAt` | timestamp | no | Momento del registro. |
| `lastLoginAt` | timestamp | no | Último inicio de sesión registrado. |
| `bio` | string | no | Biografía editable. |
| `favoritePlatform` | string | no | Plataforma favorita. |
| `favoriteGenre` | string | no | Género favorito. |
| `favoriteGame` | string | no | Juego favorito escrito por el usuario. |
| `savedGames` | string[] | no | IDs de juegos guardados. |
| `favoriteGames` | string[] | no | IDs de juegos favoritos. |
| `recentlyViewedGames` | string[] | no | Hasta 10 IDs abiertos recientemente. |

### Ejemplo

```json
{
  "uid": "firebase-user-id",
  "email": "jugador@example.com",
  "displayName": "Jugador",
  "emailVerified": true,
  "bio": "Me gustan los RPG.",
  "favoritePlatform": "PC",
  "favoriteGenre": "RPG",
  "favoriteGame": "Chrono Trigger",
  "savedGames": ["10001", "10008"],
  "favoriteGames": ["10008"],
  "recentlyViewedGames": ["10008", "10001"]
}
```

## 3. Propiedad de los datos

- `games` es catálogo compartido y de solo lectura para la aplicación.
- `users/{uid}` es privado y pertenece únicamente al usuario cuyo `uid` coincide.
- Las listas personales guardan IDs, no copias completas de juegos.
- Si un juego desaparece del catálogo, su ID puede permanecer temporalmente en una lista personal; la interfaz usa el ID como fallback.

## 4. Normalización del backend

El repositorio convierte cada documento de Firestore a un contrato estable:

- campos de texto ausentes se convierten en `''` o `null` según el contrato;
- `rating` solo se conserva si es numérico;
- `platforms` siempre se devuelve como array;
- la respuesta siempre incluye `id`, `name`, `rating`, `released`, `background_image` y `platforms`.

Así el frontend no necesita conocer las variaciones de los documentos originales.

## 5. Lecturas y coste

- La landing solicita como máximo dos juegos destacados.
- El backend mantiene un pool de 20 juegos durante 30 minutos.
- La biblioteca solicita 21 documentos para mostrar 20 y detectar si existe una página siguiente.
- Las colecciones del usuario se guardan como arrays pequeños de IDs.
