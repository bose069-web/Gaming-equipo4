# Flujo de trabajo Git

Ramas permanentes:

- `main`: versiones estables.
- `develop`: integracion del trabajo validado.

Ramas de trabajo:

- `feature/backend`
- `feature/frontend`
- `feature/firebase`
- `fix/nombre-del-problema`

## Reglas

1. Cada cambio funcional parte de `develop`.
2. Los cambios entran mediante Pull Request.
3. El Pull Request debe describir el cambio y su validacion.
4. No se suben secretos, claves privadas ni archivos `.env`.
5. `main` solo recibe cambios revisados y comprobados.
