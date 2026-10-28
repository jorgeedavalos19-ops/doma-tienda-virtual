# DOMA — tienda virtual

Prototipo funcional con catálogo público, carrito, pedidos con retiro en el local, inventario por variante, autenticación administrativa, panel de pedidos y una configuración preparada para PostgreSQL en internet.

## Ejecutar

1. Copiar `.env.example` a `.env` y configurar `DATABASE_URL`.
2. Ejecutar `database/schema.sql` en PostgreSQL.
3. Ejecutar `npm install` y luego `npm start`.
4. Abrir la URL pública del proveedor.

La cuenta inicial usa `ADMIN_EMAIL` y `ADMIN_PASSWORD`. Para probar sin PostgreSQL, el respaldo local se inicia con `npm run start:local`, pero no es la versión pública.

Para desplegar la versión pública se utiliza `server-cloud.js`, `database/schema.sql`, `render.yaml` o `Dockerfile`. La guía está en `docs/Despliegue.md`.

## API principal

- `GET /api/products`
- `POST /api/orders` con `Idempotency-Key`
- `POST /api/auth/login`
- `GET /api/admin/dashboard`
- `GET|POST /api/admin/products`
- `GET /api/admin/orders`
- `PATCH /api/admin/orders/:id`
- `GET /api/admin/customers`
- `GET /api/admin/sales`
