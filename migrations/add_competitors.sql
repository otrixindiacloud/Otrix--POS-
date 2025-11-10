-- Migration: Add Competitors and Competitor Prices tables
-- Description: Adds tables for tracking competitors and their product pricing
-- Date: 2025-11-04

-- Create competitors table
CREATE TABLE IF NOT EXISTS competitors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  website TEXT,
  phone TEXT,
  email TEXT,
  contact_person TEXT,
  business_type TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id)
);

-- Create competitor_prices table
CREATE TABLE IF NOT EXISTS competitor_prices (
  id SERIAL PRIMARY KEY,
  competitor_id INTEGER NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL,
  original_price DECIMAL(10, 2),
  currency TEXT NOT NULL DEFAULT 'QAR',
  product_name TEXT,
  product_url TEXT,
  notes TEXT,
  price_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expiry_date TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  recorded_by INTEGER REFERENCES users(id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_competitor_prices_competitor ON competitor_prices(competitor_id, product_id);
CREATE INDEX IF NOT EXISTS idx_competitor_prices_product ON competitor_prices(product_id, competitor_id);
CREATE INDEX IF NOT EXISTS idx_competitors_active ON competitors(is_active);
CREATE INDEX IF NOT EXISTS idx_competitor_prices_active ON competitor_prices(is_active);
CREATE INDEX IF NOT EXISTS idx_competitor_prices_date ON competitor_prices(price_date);

-- Add comments for documentation
COMMENT ON TABLE competitors IS 'Stores information about competitors for market analysis';
COMMENT ON TABLE competitor_prices IS 'Tracks competitor pricing for products over time';

COMMENT ON COLUMN competitors.business_type IS 'Type of business: retail, wholesale, online, mixed';
COMMENT ON COLUMN competitor_prices.price_date IS 'Date when this price was recorded/observed';
COMMENT ON COLUMN competitor_prices.expiry_date IS 'Optional end date for promotional pricing';
COMMENT ON COLUMN competitor_prices.product_name IS 'How the competitor labels/names this product';
COMMENT ON COLUMN competitor_prices.product_url IS 'Link to product on competitor website';
