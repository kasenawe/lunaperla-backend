-- Seed opcional consolidado para Luna Gold
-- Ejecutar despues de supabase-setup.sql

BEGIN;

INSERT INTO products (name, price, description, image_url, category, category_slug, active)
SELECT seed.name, seed.price, seed.description, seed.image_url, seed.category, seed.category_slug, seed.active
FROM (
  VALUES
    (
      'Canasta trenzada',
      299.00::numeric,
      'Caravanas tix bebe abridores en oro amarillo 18 k y perla de cultivo 4 mm.',
      'canasta.PNG',
      'Coleccion Bebe',
      'bebe',
      true
    ),
    (
      'Bolita mediana',
      330.00::numeric,
      'Caravanas tix bebe abridores en oro amarillo 18 k y bolitas 3 1/2 mm',
      'bolita.PNG',
      'Coleccion Bebe',
      'bebe',
      true
    ),
    (
      'Modelo simple',
      280.00::numeric,
      'Caravanas tix bebe abridores en oro amarillo 18 k y perla de cultivo 4 mm.',
      'simple.PNG',
      'Coleccion Bebe',
      'bebe',
      true
    ),
    (
      'Modelo coronita',
      360.00::numeric,
      'Caravanas tix bebe abridores en oro amarillo 18 k y perla de cultivo 4 mm.',
      'coronita.PNG',
      'Coleccion Bebe',
      'bebe',
      true
    )
) AS seed(name, price, description, image_url, category, category_slug, active)
WHERE NOT EXISTS (
  SELECT 1
  FROM products p
  WHERE p.name = seed.name
    AND p.category_slug = seed.category_slug
    AND COALESCE(p.image_url, '') = COALESCE(seed.image_url, '')
);

WITH alianza_products AS (
  SELECT p.id, p.name, p.price, p.product_code
  FROM products p
  WHERE p.category_slug = 'alianzas'
    AND NOT EXISTS (
      SELECT 1
      FROM product_variants pv
      WHERE pv.product_id = p.id
    )
),
alianza_variant_templates AS (
  SELECT *
  FROM (
    VALUES
      ('18K', 1.00::numeric, 0),
      ('10K', 0.82::numeric, 1)
  ) AS t(karat, factor, sort_order)
)
INSERT INTO product_variants (
  product_id,
  sku,
  label,
  karat,
  width_mm,
  profile,
  closure_type,
  price,
  active,
  sort_order,
  metadata
)
SELECT
  ap.id,
  CONCAT(
    COALESCE(
      NULLIF(UPPER(REGEXP_REPLACE(ap.product_code, '[^A-Za-z0-9]+', '', 'g')), ''),
      CONCAT('ALI', UPPER(SUBSTRING(REPLACE(ap.id::text, '-', '') FROM 1 FOR 8)))
    ),
    '-',
    avt.karat
  ) AS sku,
  CONCAT(avt.karat, ' estandar') AS label,
  avt.karat,
  CASE
    WHEN ap.name ~* '(\d+(?:[\.,]\d+)?)\s*mm'
      THEN REPLACE(SUBSTRING(ap.name FROM '(\d+(?:[\.,]\d+)?)\s*mm'), ',', '.')::numeric
    ELSE NULL
  END AS width_mm,
  CASE
    WHEN ap.name ~* 'doble\s*bombe' THEN 'doble_bombe'
    WHEN ap.name ~* 'bombe' THEN 'bombe'
    ELSE NULL
  END AS profile,
  NULL AS closure_type,
  ROUND((ap.price * avt.factor)::numeric, 2) AS price,
  true,
  avt.sort_order,
  jsonb_build_object(
    'seed_source', 'supabase-seed.sql',
    'seeded_at', NOW(),
    'notes', 'Revisar precio final en panel admin'
  )
FROM alianza_products ap
CROSS JOIN alianza_variant_templates avt
ON CONFLICT (sku) DO NOTHING;

