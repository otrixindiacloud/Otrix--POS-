import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ProductSearchResult {
  name: string;
  description: string;
  category: string;
  suggestedPrice: number;
  sku: string;
  barcode?: string;
  confidence: number;
}

export async function searchProductWithAI(query: string, isBarcode: boolean = false): Promise<ProductSearchResult> {
  // Check if we have a valid OpenAI API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'set-me' || apiKey.startsWith('AIzaSy') || !apiKey.startsWith('sk-') || apiKey.length < 20) {
    throw new Error('Invalid or missing OpenAI API key. Please set a valid OpenAI API key in your .env file. Get one at https://platform.openai.com/api-keys');
  }
  
  try {
    const searchType = isBarcode ? "barcode" : "product name";
    const prompt = `You are a product database expert. I'm searching for a product by ${searchType}: "${query}".

Please provide detailed product information in JSON format with these exact fields:
- name: Full product name
- description: Detailed product description (2-3 sentences)
- category: Product category (e.g., "Electronics", "Clothing", "Food", "Books", etc.)
- suggestedPrice: Estimated retail price in USD (number only)
- sku: Generate a logical SKU code (letters and numbers, 6-10 characters)
- barcode: ${isBarcode ? `Use the provided barcode: "${query}"` : 'Generate a realistic 12-digit UPC barcode'}
- confidence: How confident you are about this product (0.0 to 1.0)

Focus on real, commonly available products. If it's a generic term, suggest the most popular variant.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a product information expert. Always respond with valid JSON in the exact format requested."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    // Validate and clean the result
    return {
      name: result.name || query,
      description: result.description || "Product description not available",
      category: result.category || "General",
      suggestedPrice: Number(result.suggestedPrice) || 0,
      sku: result.sku || generateSKU(result.name || query),
      barcode: result.barcode || generateBarcode(),
      confidence: Math.min(Math.max(Number(result.confidence) || 0.5, 0), 1)
    };
  } catch (error) {
    console.error("Error searching product with AI:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Provide more helpful error messages
    if (errorMessage.includes('API key') || errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      throw new Error('Invalid OpenAI API key. Please check your .env file and ensure the API key is correct.');
    }
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      throw new Error('OpenAI API rate limit exceeded. Please try again in a moment.');
    }
    throw new Error("Failed to search product with AI: " + errorMessage);
  }
}

function generateSKU(productName: string): string {
  const cleaned = productName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const prefix = cleaned.substring(0, 4).padEnd(4, 'X');
  const suffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${suffix}`;
}

function generateBarcode(): string {
  // Generate a realistic 12-digit UPC barcode
  let barcode = '';
  for (let i = 0; i < 12; i++) {
    barcode += Math.floor(Math.random() * 10).toString();
  }
  return barcode;
}

// AI-powered invoice processing
interface InvoiceExtractionResult {
  invoiceNumber: string;
  supplierName: string;
  invoiceDate: string;
  dueDate?: string;
  subtotal: number;
  tax: number;
  total: number;
  items: {
    productName: string;
    quantity: number;
    uom?: string;
    crtQty?: number;
    pcsQty?: number;
    unitPrice: number;
    totalPrice: number;
    sku?: string;
    barcode?: string;
  }[];
  confidence: number;
}

