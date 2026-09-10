# Arquitectura

```text
RAWG
  |
  v
Importador ETL (scripts)
  |
  v
Firestore (coleccion games)
  |
  v
Backend REST (Express)
  |
  v
Frontend React
```

## Responsabilidades

- RAWG: fuente externa de datos.
- ETL: descarga, normaliza y actualiza registros.
- Firestore: base de datos maestra del proyecto.
- Backend: contrato publico, validacion, paginacion y acceso seguro a Firestore.
- Frontend: experiencia de usuario; no conoce la estructura interna de Firestore.

El backend debe ser la unica capa que lea o escriba la base de datos desde las aplicaciones.
