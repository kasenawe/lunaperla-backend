ALTER TABLE products
ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Coleccion Bebe';

ALTER TABLE products
ADD COLUMN IF NOT EXISTS category_slug TEXT NOT NULL DEFAULT 'bebe';

UPDATE products
SET
  category = COALESCE(NULLIF(TRIM(category), ''), 'Coleccion Bebe'),
  category_slug = COALESCE(NULLIF(TRIM(category_slug), ''), 'bebe');

CREATE INDEX IF NOT EXISTS idx_products_category_slug ON products(category_slug);