-- Create credit_transactions table
CREATE TABLE IF NOT EXISTS credit_transactions (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  cashier_id INTEGER REFERENCES users(id),
  transaction_id INTEGER REFERENCES transactions(id),
  type TEXT NOT NULL, -- 'charge', 'payment', 'adjustment', 'refund'
  amount DECIMAL(10, 2) NOT NULL,
  payment_method TEXT, -- 'cash', 'card', 'bank_transfer', 'check', 'adjustment'
  reference TEXT, -- Check number, transfer reference, etc.
  description TEXT,
  previous_balance DECIMAL(10, 2) NOT NULL,
  new_balance DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_credit_transactions_customer_id ON credit_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(type);