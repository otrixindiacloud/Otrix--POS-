-- Migration to update default VAT rate from 5.00 to 0.00
-- This ensures all existing stores have 0% VAT applied

-- Update all stores to have 0% default VAT rate
UPDATE stores 
SET default_vat_rate = '0.00'
WHERE default_vat_rate = '5.00';

-- Update any VAT configurations that have 5% rate to 0%
UPDATE vat_configurations 
SET vat_rate = '0.00'
WHERE vat_rate = '5.00';

-- Display the changes
SELECT 'Updated stores with 0% VAT rate:' as message, COUNT(*) as count 
FROM stores 
WHERE default_vat_rate = '0.00';

SELECT 'Updated VAT configurations with 0% rate:' as message, COUNT(*) as count 
FROM vat_configurations 
WHERE vat_rate = '0.00';
