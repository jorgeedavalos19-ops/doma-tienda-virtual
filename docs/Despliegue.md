# Despliegue público

La aplicación tiene dos superficies separadas:

- `public/`: tienda para clientes.
- `admin/`: panel privado en `/admin/`.
- `server-cloud.js`: API conectada a PostgreSQL.

## Publicar

1. Crear una base PostgreSQL administrada.
2. Ejecutar `database/schema.sql` en esa base.
3. Configurar `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `PUBLIC_URL` y `NODE_ENV=production`.
4. Desplegar el servicio Node con `node server-cloud.js`.
5. Configurar el dominio HTTPS del servicio.

`render.yaml` deja preparada una configuración para Render. También se incluye `Dockerfile` para otros proveedores.

El servidor local anterior (`server.js`) se conserva como respaldo de desarrollo con `data/store.json`. El servidor público debe usar `server-cloud.js` y PostgreSQL.
