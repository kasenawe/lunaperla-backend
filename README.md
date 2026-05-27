# Backend Luna Gold - Mercado Pago + Supabase

API backend con integración completa: pagos, persistencia en Supabase, emails automáticos, dashboard y soporte administrativo para productos, categorias y colecciones.

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

   # Resend - Email automático (https://resend.com) - OPCIONAL
   RESEND_API_KEY=re_...

   # Puerto
   PORT=3001
   ```

3. **Ejecutar servidor:**
   ```bash
   npm run dev    # Desarrollo (con nodemon)
   npm start      # Producción
   ```

## ⚙️ Configuración Detallada

Ver [README-Supabase.md](README-Supabase.md) para configuración completa de base de datos, trigger `updated_at` y Storage.

Si tu tabla `products` ya existe:

- Ejecuta [supabase-categories-migration.sql](supabase-categories-migration.sql) para agregar `category` y `category_slug`.
- Ejecuta [supabase-phase2-catalog.sql](supabase-phase2-catalog.sql) para:
  - crear tabla `categories`
  - crear tabla `collections`
  - agregar `collection` y `collection_slug` en `products`
  - sembrar categorias base
  - migrar categorias existentes desde `products`

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

### POST /api/upload-image

Sube una imagen de producto a Supabase Storage usando `SUPABASE_SERVICE_ROLE_KEY`.

- Content-Type: `multipart/form-data`
- Campo esperado: `image`
- Límite: 5 MB
- Tipos permitidos: imágenes (`image/*`)

**Response:**

```json
{
  "image_url": "1776975642449-alianzas.png",
  "public_url": "https://PROJECT.supabase.co/storage/v1/object/public/products/1776975642449-alianzas.png",
  "path": "1776975642449-alianzas.png"
}
```

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

Si la creación falla después de subir una imagen, el backend intenta eliminar esa imagen para evitar archivos huérfanos.

### PUT /api/products/:id

Actualiza un producto existente.

- Si la imagen cambió, elimina la imagen anterior del bucket.
- `updated_at` se actualiza automáticamente desde Supabase mediante trigger.

### DELETE /api/products/:id

Elimina el producto y también elimina su imagen asociada del bucket, si existe.

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
- Estados visuales (colores: amarillo, verde, rojo)
- Auto-refresh cada 30 segundos
- Responsive (móvil + desktop)
- No requiere login

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
- `POST /api/upload-image`

Detalles importantes:

- El home del frontend arma el catalogo por categorias usando `GET /api/products` + `GET /api/categories`.
- El panel admin usa tres superficies separadas: productos, categorias y colecciones.
- La base guarda en `products.image_url` solo el path del objeto en Storage, no la URL pública completa.
- El frontend normaliza ese path usando su `VITE_SUPABASE_STORAGE_PUBLIC_BASE_URL`.
- La subida a Storage se hace solo desde backend con `SUPABASE_SERVICE_ROLE_KEY`.
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
FRONTEND_URL=https://tu-dominio.vercel.app
BACKEND_URL=https://tu-backend.vercel.app
RESEND_API_KEY=re_...
```

### Checklist Pre-Producción

- [ ] Configurar Supabase y ejecutar `supabase-schema.sql`
- [ ] Ejecutar `supabase-categories-migration.sql` si tu tabla `products` es previa a categorias
- [ ] Ejecutar `supabase-phase2-catalog.sql` para categorias y colecciones reales
- [ ] Crear bucket `products` en Supabase Storage
- [ ] Configurar `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Crear trigger de `updated_at` para `products`
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
