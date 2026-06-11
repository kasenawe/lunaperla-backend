# Backend Luna Gold - Mercado Pago + Supabase

API backend con integración completa: pagos, persistencia en Supabase, emails automáticos, dashboard y soporte administrativo para productos, categorias y colecciones.

Autenticación actualizada en Fase 1:

- usuarios reales en tabla `users`
- login por `email` + `password`
- password hasheada con `bcrypt`
- JWT con `sub = user.id`
- payload JWT con `id`, `email` y `role`
- middleware de autenticación y autorización por rol para rutas administrativas

Actualización reciente:

- `products.product_code` para código interno/SKU de producto
- `orders.product_code` para trazabilidad en pedidos
- restricción de unicidad en `products.product_code` (permite `NULL`)
- soporte inicial para variantes de producto mediante `product_variants`

La estructura de catalogo ya soporta:

- categorias reales en tabla `categories`
- colecciones opcionales en tabla `collections`
- propagacion de cambios de categoria/coleccion hacia `products`
- fallback de compatibilidad cuando la fase 2 todavia no fue migrada

## 🏗️ Estructura del Proyecto

```
lunaperla/           # Frontend (React + Vite)
lunaperla-backend/   # Backend (Node.js + Express) ← Estás aquí
```

### Arquitectura Modular (actual)

```text
src/
  app.js                 # Crea y configura Express (sin listen)
  server.js              # Entry point local (app.listen)
  config/
    env.js               # Variables de entorno centralizadas
  clients/
    supabaseClient.js
    mercadoPagoClient.js
    resendClient.js
  routes/
    index.js             # Registro central de rutas API
    publicRoutes.js
    adminRoutes.js
    paymentRoutes.js
    dashboardRoutes.js
  views/
    index.js             # Rutas HTML (dashboard)
  middlewares/
    notFound.js
    errorHandler.js
  utils/
    slug.js
    catalog.js
    storage.js
```

## 📋 Requisitos

- Node.js v16+
- npm o yarn
- Cuentas en: Mercado Pago, Supabase, Resend (opcional)
- Bucket de Supabase Storage para imágenes de productos (por defecto: `products`)

## ⚡ Inicio Rápido

1. **Instalar dependencias:**

   ```bash
   npm install
   ```

2. **Crear archivo `.env`:**

   ```bash
   # Mercado Pago (https://www.mercadopago.com.uy/developers)
   MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...

   # URLs locales (desarrollo) o producción (HTTPS requerido)
   FRONTEND_URL=http://localhost:3000
   BACKEND_URL=http://localhost:3001

   # Supabase (https://supabase.com)
   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_ANON_KEY=tu-anon-key
   SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
   SUPABASE_STORAGE_BUCKET=products

   ```

# Resend - Email automático (https://resend.com) - OPCIONAL

RESEND*API_KEY=re*...

# Bootstrap inicial de admin (opcional, solo primera vez si la tabla users está vacía)

INITIAL_ADMIN_EMAIL=admin@lunagold.com
INITIAL_ADMIN_PASSWORD=TuPasswordSegura123!

# Puerto

PORT=3001

````