export async function extractInvoiceData(base64Image: string, isReturn: boolean = false): Promise<InvoiceExtractionResult> {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'set-me' || !process.env.OPENAI_API_KEY.startsWith('sk-')) {
    throw new Error('OpenAI API key is required for invoice processing. Please set a valid API key in your .env file.');
  }

  try {
    const documentType = isReturn ? "return invoice" : "receipt/invoice";
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert OCR specialist at extracting line items from ${documentType} images (scanned or photographed). Extract all relevant information and return it strictly in the JSON format requested.
          
          CRITICAL COLUMN IDENTIFICATION RULES:
          - ALWAYS examine the table header row FIRST to identify which column is which
          - Most receipts have columns in this order: Product Name | Quantity | Unit Price | Total Price
          - Common column headers: "Qty", "Quantity", "Q" = QUANTITY column
          - Common column headers: "U.Price", "Unit Price", "Price", "Rate", "UP" = UNIT PRICE column  
          - Common column headers: "Total", "Amount", "Line Total", "Amt" = TOTAL PRICE column
          - WARNING: Do NOT confuse Total Price with Unit Price - they are different columns!
          - WARNING: Do NOT confuse Quantity with Unit Price - they are different columns!
          
          IMPORTANT BEHAVIORS:
          - Extract EVERY product row that contains actual numeric values in Quantity and/or Total columns
          - Treat both handwritten AND printed numbers as valid data
          - Skip summary rows: "SUB TOTAL", "SUBTOTAL", "TOTAL", "GRAND TOTAL", taxes/fees summaries, section headers
          - Scan the ENTIRE image and combine all product rows from all sections into one items array
          
          CRITICAL UOM AND CRT/PCS HANDLING:
          - Look for UOM column (may be labeled "UOM", "Unit", "U/M") - extract the unit type (CRT, PCS, CS, BOX, etc.)
          - Look for CRT/PCS column (separate from QTY column) showing format like "2/24":
            * This is INFORMATIONAL ONLY - shows carton breakdown
            * Extract: crtQty = first number, pcsQty = second number
            * DO NOT calculate quantity from CRT/PCS - keep them separate!
          - QTY column shows the ACTUAL quantity being purchased (e.g., 1, 9, 12)
            * Extract this value AS-IS for the "quantity" field
            * This is the real quantity, not calculated from CRT/PCS
          - CRT/PCS is just showing the packing information (e.g., "2/24" means 2 cartons with 24 pieces each)
          - IMPORTANT: quantity field = value from QTY column ONLY
          - IMPORTANT: crtQty/pcsQty = values from CRT/PCS column (informational)
          - IMPORTANT: Unit price and total price are based on the QTY column value
          - Common UOMs: CRT (Carton), PCS (Pieces), CS (Case), BOX, EA (Each), PKG (Package), BTL (Bottle)
          - Always round numeric values to two decimals
          - CRITICAL: Read the table structure carefully - QTY, UOM, and CRT/PCS are THREE DIFFERENT columns
          
          STEP-BY-STEP APPROACH FOR EACH ITEM:
          1. Look at the column HEADERS to understand the table structure
          2. For each item row, read the value from each column CAREFULLY
          3. Extract Quantity from the Quantity column (usually the first numeric column)
          4. Extract Unit Price from the Unit Price column (usually the middle numeric column)
          5. Extract Total Price from the Total column (usually the last/rightmost numeric column)
          6. Verify: Quantity × Unit Price should approximately equal Total Price
          7. If math doesn't match, flag it but still extract all three values AS THEY APPEAR in their respective columns`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract all information from this ${documentType} image and return it in JSON format with these exact fields:
              
              {
                "invoiceNumber": "string",
                "supplierName": "string", 
                "invoiceDate": "YYYY-MM-DD",
                "dueDate": "YYYY-MM-DD or null",
                "subtotal": number,
                "tax": number,
                "total": number,
                "items": [
                  {
                    "productName": "string",
                    "quantity": number (ACTUAL quantity from QTY column - extract AS-IS, do NOT calculate from CRT/PCS),
                    "uom": "string - value from UOM column (can be CRT, PCS, CS, BOX, EA, or even numbers like 1, 2, 3) or null if column empty",
                    "crtQty": number (first number from CRT/PCS column if present, e.g., 2 from '2/24' - informational only) or null,
                    "pcsQty": number (second number from CRT/PCS column if present, e.g., 24 from '2/24' - informational only) or null,
                    "unitPrice": number (price per unit from Unit Price column),
                    "totalPrice": number (from Total column - should match quantity × unitPrice),
                    "sku": "string from SKU/Code column or null",
                    "barcode": "string from Barcode column or null"
                  }
                ],
                "confidence": number (0.0 to 1.0)
              }
              
              CRITICAL TABLE READING INSTRUCTIONS:
              
              STEP 1: IDENTIFY THE TABLE STRUCTURE FIRST
              - Locate the table header row showing column names
              - Identify which column is "Product Name" or "Description"
              - Identify which column is "Quantity" (or "Qty", "Q")
              - Identify which column is "UOM" (Unit of Measure) - may show CRT, PCS, CS, etc.
              - Identify which column is "CRT/PCS" or shows format like "2/24" (carton/pieces format)
              - Identify which column is "Unit Price" (or "U.Price", "Price", "Rate", "UP")
              - Identify which column is "Total" (or "Amount", "Line Total", "Amt")
              - Identify which column is "SKU" or "Code" (if present)
              - Identify which column is "Barcode" (if present)
              - Draw imaginary vertical lines for each column
              
              STEP 2: FOR EACH PRODUCT ROW, READ VALUES FROM THE CORRECT COLUMNS
              - Read Product Name from the name/description column
              - Read Quantity from the Quantity column (do NOT confuse with unit price or total!)
              
              CRITICAL: UOM FORMAT DETECTION
              - ALWAYS check for a separate UOM column first (may be labeled "UOM", "Unit", "U/M")
              - UOM column value can be:
                * Text: "CRT", "PCS", "CS", "BOX", "EA", "PKG", "BTL" - extract as string
                * Number: 1, 2, 3 - extract as string (convert to string)
                * Mixed: "1CRT", "2PCS" - extract full value as string
              - IMPORTANT: ALWAYS extract UOM value even if it's just a number or empty - record what you see
              
              - Check if there's a CRT/PCS column showing format like "2/24":
                * If yes: crtQty = first number, pcsQty = second number
                * Calculate: quantity = crtQty × pcsQty
                * Use UOM from UOM column, or default to "CRT" if UOM column is empty
              
              - If Quantity column contains "/" (e.g., "2/24", "1/12"):
                * This is CRT/PCS format: [Cartons]/[Pieces per carton]
                * Extract: crtQty = first number, pcsQty = second number
                * Calculate: quantity = crtQty × pcsQty (e.g., 2 × 24 = 48 total pieces)
                * Set uom from UOM column or default to "CRT"
              
              - If Quantity column contains text (e.g., "9 PCS", "2 CRT"):
                * Extract: quantity = numeric part, uom = text part
                * Set: crtQty = null, pcsQty = null
              
              - If Quantity column is just a number:
                * quantity = that number
                * MUST read uom from UOM column (can be text, number, or empty)
                * crtQty = null, pcsQty = null
              
              CRITICAL: UOM COLUMN EXTRACTION
              - If UOM column exists, ALWAYS extract its value as "uom" field
              - Examples:
                * UOM column shows "CRT" → uom: "CRT"
                * UOM column shows "PCS" → uom: "PCS"
                * UOM column shows "1" → uom: "1" (as string)
                * UOM column shows "CS" → uom: "CS"
                * UOM column is empty → uom: null
              - The UOM value is SEPARATE from quantity - do not confuse them
              
              - Read Unit Price ONLY from the Unit Price column (do NOT confuse with quantity or total!)
              - CRITICAL: Unit Price should be per PIECE, not per carton
              - Read Total Price ONLY from the Total column (usually rightmost numeric column)
              - Read SKU from SKU/Code column if present
              - Read Barcode from Barcode column if present
              - Read UOM from UOM column if present (CRT, PCS, CS, BOX, EA, etc.)
              - Each item row is independent - read each cell carefully
              
              STEP 3: VALIDATE MATH FOR EACH ITEM
              - After extracting: quantity × unitPrice should ≈ totalPrice (within 0.05 for rounding)
              - If CRT/PCS format: (crtQty × pcsQty) × unitPrice should ≈ totalPrice
              - If math is correct: You successfully read the columns correctly!
              - If math is wrong: You mixed up the columns - re-examine which value came from which column
  
              
             
              
              COMMON ERRORS TO AVOID:
              ❌ DO NOT use totalPrice as unitPrice (they are different columns!)
              ❌ DO NOT use unitPrice as quantity (they are different columns!)
              ❌ DO NOT assume all items have quantity=1 (read the actual Qty column!)
              ❌ DO NOT mix up values between different items
              ❌ DO NOT confuse the Total column with the Unit Price column
              ❌ If SKU is the same for multiple items (e.g., 20000003), that's OK - products can share SKUs
              ✓ Each row is independent - read quantity, unitPrice, and totalPrice from their respective columns
              ✓ Verify math for EVERY item: quantity × unitPrice = totalPrice
              
              ADDITIONAL REQUIREMENTS:
              - Extract ALL product rows (skip only summary rows like "SUB TOTAL", "TOTAL")
              - Handle both printed and handwritten numbers
              - Parse dates and convert to YYYY-MM-DD format
              - For grand totals: use values from the summary section at bottom
              - Round all numbers to 2 decimal places
              
              IMPORTANT FIELD EXTRACTION:
              - productName: from Product/Description column (required)
              - quantity: total pieces - if CRT/PCS format exists, multiply crtQty \u00d7 pcsQty
              - uom: ALWAYS extract from UOM column if present - can be text (CRT, PCS, CS) or number (1, 2, 3) - convert everything to string
              - crtQty: first number in "X/Y" format from CRT/PCS column (e.g., 2 from "2/24")
              - pcsQty: second number in "X/Y" format from CRT/PCS column (e.g., 24 from "2/24")
              - unitPrice: price per piece from Unit Price column (required)
              - totalPrice: from Total column - should equal quantity \u00d7 unitPrice (required)
              - sku: from SKU/Code column - extract exactly as shown
              - barcode: from Barcode column - extract exactly as shown
              
              EXAMPLES OF CORRECT EXTRACTION:
              Row with: Product="MILK 1L FF" | UOM="CRT" | QTY=1 | CRT/PCS="2/24" | Price=7.60 | Total=7.60 | SKU=20000003
              Extract: {productName:"MILK 1L FF", quantity:1, uom:"CRT", crtQty:2, pcsQty:24, unitPrice:7.60, totalPrice:7.60, sku:"20000003"}
              Note: quantity=1 from QTY column, CRT/PCS "2/24" is just packing info
              
              Row with: Product="MILK 2L FF" | UOM="PCS" | QTY=9 | CRT/PCS="2/24" | Price=14.25 | Total=128.25 | SKU=20000003
              Extract: {productName:"MILK 2L FF", quantity:9, uom:"PCS", crtQty:2, pcsQty:24, unitPrice:14.25, totalPrice:128.25, sku:"20000003"}
              Note: quantity=9 from QTY column, CRT/PCS "2/24" is just packing info
              
              If a column shows "-" or is empty, use null for that field`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 4000,
      temperature: 0.1
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    console.log("✅ AI Extraction Results (raw):", {
      invoiceNumber: result.invoiceNumber,
      supplierName: result.supplierName,
      itemsCount: result.items?.length || 0,
      items: result.items?.map((item: any) => ({
        name: item.productName,
        qty: item.quantity,
        uom: item.uom,
        crtQty: item.crtQty,
        pcsQty: item.pcsQty,
        sku: item.sku,
        barcode: item.barcode,
        unitPrice: item.unitPrice,
        total: item.totalPrice
      })),
      total: result.total,
      confidence: result.confidence
    });
    
    // Validate and correct items with math validation
    const validatedItems = (result.items || []).map((item: any, index: number) => {
      // Quantity is from QTY column - extract as-is, don't calculate from CRT/PCS
      let quantity: number;
      let uom: string | null = item.uom || null;
      let crtQty: number | null = item.crtQty || null;
      let pcsQty: number | null = item.pcsQty || null;
      
      // Convert UOM to string if it's a number (from UOM column)
      if (uom !== null && typeof uom === 'number') {
        uom = String(uom);
        console.log(`📝 UOM column contains number: converting ${item.uom} to string "${uom}"`);
      }
      
      if (typeof item.quantity === 'string') {
        // Extract numeric part only (remove any text like "PCS", "CRT")
        const numMatch = item.quantity.match(/\d+(?:\.\d+)?/);
        quantity = numMatch ? parseFloat(numMatch[0]) : NaN;
        
        // Extract UOM from quantity string if not already provided
        if (!uom) {
          const uomMatch = item.quantity.match(/\b(CRT|PCS|CS|BOX|EA|PKG|BTL|CASE|CTN)\b/i);
          if (uomMatch) {
            uom = uomMatch[1].toUpperCase();
          }
        }
      } else {
        // Quantity is already a number - use it as-is
        quantity = Number(item.quantity);
      }
      
      // Validate quantity
      if (!isFinite(quantity) || quantity <= 0) {
        console.warn(`⚠️ Item ${index + 1}: Invalid quantity detected, defaulting to 1`);
        quantity = 1;
      }
      
      // Ensure UOM is uppercase if present
      if (uom) {
        uom = uom.toUpperCase();
      }
      
      // CRT/PCS values are informational only - don't modify quantity
      if (crtQty && pcsQty) {
        console.log(`📦 Item ${index + 1}: CRT/PCS info: ${crtQty}/${pcsQty} (packing info only, quantity=${quantity})`);
      }
      
      const totalPrice = Number(item.totalPrice) || 0;
      let unitPrice = Number(item.unitPrice) || 0;
      
      console.log(`🔍 Item ${index + 1} - Raw extraction:`, {
        name: item.productName,
        qty: quantity,
        uom: uom,
        crtQty: crtQty,
        pcsQty: pcsQty,
        format: crtQty && pcsQty ? `${crtQty}/${pcsQty}` : 'standard',
        sku: item.sku || 'none',
        barcode: item.barcode || 'none',
        unitPrice: unitPrice,
        total: totalPrice
      });
      
      console.log(`   → Display: ${quantity}${uom ? ' ' + uom : ''} ${crtQty && pcsQty ? `(${crtQty}/${pcsQty})` : ''} @ ${unitPrice} = ${totalPrice}`);
      
      // CRITICAL: Validate math - if unit price × quantity doesn't match total, recalculate
      const calculatedTotal = unitPrice * quantity;
      const difference = Math.abs(calculatedTotal - totalPrice);
      const tolerance = 0.10; // 10 cent tolerance for rounding
      
      // Check for common extraction errors
      if (difference > tolerance && totalPrice > 0 && quantity > 0) {
        // Math doesn't match - check if values were swapped
        
        // Pattern 1: Check if unitPrice and totalPrice were swapped
        if (Math.abs(quantity * totalPrice - unitPrice) < tolerance) {
          console.warn(`⚠️ Item ${index + 1}: Detected swap - unitPrice and totalPrice were reversed`);
          const temp = unitPrice;
          unitPrice = totalPrice;
          // Don't swap totalPrice - recalculate it
          const correctedTotal = quantity * unitPrice;
          console.warn(`   Corrected: qty=${quantity}, unitPrice=${unitPrice}, total=${correctedTotal.toFixed(2)}`);
          return {
            productName: item.productName || "Unknown Product",
            quantity: quantity,
            uom: uom,
            crtQty: crtQty,
            pcsQty: pcsQty,
            unitPrice: parseFloat(unitPrice.toFixed(2)),
            totalPrice: parseFloat(correctedTotal.toFixed(2)),
            sku: item.sku || null,
            barcode: item.barcode || null
          };
        }
        
        // Pattern 2: Check if quantity and unitPrice were swapped
        if (Math.abs(unitPrice * quantity - totalPrice) > tolerance && 
            Math.abs(quantity * unitPrice - totalPrice) > tolerance) {
          // Try swapping quantity and unitPrice
          const testCalc = quantity * unitPrice;
          if (Math.abs(testCalc - totalPrice) < tolerance) {
            // Already correct, just recalculate unit price from total
            const correctedUnitPrice = totalPrice / quantity;
            console.warn(`⚠️ Item ${index + 1}: Math mismatch - recalculating unit price`);
            console.warn(`   Original: qty=${quantity}, unitPrice=${unitPrice}, total=${totalPrice}`);
            console.warn(`   Corrected: qty=${quantity}, unitPrice=${correctedUnitPrice.toFixed(2)}, total=${totalPrice}`);
            unitPrice = parseFloat(correctedUnitPrice.toFixed(2));
          }
        } else {
          // Math doesn't match - recalculate unit price from total
          const correctedUnitPrice = totalPrice / quantity;
          console.warn(`⚠️ Item ${index + 1}: Math correction for "${item.productName}"`);
          console.warn(`   Original: qty=${quantity}, unitPrice=${unitPrice}, total=${totalPrice}, calculated=${calculatedTotal.toFixed(2)}`);
          console.warn(`   Corrected: qty=${quantity}, unitPrice=${correctedUnitPrice.toFixed(2)}, total=${totalPrice}`);
          unitPrice = parseFloat(correctedUnitPrice.toFixed(2));
        }
      } else if (unitPrice === 0 && totalPrice > 0 && quantity > 0) {
        // Unit price is zero but we have total and quantity - calculate it
        unitPrice = parseFloat((totalPrice / quantity).toFixed(2));
        console.log(`✅ Item ${index + 1}: Calculated unit price for "${item.productName}": ${unitPrice} (from ${totalPrice} ÷ ${quantity})`);
      } else if (totalPrice === 0 && unitPrice > 0 && quantity > 0) {
        // Total price is zero but we have unit price and quantity - calculate it
        const calculatedTotal = unitPrice * quantity;
        console.log(`✅ Item ${index + 1}: Calculated total price for "${item.productName}": ${calculatedTotal.toFixed(2)} (from ${quantity} × ${unitPrice})`);
        return {
          productName: item.productName || "Unknown Product",
          quantity: quantity,
          uom: uom,
          crtQty: crtQty,
          pcsQty: pcsQty,
          unitPrice: unitPrice,
          totalPrice: parseFloat(calculatedTotal.toFixed(2)),
          sku: item.sku || null,
          barcode: item.barcode || null
        };
      }
      
      // Final validation: ensure total = quantity × unitPrice
      const finalTotal = parseFloat((quantity * unitPrice).toFixed(2));
      if (Math.abs(finalTotal - totalPrice) > tolerance) {
        // Use calculated total if it's more accurate
        console.warn(`⚠️ Item ${index + 1}: Final total mismatch, using calculated total ${finalTotal} instead of ${totalPrice}`);
        return {
          productName: item.productName || "Unknown Product",
          quantity: quantity,
          uom: uom,
          crtQty: crtQty,
          pcsQty: pcsQty,
          unitPrice: unitPrice,
          totalPrice: finalTotal,
          sku: item.sku || null,
          barcode: item.barcode || null
        };
      }
      
      return {
        productName: item.productName || "Unknown Product",
        quantity: quantity,
        uom: uom,
        crtQty: crtQty,
        pcsQty: pcsQty,
        unitPrice: unitPrice,
        totalPrice: totalPrice,
        sku: item.sku || null,
        barcode: item.barcode || null
      };
    });
    
    // Parse and validate invoice date with better format handling
    let invoiceDate = result.invoiceDate;
    if (invoiceDate && typeof invoiceDate === 'string') {
      // Handle formats like "1.5.11.25" or "15/11/25" or "1.5/11/25"
      const dateStr = invoiceDate.replace(/[.\s]/g, '/'); // Normalize separators
      const parts = dateStr.split('/');
      
      if (parts.length >= 3) {
        let day = parseInt(parts[0]);
        let month = parseInt(parts[1]);
        let year = parseInt(parts[2]);
        
        // Handle 2-digit years
        if (year < 100) {
          year += 2000;
        }
        
        // Validate and create date
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000) {
          invoiceDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        }
      }
    }
    
    if (!invoiceDate || typeof invoiceDate !== 'string' || !invoiceDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      invoiceDate = new Date().toISOString().split('T')[0];
    }
    
    console.log("✅ Validated Items:", validatedItems.map((item: any) => ({
      name: item.productName,
      qty: item.quantity,
      uom: item.uom,
      crtPcs: item.crtQty && item.pcsQty ? `${item.crtQty}/${item.pcsQty}` : null,
      sku: item.sku,
      barcode: item.barcode,
      unitPrice: item.unitPrice,
      total: item.totalPrice,
      check: `${item.quantity}${item.uom ? ' ' + item.uom : ''}${item.crtQty && item.pcsQty ? ` (${item.crtQty}×${item.pcsQty})` : ''} × ${item.unitPrice} = ${item.totalPrice}`
    })));
    
    // Validate and structure the response
    return {
      invoiceNumber: result.invoiceNumber || `INV-${Date.now()}`,
      supplierName: result.supplierName || "Unknown Supplier",
      invoiceDate: invoiceDate,
      dueDate: result.dueDate || null,
      subtotal: Number(result.subtotal) || 0,
      tax: Number(result.tax) || 0,
      total: Number(result.total) || 0,
      items: validatedItems,
      confidence: Math.min(Math.max(Number(result.confidence) || 0.8, 0), 1)
    };
  } catch (error) {
    console.error("❌ Error extracting invoice data:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Provide specific error messages
    if (errorMessage.includes('API key') || errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      throw new Error('Invalid OpenAI API key. Please check your .env file and ensure the API key is correct.');
    }
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      throw new Error('OpenAI API rate limit exceeded. Please try again in a moment.');
    }
    if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
      throw new Error('Network error while processing invoice. Please check your connection and try again.');
    }
    
    // Re-throw with better message
    throw new Error(`Failed to extract invoice data: ${errorMessage}`);
  }
}

// Enhanced product matching with AI
export async function matchProductsWithAI(invoiceItems: any[], existingProducts: any[]): Promise<any[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'set-me' || !apiKey.startsWith('sk-') || apiKey.length < 20) {
    // Return fallback matches instead of throwing error for better UX
    console.warn('OpenAI API key not configured. Using fallback product matching.');
    return invoiceItems.map(item => ({
      invoiceItem: item,
      matchedProduct: null,
      matchConfidence: 0.0,
      suggestedProduct: {
        name: item.productName || "Unknown Product",
        description: `Product from invoice: ${item.productName || "Unknown"}`,
        category: "General",
        sku: `INV-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        barcode: null
      },
      action: 'create_new'
    }));
  }

  try {
    // Process only the first 20 products to avoid token limits
    const limitedProducts = existingProducts.slice(0, 20).map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category
    }));

    // Process only the first 10 invoice items to avoid token limits
    const limitedInvoiceItems = invoiceItems.slice(0, 10);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Match invoice items to existing products. Return matches array in JSON format.`
        },
        {
          role: "user",
          content: `Invoice items: ${JSON.stringify(limitedInvoiceItems)}
          
          Existing products: ${JSON.stringify(limitedProducts)}
          
          Return JSON: {"matches": [{"invoiceItem": item, "matchedProduct": product_or_null, "matchConfidence": 0.8, "suggestedProduct": {"name": "Name", "description": "Desc", "category": "Cat", "sku": "SKU", "barcode": null}, "action": "match_or_create_new"}]}`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
      temperature: 0.2
    });

    const result = JSON.parse(response.choices[0].message.content || '{"matches": []}');
    return Array.isArray(result) ? result : result.matches || [];
  } catch (error) {
    console.error("Error matching products with AI:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Log specific error types for debugging
    if (errorMessage.includes('API key') || errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      console.warn('OpenAI API key issue detected. Using fallback matching.');
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      console.warn('OpenAI API rate limit exceeded. Using fallback matching.');
    } else {
      console.warn('AI matching failed. Using fallback matching.');
    }
    
    // Fallback: create default matches without AI
    return invoiceItems.map(item => ({
      invoiceItem: item,
      matchedProduct: null,
      matchConfidence: 0.0,
      suggestedProduct: {
        name: item.productName || "Unknown Product",
        description: `Product from invoice: ${item.productName || "Unknown"}`,
        category: "General",
        sku: `INV-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        barcode: null
      },
      action: 'create_new'
    }));
  }
}

