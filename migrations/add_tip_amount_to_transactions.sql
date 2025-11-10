-- Add tip_amount column to transactions table
ALTER TABLE transactions 
ADD COLUMN tip_amount DECIMAL(10, 2) DEFAULT 0.00;

-- Add comment for documentation
COMMENT ON COLUMN transactions.tip_amount IS 'Tip amount for the transaction';