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
          content: `You are an expert OCR specialist at extracting data from ${documentType} images, including receipts with handwritten notes and small text. Extract all relevant information and return it in the exact JSON format specified. 
          
          CRITICAL RULES:
          1. Only extract rows that have ACTUAL HANDWRITTEN OR FILLED DATA - ignore blank template rows
          2. Read ACTUAL numbers written/circled on the form - do NOT use template/example values
          3. Handwritten numbers may be circled or highlighted - these are the real transaction values
          4. Empty template rows with pre-printed labels should be completely ignored
          5. Focus on what is ACTUALLY FILLED IN, not what is pre-printed on the template`
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
                    "quantity": number,
                    "unitPrice": number,
                    "totalPrice": number,
                    "sku": "string or null",
                    "barcode": "string or null"
                  }
                ],
                "confidence": number (0.0 to 1.0)
              }
              
              CRITICAL INSTRUCTIONS FOR EXTRACTING ITEMS:
              
              UNDERSTAND THE TABLE LAYOUT:
              The invoice table has these columns from LEFT to RIGHT:
              1. رقم الصنف (Item No.) - Row number
              2. التفصيل / Description - Product name/description
              3. الكمية / Qty - Quantity (number of units)
              4. سعر الوحدة / U. Price - Unit price per item, split into:
                 - ريال / QR (Qatari Riyals)
                 - درهم / Dh (Dirhams - decimals)
              5. المبلغ / Amount - Total price (Quantity × Unit Price), split into:
                 - ريال / QR (Qatari Riyals)
                 - درهم / Dh (Dirhams - decimals)
              
              EXTRACTION RULES - READ VERY CAREFULLY:
              - ONLY extract items that have ACTUAL HANDWRITTEN OR FILLED DATA
              - IGNORE completely empty rows even if they have printed row numbers
              - Look for handwritten numbers, circled numbers, or filled data
              - Many invoices have pre-printed template rows that were NOT used - skip these entirely
              - A row is ONLY valid if it has handwritten data in Qty, Unit Price, or Amount columns
              
              STEP-BY-STEP EXTRACTION FOR EACH ROW:
              
              Step 1: Identify if the row has ANY handwritten data
              - Look for ink marks, handwriting, or circled numbers
              - If the row is completely blank except for pre-printed labels, SKIP IT
              
              Step 2: Extract PRODUCT NAME from the "التفصيل / Description" column
              - This is typically the second column from the left
              - May be handwritten or pre-printed product name
              - Common examples: "MTA", "CABLE", "PIPE", etc.
              
              Step 3: Extract QUANTITY from the "الكمية / Qty" column
              - This is usually the third column
              - Look for handwritten number in the quantity box
              - Common values: 1, 2, 4, 8, 10, 12, 16, 20, etc.
              - Be careful with handwritten numbers that might look unclear
              
              Step 4: Extract TOTAL AMOUNT FIRST (most reliable)
              - Find the "المبلغ / Amount" column (rightmost columns with QR and Dh)
              - Look for the TOTAL PRICE which is often circled or emphasized
              - This is the FINAL price for this line item (Quantity × Unit Price)
              - Read the QR (ريال) column for the main amount
              - Read the Dh (درهم) column for decimals if present
              - Combine them: if QR=12 and Dh is empty, total = 12.00
              
              Step 5: Calculate or Extract UNIT PRICE
              - Look in the "سعر الوحدة / U. Price" columns (middle columns)
              - Read what's written in the QR and Dh sub-columns
              - If unit price is blank/unclear, CALCULATE IT: Unit Price = Total Amount ÷ Quantity
              - Example: If Total=12 and Qty=16, then Unit Price = 12÷16 = 0.75
              - Verify your calculation makes sense (Unit Price × Quantity should equal Total)
              
              CRITICAL MATH VALIDATION:
              - After extraction, verify: Quantity × Unit Price ≈ Total Price
              - If the math doesn't match, recalculate the unit price: Unit Price = Total ÷ Quantity
              - ALWAYS prioritize the TOTAL AMOUNT as it's usually most clearly written
              - Example from image:
                * Product: MTA
                * Quantity: 16 (handwritten in Qty column)
                * Total: 12 (circled in Amount column)
                * Therefore Unit Price must be: 12 ÷ 16 = 0.75 QR
              
              IMPORTANT - HANDLING UNCLEAR HANDWRITING:
              - The Total Amount is usually the MOST CLEARLY written (often circled)
              - If Unit Price is unclear or missing, calculate it from Total ÷ Quantity
              - Quantity is typically easier to read than unit prices
              - Don't assume values - extract what you see or calculate based on math
              - Handwritten 1 looks like: |
              - Handwritten 2 looks like: curved line
              - Handwritten 4 looks like: angular or checkmark shape
              - Handwritten 7 may have a line through it: 7̶
              - Decimals are often in the Dh (درهم) column
              
              OTHER INSTRUCTIONS:
              - Look at the BOTTOM of the invoice for the final totals section
              - The "Total" row at the bottom (often has handwritten/circled amount) is the GRAND TOTAL
              - "Discount" row may have a discount amount
              - "Grant Total" (or "Grand Total") is the final amount after discount
              - The REMARKS section may contain additional notes or reference numbers (ignore these for calculations)
              - Parse dates carefully - formats like "15/11/25" or "1.5.11.25" mean day-month-year
              - Convert dates to YYYY-MM-DD format (e.g., "15/11/25" → "2025-11-15")
              - If you see "1.5.11.25" that likely means day 15, month 11, year 2025
              - Prefer QR (Qatari Riyal) as the currency
              - If subtotal is not shown, sum all line item totals
              - VAT is often zero on these invoices unless explicitly shown
              - ONLY include line items with actual data - skip empty template rows
              - Double-check: For EACH item, verify that Quantity × Unit Price = Total Price
              - If the math doesn't match, recalculate unit price as: Total Price ÷ Quantity`
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
        unitPrice: item.unitPrice,
        total: item.totalPrice
      })),
      total: result.total,
      confidence: result.confidence
    });
    
    // Validate and correct items with math validation
    const validatedItems = (result.items || []).map((item: any) => {
      const quantity = Number(item.quantity) || 1;
      const totalPrice = Number(item.totalPrice) || 0;
      let unitPrice = Number(item.unitPrice) || 0;
      
      // CRITICAL: Validate math - if unit price × quantity doesn't match total, recalculate
      const calculatedTotal = unitPrice * quantity;
      const difference = Math.abs(calculatedTotal - totalPrice);
      const tolerance = 0.02; // 2 cent tolerance for rounding
      
      if (difference > tolerance && totalPrice > 0 && quantity > 0) {
        // Math doesn't match - recalculate unit price from total
        const correctedUnitPrice = totalPrice / quantity;
        console.warn(`⚠️ Math correction for "${item.productName}":`, {
          original: { qty: quantity, unitPrice, total: totalPrice, calculated: calculatedTotal },
          corrected: { qty: quantity, unitPrice: correctedUnitPrice, total: totalPrice }
        });
        unitPrice = parseFloat(correctedUnitPrice.toFixed(2));
      } else if (unitPrice === 0 && totalPrice > 0 && quantity > 0) {
        // Unit price is zero but we have total and quantity - calculate it
        unitPrice = parseFloat((totalPrice / quantity).toFixed(2));
        console.log(`✅ Calculated unit price for "${item.productName}": ${unitPrice} (from ${totalPrice} ÷ ${quantity})`);
      }
      
      return {
        productName: item.productName || "Unknown Product",
        quantity: quantity,
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
      unitPrice: item.unitPrice,
      total: item.totalPrice,
      check: `${item.quantity} × ${item.unitPrice} = ${item.totalPrice}`
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