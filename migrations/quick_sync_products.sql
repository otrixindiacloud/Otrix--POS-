-- Quick sync: Assign all products to all stores
-- This creates store_products entries for products that aren't yet assigned

INSERT INTO store_products (store_id, product_id, price, cost, stock, min_stock, max_stock, is_active, created_at, updated_at)
SELECT 
    s.id AS store_id,
    p.id AS product_id,
    p.price,
    p.cost,
    p.stock,
    5 AS min_stock,
    100 AS max_stock,
    true AS is_active,
    NOW() AS created_at,
    NOW() AS updated_at
FROM stores s
CROSS JOIN products p
WHERE p.is_active = true 
  AND s.is_active = true
  AND NOT EXISTS (
    -- Don't create duplicates
    SELECT 1 FROM store_products sp 
    WHERE sp.store_id = s.id 
      AND sp.product_id = p.id
  );

-- Show results
SELECT 
    s.name AS store_name,
    COUNT(sp.id) AS product_count
FROM stores s
LEFT JOIN store_products sp ON s.id = sp.store_id
WHERE s.is_active = true
GROUP BY s.id, s.name
ORDER BY s.name;
