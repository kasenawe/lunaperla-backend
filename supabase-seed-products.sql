-- Seed de productos para Supabase
-- Ejecutar en SQL Editor luego de crear la tabla products.

-- Opcional: limpiar productos existentes
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
