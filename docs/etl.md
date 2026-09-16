# Flujo ETL

El ETL transforma datos externos de RAWG en documentos compatibles con la colección `games` de Firestore.

## Objetivo

```text
RAWG API -> extracción -> normalización -> validación -> Firestore/games
```

El frontend nunca consume RAWG directamente. La aplicación solo lee el modelo interno que expone el backend.

## Fases

### 1. Extracción

El importador solicita páginas de RAWG respetando:

- la paginación de la API;
- los límites de peticiones;
- la disponibilidad de la clave de RAWG;
- los errores temporales de red.

Cada página debe poder reintentarse sin duplicar documentos.

### 2. Transformación

Cada resultado externo se transforma al modelo interno:

- `id` usa el identificador estable de RAWG;
- `name` conserva el nombre legible;
- `rating` se conserva como número cuando existe;
- `released` se conserva como fecha ISO cuando existe;
- `background_image` contiene la URL de la portada;
- `platforms` se convierte a una lista de nombres.

Los campos que RAWG no proporcione se guardan con valores compatibles con el contrato del backend.

### 3. Validación

Antes de escribir en Firestore se comprueba que:

- exista un identificador estable;
- el nombre tenga un valor utilizable;
- las plataformas sean una lista;
- la valoración sea numérica o esté ausente;
- la fecha mantenga un formato reconocible.

Los registros inválidos se registran como errores y no deben detener toda la importación.

### 4. Persistencia

La escritura debe ser idempotente:

- usar el ID estable como ID del documento;
- utilizar `set` o upsert en lugar de crear documentos aleatorios;
- poder repetir una página sin crear duplicados;
- registrar cuántos documentos se crearon o actualizaron.

La colección de destino es `games`.

## Métricas recomendadas

Cada ejecución debería informar, como mínimo:

- páginas solicitadas;
- registros recibidos;
- registros válidos;
- documentos creados;
- documentos actualizados;
- registros rechazados;
- errores de red;
- duración total.

## Coste y límites

La importación debe ejecutarse de forma controlada porque cada escritura tiene coste y porque RAWG también puede limitar las peticiones. Para la aplicación web, las lecturas se reducen mediante:

- pool de 20 juegos destacados;
- caché de 30 minutos para destacados;
- paginación de la biblioteca;
- contratos pequeños que no duplican la ficha completa en el perfil.

## Credenciales

Las credenciales de RAWG y Firebase deben permanecer fuera del repositorio:

- no guardar claves en el código;
- no subir `.env`;
- no subir el JSON de Firebase Admin;
- usar variables de entorno en local;
- revisar `.gitignore` antes de compartir cambios.
