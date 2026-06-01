# Supabase - Configuración y Esquema de Base de Datos

Backend Luna Gold usa Supabase como base de datos PostgreSQL y Storage para imágenes.

## 🚀 Setup Inicial

### 1. Crear Proyecto

1. Ve a [supabase.com](https://supabase.com)
2. Crea una cuenta
3. Crea un proyecto nuevo en la región más cercana

### 2. Ejecutar migraciones SQL

En **SQL Editor**, ejecutar en este orden:

1. `supabase-schema.sql`
2. `supabase-categories-migration.sql` (solo si tu tabla `products` ya existía sin categorías)
3. `supabase-phase2-catalog.sql` (categorías y colecciones reales)

Resultado esperado:

- tablas base: `orders`, `products`
- catálogo fase 2: `categories`, `collections`
- columnas nuevas en `products`: `category`, `category_slug`, `collection`, `collection_slug`
- soporte de `product_code`:
  - `orders.product_code` para trazabilidad de compra
  - `products.product_code` con unicidad (cuando no es `NULL`)
- soporte de variantes:
  - tabla `product_variants`
  - cada producto puede tener una o más variantes activas
  - la UI usa la variante seleccionada para precio y código final

### 3. Obtener credenciales

En **Settings > API**:

- Project URL -> `SUPABASE_URL`
- anon/public key -> `SUPABASE_ANON_KEY`
- service_role key -> `SUPABASE_SERVICE_ROLE_KEY`

Configurar en `.env`:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_STORAGE_BUCKET=products
```

### 4. Storage para imágenes de productos

1. Crear bucket público `products`
2. El backend sube imágenes con `SUPABASE_SERVICE_ROLE_KEY`
3. `products.image_url` guarda el path del objeto, por ejemplo:

```text
1776975642449-alianzas.png
```

No se guarda URL pública completa; el frontend la reconstruye con su base pública de Storage.

## 📊 Esquema de Tablas

### Tabla `orders`

Almacena compras y estados de pago.

| Campo                 | Tipo      | Descripción                         |
| --------------------- | --------- | ----------------------------------- |
| `id`                  | TEXT      | ID único de la orden (PK)           |
| `preference_id`       | TEXT      | ID de Mercado Pago                  |
| `product`             | TEXT      | Nombre del producto                 |
| `product_code`        | TEXT      | Código/SKU del producto comprado    |
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

Índices:

- `idx_orders_status`
- `idx_orders_created_at`
- `idx_orders_payment_id`
- `idx_orders_product_code`

### Tabla `products`

Catálogo de productos de la tienda.

| Campo             | Tipo      | Descripción                    |
| ----------------- | --------- | ------------------------------ |
| `id`              | UUID      | ID único (autogenerado)        |
| `name`            | TEXT      | Nombre del producto            |
| `product_code`    | TEXT      | Código/SKU interno (opcional)  |
| `price`           | DECIMAL   | Precio en USD                  |
| `description`     | TEXT      | Descripción                    |
| `image_url`       | TEXT      | Path del archivo en Storage    |
| `category`        | TEXT      | Nombre de categoría visible    |
| `category_slug`   | TEXT      | Slug de categoría              |
| `collection`      | TEXT      | Nombre de colección (opcional) |
| `collection_slug` | TEXT      | Slug de colección (opcional)   |
| `active`          | BOOLEAN   | Visible en tienda              |
| `created_at`      | TIMESTAMP | Fecha creación                 |
| `updated_at`      | TIMESTAMP | Última actualización           |

Índices:

- `idx_products_active`
- `idx_products_created_at`
- `idx_products_category_slug`
- `uq_products_product_code` (índice único parcial)

### Tabla `product_variants`

Variantes vendibles asociadas a un producto base.

| Campo           | Tipo      | Descripción                          |
| --------------- | --------- | ------------------------------------ |
| `id`            | UUID      | ID único                             |
| `product_id`    | UUID      | FK a `products.id`                   |
| `sku`           | TEXT      | Código único de la variante          |
| `label`         | TEXT      | Nombre visible de la variante        |
| `karat`         | TEXT      | Kilataje / material                  |
| `width_mm`      | DECIMAL   | Ancho en milímetros                  |
| `profile`       | TEXT      | Perfil: bombe, doble bombe, plano... |
| `closure_type`  | TEXT      | Tipo de cierre o montaje             |
| `price`         | DECIMAL   | Precio final de la variante          |
| `active`        | BOOLEAN   | Variante visible                     |
| `sort_order`    | INTEGER   | Orden de visualización               |
| `metadata`      | JSONB     | Datos adicionales flexibles          |
| `created_at`    | TIMESTAMP | Fecha creación                       |
| `updated_at`    | TIMESTAMP | Última actualización                 |

Índices:

- `idx_product_variants_product_id`
- `idx_product_variants_active`
- `idx_product_variants_sort_order`

Regla de unicidad de `products.product_code`:

- permite valores `NULL`
- cuando tiene valor, no puede repetirse

### Tabla `categories`

Categorías administrables del catálogo.

| Campo         | Tipo      | Descripción                  |
| ------------- | --------- | ---------------------------- |
| `slug`        | TEXT      | PK y slug único              |
| `name`        | TEXT      | Nombre público               |
| `description` | TEXT      | Descripción para Home/Admin  |
| `active`      | BOOLEAN   | Activa para catálogo público |
| `sort_order`  | INTEGER   | Orden de visualización       |
| `created_at`  | TIMESTAMP | Fecha creación               |
| `updated_at`  | TIMESTAMP | Última actualización         |

Índices:

- `idx_categories_active`
- `idx_categories_sort_order`

### Tabla `collections`

Colecciones opcionales asociadas a una categoría.

| Campo           | Tipo      | Descripción                  |
| --------------- | --------- | ---------------------------- |
| `slug`          | TEXT      | PK y slug único              |
| `name`          | TEXT      | Nombre público               |
| `description`   | TEXT      | Descripción                  |
| `category_slug` | TEXT      | FK a `categories.slug`       |
| `active`        | BOOLEAN   | Activa para catálogo público |
| `sort_order`    | INTEGER   | Orden de visualización       |
| `created_at`    | TIMESTAMP | Fecha creación               |
| `updated_at`    | TIMESTAMP | Última actualización         |

Índices:

- `idx_collections_active`
- `idx_collections_category_slug`
- `idx_collections_sort_order`

## 🕒 Trigger para `updated_at`

Si `update_updated_at_column()` no existe, créala primero:

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
```

Luego crear triggers idempotentes para:

- `products` (`update_products_updated_at`)
- `categories` (`update_categories_updated_at`)
- `collections` (`update_collections_updated_at`)

Nota: `supabase-phase2-catalog.sql` ya intenta crear triggers para `categories` y `collections` cuando la función existe.

## 🔒 Seguridad

- El backend usa `SUPABASE_SERVICE_ROLE_KEY` para operaciones de escritura.
- Validación de datos y reglas de negocio se hacen en backend.
- Para `orders` y `products`, el esquema base incluye RLS habilitado.
- Si decides exponer acceso directo a `categories`/`collections`, agrega políticas RLS explícitas.

## 🖼️ Ciclo de vida de imágenes

Reglas implementadas en backend:

- al subir imagen se genera nombre único
- si falla create de producto, se elimina imagen recién subida
- al cambiar imagen en update, se elimina la anterior
- al borrar producto, se elimina su imagen

## 📈 Ejemplos de uso con Supabase JS

```javascript
// Productos activos
const { data: products } = await supabase
  .from("products")
  .select("id, name, price, image_url, category, category_slug")
  .eq("active", true);

// Categorías activas
const { data: categories } = await supabase
  .from("categories")
  .select("slug, name, active, sort_order")
  .eq("active", true)
  .order("sort_order", { ascending: true });

// Colecciones de una categoría
const { data: collections } = await supabase
  .from("collections")
  .select("slug, name, category_slug, active")
  .eq("category_slug", "bebe")
  .eq("active", true);
```

## 📞 Troubleshooting

**"SUPABASE_URL o SUPABASE_ANON_KEY no están definidas"**

- revisa nombres exactos en `.env`
- sin espacios alrededor de `=`

**Conexión rechazada**

- valida URL y keys
- confirma proyecto activo en Supabase

**Tabla o columna no existe**

- ejecuta `supabase-schema.sql`
- ejecuta `supabase-categories-migration.sql` si aplica
- ejecuta `supabase-phase2-catalog.sql`

**Error de backend sobre catálogo faltante**

- mensaje típico: faltan columnas o tablas del catálogo
- causa: no se ejecutó migración fase 2
- solución: correr `supabase-phase2-catalog.sql`

**No actualiza `updated_at`**

- verifica trigger correspondiente en cada tabla
- prueba `UPDATE` manual en SQL Editor

**Las imágenes no aparecen en frontend**

- `image_url` debe guardar solo path
- bucket debe ser `products`
- revisa `VITE_SUPABASE_STORAGE_PUBLIC_BASE_URL` en frontend
