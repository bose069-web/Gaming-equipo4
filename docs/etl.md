# Flujo de importacion

```text
RAWG API -> Import Script -> Normalizacion -> Firestore/games
```

El importador debe:

1. Leer paginas de RAWG respetando sus limites de peticiones.
2. Convertir cada resultado al modelo `games`.
3. Usar el identificador de RAWG como clave estable cuando sea posible.
4. Escribir mediante operaciones idempotentes (`set` o upsert).
5. Registrar errores y continuar con el resto de paginas.
6. Guardar metricas de registros procesados, creados, actualizados y fallidos.

Las credenciales de RAWG y Firebase se mantienen fuera del repositorio.
