-- Add productType column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type TEXT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- Optional: Update existing products with default product type based on their category
-- This is a best-effort migration - you may want to manually review and update
UPDATE products 
SET product_type = CASE 
  WHEN category IN ('beverages-soft', 'beverages-hot', 'beverages-water', 'beverages-energy') THEN 'non-food'
  WHEN category IN ('fruits', 'vegetables', 'meat', 'poultry', 'seafood', 'dairy', 'eggs', 'cheese', 'deli') THEN 'fresh'
  WHEN category IN ('frozen-meals', 'frozen-vegetables', 'frozen-meat', 'ice-cream', 'frozen-snacks') THEN 'frozen'
  WHEN category IN ('cleaning', 'laundry', 'paper-products', 'kitchen-supplies', 'storage', 'pet-supplies') THEN 'household'
  WHEN category IN ('hygiene', 'toiletries', 'cosmetics', 'hair-care', 'skin-care', 'oral-care', 'baby-care', 'feminine-care', 'health') THEN 'personal-care'
  WHEN category IN ('bakery', 'snacks', 'candy', 'canned', 'condiments', 'cereals', 'pasta-rice', 'oils', 'spices', 'baking') THEN 'food'
  ELSE NULL
END
WHERE product_type IS NULL;

-- Comment for reference
COMMENT ON COLUMN products.product_type IS 'Product type category: food, non-food, fresh, frozen, household, personal-care';
