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

## Ejemplo verificado

La importacion actual ya contiene documentos como `10001` con esta forma:

```json
{
	"id": 10001,
	"name": "Serious Sam Fusion 2017 (beta)",
	"rating": 3.05,
	"released": "2017-03-20",
	"background_image": "https://media.rawg.io/media/games/21b/21...",
	"platforms": ["PC", "macOS", "Linux"]
}
```

El backend utiliza el ID del documento de Firestore como identificador publico y lo normaliza a texto en sus respuestas HTTP. Por tanto, los IDs numericos importados desde RAWG son compatibles con la API.
