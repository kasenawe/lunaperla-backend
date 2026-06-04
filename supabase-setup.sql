-- Supabase setup consolidado para Luna Gold
-- Objetivo: dejar el esquema completo e idempotente en un solo script.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  preference_id TEXT,
  product TEXT NOT NULL,
  product_code TEXT,
  product_variant_id TEXT,
  product_variant_data JSONB,
  price DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  product_description TEXT,
  init_point TEXT,
  payment_id TEXT,
  payment_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS preference_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_variant_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_variant_data JSONB;

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  product_code TEXT,
  price DECIMAL(10,2) NOT NULL,
  description TEXT,
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'Coleccion Bebe',
  category_slug TEXT NOT NULL DEFAULT 'bebe',
  collection TEXT,
  collection_slug TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS product_code TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Coleccion Bebe';
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_slug TEXT NOT NULL DEFAULT 'bebe';
ALTER TABLE products ADD COLUMN IF NOT EXISTS collection TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS collection_slug TEXT;

UPDATE products
SET
  category = COALESCE(NULLIF(TRIM(category), ''), 'Coleccion Bebe'),
  category_slug = COALESCE(NULLIF(TRIM(category_slug), ''), 'bebe'),
  collection = NULLIF(TRIM(collection), ''),
  collection_slug = NULLIF(TRIM(collection_slug), '');

CREATE TABLE IF NOT EXISTS categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collections (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category_slug TEXT NOT NULL REFERENCES categories(slug) ON UPDATE CASCADE,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  karat TEXT,
  width_mm DECIMAL(4,2),
  profile TEXT,
  closure_type TEXT,
  price DECIMAL(10,2) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (product_id, label)
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_id ON orders(payment_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_code ON orders(product_code);
CREATE INDEX IF NOT EXISTS idx_orders_product_variant_id ON orders(product_variant_id);

CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_category_slug ON products(category_slug);
CREATE INDEX IF NOT EXISTS idx_products_collection_slug ON products(collection_slug);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
DROP INDEX IF EXISTS idx_products_product_code;
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_product_code ON products(product_code)
WHERE product_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(active);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_collections_active ON collections(active);
CREATE INDEX IF NOT EXISTS idx_collections_category_slug ON collections(category_slug);
CREATE INDEX IF NOT EXISTS idx_collections_sort_order ON collections(sort_order);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_active ON product_variants(active);
CREATE INDEX IF NOT EXISTS idx_product_variants_sort_order ON product_variants(sort_order);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'orders'
      AND policyname = 'Allow all operations for authenticated users'
  ) THEN
    CREATE POLICY "Allow all operations for authenticated users" ON orders
    FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'products'
      AND policyname = 'Allow all users to read products'
  ) THEN
    CREATE POLICY "Allow all users to read products" ON products
    FOR SELECT USING (true);
  END IF;
END;
$$;

INSERT INTO categories (slug, name, description, active, sort_order)
VALUES
  ('bebe', 'Coleccion Bebe', 'Caravanas y joyas delicadas para bebe.', true, 0),
  ('alianzas', 'Alianzas', 'Anillos y alianzas para compromiso, boda o regalo.', true, 1),
  ('anillos', 'Anillos', 'Piezas clasicas y contemporaneas para uso diario o especial.', true, 2),
  ('collares', 'Collares', 'Diseños para sumar brillo y elegancia a cada look.', true, 3),
  ('pulseras', 'Pulseras', 'Detalles finos para regalar o completar un conjunto.', true, 4)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order;

INSERT INTO categories (slug, name, description, active, sort_order)
SELECT DISTINCT
  COALESCE(NULLIF(TRIM(category_slug), ''), 'bebe') AS slug,
  COALESCE(NULLIF(TRIM(category), ''), 'Coleccion Bebe') AS name,
  '' AS description,
  true AS active,
  100 AS sort_order
FROM products
WHERE COALESCE(NULLIF(TRIM(category_slug), ''), '') <> ''
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name;

INSERT INTO collections (slug, name, description, category_slug, active, sort_order)
SELECT DISTINCT
  collection_slug,
  collection,
  '' AS description,
  COALESCE(NULLIF(TRIM(category_slug), ''), 'bebe') AS category_slug,
  true AS active,
  100 AS sort_order
FROM products
WHERE COALESCE(NULLIF(TRIM(collection_slug), ''), '') <> ''
  AND COALESCE(NULLIF(TRIM(collection), ''), '') <> ''
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category_slug = EXCLUDED.category_slug;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'update_orders_updated_at'
      AND c.relname = 'orders'
      AND NOT t.tgisinternal
  ) THEN
    DROP TRIGGER update_orders_updated_at ON orders;
  END IF;

  CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'update_products_updated_at'
      AND c.relname = 'products'
      AND NOT t.tgisinternal
  ) THEN
    DROP TRIGGER update_products_updated_at ON products;
  END IF;

  CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'update_categories_updated_at'
      AND c.relname = 'categories'
      AND NOT t.tgisinternal
  ) THEN
    DROP TRIGGER update_categories_updated_at ON categories;
  END IF;

  CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'update_collections_updated_at'
      AND c.relname = 'collections'
      AND NOT t.tgisinternal
  ) THEN
    DROP TRIGGER update_collections_updated_at ON collections;
  END IF;

  CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'update_product_variants_updated_at'
      AND c.relname = 'product_variants'
      AND NOT t.tgisinternal
  ) THEN
    DROP TRIGGER update_product_variants_updated_at ON product_variants;
  END IF;

  CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
