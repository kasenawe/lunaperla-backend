-- Crear tabla orders en Supabase
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  product TEXT NOT NULL,
  product_code TEXT,
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

-- Crear índices para mejor rendimiento
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_payment_id ON orders(payment_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_code ON orders(product_code);

-- Políticas RLS (Row Level Security) - opcional pero recomendado
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas las operaciones (ajusta según necesites)
CREATE POLICY "Allow all operations for authenticated users" ON orders
FOR ALL USING (true);

-- Agregar columna preference_id
ALTER TABLE orders ADD COLUMN IF NOT EXISTS preference_id TEXT;

-- Agregar columna product_code
ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_code TEXT;

-- Crear tabla products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  product_code TEXT,
  price DECIMAL(10,2) NOT NULL,
  description TEXT,
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'Coleccion Bebe',
  category_slug TEXT NOT NULL DEFAULT 'bebe',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejor rendimiento
CREATE INDEX idx_products_active ON products(active);
CREATE INDEX idx_products_category_slug ON products(category_slug);
CREATE INDEX idx_products_created_at ON products(created_at DESC);
DROP INDEX IF EXISTS idx_products_product_code;
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_product_code ON products(product_code)
WHERE product_code IS NOT NULL;

-- Agregar columna product_code en products
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_code TEXT;

-- Políticas RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all users to read products" ON products
FOR SELECT USING (true);

-- Trigger idempotente para mantener updated_at automáticamente en products
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
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

-- Seed inicial de productos (migrados desde frontend)
-- Opcional: descomenta la siguiente línea si querés limpiar productos previos
-- DELETE FROM products;

INSERT INTO products (name, price, description, image_url, category, category_slug, active)
VALUES
  (
    'Canasta trenzada',
    299.00,
    'Caravanas tix bebe abridores en oro amarillo 18 k y perla de cultivo 4 mm.',
    'canasta.PNG',
    'Coleccion Bebe',
    'bebe',
    true
  ),
  (
    'Bolita mediana',
    330.00,
    'Caravanas tix bebe abridores en oro amarillo 18 k y bolitas 3 1/2 mm',
    'bolita.PNG',
    'Coleccion Bebe',
    'bebe',
    true
  ),
  (
    'Modelo simple',
    280.00,
    'Caravanas tix bebe abridores en oro amarillo 18 k y perla de cultivo 4 mm.',
    'simple.PNG',
    'Coleccion Bebe',
    'bebe',
    true
  ),
  (
    'Modelo coronita',
    360.00,
    'Caravanas tix bebe abridores en oro amarillo 18 k y perla de cultivo 4 mm.',
    'coronita.PNG',
    'Coleccion Bebe',
    'bebe',
    true
  );