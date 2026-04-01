# Backend - Luna Gold Creaciones

API backend para integración con Mercado Pago.

## Estructura del Proyecto

Este backend está separado del frontend y se encuentra al mismo nivel:

```
lunaperla/           # Frontend (React + Vite)
lunaperla-backend/   # Backend (Node.js + Express)
```

## Configuración

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar variables de entorno:**
   Copiar `.env` y completar:
   ```bash
   # Obtener de https://www.mercadopago.com.uy/developers
   MERCADO_PAGO_ACCESS_TOKEN=tu_access_token_aqui

   # URLs de tu aplicación
   FRONTEND_URL=http://localhost:3000
   BACKEND_URL=http://localhost:3001

   # Base de datos Supabase (opcional para persistencia)
   SUPABASE_URL=tu_supabase_url
   SUPABASE_ANON_KEY=tu_supabase_anon_key

   # Email service Resend (para notificaciones automáticas)
   RESEND_API_KEY=tu_resend_api_key
   ```

3. **Configurar servicios externos:**

   **Mercado Pago:**
   - Ir a [Mercado Pago Developers](https://www.mercadopago.com.uy/developers)
   - Crear aplicación
   - Copiar Access Token de Producción

   **Supabase (opcional):**
   - Crear proyecto en [Supabase](https://supabase.com)
   - Ejecutar el script `supabase-schema.sql` en el SQL Editor
   - Copiar URL y Anon Key del proyecto

   **Resend (para emails automáticos):**
   - Crear cuenta en [Resend](https://resend.com)
   - Obtener API Key desde el dashboard
   - Verificar dominio para envío profesional (recomendado)

## Ejecutar

```bash
# Desarrollo (con nodemon)
npm run dev

# Producción
npm start
```

## Endpoints

### POST /api/create-payment
Crea una preferencia de pago en Mercado Pago.

**Request Body:**
```json
{
  "product": {
    "name": "Canasta trenzada",
    "price": 299,
    "description": "Caravanas tix bebe..."
  },
  "customerData": {
    "name": "Juan Pérez",
    "email": "juan@email.com",
    "phone": "099123456"
  }
}
```

**Response:**
```json
{
  "id": "preferencia_id",
  "init_point": "https://www.mercadopago.com.uy/checkout/v1/redirect?pref_id=..."
}
```

### POST /api/webhook
Webhook para confirmaciones de pago de Mercado Pago. Actualiza automáticamente el status de las órdenes y envía emails de confirmación.

### GET /api/orders
Obtiene todas las órdenes almacenadas (útil para debugging y dashboard).

**Response:**
```json
[
  {
    "id": "LP-1234567890",
    "product": "Anillo Luna Gold",
    "price": 299.99,
    "status": "approved",
    "customer_name": "María García",
    "customer_email": "maria@email.com",
    "customer_phone": "099123456",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:35:00Z"
  }
]
```

### GET /api/dashboard
Dashboard HTML con todas las órdenes y estadísticas.

### POST /api/test-email
Endpoint de prueba para enviar emails de confirmación (solo desarrollo).

**Request Body:**
```json
{
  "email": "test@example.com"
}
```

### GET /api/health
Health check del servidor.

## Funcionalidades de Email Automático

Cuando un pago es aprobado, el sistema envía automáticamente un email de confirmación profesional al cliente con:

- **Diseño Premium:** Template HTML con colores dorados y branding de Luna Gold
- **Detalles Completos:** Información del producto, precio, fecha y datos del cliente
- **Estilo Joyería:** Diseño elegante y sofisticado apropiado para productos premium
- **Información de Contacto:** Datos para soporte post-venta

### Configuración de Email

1. **Crear cuenta en Resend:**
   - Ve a [resend.com](https://resend.com) y crea una cuenta
   - Obtén tu API Key desde el dashboard

2. **Verificar Dominio (Recomendado):**
   - Para envío profesional, verifica tu dominio (ej: lunaperla.com)
   - Esto permite enviar emails desde `noreply@lunaperla.com`

3. **Configurar API Key:**
   ```bash
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### Testing de Emails

Usa el endpoint `/api/test-email` para probar el envío:

```bash
curl -X POST http://localhost:3001/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"email":"tu-email@ejemplo.com"}'
```

## Despliegue

Para producción necesitarás:
- Configurar webhook URL en Mercado Pago
- Usar HTTPS
- Configurar variables de entorno de producción
- El frontend se encuentra en el directorio `../lunaperla/`