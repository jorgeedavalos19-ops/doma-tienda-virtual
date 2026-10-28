# Arquitectura

El frontend está en `public/` y se comunica con `server.js` mediante HTTP/JSON. El backend concentra autenticación, validación de pedidos, cálculo de importes, stock e idempotencia. `data/store.json` es la persistencia central del prototipo.

Para producción, el siguiente paso recomendado es reemplazar el repositorio JSON por PostgreSQL o SQLite con transacciones.