3. **Ejecutar servidor:**
```bash
npm run dev    # Desarrollo (con nodemon)
npm start      # Producción
````

## ⚙️ Configuración Detallada

Ver [README-Supabase.md](README-Supabase.md) para configuración completa de base de datos, trigger `updated_at` y Storage.

Setup recomendado actual:

- Ejecuta [supabase-setup.sql](supabase-setup.sql) para crear o completar todo el esquema final de catálogo y órdenes.
- Ejecuta [supabase-phase1-users.sql](supabase-phase1-users.sql) para habilitar usuarios reales y roles.
- Ejecuta [supabase-seed.sql](supabase-seed.sql) solo si querés cargar productos y variantes iniciales de ejemplo.

**Mercado Pago:**

- Dashboard: https://www.mercadopago.com.uy/developers
- Copiar **Access Token** de Producción

**Resend (Emails automáticos - opcional):**

- Dashboard: https://resend.com
- Crear API Key
- Verificar dominio para emails profesionales

## 🔌 API Endpoints

### POST /api/create-payment

Crear preferencia de pago en Mercado Pago y guardar orden en Supabase.

**Body:**

```json
{
  "product": {
    "name": "Canasta trenzada",
    "product_code": "LP-CAN-001",
    "price": 299,
    "description": "Descripción del producto"
  },
  "customerData": {
    "name": "Juan Pérez",
    "email": "juan@email.com",
    "phone": "099123456"
  }
}
```

**Response:** `{id, init_point, orderId}`

### POST /api/webhook

Webhook automático de Mercado Pago. Actualiza órdenes y envía emails de confirmación.

### GET /api/products

Obtener productos activos para mostrar en tienda.

Si se envía `?all=true`, devuelve también productos inactivos para el panel admin.

**Response:**

```json
[
  {
    "id": "uuid",
    "name": "Anillo Luna Gold",
    "product_code": "LP-ANI-001",
    "price": 299.99,
    "image_url": "1776975642449-alianzas.png",
    "description": "...",
    "category": "Alianzas",
    "category_slug": "alianzas",
    "collection": "Clasicas",
    "collection_slug": "clasicas",
    "active": true
  }
]
```

### GET /api/categories

Devuelve las categorías disponibles del catálogo. Con `?all=true` incluye también las inactivas para el panel admin.

**Response:**

```json
[
  {
    "slug": "bebe",
    "name": "Coleccion Bebe",
    "description": "Caravanas y joyas delicadas para bebe.",
    "active": true,
    "sort_order": 0
  },
  {
    "slug": "alianzas",
    "name": "Alianzas",
    "description": "Anillos y alianzas para compromiso, boda o regalo.",
    "active": true,
    "sort_order": 1
  }
]
```

### POST /api/categories

Crea una categoría con `slug`, `name`, `description`, `active` y `sort_order`.

### PUT /api/categories/:slug

Actualiza una categoría y propaga cambios de `slug`/`name` a productos y colecciones asociadas.

### DELETE /api/categories/:slug

Elimina una categoría si no tiene productos ni colecciones asociadas.

### POST /api/upload-image-token

Genera un token de subida (signed upload URL) para que el frontend suba la imagen directamente a Supabase Storage.

- Content-Type: `application/json`
- Body esperado:

```json
{
  "filename": "alianzas.png",
  "content_type": "image/png"
}
```

**Response:**

```json
{
  "signed_url": "https://PROJECT.supabase.co/storage/v1/object/sign/products/....",
  "path": "1776975642449-alianzas.png",
  "public_url": "https://PROJECT.supabase.co/storage/v1/object/public/products/1776975642449-alianzas.png"
}
```

Notas:

- El archivo binario no pasa por la función serverless de Vercel, evitando el error `FUNCTION_PAYLOAD_TOO_LARGE`.
- El frontend debe hacer un `PUT` directo a `signed_url` con el archivo y luego guardar `path` en `products.image_url`.

### GET /api/collections

Devuelve las colecciones disponibles. Soporta `?all=true` y `?category_slug=...`.

**Response:**

```json
[
  {
    "slug": "abridores",
    "name": "Abridores",
    "description": "Modelos clasicos para bebes y niñas.",
    "category_slug": "bebe",
    "active": true,
    "sort_order": 0
  }
]
```

### POST /api/collections

Crea una colección con `slug`, `name`, `description`, `category_slug`, `active` y `sort_order`.

### PUT /api/collections/:slug

Actualiza una colección y propaga cambios a los productos asociados.

### DELETE /api/collections/:slug

Elimina una colección si no tiene productos asociados.

### POST /api/products

Crea un producto en la tabla `products`.

**Body:**

```json
{
  "name": "Alianzas",
  "product_code": "LP-ALI-001",
  "price": 250,
  "image_url": "1776975642449-alianzas.png",
  "description": "Par de alianzas de oro",
  "category": "Alianzas",
  "category_slug": "alianzas",
  "collection": "Clasicas",
  "collection_slug": "clasicas",
  "active": true
}
```

Notas:

- `product_code` es opcional.
- Si se envía, debe ser único entre productos.
- Si existe un duplicado, la API responde `409` con el mensaje: `Ya existe un producto con ese código de producto`.

Si la creación falla después de subir una imagen, el backend intenta eliminar esa imagen para evitar archivos huérfanos.

### GET /api/products

Cada producto puede incluir una lista `variants` con variantes activas ordenadas por `sort_order`.
Si la tabla `product_variants` todavía no existe, la API devuelve el producto sin variantes para mantener compatibilidad durante la migración.

### GET /api/products/:id/variants

Lista variantes de un producto (admin) ordenadas por `sort_order` y `label`.

### POST /api/products/:id/variants

Crea una variante para un producto.

- Requiere: `sku`, `label`, `price`.
- Opcionales: `karat`, `width_mm`, `profile`, `closure_type`, `metadata`, `sort_order`, `active`.
- Si se repite `sku` o `label` para el mismo producto, responde `409`.

### PUT /api/products/:id/variants/:variantId

Actualiza una variante existente con los mismos campos del endpoint de creación.

### DELETE /api/products/:id/variants/:variantId

Elimina una variante existente.

### PUT /api/products/:id

Actualiza un producto existente.

- Si la imagen cambió, elimina la imagen anterior del bucket.
- `updated_at` se actualiza automáticamente desde Supabase mediante trigger.

### DELETE /api/products/:id

Elimina el producto y también elimina su imagen asociada del bucket, si existe.

### Seed inicial opcional

Archivo disponible: `supabase-seed.sql`.

- Inserta productos base de ejemplo si todavía no existen.
- Genera variantes base para productos de `alianzas` (18K y 10K) que todavía no tengan variantes.
- Genera variante base para productos de `bebe` sin variantes (incluye abridores/tix).
- Es idempotente: no duplica registros ya existentes.

### GET /api/orders

Todas las órdenes guardadas.

### GET /api/orders/:orderId

Orden específica.

### GET /api/dashboard/stats

Estadísticas para el dashboard (total, pendientes, aprobados, ingresos).

### GET /dashboard

Dashboard HTML administrativo completo con estadísticas en tiempo real.

### POST /api/test-email

Probar envío de emails (desarrollo). Body: `{email: "test@example.com"}`

## 📧 Emails Automáticos (Resend)

Cuando un pago es aprobado, se envía automáticamente un email profesional con:

- ✨ Diseño premium con branding Luna Gold
- 📦 Detalles completos del pedido (producto, precio, fecha, ID)
- 📱 Información de contacto para soporte
- 🎨 Template HTML personalizado

**Uso:**

1. Crear cuenta en https://resend.com
2. Obtener API Key y completar `RESEND_API_KEY` en `.env`
3. (Recomendado) Verificar dominio para emails profesionales

**Prueba:**

```bash
curl -X POST http://localhost:3001/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"email":"tu-email@ejemplo.com"}'
```

## 📊 Dashboard Administrativo

Acceso en `http://localhost:3001/dashboard` (o producción)

