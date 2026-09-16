# Flujo de trabajo Git

El proyecto se desarrolla y valida en local. Este documento organiza los cambios para que sean fáciles de revisar y no incluye pasos de despliegue.

## Antes de empezar

1. Actualiza tu rama de trabajo.
2. Comprueba que el proyecto arranca en local.
3. Lee la documentación relacionada con el cambio.
4. No modifiques archivos `.env` para incluirlos en Git.

## Tipos de cambio

Usa nombres claros para las ramas cuando el repositorio remoto esté activo:

- `feature/frontend-descripcion`
- `feature/backend-descripcion`
- `feature/firebase-descripcion`
- `fix/descripcion-del-problema`
- `docs/descripcion-del-cambio`

Si solo estás trabajando en local, conserva igualmente ese formato para que el historial sea legible.

## Secuencia recomendada

1. Identifica el código que controla el comportamiento.
2. Haz un cambio pequeño y concreto.
3. Ejecuta la comprobación más cercana al cambio.
4. Revisa el diff.
5. Comprueba que no aparecen secretos ni archivos generados.
6. Documenta cualquier decisión relevante.

## Comprobaciones

Desde la raíz del proyecto:

```bash
npm run typecheck
```

Para comprobar también las compilaciones locales:

```bash
npm run build
```

Si el cambio afecta al frontend, revisa el flujo en el navegador con el backend local activo. Si afecta a Firebase, comprueba login, verificación de correo y lectura del perfil.

## Seguridad

Nunca subas:

- `frontend/.env`;
- `scripts/backend/.env`;
- JSON de cuentas de servicio;
- tokens de Firebase;
- claves de RAWG;
- datos reales de usuarios.

Antes de confirmar cambios, revisa:

```bash
git status
```

Y comprueba que los archivos sensibles no aparecen en el conjunto preparado para commit.

## Commits

Usa mensajes breves y descriptivos:

- `feat: add saved games`
- `fix: protect library with verified email`
- `docs: reorganize local setup`
- `refactor: simplify profile state`

Un commit debe representar un cambio coherente. Evita mezclar una modificación visual, un cambio de API y una limpieza no relacionada en el mismo commit.

## Documentación

Actualiza el documento especializado cuando cambie una responsabilidad:

- arquitectura o flujo general: `docs/architecture.md`;
- campos o colecciones: `docs/data-model.md`;
- importación: `docs/etl.md`;
- instrucciones de uso: `README.md`.
