-- Crear tabla orders en Supabase
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  product TEXT NOT NULL,
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

-- Políticas RLS (Row Level Security) - opcional pero recomendado
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas las operaciones (ajusta según necesites)
CREATE POLICY "Allow all operations for authenticated users" ON orders
FOR ALL USING (true);