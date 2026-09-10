# Modelo de datos

## Collection: `games`

| Campo | Tipo | Descripcion |
|---|---|---|
| `id` | string | Identificador estable del documento |
| `name` | string | Nombre del juego |
| `rating` | number | Valoracion; puede faltar |
| `released` | string | Fecha de lanzamiento en formato ISO; puede faltar |
| `background_image` | string | URL de imagen; puede faltar |
| `platforms` | string[] | Plataformas disponibles |

El backend devuelve un contrato estable aunque falten campos en Firestore.