**Características:**

- Estadísticas en tiempo real: Total pedidos, pendientes, aprobados, ingresos
- Tabla con últimos 20 pedidos
- Incluye columna de `Codigo` (valor de `orders.product_code`)
- Estados visuales (colores: amarillo, verde, rojo)
- Auto-refresh cada 30 segundos
- Responsive (móvil + desktop)
- Protegido por JWT (Bearer token)

## 🔐 Autenticación JWT (Admin)

### POST /api/auth/register

Registrar un usuario customer con `email`, `password`, `first_name`, `last_name` y `phone`.

### POST /api/auth/login

Login por `email` + `password`. Devuelve `accessToken` y el usuario autenticado.

**Body:**

```json
{
  "email": "admin@lunagold.com",
  "password": "tu-password"
}
```

### GET /api/auth/me

Devuelve el usuario autenticado a partir del JWT.

### PUT /api/auth/profile

Actualiza perfil básico del usuario autenticado (`email`, `first_name`, `last_name`, `phone`).

**Body:**

```json
{
  "email": "admin@lunagold.com",
  "first_name": "Luna",
  "last_name": "Gold",
  "phone": "099123456"
}
```

**Response:**

```json
{
  "accessToken": "eyJ...",
  "tokenType": "Bearer",
  "expiresIn": "12h"
}
```

