-- Migracion de variantes de producto para Luna Gold
-- Ejecutar luego de supabase-schema.sql

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

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS product_variant_id TEXT,
  ADD COLUMN IF NOT EXISTS product_variant_data JSONB;

CREATE INDEX IF NOT EXISTS idx_orders_product_variant_id ON orders(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_active ON product_variants(active);
CREATE INDEX IF NOT EXISTS idx_product_variants_sort_order ON product_variants(sort_order);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_class
      WHERE relname = 'product_variants'
    ) AND NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'update_product_variants_updated_at'
        AND NOT tgisinternal
    ) THEN
      CREATE TRIGGER update_product_variants_updated_at
      BEFORE UPDATE ON product_variants
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    END IF;
  END IF;
END;
$$;
