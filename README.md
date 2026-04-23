# Backend Luna Gold - Mercado Pago + Supabase

API backend profesional con integración completa: pagos, persistencia de datos, dashboard administrativo y emails automáticos.

## 🏗️ Estructura del Proyecto

```
lunaperla/           # Frontend (React + Vite)
lunaperla-backend/   # Backend (Node.js + Express) ← Estás aquí
```

## 📋 Requisitos

- Node.js v16+
- npm o yarn
- Cuentas en: Mercado Pago, Supabase, Resend (opcional)

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

Ver **[SUPABASE.md](SUPABASE.md)** para configuración completa de base de datos.

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

**Response:**

```json
[
  {
    "id": "uuid",
    "name": "Anillo Luna Gold",
    "price": 299.99,
    "image_url": "...",
    "description": "..."
  }
]
```

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

## 🚀 Despliegue a Producción

### Vercel

1. Conectar repo a Vercel
2. Configurar variables de entorno en Settings → Environment Variables
3. URLs deben ser HTTPS (obligatorio para Mercado Pago)

**Variables requeridas:**

```env
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...
FRONTEND_URL=https://tu-dominio.vercel.app
BACKEND_URL=https://tu-backend.vercel.app
RESEND_API_KEY=re_...
```

### Checklist Pre-Producción

- [ ] Configurar Supabase y ejecutar `supabase-schema.sql`
- [ ] Configurar webhook en Mercado Pago (URL: `https://tu-backend/api/webhook`)
- [ ] Establecer variables de entorno en producción
- [ ] Probar flujo completo de pago
- [ ] Verificar emails se envíen correctamente
- [ ] Monitorear órdenes en dashboard

## 📚 Información Adicional

**Base de datos:** Ver [SUPABASE.md](SUPABASE.md) para configuración completa

**Scripts disponibles:**

- `npm start` - Producción
- `npm run dev` - Desarrollo con nodemon