export async function generateProductRecommendations(customerId?: number, cartItems: any[] = []) {
  // Check if we have a valid OpenAI API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'set-me' || apiKey.startsWith('AIzaSy') || !apiKey.startsWith('sk-') || apiKey.length < 20) {
    console.log('Invalid or missing OpenAI API key. Returning empty recommendations.');
    return [];
  }
  
  // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
  try {
    const cartContext = cartItems.length > 0 
      ? `Current cart contains: ${cartItems.map(item => `${item.productName} (${item.quantity}x)`).join(', ')}`
      : 'Cart is empty';
    
    const customerContext = customerId 
      ? `Customer ID: ${customerId} - analyze their purchase history`
      : 'Walk-in customer - provide general recommendations';

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant for a retail POS system. Generate product recommendations based on the current cart and customer context. Provide exactly 3-5 relevant product recommendations.
          
          For each recommendation, provide:
          - product: { id, name, price, category, sku }
          - reason: one of "frequently_bought_together", "customer_history", "trending", "seasonal"
          - confidence: percentage (70-95)
          
          Respond with JSON in this format:
          [
            {
              "product": {"id": 1, "name": "Product Name", "price": 12.99, "category": "Category", "sku": "SKU-001"},
              "reason": "frequently_bought_together",
              "confidence": 85
            }
          ]`
        },
        {
          role: "user",
          content: `${cartContext}. ${customerContext}. Generate relevant product recommendations for this retail scenario.`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 800
    });

    const result = JSON.parse(response.choices[0].message.content || '{"recommendations": []}');
    
    // Ensure we return an array
    return Array.isArray(result) ? result : result.recommendations || [];
    
  } catch (error) {
    console.error("Error generating product recommendations:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Log specific error types for debugging
    if (errorMessage.includes('API key') || errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      console.warn('OpenAI API key issue detected. Recommendations disabled.');
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      console.warn('OpenAI API rate limit exceeded. Recommendations temporarily unavailable.');
    }
    // Return empty array if AI fails (graceful degradation)
    return [];
  }
}