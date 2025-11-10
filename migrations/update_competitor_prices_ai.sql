-- Migration: Add AI matching fields to competitor_prices table
-- Date: 2024
-- Description: Adds fields to support AI-powered product matching and import capabilities

-- Add product identifiers
ALTER TABLE competitor_prices 
ADD COLUMN IF NOT EXISTS product_sku TEXT,
ADD COLUMN IF NOT EXISTS product_barcode TEXT;

-- Add product metadata
ALTER TABLE competitor_prices
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS availability TEXT CHECK (availability IN ('in_stock', 'out_of_stock', 'limited', 'discontinued', 'unknown'));

-- Add matching metadata
ALTER TABLE competitor_prices
ADD COLUMN IF NOT EXISTS match_confidence DECIMAL(5, 2) CHECK (match_confidence >= 0 AND match_confidence <= 100),
ADD COLUMN IF NOT EXISTS matched_by TEXT CHECK (matched_by IN ('manual', 'ai', 'barcode', 'sku'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_competitor_prices_product_sku ON competitor_prices(product_sku) WHERE product_sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_competitor_prices_product_barcode ON competitor_prices(product_barcode) WHERE product_barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_competitor_prices_matched_by ON competitor_prices(matched_by) WHERE matched_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_competitor_prices_match_confidence ON competitor_prices(match_confidence) WHERE match_confidence IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN competitor_prices.product_sku IS 'SKU of the competitor product for matching';
COMMENT ON COLUMN competitor_prices.product_barcode IS 'Barcode of the competitor product for matching';
COMMENT ON COLUMN competitor_prices.image_url IS 'URL to product image from competitor website';
COMMENT ON COLUMN competitor_prices.availability IS 'Product availability status at competitor';
COMMENT ON COLUMN competitor_prices.match_confidence IS 'Confidence score (0-100) of product match';
COMMENT ON COLUMN competitor_prices.matched_by IS 'Method used to match product: manual, ai, barcode, or sku';
