# Seguridad

El prototipo valida pedidos en el servidor, no acepta precios desde el frontend, exige `Idempotency-Key`, controla stock antes de descontarlo y protege rutas administrativas mediante token de sesión.

Pendiente para producción: HTTPS, hash de contraseña con almacenamiento persistente, roles, rate limiting, CSRF según estrategia de sesión, validación avanzada de imágenes, auditoría completa y base de datos transaccional.
