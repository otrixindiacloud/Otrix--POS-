-- Add store_id column to customers table
-- This allows customers to be associated with specific stores

-- Add the store_id column (nullable initially to allow existing data)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_customers_store_id ON customers(store_id);

-- Optional: Set a default store for existing customers (update this with your main store ID if needed)
-- UPDATE customers SET store_id = 1 WHERE store_id IS NULL;
