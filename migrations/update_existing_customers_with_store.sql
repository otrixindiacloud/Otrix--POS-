-- Update existing customers to be assigned to the first store
-- Run this AFTER adding the store_id column

-- First, let's see what stores we have
-- SELECT id, name FROM stores;

-- Update customers that don't have a store_id assigned yet
-- Assign them to the first available store (usually ID 1)
UPDATE customers 
SET store_id = (SELECT id FROM stores ORDER BY id LIMIT 1)
WHERE store_id IS NULL;

-- Verify the update
-- SELECT COUNT(*) as customers_without_store FROM customers WHERE store_id IS NULL;
-- SELECT store_id, COUNT(*) as customer_count FROM customers GROUP BY store_id;