WITH bebe_products AS (
  SELECT p.id, p.name, p.price, p.product_code, p.collection_slug
  FROM products p
  WHERE p.category_slug = 'bebe'
    AND NOT EXISTS (
      SELECT 1
      FROM product_variants pv
      WHERE pv.product_id = p.id
    )
)
INSERT INTO product_variants (
  product_id,
  sku,
  label,
  karat,
  width_mm,
  profile,
  closure_type,
  price,
  active,
  sort_order,
  metadata
)
SELECT
  bp.id,
  CONCAT(
    COALESCE(
      NULLIF(UPPER(REGEXP_REPLACE(bp.product_code, '[^A-Za-z0-9]+', '', 'g')), ''),
      CONCAT('BEB', UPPER(SUBSTRING(REPLACE(bp.id::text, '-', '') FROM 1 FOR 8)))
    ),
    '-BASE'
  ) AS sku,
  CASE
    WHEN bp.collection_slug = 'abridores' THEN 'Abridor estandar'
    WHEN bp.collection_slug = 'tix' THEN 'Tix estandar'
    ELSE 'Variante estandar'
  END AS label,
  CASE
    WHEN bp.name ~* '10k' THEN '10K'
    ELSE '18K'
  END AS karat,
  CASE
    WHEN bp.name ~* '(\d+(?:[\.,]\d+)?)\s*mm'
      THEN REPLACE(SUBSTRING(bp.name FROM '(\d+(?:[\.,]\d+)?)\s*mm'), ',', '.')::numeric
    ELSE NULL
  END AS width_mm,
  NULL AS profile,
  CASE
    WHEN bp.name ~* 'rosca' THEN 'rosca'
    ELSE NULL
  END AS closure_type,
  bp.price,
  true,
  0,
  jsonb_build_object(
    'seed_source', 'supabase-seed.sql',
    'seeded_at', NOW(),
    'notes', 'Variante base generada automaticamente'
  )
FROM bebe_products bp
ON CONFLICT (sku) DO NOTHING;

COMMIT;
-- Seed opcional e idempotente para Luna Gold.
-- Carga productos base y genera variantes iniciales cuando faltan.

BEGIN;

INSERT INTO products (name, price, description, image_url, category, category_slug, active)
SELECT seed.name, seed.price, seed.description, seed.image_url, seed.category, seed.category_slug, seed.active
FROM (
  VALUES
    (
      'Canasta trenzada',
      299.00::numeric,
      'Caravanas tix bebe abridores en oro amarillo 18 k y perla de cultivo 4 mm.',
      'canasta.PNG',
      'Coleccion Bebe',
      'bebe',
      true
    ),
    (
      'Bolita mediana',
      330.00::numeric,
      'Caravanas tix bebe abridores en oro amarillo 18 k y bolitas 3 1/2 mm',
      'bolita.PNG',
      'Coleccion Bebe',
      'bebe',
      true
    ),
    (
      'Modelo simple',
      280.00::numeric,
      'Caravanas tix bebe abridores en oro amarillo 18 k y perla de cultivo 4 mm.',
      'simple.PNG',
      'Coleccion Bebe',
      'bebe',
      true
    ),
    (
      'Modelo coronita',
      360.00::numeric,
      'Caravanas tix bebe abridores en oro amarillo 18 k y perla de cultivo 4 mm.',
      'coronita.PNG',
      'Coleccion Bebe',
      'bebe',
      true
    )
) AS seed(name, price, description, image_url, category, category_slug, active)
WHERE NOT EXISTS (
  SELECT 1
  FROM products p
  WHERE p.name = seed.name
    AND p.category_slug = seed.category_slug
);

