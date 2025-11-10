-- Add product_siblings table for linking similar/related/alternative products
CREATE TABLE IF NOT EXISTS product_siblings (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sibling_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('similar', 'alternative', 'complementary', 'substitute')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id),
  
  -- Ensure no duplicate relationships
  CONSTRAINT unique_product_sibling UNIQUE (product_id, sibling_id),
  
  -- Prevent self-referencing
  CONSTRAINT no_self_reference CHECK (product_id != sibling_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_product_siblings_product_id ON product_siblings(product_id);
CREATE INDEX IF NOT EXISTS idx_product_siblings_sibling_id ON product_siblings(sibling_id);
CREATE INDEX IF NOT EXISTS idx_product_siblings_relationship_type ON product_siblings(relationship_type);

-- Comments for documentation
COMMENT ON TABLE product_siblings IS 'Stores relationships between products (similar, alternative, complementary, substitute)';
COMMENT ON COLUMN product_siblings.relationship_type IS 'Type of relationship: similar (same product different size/brand), alternative (can replace), complementary (often bought together), substitute (fallback option)';
COMMENT ON COLUMN product_siblings.notes IS 'Optional notes about why these products are related';
