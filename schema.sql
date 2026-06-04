-- Contabilidad Familiar - Esquema de base de datos
-- Ejecutar en el SQL Editor de Supabase

-- Tabla de transacciones
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_phone TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ingreso', 'gasto')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  description TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  month_year TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_phone ON transactions(user_phone);
CREATE INDEX IF NOT EXISTS idx_transactions_month_year ON transactions(month_year);
CREATE INDEX IF NOT EXISTS idx_transactions_phone_month ON transactions(user_phone, month_year);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- Tabla de presupuestos
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_phone TEXT NOT NULL,
  category TEXT NOT NULL,
  monthly_limit INTEGER NOT NULL CHECK (monthly_limit > 0),
  month_year TEXT NOT NULL,
  UNIQUE(user_phone, category, month_year)
);

CREATE INDEX IF NOT EXISTS idx_budgets_user_phone ON budgets(user_phone);
CREATE INDEX IF NOT EXISTS idx_budgets_phone_month ON budgets(user_phone, month_year);

-- Row Level Security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all budgets" ON budgets FOR ALL USING (true) WITH CHECK (true);
