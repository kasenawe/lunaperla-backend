# Supabase - Configuración y Esquema de Base de Datos

Backend Luna Gold usa Supabase como base de datos PostgreSQL escalable y gratuita.

## 🚀 Setup Inicial

### 1. Crear Proyecto

1. Ve a [supabase.com](https://supabase.com)
2. Crea una cuenta (GitHub o email)
3. Nuevo proyecto → Selecciona región más cercana
4. Espera configuración (2-3 minutos)

### 2. Ejecutar Script SQL

1. Abre **SQL Editor** en tu proyecto
2. Copia todo el contenido de `supabase-schema.sql`
3. Pega en SQL Editor
4. Click en **Run** o presiona `Cmd + Enter`

Las tablas `orders` y `products` se crearán automáticamente.

### 3. Obtener Credenciales

1. Ve a **Settings** → **API**
2. Copia:
   - **Project URL** → `SUPABASE_URL`
   - **anon/public key** → `SUPABASE_ANON_KEY`
3. Pega en tu `.env` local

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=eyJ...
```

## 📊 Esquema de Tablas

### Tabla `orders`

Almacena todas las compras y sus estados de pago.

| Campo                 | Tipo      | Descripción                         |
| --------------------- | --------- | ----------------------------------- |
| `id`                  | TEXT      | ID único de la orden (PK)           |
| `preference_id`       | TEXT      | ID de Mercado Pago                  |
| `product`             | TEXT      | Nombre del producto                 |
| `price`               | DECIMAL   | Precio pagado                       |
| `status`              | TEXT      | Estado: pending, approved, rejected |
| `customer_name`       | TEXT      | Nombre del cliente                  |
| `customer_email`      | TEXT      | Email para confirmación             |
| `customer_phone`      | TEXT      | Teléfono de contacto                |
| `product_description` | TEXT      | Descripción completa                |
| `init_point`          | TEXT      | URL de checkout MP                  |
| `payment_id`          | TEXT      | ID del pago confirmado              |
| `payment_data`        | JSONB     | Datos completos del webhook         |
| `created_at`          | TIMESTAMP | Fecha de creación                   |
| `updated_at`          | TIMESTAMP | Última actualización                |

**Índices:**

- `idx_orders_status` - Búsquedas rápidas por estado
- `idx_orders_created_at` - Ordenes más recientes primero
- `idx_orders_payment_id` - Búsquedas por pago

### Tabla `products`

Catálogo de productos para la tienda.

| Campo         | Tipo      | Descripción                    |
| ------------- | --------- | ------------------------------ |
| `id`          | UUID      | ID único (autogenerado)        |
| `name`        | TEXT      | Nombre del producto            |
| `price`       | DECIMAL   | Precio en USD                  |
| `description` | TEXT      | Descripción larga              |
| `image_url`   | TEXT      | URL de la imagen               |
| `active`      | BOOLEAN   | Visible en tienda (true/false) |
| `created_at`  | TIMESTAMP | Fecha creación                 |
| `updated_at`  | TIMESTAMP | Última actualización           |

**Índices:**

- `idx_products_active` - Filtrar productos activos
- `idx_products_created_at` - Productos más nuevos primero

**Políticas RLS:**

- Lectura pública para todos
- Escritura solo autenticados (si necesario)

## 🔒 Seguridad (RLS)

Row Level Security está habilitado en ambas tablas:

- **orders:** Acceso completo para API (verificado por backend)
- **products:** Lectura pública, escritura autenticada

Todos los datos sensibles se validan en el backend antes de guardar.

## 📈 Uso desde Node.js

Backend ya está configurado. Ejemplos de uso:

```javascript
// Obtener productos activos
const { data } = await supabase
  .from("products")
  .select("id, name, price, image_url")
  .eq("active", true);

// Guardar orden
await supabase.from("orders").insert([
  {
    id: "LP-123456",
    product: "Anillo Gold",
    price: 299.99,
    status: "pending",
  },
]);

// Actualizar estado
await supabase
  .from("orders")
  .update({ status: "approved" })
  .eq("id", "LP-123456");
```

## 💾 Monitorear Datos

Desde Supabase Dashboard:

1. **Table Editor** - Ver/editar datos manualmente
2. **SQL Editor** - Queries personalizadas
3. **Logs** - Errores y actividad
4. **Backups** - Descargar datos

## 🎯 Beneficios

✅ **Gratuito** - Plan suficiente para pequeños negocios  
✅ **Escalable** - Crece con tu negocio  
✅ **PostgreSQL Real** - No limitaciones de base de datos  
✅ **Seguro** - Encriptación, RLS, backups automáticos  
✅ **Rest API** - APIs automáticas para todos los datos  
✅ **Soporte** - Documentación y comunidad activa

## 📞 Troubleshooting

**"SUPABASE_URL o SUPABASE_ANON_KEY no están definidas"**

- Verifica que el `.env` tenga exactamente esos nombres
- No hay espacios antes/después del `=`

**Conexión rechazada**

- Verifica que el URL y Key sean correctos
- El proyecto está activo en Supabase

**Tabla no existe**

- Ejecuta `supabase-schema.sql` completo
- Verifica en SQL Editor que se creó exitosamente
