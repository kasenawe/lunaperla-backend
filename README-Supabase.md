# Backend Luna Gold - Integración Mercado Pago

## 🚀 Configuración con Supabase

### 1. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta
2. Crea un nuevo proyecto
3. Espera a que se configure (2-3 minutos)

### 2. Configurar Base de Datos

1. Ve a **SQL Editor** en tu proyecto Supabase
2. Copia y pega el contenido de `supabase-schema.sql`
3. Ejecuta el script para crear la tabla `orders`

### 3. Obtener credenciales

1. Ve a **Settings** → **API**
2. Copia:
   - **Project URL** (SUPABASE_URL)
   - **anon/public key** (SUPABASE_ANON_KEY)

### 4. Configurar variables de entorno

1. Copia `.env.example` a `.env`
2. Completa las variables:

```env
# Mercado Pago
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...

# URLs de PRODUCCIÓN (HTTPS - requerido por Mercado Pago)
FRONTEND_URL=https://tu-dominio.vercel.app
BACKEND_URL=https://tu-backend.vercel.app

# Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key

# Puerto del backend
PORT=3001
```

### 5. Instalar dependencias

```bash
npm install
```

### 6. Ejecutar el servidor

```bash
npm start
```

## 📊 Estructura de la tabla `orders`

| Campo                 | Tipo      | Descripción                                        |
| --------------------- | --------- | -------------------------------------------------- |
| `id`                  | TEXT      | ID de la preferencia de Mercado Pago (Primary Key) |
| `product`             | TEXT      | Nombre del producto                                |
| `price`               | DECIMAL   | Precio del producto                                |
| `status`              | TEXT      | Estado: 'pending', 'approved', 'rejected'          |
| `customer_name`       | TEXT      | Nombre del cliente                                 |
| `customer_phone`      | TEXT      | Teléfono del cliente                               |
| `customer_email`      | TEXT      | Email del cliente                                  |
| `product_description` | TEXT      | Descripción del producto                           |
| `init_point`          | TEXT      | URL de pago de Mercado Pago                        |
| `payment_id`          | TEXT      | ID del pago confirmado                             |
| `payment_data`        | JSONB     | Datos completos del pago (webhook)                 |
| `created_at`          | TIMESTAMP | Fecha de creación                                  |
| `updated_at`          | TIMESTAMP | Fecha de actualización                             |

## 🔗 Endpoints disponibles

### Crear pago

```
POST /api/create-payment
```

**Body:**

```json
{
  "product": {
    "name": "Producto",
    "description": "Descripción",
    "price": 100.0
  },
  "customerData": {
    "name": "Juan Pérez",
    "email": "juan@email.com",
    "phone": "099123456"
  }
}
```

### Consultar órdenes

```
GET /api/orders
GET /api/orders/:orderId
```

### Webhook de Mercado Pago

```
POST /api/webhook
```

## ✅ Beneficios de Supabase

- ✅ **Gratis** (hasta ciertos límites)
- ✅ **Escalable** y confiable
- ✅ **Base de datos PostgreSQL** real
- ✅ **Dashboard web** para ver datos
- ✅ **APIs REST** automáticas
- ✅ **Seguridad** integrada (RLS)

## 🚀 Próximos pasos

1. **Configurar Supabase** siguiendo los pasos arriba
2. **Desplegar en Vercel** con las variables de entorno
3. **Probar el flujo completo** de pago
4. **Monitorear órdenes** desde el dashboard de Supabase

¡Ya no perderás ventas! 🎉
