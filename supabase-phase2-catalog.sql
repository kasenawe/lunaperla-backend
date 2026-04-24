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

ALTER TABLE products
ADD COLUMN IF NOT EXISTS collection TEXT;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS collection_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(active);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_collections_active ON collections(active);
CREATE INDEX IF NOT EXISTS idx_collections_category_slug ON collections(category_slug);
CREATE INDEX IF NOT EXISTS idx_collections_sort_order ON collections(sort_order);
CREATE INDEX IF NOT EXISTS idx_products_collection_slug ON products(collection_slug);

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
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_class
      WHERE relname = 'categories'
    ) AND NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'update_categories_updated_at'
        AND NOT tgisinternal
    ) THEN
      CREATE TRIGGER update_categories_updated_at
      BEFORE UPDATE ON categories
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_class
      WHERE relname = 'collections'
    ) AND NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'update_collections_updated_at'
        AND NOT tgisinternal
    ) THEN
      CREATE TRIGGER update_collections_updated_at
      BEFORE UPDATE ON collections
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    END IF;
  END IF;
END;
$$;
