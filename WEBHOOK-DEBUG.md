# 🔧 **Diagnóstico: Webhook no funciona - Solución Completa**

## 🚨 **Problema Identificado:**

Los pedidos quedan en `pending` porque **el webhook no se está ejecutando**. Esto significa que Mercado Pago **no está enviando notificaciones** a tu servidor.

## 🔍 **Causas Posibles:**

### **1. ❌ External Reference faltante**

- ✅ **ARREGLADO:** Ahora se envía `external_reference: result.id` al crear la preferencia

### **2. ❌ Webhook URL no configurada en Mercado Pago**

- **Verificar:** Ve a tu [Panel de Mercado Pago](https://www.mercadopago.com.uy/developers/panel/app)
- **Buscar:** Configuración de Webhooks
- **Debe estar:** `https://lunaperla-backend.vercel.app/api/webhook`

### **3. ❌ Credenciales de producción no activas**

- **Verificar:** Tu token debe ser `APP_USR-...` (producción)
- **Activar:** En Mercado Pago → Configuración → Activar credenciales de producción

## 🧪 **Cómo Probar el Webhook:**

### **Paso 1: Verificar configuración**

```bash
# Visita esta URL para ver la configuración actual
https://lunaperla-backend.vercel.app/api/config-check
```

**Debe mostrar:**

```json
{
  "supabase": { "url": true, "key": true },
  "mercadopago": { "token": true, "tokenType": "APP_USR" },
  "urls": {
    "notification": "https://lunaperla-backend.vercel.app/api/webhook"
  }
}
```

### **Paso 2: Probar webhook manualmente**

```bash
# Enviar webhook de prueba
curl -X POST https://lunaperla-backend.vercel.app/api/webhook-test \
  -H "Content-Type: application/json" \
  -d '{"orderId": "ID_DE_TU_ORDEN_AQUI"}'
```

### **Paso 3: Revisar logs en Vercel**

- Ve a Vercel Dashboard → Tu proyecto → Functions → Logs
- Busca entradas con "WEBHOOK RECIBIDO"
- Deberías ver logs detallados cuando llegue un webhook

## 🎯 **Solución Paso a Paso:**

### **1. ✅ Verificar credenciales de Mercado Pago**

- Asegúrate de usar **token de producción** (`APP_USR-...`)
- Activa las **credenciales de producción** en tu cuenta

### **2. ✅ Configurar webhook URL**

En Mercado Pago Dashboard:

- Ve a **Configuración** → **Notificaciones**
- **URL:** `https://lunaperla-backend.vercel.app/api/webhook`
- **Eventos:** Marcar "Pago" (payment)

### **3. ✅ Probar con pago real**

- Crea una orden desde tu sitio
- Completa el pago con **tarjeta de prueba**
- Espera 30 segundos
- Revisa si el status cambió en el dashboard

### **4. ✅ Verificar logs**

Si no funciona, revisa los logs de Vercel para ver si llegan los webhooks.

## 📊 **Estados que deberías ver:**

| Acción         | Status Inicial | Webhook llega  | Status Final |
| -------------- | -------------- | -------------- | ------------ |
| Pago exitoso   | `pending`      | ✅ Log aparece | `approved`   |
| Pago rechazado | `pending`      | ✅ Log aparece | `rejected`   |

## 🚀 **URLs para verificar:**

- **Configuración:** `https://lunaperla-backend.vercel.app/api/config-check`
- **Dashboard:** `https://lunaperla-backend.vercel.app/dashboard`
- **Test webhook:** `POST https://lunaperla-backend.vercel.app/api/webhook-test`

## 💡 **Si aún no funciona:**

1. **Revisa que la URL del webhook esté correcta en Mercado Pago**
2. **Asegúrate de que usas credenciales de PRODUCCIÓN**
3. **Verifica que Vercel esté desplegado correctamente**
4. **Revisa los logs de Vercel para errores**

¿Has verificado estos puntos? ¿Puedes compartir qué ves en `/api/config-check` y si aparecen logs en Vercel cuando intentas un pago?</content>
<parameter name="filePath">d:\github\lunaperla-backend\WEBHOOK-DEBUG.md