WITH alianza_products AS (
  SELECT p.id, p.name, p.price, p.product_code
  FROM products p
  WHERE p.category_slug = 'alianzas'
    AND NOT EXISTS (
      SELECT 1
      FROM product_variants pv
      WHERE pv.product_id = p.id
    )
),
alianza_variant_templates AS (
  SELECT *
  FROM (
    VALUES
      ('18K', 1.00::numeric, 0),
      ('10K', 0.82::numeric, 1)
  ) AS t(karat, factor, sort_order)
)
INSERT INTO product_variants (
  product_id,
  sku,
  label,
  karat,
  width_mm,
  profile,
  closure_type,
  price,
  active,
  sort_order,
  metadata
)
SELECT
  ap.id,
  CONCAT(
    COALESCE(
      NULLIF(UPPER(REGEXP_REPLACE(ap.product_code, '[^A-Za-z0-9]+', '', 'g')), ''),
      CONCAT('ALI', UPPER(SUBSTRING(REPLACE(ap.id::text, '-', '') FROM 1 FOR 8)))
    ),
    '-',
    avt.karat
  ) AS sku,
  CONCAT(avt.karat, ' estandar') AS label,
  avt.karat,
  CASE
    WHEN ap.name ~* '(\d+(?:[\.,]\d+)?)\s*mm'
      THEN REPLACE(SUBSTRING(ap.name FROM '(\d+(?:[\.,]\d+)?)\s*mm'), ',', '.')::numeric
    ELSE NULL
  END AS width_mm,
  CASE
    WHEN ap.name ~* 'doble\s*bombe' THEN 'doble_bombe'
    WHEN ap.name ~* 'bombe' THEN 'bombe'
    ELSE NULL
  END AS profile,
  NULL AS closure_type,
  ROUND((ap.price * avt.factor)::numeric, 2) AS price,
  true,
  avt.sort_order,
  jsonb_build_object(
    'seed_source', 'supabase-seed.sql',
    'seeded_at', NOW(),
    'notes', 'Revisar precio final en panel admin'
  )
FROM alianza_products ap
CROSS JOIN alianza_variant_templates avt
ON CONFLICT (sku) DO NOTHING;

WITH bebe_products AS (
  SELECT p.id, p.name, p.price, p.product_code, p.collection_slug
  FROM products p
  WHERE p.category_slug = 'bebe'
    AND NOT EXISTS (
      SELECT 1
      FROM product_variants pv
      WHERE pv.product_id = p.id
    )
)
INSERT INTO product_variants (
  product_id,
  sku,
  label,
  karat,
  width_mm,
  profile,
  closure_type,
  price,
  active,
  sort_order,
  metadata
)
SELECT
  bp.id,
  CONCAT(
    COALESCE(
      NULLIF(UPPER(REGEXP_REPLACE(bp.product_code, '[^A-Za-z0-9]+', '', 'g')), ''),
      CONCAT('BEB', UPPER(SUBSTRING(REPLACE(bp.id::text, '-', '') FROM 1 FOR 8)))
    ),
    '-BASE'
  ) AS sku,
  CASE
    WHEN bp.collection_slug = 'abridores' THEN 'Abridor estandar'
    WHEN bp.collection_slug = 'tix' THEN 'Tix estandar'
    ELSE 'Variante estandar'
  END AS label,
  CASE
    WHEN bp.name ~* '10k' THEN '10K'
    ELSE '18K'
  END AS karat,
  CASE
    WHEN bp.name ~* '(\d+(?:[\.,]\d+)?)\s*mm'
      THEN REPLACE(SUBSTRING(bp.name FROM '(\d+(?:[\.,]\d+)?)\s*mm'), ',', '.')::numeric
    ELSE NULL
  END AS width_mm,
  NULL AS profile,
  CASE
    WHEN bp.name ~* 'rosca' THEN 'rosca'
    ELSE NULL
  END AS closure_type,
  bp.price,
  true,
  0,
  jsonb_build_object(
    'seed_source', 'supabase-seed.sql',
    'seeded_at', NOW(),
    'notes', 'Variante base generada automaticamente'
  )
FROM bebe_products bp
ON CONFLICT (sku) DO NOTHING;

COMMIT;