END;
$$;-- Setup completo e idempotente de Supabase para Luna Gold.
-- Crea el esquema final esperado para orders, products, categories,
-- collections y product_variants, incluyendo índices, RLS y triggers.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  preference_id TEXT,
  product TEXT NOT NULL,
  product_code TEXT,
  product_variant_id TEXT,
  product_variant_data JSONB,
  price DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  product_description TEXT,
  init_point TEXT,
  payment_id TEXT,
  payment_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS preference_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_variant_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_variant_data JSONB;

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  product_code TEXT,
  price DECIMAL(10,2) NOT NULL,
  description TEXT,
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'Coleccion Bebe',
  category_slug TEXT NOT NULL DEFAULT 'bebe',
  collection TEXT,
  collection_slug TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS product_code TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Coleccion Bebe';
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_slug TEXT NOT NULL DEFAULT 'bebe';
ALTER TABLE products ADD COLUMN IF NOT EXISTS collection TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS collection_slug TEXT;

UPDATE products
SET
  category = COALESCE(NULLIF(TRIM(category), ''), 'Coleccion Bebe'),
  category_slug = COALESCE(NULLIF(TRIM(category_slug), ''), 'bebe'),
  collection = NULLIF(TRIM(collection), ''),
  collection_slug = NULLIF(TRIM(collection_slug), '');

CREATE TABLE IF NOT EXISTS categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collections (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category_slug TEXT NOT NULL REFERENCES categories(slug) ON UPDATE CASCADE,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  karat TEXT,
  width_mm DECIMAL(4,2),
  profile TEXT,
  closure_type TEXT,
  price DECIMAL(10,2) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (product_id, label)
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_id ON orders(payment_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_code ON orders(product_code);
CREATE INDEX IF NOT EXISTS idx_orders_product_variant_id ON orders(product_variant_id);

CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_category_slug ON products(category_slug);
CREATE INDEX IF NOT EXISTS idx_products_collection_slug ON products(collection_slug);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
DROP INDEX IF EXISTS idx_products_product_code;
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_product_code ON products(product_code)
WHERE product_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(active);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);

CREATE INDEX IF NOT EXISTS idx_collections_active ON collections(active);
CREATE INDEX IF NOT EXISTS idx_collections_category_slug ON collections(category_slug);
CREATE INDEX IF NOT EXISTS idx_collections_sort_order ON collections(sort_order);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_active ON product_variants(active);
CREATE INDEX IF NOT EXISTS idx_product_variants_sort_order ON product_variants(sort_order);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'orders'
      AND policyname = 'Allow all operations for authenticated users'
  ) THEN
    CREATE POLICY "Allow all operations for authenticated users" ON orders
    FOR ALL USING (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'products'
      AND policyname = 'Allow all users to read products'
  ) THEN
    CREATE POLICY "Allow all users to read products" ON products
    FOR SELECT USING (true);
  END IF;
END;
$$;

INSERT INTO categories (slug, name, description, active, sort_order)
VALUES
  ('bebe', 'Coleccion Bebe', 'Caravanas y joyas delicadas para bebe.', true, 0),
  ('alianzas', 'Alianzas', 'Anillos y alianzas para compromiso, boda o regalo.', true, 1),
  ('anillos', 'Anillos', 'Piezas clasicas y contemporaneas para uso diario o especial.', true, 2),
  ('collares', 'Collares', 'Diseños para sumar brillo y elegancia a cada look.', true, 3),
  ('pulseras', 'Pulseras', 'Detalles finos para regalar o completar un conjunto.', true, 4)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order;

INSERT INTO categories (slug, name, description, active, sort_order)
SELECT DISTINCT
  COALESCE(NULLIF(TRIM(category_slug), ''), 'bebe') AS slug,
  COALESCE(NULLIF(TRIM(category), ''), 'Coleccion Bebe') AS name,
  '' AS description,
  true AS active,
  100 AS sort_order
FROM products
WHERE COALESCE(NULLIF(TRIM(category_slug), ''), '') <> ''
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name;

INSERT INTO collections (slug, name, description, category_slug, active, sort_order)
SELECT DISTINCT
  collection_slug,
  collection,
  '' AS description,
  COALESCE(NULLIF(TRIM(category_slug), ''), 'bebe') AS category_slug,
  true AS active,
  100 AS sort_order
FROM products
WHERE COALESCE(NULLIF(TRIM(collection_slug), ''), '') <> ''
  AND COALESCE(NULLIF(TRIM(collection), ''), '') <> ''
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category_slug = EXCLUDED.category_slug;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'update_orders_updated_at'
      AND c.relname = 'orders'
      AND NOT t.tgisinternal
  ) THEN
    DROP TRIGGER update_orders_updated_at ON orders;
  END IF;

  CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'update_products_updated_at'
      AND c.relname = 'products'
      AND NOT t.tgisinternal
  ) THEN
    DROP TRIGGER update_products_updated_at ON products;
  END IF;

  CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'update_categories_updated_at'
      AND c.relname = 'categories'
      AND NOT t.tgisinternal
  ) THEN
    DROP TRIGGER update_categories_updated_at ON categories;
  END IF;

  CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'update_collections_updated_at'
      AND c.relname = 'collections'
      AND NOT t.tgisinternal
  ) THEN
    DROP TRIGGER update_collections_updated_at ON collections;
  END IF;

  CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'update_product_variants_updated_at'
      AND c.relname = 'product_variants'
      AND NOT t.tgisinternal
  ) THEN
    DROP TRIGGER update_product_variants_updated_at ON product_variants;
  END IF;

  CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
END;
$$;