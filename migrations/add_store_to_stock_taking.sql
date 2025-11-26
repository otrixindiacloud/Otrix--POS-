-- Add storeId to stock_taking_sessions table
ALTER TABLE stock_taking_sessions 
ADD COLUMN store_id INTEGER REFERENCES stores(id);

-- Add storeId to stock_taking_items table  
ALTER TABLE stock_taking_items
ADD COLUMN store_id INTEGER REFERENCES stores(id);

-- Add index for better performance on store-filtered queries
CREATE INDEX IF NOT EXISTS idx_stock_taking_sessions_store_id ON stock_taking_sessions(store_id);
CREATE INDEX IF NOT EXISTS idx_stock_taking_items_store_id ON stock_taking_items(store_id);
CREATE INDEX IF NOT EXISTS idx_stock_taking_sessions_date ON stock_taking_sessions(session_date);