Usar el token en rutas protegidas con header:

```text
Authorization: Bearer <accessToken>
```

Rutas protegidas:

- `/api/products?all=true`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`
- `POST /api/upload-image-token`
- `POST /api/categories`
- `PUT /api/categories/:slug`
- `DELETE /api/categories/:slug`
- `POST /api/collections`
- `PUT /api/collections/:slug`
- `DELETE /api/collections/:slug`
- `GET /api/orders`
- `GET /api/orders/:orderId`
- `GET /api/dashboard/stats`
- `POST /api/test-email`

Protección por rol:

- las rutas admin requieren `role = admin`
- las rutas de perfil requieren JWT válido
- el acceso público de catálogo y pagos se mantiene sin cambios

## 🛍️ Integración con Panel Admin Frontend

El frontend en `../lunaperla` consume estos endpoints para el panel `/admin`:

- `GET /api/products?all=true`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`
- `GET /api/categories?all=true`
- `POST /api/categories`
- `PUT /api/categories/:slug`
- `DELETE /api/categories/:slug`
- `GET /api/collections?all=true`
- `POST /api/collections`
- `PUT /api/collections/:slug`
- `DELETE /api/collections/:slug`
- `POST /api/upload-image-token`

Detalles importantes:

- El home del frontend arma el catalogo por categorias usando `GET /api/products` + `GET /api/categories`.
- El panel admin usa tres superficies separadas: productos, categorias y colecciones.
- La base guarda en `products.image_url` solo el path del objeto en Storage, no la URL pública completa.
- El frontend normaliza ese path usando su `VITE_SUPABASE_STORAGE_PUBLIC_BASE_URL`.
- El backend solo firma la subida con `SUPABASE_SERVICE_ROLE_KEY`; el archivo se sube directo desde frontend a Supabase Storage.
- El backend limpia imágenes huérfanas al fallar create/update y borra la imagen anterior al reemplazarla.

## 🚀 Despliegue a Producción

### Vercel

1. Conectar repo a Vercel
2. Configurar variables de entorno en Settings → Environment Variables
3. URLs deben ser HTTPS (obligatorio para Mercado Pago)

Nota de runtime:

- Para Serverless Functions en Vercel, usa `src/app.js` como entrada.
- `src/app.js` exporta directamente la app de Express.
- `src/server.js` queda para ejecución local (`npm start`/`npm run dev`).

**Variables requeridas:**

```env
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=products
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...
JWT_SECRET=una-clave-larga-y-segura
JWT_EXPIRES_IN=12h
INITIAL_ADMIN_EMAIL=admin@lunagold.com
INITIAL_ADMIN_PASSWORD=cambiar-esta-password
FRONTEND_URL=https://tu-dominio.vercel.app
BACKEND_URL=https://tu-backend.vercel.app
RESEND_API_KEY=re_...
```

### Checklist Pre-Producción

- [ ] Configurar Supabase y ejecutar `supabase-setup.sql`
- [ ] Ejecutar `supabase-seed.sql` solo si querés datos iniciales de prueba
- [ ] Crear bucket `products` en Supabase Storage
- [ ] Configurar `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Configurar webhook en Mercado Pago (URL: `https://tu-backend/api/webhook`)
- [ ] Establecer variables de entorno en producción
- [ ] Probar flujo completo de pago
- [ ] Probar CRUD de productos, categorias y colecciones desde `/admin`
- [ ] Verificar emails se envíen correctamente
- [ ] Monitorear órdenes en dashboard

## 📚 Información Adicional

**Base de datos:** Ver [README-Supabase.md](README-Supabase.md) para configuración completa

**Scripts disponibles:**

- `npm start` - Producción
- `npm run dev` - Desarrollo con nodemon
