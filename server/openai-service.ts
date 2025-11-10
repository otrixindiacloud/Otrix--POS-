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
          content: `You are an expert at extracting data from ${documentType} images. Extract all relevant information and return it in the exact JSON format specified. Focus on accuracy and completeness.`
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
              
              Parse all line items carefully. If dates are unclear, estimate based on invoice format. If amounts are unclear, calculate based on line items.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "low"
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
      temperature: 0.1
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    // Validate and structure the response
    return {
      invoiceNumber: result.invoiceNumber || `INV-${Date.now()}`,
      supplierName: result.supplierName || "Unknown Supplier",
      invoiceDate: result.invoiceDate || new Date().toISOString().split('T')[0],
      dueDate: result.dueDate || null,
      subtotal: Number(result.subtotal) || 0,
      tax: Number(result.tax) || 0,
      total: Number(result.total) || 0,
      items: (result.items || []).map((item: any) => ({
        productName: item.productName || "Unknown Product",
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unitPrice) || 0,
        totalPrice: Number(item.totalPrice) || 0,
        sku: item.sku || null,
        barcode: item.barcode || null
      })),
      confidence: Math.min(Math.max(Number(result.confidence) || 0.8, 0), 1)
    };
  } catch (error) {
    console.error("Error extracting invoice data:", error);
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