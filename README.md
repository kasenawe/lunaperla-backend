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
   ```

3. **Obtener Access Token de Mercado Pago:**
   - Ir a [Mercado Pago Developers](https://www.mercadopago.com.uy/developers)
   - Crear aplicación
   - Copiar Access Token de Producción

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

Webhook para confirmaciones de pago de Mercado Pago.

### GET /api/health

Health check del servidor.

## Despliegue

Para producción necesitarás:

- Configurar webhook URL en Mercado Pago
- Usar HTTPS
- Configurar variables de entorno de producción
- El frontend se encuentra en el directorio `../lunaperla/`
