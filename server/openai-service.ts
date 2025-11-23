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
          content: `You are an expert OCR specialist at extracting line items from ${documentType} images (scanned or photographed). 
          
          CRITICAL: YOU MUST EXTRACT THE ACTUAL, REAL DATA FROM THE IMAGE - DO NOT MAKE UP OR HALLUCINATE DATA!
          
          Your task is to READ the text, numbers, and values EXACTLY as they appear in the image using visual OCR.
          If you cannot read a value clearly, use null - NEVER guess or fabricate data.
          
          Extract all relevant information and return it strictly in the JSON format requested.
          
          CRITICAL COLUMN IDENTIFICATION RULES:
          - ALWAYS examine the table header row FIRST to identify ALL columns
          - Columns can appear in ANY ORDER - do not assume a fixed sequence
          - IMPORTANT: Columns may be arranged as: Product | QTY CRT/PCS | CRT Price | PCS Price | Total
          - OR they could be: Product | Total | QTY CRT/PCS | PCS Price | CRT Price
          - OR any other combination - READ THE HEADERS to identify each column
          
          STEP 1: IDENTIFY ALL COLUMNS BY THEIR HEADERS (can be in any order):
          
          A) QUANTITY COLUMN (MOST IMPORTANT):
             - Header is typically: "QTY", "Qty", or "Quantity"
             - This is a SINGLE column that contains the quantity values
             - Values INSIDE this column can be in TWO different formats:
             
             Format 1: Simple numbers (most common for bakery/simple items)
               * Examples: 1, 2, 9, 12, etc.
               * Just read the number directly
               * Extract: quantity = the number shown
             
             Format 2: CRT/PCS format (for carton-based items)
               * Examples: "2/24", "0/3", "1/0", "3/12"
               * Format is "X/Y" where X=cartons, Y=pieces per carton
               * The "X/Y" appears as the VALUE inside the QTY column
               * Extract: crtQty = X (first number), pcsQty = Y (second number)
               * Calculate quantity based on which price is used (see decision tree)
             
             IMPORTANT: Whether simple numbers OR "X/Y" format, BOTH are values INSIDE the QTY column
             - Do NOT look for separate "CRT/PCS" column - it's part of the QTY values
             - The column header is just "QTY" or "Quantity"
             - The values themselves tell you if it's simple (9) or CRT/PCS format (2/24)
          
          B) PRICE COLUMNS (receipt may have MULTIPLE price columns):
             1. "CRT Price" or "Carton Price" = Price per CARTON
             2. "PCS Price" or "Piece Price" or "Unit Price" = Price per PIECE
             3. "U.Price", "U Price", "U/Price", "Price", "Rate", "Base Price" = Could be either
             - CRITICAL: Some receipts have BOTH CRT Price and PCS Price columns
             - You need to identify which price applies to calculate the total
          
          C) TOTAL COLUMN:
             - Header: "Total", "Amount", "Line Total", "Amt", "Tot", "Totl", "Line Amt"
             - This is the final calculated amount for the line
             - Use this to VERIFY which price column was used
          
          D) OTHER COLUMNS:
             - Product/Description column
             - SKU/Code column (if present)
             - Barcode column (if present)
          
          CRITICAL: DO NOT extract or read any UOM (Unit of Measure) column
          - Ignore columns labeled "UOM", "Unit", "U/M"
          - Use ONLY the QTY or QTY CRT/PCS column for quantity information
          
          CRITICAL WARNINGS:
          - DO NOT assume columns are in a fixed order
          - READ each column header carefully
          - Identify which columns exist before extracting data
          - Some receipts have only CRT Price, some only PCS Price, some have BOTH
          
          CRITICAL UNIT PRICE READING INSTRUCTIONS:
          - Unit Price is typically SMALLER than Total Price for each item
          - Unit Price represents the price of ONE unit/piece of the product
          - For items with quantity > 1, the Unit Price should be: Total Price ÷ Quantity
          - Look at the column under "U.Price" or "Unit Price" header - read the value EXACTLY as shown
          - Use high contrast and clear focus when reading numbers in the Unit Price column
          - Pay special attention to decimal points (e.g., 22.41 vs 2.241 vs 224.1)
          - Double-check: Does Quantity × Unit Price = Total Price? If not, you may have misread the Unit Price
          - Common mistakes to avoid:
            * Reading Total Price as Unit Price (Total is usually rightmost column)
            * Misplacing decimal points (22.41 is different from 2.241)
            * Confusing similar digits (0 vs O, 1 vs I, 5 vs S, 8 vs B)
            * Reading from wrong column due to column misalignment
          
          IMPORTANT BEHAVIORS:
          - Extract EVERY product row that contains actual numeric values in Quantity and/or Total columns
          - Treat both HANDWRITTEN AND PRINTED numbers/text as valid data
          - Skip summary rows: "SUB TOTAL", "SUBTOTAL", "TOTAL", "GRAND TOTAL", taxes/fees summaries, section headers
          - Scan the ENTIRE image and combine all product rows from all sections into one items array
          
          🖊️ CRITICAL: HANDWRITTEN TEXT AND NUMBER RECOGNITION 🖊️
          
          HANDWRITTEN RECEIPTS ARE COMMON - You MUST be able to read handwriting accurately!
          
          🔢 ADVANCED HANDWRITTEN NUMBER RECOGNITION - HIGH ACCURACY REQUIRED 🔢
          
          Your PRIMARY CHALLENGE is reading handwritten numbers with 100% accuracy.
          Common mistakes: Misreading "4" as "9", "14" as "19", "56" as "66" or "86"
          
          CRITICAL DIGIT-BY-DIGIT ANALYSIS METHOD:
          
          For EACH handwritten number, use this step-by-step approach:
          
          1️⃣ DIGIT "1":
             - Vertical line (may be straight or slightly curved)
             - May have small hook/serif at top
             - May have base stroke at bottom
             - Context check: Usually smallest/thinnest digit
             - In "14": First digit is "1" (thin vertical line)
             - NOT to be confused with: "7" (has top horizontal), "l" (letter)
          
          2️⃣ DIGIT "4":
             - Most distinctive feature: OPEN or CLOSED TOP
             - Two main styles:
               Style A: Triangle shape with vertical line on right (like an upside-down chair)
               Style B: Open at top (looks like lightning bolt or "<|")
             - Key feature: Vertical line on RIGHT side goes DOWN
             - In "14": Second digit after the thin "1"
             - In "4" alone: Look for the characteristic right vertical stroke
             - NOT to be confused with: "9" (has closed circle/loop at top)
             - VERIFICATION: If you think it's "9", look again - does it have a triangle or open top? Then it's "4"
          
          3️⃣ DIGIT "5":
             - Top horizontal line (may curve slightly)
             - Bottom curves like half circle or "C"
             - Two-part structure: top straight, bottom curved
             - NOT to be confused with: "S" (letter), "6" (circle with top tail)
             - In "56": First digit with horizontal top and curved bottom
          
          4️⃣ DIGIT "6":
             - Circle or loop at BOTTOM
             - Tail/stroke comes from TOP and curves to form circle
             - Like lowercase "b" but mirrored
             - In "56": Second digit with circular bottom
             - NOT to be confused with: "0" (no tail), "8" (two loops)
          
          5️⃣ DIGIT "7":
             - Horizontal line at TOP
             - Diagonal stroke going down-left to down-right
             - May have small cross-stroke in middle (European style)
             - NOT to be confused with: "1" (no top horizontal)
          
          6️⃣ DIGIT "8":
             - Two circles/loops stacked vertically
             - Top loop may be smaller than bottom loop
             - Continuous line forming both loops
             - NOT to be confused with: "3" (has gaps), "B" (letter)
          
          7️⃣ DIGIT "9":
             - Circle/loop at TOP
             - Vertical tail going DOWN from the circle
             - Like "g" in cursive or "q" upside down
             - Key difference from "4": "9" has CLOSED CIRCLE at top, "4" has OPEN/TRIANGLE
             - NOT to be confused with: "4" (open top, different structure)
          
          8️⃣ DIGIT "0":
             - Oval or circle shape
             - No tails, no internal marks
             - May be slightly tilted
             - NOT to be confused with: "O" (letter - check context)
          
          9️⃣ DIGIT "2":
             - Curved top (like swan neck)
             - Horizontal or diagonal bottom
             - May look like "Z" shape
             - NOT to be confused with: "Z" (letter - check context)
          
          🔟 DIGIT "3":
             - Two curves stacked (like two "C"s facing right)
             - Middle may connect or have gap
             - NOT to be confused with: "8" (closed loops), "E" (letter)
          
          🎯 CRITICAL VERIFICATION STEPS FOR ACCURACY:
          
          After reading each handwritten number, ASK YOURSELF:
          
          For "4" vs "9" confusion (MOST COMMON ERROR):
          ❓ Does it have an OPEN TOP or TRIANGLE shape? → It's "4"
          ❓ Does it have a CLOSED CIRCLE at top? → It's "9"
          ❓ Can you see a clear vertical stroke on the RIGHT side? → It's "4"
          ❓ Does it look like a lollipop with tail going down? → It's "9"
          
          For "14" specifically:
          ✓ First digit: thin vertical line = "1"
          ✓ Second digit: has open/triangle top with right vertical = "4"
          ✓ Together: "14" (not "19", not "11", not "44")
          
          For "56" specifically:
          ✓ First digit: horizontal top + curved bottom = "5"
          ✓ Second digit: circular bottom with top tail = "6"
          ✓ Together: "56" (not "66", not "86", not "96")
          
          For "4" alone:
          ✓ Look for the OPEN structure at top (not a closed circle like "9")
          ✓ Look for the RIGHT-SIDE vertical stroke going down
          ✓ May look like: "4", "ч", "<|", or triangle-with-leg
          ✓ Result: "4" (not "9", not "7", not "1")
          
          MATHEMATICAL VERIFICATION (EXTREMELY IMPORTANT):
          - After extracting numbers, IMMEDIATELY verify with math
          - If Quantity = 4, Price = 5.10, Total should be ≈ 20.40
          - If Quantity = 14, Price = 5.10, Total should be ≈ 71.40
          - If Quantity = 56, Price = 5.10, Total should be ≈ 285.60
          - If math DOESN'T MATCH → You misread a digit → GO BACK and re-examine
          
          STEP-BY-STEP NUMBER READING PROTOCOL:
          1. Look at the full handwritten number
          2. Break it into individual digits (left to right)
          3. Identify EACH digit using the patterns above
          4. For each "4": Confirm it's NOT "9" (check for open top vs closed circle)
          5. For each "5": Confirm it's NOT "6" or "S"
          6. For each "6": Confirm it's NOT "8" or "0"
          7. Assemble the complete number
          8. VERIFY with mathematical calculation (qty × price = total)
          9. If math fails → Re-read the most ambiguous digits
          
          COMMON HANDWRITING ERROR PATTERNS TO AVOID:
          ❌ Reading "4" as "9" → Always check: open top = 4, closed circle = 9
          ❌ Reading "14" as "19" → The second digit is "4" (open top), not "9" (closed circle)
          ❌ Reading "14" as "11" → Second digit has more structure than just a line
          ❌ Reading "56" as "66" → First digit has straight top (5), not circular (6)
          ❌ Reading "56" as "86" → First digit is "5" (half circle bottom), not "8" (full circles)
          ❌ Reading "4" as "H" → Context: in number column = digit 4, in text = letter H
          
          Handwritten Text Recognition Rules:
          - Product names may be abbreviated or written in cursive
          - Look for recognizable brand names, common words
          - Some letters to watch carefully:
            * "a" vs "o" - check if it's open at top
            * "e" vs "c" - check for the horizontal line in "e"
            * "l" vs "i" vs "1" - use context (is it in a word or number?)
            * "n" vs "u" - "n" has humps going up, "u" curves down
            * "m" vs "w" - orientation and context
          
          Verification Strategy for Handwritten Data:
          1. Read the handwritten value
          2. Check if it makes sense in context (quantity should be small, prices reasonable)
          3. Verify math: Does quantity × unit price = total? If yes, you read it correctly
          4. If math doesn't match, re-examine the handwritten digits you may have misread
          5. Use surrounding printed text/numbers as reference for handwriting style
          
          Examples of Handwritten Number Reading:
          - Handwritten "24" - might look like "24" or "2H" - verify with math
          - Handwritten "3.25" - decimal point may be small dot or dash - look carefully
          - Handwritten "0" vs "O" - if it's in a number position, it's zero; in text, it's letter O
          - Handwritten "1" vs "l" vs "I" - in quantity column = 1 (number), in product name = letter
          
          If Handwriting is Truly Illegible:
          - Use null for that specific field
          - DO NOT guess or make up values
          - But make a STRONG effort first - most handwriting CAN be read with careful analysis
          
          MANDATORY OCR ACCURACY RULES:
          ⚠️ CRITICAL: Read ONLY what is ACTUALLY VISIBLE in the image
          ⚠️ DO NOT fabricate, estimate, or guess ANY values
          ⚠️ DO NOT use example data or placeholder values
          ⚠️ DO NOT assume standard prices or quantities
          ⚠️ If a field is unclear or unreadable, use null - DO NOT GUESS
          ⚠️ Read each digit carefully - verify decimal points, commas, and number formatting
          ⚠️ Double-check every extracted number against the actual image
          ⚠️ Product names must match EXACTLY as written (including spelling, abbreviations, brands)
          ⚠️ Dates must be extracted as shown (convert to YYYY-MM-DD format)
          ⚠️ Invoice numbers must be extracted EXACTLY as printed
          ⚠️ Supplier names must match the actual business name on the invoice
          
          VISUAL OCR CHECKLIST (for each value you extract):
          1. Can you clearly SEE this value in the image? (Yes → extract it, No → use null)
          2. Is the text/number sharp enough to read with confidence? (Yes → extract it, No → use null)
          3. Did you read it from the CORRECT column/position? (verify alignment)
          4. Did you verify the decimal point position? (e.g., 22.41 not 224.1)
          5. Does this value make logical sense? (qty=365 for one item is suspicious, might be total)
          6. For handwritten numbers: Did you verify EACH DIGIT individually? (4 vs 9, 5 vs 6, 1 vs 7)
          7. For handwritten numbers: Did you use MATH to verify? (qty × price = total)
          
          REAL-WORLD HANDWRITTEN NUMBER EXAMPLES:
          ✓ Handwritten "4" → May look like: 4, ч, ⁴, <|, triangle-with-leg → EXTRACT AS: 4 (number)
          ✓ Handwritten "14" → May look like: 1ч, |4, thin-line + triangle → EXTRACT AS: 14 (number)
          ✓ Handwritten "56" → May look like: 5б, curved-top + circle-bottom → EXTRACT AS: 56 (number)
          ✗ DO NOT read "4" as "9" → "9" has closed circle at top, "4" has open/triangle top
          ✗ DO NOT read "14" as "19" → Second digit is "4" (open structure), not "9" (closed circle)
          ✗ DO NOT read "56" as "66" → First digit "5" has horizontal top, "6" has circular top
          
          🖊️ MIXED PRINTED AND HANDWRITTEN RECEIPTS:
          - Many receipts have BOTH printed AND handwritten elements
          - Common pattern: Printed template/form with handwritten fill-ins
          - Headers/column names are usually PRINTED (typed)
          - Product names, quantities, prices may be HANDWRITTEN (written by hand)
          - Treat handwritten data with EQUAL importance as printed data
          - Apply the handwritten recognition rules (see above) when you encounter handwriting
          - Use the printed column headers to guide where handwritten values belong
          
          CRITICAL: HANDLING "QTY CRT/PCS" COLUMN AND PRICING:
          
          The receipt will have a "QTY CRT/PCS" column with format "X/Y" (e.g., "2/24", "0/3", "1/0")
          where X = number of cartons, Y = pieces per carton
          
          The receipt may have ONE or MORE of these price columns:
          - CRT Price (price per carton)
          - PCS Price (price per piece)
          - Unit Price (could be per carton or per piece)
          
          CALCULATION LOGIC (VERY IMPORTANT):
          
          Case 1: Receipt has BOTH "CRT Price" AND "PCS Price" columns
          - Look at which value is used to calculate the Total
          - If QTY = "2/24" (2 cartons of 24 pieces), CRT Price = 182.40, PCS Price = 7.60, Total = 364.80
            * Check: 2 × 182.40 = 364.80 ✓ (matches Total) → CRT Price was used
            * Therefore: quantity = 2, unitPrice = 182.40, crtQty = 2, pcsQty = 24
          - If QTY = "0/3" (3 pieces), CRT Price = 68.40, PCS Price = 2.85, Total = 8.55
            * Check: 0 × 68.40 = 0 ✗ (doesn't match)
            * Check: 3 × 2.85 = 8.55 ✓ (matches Total) → PCS Price was used
            * Therefore: quantity = 3, unitPrice = 2.85, crtQty = 0, pcsQty = 3
          
          Case 2: Receipt has only ONE price column
          - Determine if it's per carton or per piece by checking the math
          - QTY = "2/24", Price = 7.60, Total = 364.80
            * Check: 2 × 7.60 = 15.20 ✗ (doesn't match)
            * Check: 48 × 7.60 = 364.80 ✓ (matches) → Price is per piece
            * Therefore: quantity = 48 (2 × 24), unitPrice = 7.60, crtQty = 2, pcsQty = 24
          
          DECISION TREE FOR QUANTITY AND UNIT PRICE:
          1. Read the QTY column value:
             - If it's a simple number (1, 2, 9) → quantity = that number
             - If it's "X/Y" format (2/24, 0/3) → Extract crtQty (X) and pcsQty (Y)
          2. Identify available price columns (CRT Price, PCS Price, Unit Price, etc.)
          3. For "X/Y" format, use Total column to determine which calculation applies:
             - If crtQty > 0 and crtQty × CRT_Price ≈ Total → use crtQty as quantity, CRT_Price as unitPrice
             - If pcsQty > 0 and pcsQty × PCS_Price ≈ Total → use pcsQty as quantity, PCS_Price as unitPrice
             - If (crtQty × pcsQty) × PCS_Price ≈ Total → use (crtQty × pcsQty) as quantity, PCS_Price as unitPrice
          4. Store: quantity (calculated), unitPrice (the price used), crtQty, pcsQty, totalPrice
          
          IMPORTANT: UNDERSTANDING QTY COLUMN VALUES:
          
          The QTY column header is simply "QTY" or "Quantity"
          The VALUES inside this column tell you the format:
          
          Case A: Simple numeric values (bakery receipt example)
          - QTY column shows: 1 → Extract: quantity=1, crtQty=null, pcsQty=null
          - QTY column shows: 2 → Extract: quantity=2, crtQty=null, pcsQty=null
          - QTY column shows: 9 → Extract: quantity=9, crtQty=null, pcsQty=null
          - Just read the number directly as the quantity
          
          Case B: CRT/PCS format values (wholesale receipt example)
          - QTY column shows: "0/3" → Extract: quantity=3, crtQty=0, pcsQty=3
          - QTY column shows: "2/24" → Extract: quantity=(determined by price), crtQty=2, pcsQty=24
          - QTY column shows: "1/0" → Extract: quantity=1, crtQty=1, pcsQty=0
          - Parse the "X/Y" format to get crtQty and pcsQty, then calculate quantity
            * This is the real quantity, not calculated from CRT/PCS
          - CRT/PCS is just showing the packing information (e.g., "2/24" means 2 cartons with 24 pieces each)
          - IMPORTANT: quantity field = value from QTY column ONLY
          - IMPORTANT: crtQty/pcsQty = values from CRT/PCS column (informational)
          - IMPORTANT: Unit price and total price are based on the QTY column value
          - Common UOMs: CRT (Carton), PCS (Pieces), CS (Case), BOX, EA (Each), PKG (Package), BTL (Bottle)
          - Always round numeric values to two decimals
          
          STEP-BY-STEP APPROACH FOR EACH ITEM:
          1. Examine the column HEADERS to identify ALL columns and their positions (they can be in ANY order)
          2. Locate: Product name, QTY CRT/PCS, price columns (CRT Price, PCS Price, Unit Price), Total
          3. For each item row:
             a) Read QTY CRT/PCS value (e.g., "2/24") → parse as crtQty=2, pcsQty=24
             b) Read ALL available price columns (CRT Price, PCS Price, etc.)
             c) Read Total column value
             d) Determine which price was used by checking: which calculation matches Total?
             e) Set quantity and unitPrice based on which price matches
          4. Verify: calculated_quantity × unitPrice ≈ Total Price (±2% tolerance)
          5. If math matches, you extracted correctly!`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `IMPORTANT: You are analyzing a REAL invoice/receipt image. Extract ONLY the ACTUAL data visible in the image.
              DO NOT use example data, placeholders, or make assumptions. If unclear, use null.
              
              STEP-BY-STEP EXTRACTION PROCESS:
              1. First, EXAMINE the entire image to understand the layout
              2. Locate the HEADER section (top) - find supplier name, invoice number, date
              3. Locate the ITEM TABLE (middle) - identify column headers and read each row
              4. Locate the SUMMARY section (bottom) - find subtotal, tax, and total
              5. Extract values EXACTLY as shown, character by character
              
              🎨 CRITICAL: TABLE FORMATTING AND VISUAL ELEMENTS 🎨
              
              COLORED TABLES AND BACKGROUNDS:
              - Some receipts use COLORED backgrounds for tables (blue, green, gray, etc.)
              - COLORED TABLE CELLS are still valid data - read the text/numbers inside them
              - Blue background with white text is COMMON - focus on reading the WHITE TEXT
              - Don't be confused by colored headers - they're still column headers
              - Colored alternating rows (zebra striping) are for readability - read all rows equally
              
              GRID LINES AND TABLE BORDERS - CRITICAL DISTINCTION:
              ⚠️⚠️⚠️ VERTICAL LINES ARE NOT NUMBERS ⚠️⚠️⚠️
              
              - Tables have VERTICAL LINES to separate columns
              - These vertical lines are BORDERS/GRID LINES, NOT the number "1"
              - DO NOT extract table border lines as data
              - DO NOT read "|" or "│" as the number "1"
              - Vertical lines are STRUCTURAL elements, not content
              
              How to distinguish VERTICAL LINES from NUMBER "1":
              ✓ Number "1": Appears INSIDE a cell, has context (in QTY column, in product code)
              ✓ Number "1": Has surrounding space, aligned with other numbers
              ✓ Number "1": May have serif (hook at top/bottom), slight curve
              ✗ Vertical line: Extends FULL HEIGHT of row, spans multiple rows
              ✗ Vertical line: Perfectly straight, no serifs, no variation
              ✗ Vertical line: Separates content between columns
              ✗ Vertical line: Often colored (gray, blue, black) matching table theme
              
              TABULAR FORMAT RECOGNITION:
              - Identify column boundaries by looking at HEADER ROW alignment
              - Each column has: Left border | Content | Right border
              - The borders are NOT part of the data
              - Read content BETWEEN the vertical lines, not the lines themselves
              
              Example of CORRECT reading:
              Table structure: | Product | QTY | Price |
              Visual:          | Bread   | 2   | 5.10  |
              ✓ CORRECT: Product="Bread", QTY=2, Price=5.10
              ✗ WRONG: Reading vertical separator lines as "1" in data
              
              COLOR-BASED TABLE ELEMENTS:
              - Blue headers → Read white/light text on blue background
              - Gray alternating rows → Read text in both white and gray rows equally
              - Highlighted cells (yellow/green) → May indicate special items, but read normally
              - Color coding is for VISUAL organization, not data meaning
              
              GRID STRUCTURE UNDERSTANDING:
              - Modern receipts often have grid layouts with boxes/cells
              - Each cell is bounded by lines on all 4 sides
              - Read the CONTENT inside each cell, not the cell borders
              - Cell borders help you understand column alignment - use them as guides
              - Don't extract border lines, gridlines, or separators as numbers
              
              VISUAL NOISE FILTERING:
              - Ignore: Logo watermarks, background patterns, decorative elements
              - Ignore: Header/footer lines, page borders, form boundaries
              - Ignore: Column separator lines, row divider lines, table grid
              - Focus on: Actual text and numbers INSIDE the cells/fields
              
              🖊️ HANDWRITTEN RECEIPT SPECIAL INSTRUCTIONS:
              - Many receipts contain handwritten text and numbers - you MUST read them accurately
              - For handwritten product names: Read each letter carefully, use context for unclear letters
              - For handwritten dates: Common formats DD/MM/YYYY or DD-MM-YYYY - parse carefully
              - For handwritten invoice numbers: May contain letters and numbers - extract exactly
              - For handwritten quantities/prices: Verify with math (quantity × price = total)
              - Handwriting varies - some may be neat, some messy - make your best effort
              - Cross-reference: If supplier name is printed at top, handwritten items should match that supplier
              - Use mathematical verification as proof you read numbers correctly
              
              Extract all information from this ${documentType} image and return it in JSON format with these exact fields:
              
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
                    "quantity": number (calculated total quantity - see QTY CRT/PCS handling below),
                    "crtQty": number (carton quantity from CRT/PCS format, e.g., 2 from '2/24') or null,
                    "pcsQty": number (pieces per carton from CRT/PCS format, e.g., 24 from '2/24') or null,
                    "unitPrice": number (price per unit - could be from Unit Price, CRT Price, or PCS Price column),
                    "totalPrice": number (total line amount from Total column),
                    "sku": "string from SKU/Code column or null",
                    "barcode": "string from Barcode column or null"
                  }
                ],
                "confidence": number (0.0 to 1.0)
              }
              
              ⚠️⚠️⚠️ CRITICAL REMINDER: EXTRACT REAL DATA ONLY ⚠️⚠️⚠️
              - Read ACTUAL text and numbers from the image using OCR
              - Do NOT generate sample/example data
              - Do NOT use placeholder values like "Product 1", "Product 2"
              - Do NOT assume prices like 10.00, 20.00, 5.00 if not visible
              - VERIFY each extracted value by looking at the image again
              - If you cannot read something clearly, use null
              - Product names must be EXACT matches (including spelling errors if present)
              - All numbers must be ACTUAL values from the image (not rounded or estimated)
              
              CRITICAL: READING SUBTOTAL, TAX, AND TOTAL CORRECTLY
              - These financial summary values appear at the BOTTOM of the invoice, AFTER all product line items
              - They are in a SUMMARY SECTION, not in the product table
              - Common labels: "SUB TOTAL", "SUBTOTAL", "Sub Total", "TOTAL BEFORE TAT", "Net Amount"
              - Look for these summary rows BELOW the last product item
              - Read row-wise from LEFT to RIGHT in the summary section
              - Structure is usually: [Label] [Amount in QR]
              - DO NOT confuse summary amounts with product quantities or prices
              - SUBTOTAL = Sum of all item totals (before tax)
              - TAX/VAT = Tax amount (often 0% in Qatar, so might be 0.00)
              - TOTAL/GRAND TOTAL = Final amount (Subtotal + Tax)
              - Read each summary line independently:
                Example: "SUB TOTAL    365.04" → subtotal: 365.04
                Example: "VAT (0%)     0.00" → tax: 0.00  
                Example: "TOTAL        365.04" → total: 365.04
              - Verify: SUBTOTAL + TAX should equal TOTAL (within rounding tolerance)
              - If summary section has multiple currency amounts, use the QR (Qatari Riyal) values
              
              CRITICAL TABLE READING INSTRUCTIONS:
              
              STEP 1: IDENTIFY THE TABLE STRUCTURE FIRST
              - Locate the table header row showing column names
              - Look for COLORED HEADERS (may be blue, green, gray background with white text)
              - Identify the GRID STRUCTURE - see where vertical lines separate columns
              - Use vertical lines as GUIDES to understand column boundaries
              - DO NOT extract the vertical lines themselves as data
              - Identify which column is "Product Name" or "Description"
              - Identify which column is "Quantity" (or "Qty", "Q", "QTY CRT/PCS")
              - Identify which column is "Unit Price" (or "U.Price", "Price", "Rate", "UP")
              - Identify which column is "CRT Price" and/or "PCS Price" (if separate price columns exist)
              - Identify which column is "Total" (or "Amount", "Line Total", "Amt")
              - Identify which column is "SKU" or "Code" (if present)
              - Identify which column is "Barcode" (if present)
              - IGNORE any "UOM" columns (Unit of Measure) - do not extract from them
              - Note: Product table ends when you see summary labels like "SUB TOTAL", "TOTAL", "TAX"
              
              ⚠️ CRITICAL: DISTINGUISHING TABLE STRUCTURE FROM DATA:
              - Vertical lines (|, │, ║) = Column separators = NOT DATA
              - Horizontal lines (─, —, ═) = Row separators = NOT DATA
              - Cell borders and grid lines = Formatting only = IGNORE THEM
              - Read CONTENT inside cells, NOT the cell borders
              - If you see a perfectly straight vertical line spanning multiple rows → It's a table border, NOT "1"
              
              STEP 2: FOR EACH PRODUCT ROW, READ VALUES FROM THE CORRECT COLUMNS
              - Read ONLY product rows (skip summary rows with labels like "SUB TOTAL", "TOTAL", "GRAND TOTAL")
              - For each product row, read cell-by-cell, column-by-column from LEFT to RIGHT
              - Use column boundaries (vertical lines) as GUIDES to stay in the correct column
              - Read the TEXT/NUMBERS inside each cell, not the cell borders
              - Stay within column boundaries - don't jump to adjacent columns
              - Read Product Name from the name/description column
              - Read Quantity from the Quantity column (do NOT confuse with unit price or total!)
              - IMPORTANT: Quantity values are typically small numbers (1, 2, 9, 12, 24, 48, etc.)
              - IMPORTANT: Do NOT confuse subtotal amounts (like 365.04) with quantity values
              - If you see a large decimal number, it's probably a price, not a quantity!
              - IMPORTANT: If the table has blue/colored background, focus on reading the text INSIDE the colored cells
              
              ⚠️⚠️⚠️ CRITICAL: QUANTITY EXTRACTION RULES ⚠️⚠️⚠️
              - QUANTITY column contains NUMBERS: 1, 2, 3, 9, 12, 24, 48, etc. OR "X/Y" format
              - For simple format: Extract number directly from QTY column
              - For "X/Y" format: Parse crtQty and pcsQty, calculate quantity based on price check
              - DO NOT extract from UOM columns (labeled "UOM", "Unit", "NOS", "PCS", "CRT")
              - Example CORRECT extraction:
                * QTY column shows: 9 → quantity: 9
                * QTY column shows: "2/24" → crtQty: 2, pcsQty: 24, quantity: (determined by price)
              
              COLUMN READING RULES:
              - Look at column HEADERS to identify which is which
              - QTY/Quantity column = Contains numbers or "X/Y" format
              - IGNORE any UOM/Unit columns - do not extract them
              
              CRITICAL: READING UNIT PRICE CORRECTLY
              - Locate the Unit Price column header (can be: "Unit Price", "U.Price", "U Price", "U/Price", "Price", "Rate", "UP", "Base Price", "U.P.", "Unit Rate")
              - For each item row, read the value DIRECTLY under the Unit Price header
              - Unit Price is the price PER SINGLE UNIT/PIECE of the product
              - Use careful OCR: Pay attention to decimal points and digit clarity
              - Verification check: Calculate Quantity × Unit Price - does it equal Total Price?
              - If verification fails, you likely misread the Unit Price column - re-read it carefully
              - Examples of correct reading:
                * If Total=22.41, Qty=1, then Unit Price should be around 22.41
                * If Total=128.25, Qty=9, then Unit Price should be around 14.25 (128.25÷9)
                * If Total=365.04, Qty=48, then Unit Price should be around 7.60 (365.04÷48)
                * If Total=8.55, Qty=3 (from "0/3"), then Unit Price should be 2.85 (8.55÷3)
              - Common OCR errors to avoid in Unit Price:
                * Misreading 22.41 as 2.241 or 224.1
                * Misreading 14.25 as 1.425 or 142.5
                * Misreading 2.85 as 28.5 or 0.285
                * Reading digits from wrong column (Total instead of Unit Price)
                * Confusing 0 with O, 5 with S, 8 with B, 1 with I
              
              CRITICAL: QTY COLUMN FORMAT DETECTION
              - Look for QTY column (may be labeled "QTY", "Quantity", "QTY CRT/PCS")
              - QTY column format can be:
                * Simple numbers: 1, 2, 9, 12, 24 → extract directly as quantity
                * CRT/PCS format: "X/Y" like "0/3", "2/24" → parse to get crtQty and pcsQty
              - DO NOT extract from UOM columns (labeled "UOM", "Unit", "U/M", "NOS")
              - IGNORE any UOM column values completely
              
              CRITICAL: HANDLING "QTY CRT/PCS" FORMAT
              - If QTY column shows "X/Y" format (e.g., "2/24", "0/3"):
                * This shows cartons (X) and pieces per carton (Y)
                * Parse: crtQty = X, pcsQty = Y
                * Determine quantity based on which price matches Total (see decision tree)
                * Example: "0/3" with PCS Price 2.85, Total 8.55 → quantity = 3
                * Example: "2/24" with CRT Price 182.40, Total 364.80 → quantity = 2
              
              CRITICAL: SEPARATE CRT AND PCS COLUMNS
              - If you see BOTH a "CRT" column AND a "PCS" column (two separate columns):
                * Read CRT value → store as crtQty
                * Read PCS value → store as pcsQty
                * Calculate quantity = crtQty × pcsQty (if both > 0)
                * If only CRT has value: quantity = crtQty
                * If only PCS has value: quantity = pcsQty
              
              STANDARD QTY COLUMN (when separate from CRT/PCS):
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
              - CRITICAL UNIT PRICE VALIDATION:
                * After reading Unit Price, verify: Quantity × Unit Price ≈ Total Price (within ±5% for rounding)
                * If verification fails, RE-READ the Unit Price column more carefully
                * Pay extra attention to decimal point placement
                * Ensure you're reading from the correct column (not Total or another column)
                * Use the column header as a guide to stay in the right column
              - Read Total Price ONLY from the Total column (usually rightmost numeric column)
              - Read SKU from SKU/Code column if present
              - Read Barcode from Barcode column if present
              - Read UOM from UOM column if present (CRT, PCS, CS, BOX, EA, etc.)
              - Each item row is independent - read each cell carefully
              - STOP reading product rows when you encounter summary labels
              
              STEP 3: READ THE FINANCIAL SUMMARY SECTION (AFTER PRODUCT TABLE)
              - After the last product row, look for the summary section at the bottom
              - This section contains financial totals, NOT product data
              - Read row-by-row in the summary section:
                * Find "SUB TOTAL" or "SUBTOTAL" row → extract the amount as subtotal
                * Find "VAT" or "TAX" row → extract the amount as tax
                * Find "TOTAL" or "GRAND TOTAL" row → extract the amount as total
              - Summary amounts are typically LARGER than individual item prices
              - Read carefully to avoid mixing up summary with product table values
              - Common summary row formats:
                * "SUB TOTAL          365.04" → subtotal: 365.04
                * "VAT (0%)           0.00" → tax: 0.00
                * "TOTAL              365.04" → total: 365.04
              - DO NOT use values from the QTY column as subtotal
              - DO NOT use values from product Total column as invoice subtotal
              - The subtotal is the SUM of all product line totals
              
              STEP 4: VALIDATE MATH FOR EACH ITEM (MOST IMPORTANT STEP)
              - After extracting all three values for each item, perform this validation:
              - Calculate: expected_total = quantity × unitPrice
              - Compare: Is expected_total ≈ totalPrice? (allow ±2% difference for rounding)
              - If YES: ✓ You successfully read the columns correctly!
              - If NO: ✗ ERROR - You mixed up the columns! 
                * STOP and re-examine the row
                * Check which value came from which column
                * Most likely error: You read Unit Price from the wrong column
                * Look at the column headers again and trace down to the value
                * Re-read Unit Price from the correct "U.Price" column
                * Common fix: Unit Price should be SMALLER than Total Price (unless qty=1)
              - MANDATORY: Perform this validation for EVERY item before moving to next item
              - If math doesn't work out for multiple items, the column identification is wrong - start over
              
              STEP 5: FINAL FINANCIAL VALIDATION
              - After processing all items and summary section:
              - Verify: Sum of all item.totalPrice values should equal subtotal
              - Verify: subtotal + tax should equal total (within ±1 QR tolerance for rounding)
              - If financial validation fails, re-check the summary section reading
              
              READING STRATEGY FOR HIGH ACCURACY:
              1. Process invoice in THREE PASSES:
                 Pass 1: Identify table structure (headers and columns)
                 Pass 2: Extract product rows one-by-one (stop at summary section)
                 Pass 3: Extract financial summary (subtotal, tax, total)
              2. For each row, read LEFT to RIGHT, staying within column boundaries
              3. Validate math after EVERY item extraction
              4. Keep product table separate from summary section
              5. Use visual alignment cues (vertical lines between columns)
              
              COMMON ERRORS TO AVOID:
              ❌ DO NOT use totalPrice as unitPrice (they are different columns!)
              ❌ DO NOT use unitPrice as quantity (they are different columns!)
              ❌ DO NOT assume all items have quantity=1 (read the actual Qty column!)
              ❌ DO NOT mix up values between different items
              ❌ DO NOT confuse the Total column with the Unit Price column
              ❌ DO NOT misread decimal points in Unit Price (22.41 ≠ 2.241 ≠ 224.1)
              ❌ DO NOT skip the math validation step - ALWAYS verify Quantity × Unit Price = Total
              ❌ DO NOT confuse product line totals with invoice subtotal
              ❌ DO NOT read subtotal from the QTY column (quantity values are small, subtotals are large)
              ❌ DO NOT include summary rows (SUB TOTAL, TOTAL) in the items array
              ❌ DO NOT use crtQty when pcsQty was actually used (check which price matches Total!)
              ❌ DO NOT ignore CRT Price and PCS Price columns - they determine quantity calculation
              ❌ If SKU is the same for multiple items (e.g., 20000003), that's OK - products can share SKUs
              ✓ Each row is independent - read QTY CRT/PCS, all price columns, and Total
              ✓ Use Total column to determine which price and quantity calculation is correct
              ✓ Verify math for EVERY item: calculated_quantity × selected_price ≈ totalPrice (±2% tolerance)
              ✓ Verify math for EVERY item: quantity × unitPrice ≈ totalPrice (±2% tolerance)
              ✓ If math fails, re-read the Unit Price column - you likely misread it
              ✓ Pay extreme attention to decimal point placement in Unit Price column
              ✓ Use column headers as guides to stay in the correct column
              ✓ Read subtotal from the summary section, NOT from the product table
              ✓ Process invoice in sections: table structure → products → financial summary
              
              ADDITIONAL REQUIREMENTS:
              - Extract ALL product rows (skip only summary rows like "SUB TOTAL", "TOTAL")
              - Handle both printed and handwritten numbers
              - Parse dates and convert to YYYY-MM-DD format
              - For grand totals: use values from the summary section at bottom
              - Round all numbers to 2 decimal places
              
              IMPORTANT FIELD EXTRACTION:
              - productName: from Product/Description column (required)
              - quantity: calculated based on which price is used (see decision tree above)
              - crtQty: first number in "X/Y" format from QTY CRT/PCS column (e.g., 2 from "2/24"), or null if simple QTY
              - pcsQty: second number in "X/Y" format from QTY CRT/PCS column (e.g., 24 from "2/24"), or null if simple QTY
              - unitPrice: price per unit from Price column (required)
              - totalPrice: from Total column - should equal quantity × unitPrice (required)
              - sku: from SKU/Code column - extract exactly as shown
              - barcode: from Barcode column - extract exactly as shown
              
              ⚠️⚠️⚠️ CRITICAL: DO NOT EXTRACT UOM (Unit of Measure) ⚠️⚠️⚠️
              - IGNORE any column labeled "UOM", "Unit", "U/M", "NOS", "PCS", "CRT"
              - DO NOT include "uom" field in the JSON output
              - Use ONLY the "QTY" column for quantity information
              - The QTY column values can be simple numbers OR "X/Y" format
              
              EXAMPLES OF CORRECT EXTRACTION:
              
              Example 1 - Simple QTY format (bakery receipt):
              Header: Product | QTY | Unit Price | Total
              Row: "SAMOONA 6x360 gm" | 1 | 3.25 | 3.25
              Analysis: QTY column shows simple number "1"
              Extract: {productName:"SAMOONA 6x360 gm", quantity:1, crtQty:null, pcsQty:null, unitPrice:3.25, totalPrice:3.25}
              Verify: 1 × 3.25 = 3.25 ✓ CORRECT
              
              Example 2 - Simple QTY format with quantity > 1:
              Header: Product | QTY | Unit Price | Total
              Row: "CREAM BUN 1x75 gm" | 2 | 0.90 | 1.80
              Analysis: QTY column shows simple number "2"
              Extract: {productName:"CREAM BUN 1x75 gm", quantity:2, crtQty:null, pcsQty:null, unitPrice:0.90, totalPrice:1.80}
              Verify: 2 × 0.90 = 1.80 ✓ CORRECT
              
              Example 3 - CRT/PCS format inside QTY column (pieces only):
              Header: Product | QTY | CRT Price | PCS Price | Total
              Row: "YOGURT" | 0/3 | 68.40 | 2.85 | 8.55
              Analysis: QTY column shows "0/3" = 0 cartons, 3 pieces
                - Check CRT: 0 × 68.40 = 0 ✗ (doesn't match 8.55)
                - Check PCS: 3 × 2.85 = 8.55 ✓ (matches!)
              Extract: {productName:"YOGURT", quantity:3, crtQty:0, pcsQty:3, unitPrice:2.85, totalPrice:8.55}
              Verify: 3 × 2.85 = 8.55 ✓ CORRECT
              
              Example 4 - CRT/PCS format inside QTY column (cartons only):
              Header: Product | QTY | CRT Price | PCS Price | Total
              Row: "WATER CASE" | 2/24 | 182.40 | 7.60 | 364.80
              Analysis: QTY column shows "2/24" = 2 cartons of 24 pieces each
                - Check CRT: 2 × 182.40 = 364.80 ✓ (matches!)
                - Check PCS: 48 × 7.60 = 364.80 ✓ (also matches, but CRT qty matches directly)
              Extract: {productName:"WATER CASE", quantity:2, crtQty:2, pcsQty:24, unitPrice:182.40, totalPrice:364.80}
              Verify: 2 × 182.40 = 364.80 ✓ CORRECT (used CRT Price)
              
              Example 5 - CRT/PCS format inside QTY column with single Price:
              Header: Product | QTY | Unit Price | Total
              Row: "CHIPS BOX" | 2/24 | 7.60 | 364.80
              Analysis: QTY column shows "2/24" = 2 cartons of 24 pieces each = 48 total pieces
                - Check CRT: 2 × 7.60 = 15.20 ✗ (doesn't match 364.80)
                - Check Total PCS: 48 × 7.60 = 364.80 ✓ (matches!)
              Extract: {productName:"CHIPS BOX", quantity:48, crtQty:2, pcsQty:24, unitPrice:7.60, totalPrice:364.80}
              Verify: 48 × 7.60 = 364.80 ✓ CORRECT (Price is per piece, so use total pieces)
              
              Example 6 - CRT/PCS format with columns in different order:
              Header: Product | Total | PCS Price | QTY | CRT Price
              Row: "JUICE" | 8.55 | 2.85 | 0/3 | 68.40
              Analysis: Columns are in different order! Read by header names, not position
                - QTY column value: "0/3" = 0 cartons, 3 pieces
                - CRT Price: 68.40, PCS Price: 2.85, Total: 8.55
                - Check: 3 × 2.85 = 8.55 ✓ (PCS Price matches)
              Extract: {productName:"JUICE", quantity:3, crtQty:0, pcsQty:3, unitPrice:2.85, totalPrice:8.55}
              Verify: 3 × 2.85 = 8.55 ✓ CORRECT
              
              Example 7 - CRT/PCS format with CRT Price:
              Header: Product | QTY | CRT Price | PCS Price | Total
              Row: "MILK BOX" | 1/0 | 182.40 | 7.60 | 182.40
              Analysis: QTY column shows "1/0" = 1 carton, 0 pieces
                - Check CRT: 1 × 182.40 = 182.40 ✓ (matches!)
              Extract: {productName:"MILK BOX", quantity:1, crtQty:1, pcsQty:0, unitPrice:182.40, totalPrice:182.40}
              Verify: 1 × 182.40 = 182.40 ✓ CORRECT (used CRT Price because only cartons ordered)
              
              WRONG Example (Common Mistake):
              Header: Product | QTY | PCS Price | Total
              Row: "YOGURT" | 0/3 | 2.85 | 8.55
              ❌ WRONG Extraction: {quantity:0, unitPrice:68.40, totalPrice:8.55}
              Why wrong? Used crtQty (0) instead of pcsQty (3), and wrong price
              ✓ CORRECT: {quantity:3, crtQty:0, pcsQty:3, unitPrice:2.85, totalPrice:8.55}
              
              KEY TAKEAWAY: The QTY column is ONE column that can contain EITHER:
              - Simple numbers (1, 2, 9, 12) for simple quantity
              - "X/Y" format (0/3, 2/24, 1/0) for carton/piece breakdown
              Both are just different VALUE formats in the same QTY column
              
              If a column shows "-" or is empty, use null for that field
              
              FINAL ACCURACY CHECK BEFORE RETURNING JSON:
              ✓ Did I extract REAL data from the IMAGE (not example data)?
              ✓ Did I verify supplier name matches what's printed at the top?
              ✓ Did I verify invoice number matches exactly?
              ✓ Did I extract the correct date format?
              ✓ Did I read all product names EXACTLY as written?
              ✓ Did I verify quantities are reasonable (usually small numbers)?
              ✓ Did I verify unit prices by checking: qty × unit price = total?
              ✓ Did I extract subtotal from summary section (not from table)?
              ✓ Did I verify: sum of item totals ≈ subtotal?
              ✓ Did I set appropriate confidence level based on image clarity?
              
              If you answered NO to any question above, RE-EXAMINE the image before responding.`
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
      max_tokens: 4096,
      temperature: 0.05,
      top_p: 0.95
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    // Detect if AI returned fake/example data
    const suspiciousPatterns = {
      fakeProductNames: ['Product 1', 'Product 2', 'Product 3', 'Item 1', 'Item 2', 'Sample Product'],
      fakeSuppliers: ['Supplier Name', 'ABC Company', 'Example Corp', 'Sample Supplier'],
      roundPrices: true // Will check if all prices are round numbers like 10.00, 20.00, etc.
    };
    
    // Check for suspicious patterns
    let hasSuspiciousData = false;
    const suspiciousReasons: string[] = [];
    
    if (result.items && result.items.length > 0) {
      // Check for fake product names
      const fakeProducts = result.items.filter((item: any) => 
        suspiciousPatterns.fakeProductNames.some(fake => 
          item.productName?.toLowerCase().includes(fake.toLowerCase())
        )
      );
      if (fakeProducts.length > 0) {
        hasSuspiciousData = true;
        suspiciousReasons.push(`Found ${fakeProducts.length} fake product names`);
      }
      
      // Check if all prices are round numbers (e.g., 10.00, 20.00, 5.00)
      const allRoundPrices = result.items.every((item: any) => {
        const price = Number(item.unitPrice) || 0;
        return price > 0 && price % 1 === 0; // Check if it's a whole number
      });
      if (allRoundPrices && result.items.length >= 2) {
        hasSuspiciousData = true;
        suspiciousReasons.push('All unit prices are suspiciously round numbers');
      }
      
      // Check for sequential identical prices (10, 20, 30 or 5, 10, 15)
      const prices = result.items.map((item: any) => Number(item.unitPrice) || 0);
      if (prices.length >= 3) {
        const differences: number[] = [];
        for (let i = 1; i < prices.length; i++) {
          differences.push(prices[i] - prices[i - 1]);
        }
        const allSameDiff = differences.every(diff => diff === differences[0]);
        if (allSameDiff && differences[0] !== 0) {
          hasSuspiciousData = true;
          suspiciousReasons.push('Prices follow suspicious sequential pattern');
        }
      }
    }
    
    // Check for fake supplier name
    if (suspiciousPatterns.fakeSuppliers.some(fake => 
      result.supplierName?.toLowerCase().includes(fake.toLowerCase())
    )) {
      hasSuspiciousData = true;
      suspiciousReasons.push('Supplier name appears to be placeholder text');
    }
    
    if (hasSuspiciousData) {
      console.log("\n⚠️⚠️⚠️ WARNING: SUSPICIOUS DATA DETECTED ⚠️⚠️⚠️");
      console.log("The AI may have generated example/fake data instead of reading the actual image!");
      console.log("Reasons:");
      suspiciousReasons.forEach(reason => console.log(`   - ${reason}`));
      console.log("⚠️ Please verify the extracted data matches the actual invoice image");
      console.log("=".repeat(80));
    }
    
    console.log("\n" + "=".repeat(80));
    console.log("🤖 AI INVOICE SCANNING RESULTS");
    console.log("=".repeat(80));
    console.log("\n📄 INVOICE HEADER:");
    console.log(`   Invoice Number: ${result.invoiceNumber || 'N/A'}`);
    console.log(`   Supplier Name:  ${result.supplierName || 'N/A'}`);
    console.log(`   Invoice Date:   ${result.invoiceDate || 'N/A'}`);
    console.log(`   Subtotal:       QR ${result.subtotal || 0}`);
    console.log(`   Tax:            QR ${result.tax || 0}`);
    console.log(`   Total:          QR ${result.total || 0}`);
    console.log(`   AI Confidence:  ${Math.round((result.confidence || 0) * 100)}%`);
    
    console.log("\n📦 EXTRACTED ITEMS: (" + (result.items?.length || 0) + " items)");
    console.log("-".repeat(80));
    
    if (result.items && result.items.length > 0) {
      result.items.forEach((item: any, index: number) => {
        console.log(`\n   Item ${index + 1}: ${item.productName || 'Unknown'}`);
        
        // Detect if UOM was wrongly extracted as quantity
        const qtyValue = item.quantity;
        const uomValue = item.uom;
        let dataSwapWarning = false;
        
        // Check if quantity is text (should be number)
        if (typeof qtyValue === 'string' && /^[A-Z]+$/i.test(qtyValue)) {
          console.log(`      ⚠️  WARNING: Quantity appears to be text "${qtyValue}" - AI may have extracted UOM as quantity!`);
          dataSwapWarning = true;
        }
        
        // Check if uom is a number (should be text)
        if (typeof uomValue === 'number' || (typeof uomValue === 'string' && /^\d+$/.test(uomValue) && parseInt(uomValue) > 0 && parseInt(uomValue) < 100)) {
          console.log(`      ⚠️  WARNING: UOM appears to be numeric "${uomValue}" - AI may have extracted quantity as UOM!`);
          dataSwapWarning = true;
        }
        
        console.log(`      Quantity:    ${item.quantity || 0}${item.uom ? ' ' + item.uom : ''}`);
        if (dataSwapWarning) {
          console.log(`      ⚠️  Data validation issue detected - please verify QTY and UOM columns are read correctly!`);
        }        if (item.crtQty && item.pcsQty) {
          console.log(`      CRT/PCS:     ${item.crtQty}/${item.pcsQty} (packing info)`);
        }
        console.log(`      Unit Price:  QR ${item.unitPrice || 0}`);
        console.log(`      Total Price: QR ${item.totalPrice || 0}`);
        if (item.sku) {
          console.log(`      SKU:         ${item.sku}`);
        }
        if (item.barcode) {
          console.log(`      Barcode:     ${item.barcode}`);
        }
        
        // Show math validation
        const expectedTotal = (item.quantity || 0) * (item.unitPrice || 0);
        const actualTotal = item.totalPrice || 0;
        const difference = Math.abs(expectedTotal - actualTotal);
        const accuracy = actualTotal > 0 ? Math.min(100, ((1 - difference / actualTotal) * 100)) : 0;
        
        console.log(`      Validation:  ${item.quantity} × ${item.unitPrice} = ${expectedTotal.toFixed(2)}`);
        if (difference < 0.10) {
          console.log(`      ✅ ACCURATE (${accuracy.toFixed(1)}% match)`);
        } else if (difference < 1.00) {
          console.log(`      ⚠️  CLOSE (${accuracy.toFixed(1)}% match, diff: QR ${difference.toFixed(2)})`);
        } else {
          console.log(`      ❌ MISMATCH (${accuracy.toFixed(1)}% match, diff: QR ${difference.toFixed(2)})`);
        }
      });
    } else {
      console.log("   No items extracted");
    }
    
    console.log("\n" + "=".repeat(80));
    
    // Validate and correct items with math validation
    console.log("\n🔍 VALIDATING & CORRECTING EXTRACTED DATA:");
    console.log("-".repeat(80));
    
    const validatedItems = (result.items || []).map((item: any, index: number) => {
      // Quantity is calculated from QTY CRT/PCS format
      let quantity: number;
      let crtQty: number | null = item.crtQty || null;
      let pcsQty: number | null = item.pcsQty || null;
      
      // Use the quantity already calculated by AI (based on which price was used)
      quantity = Number(item.quantity) || 0;
      
      // Validate quantity
      if (!isFinite(quantity) || quantity <= 0) {
        console.warn(`⚠️ Item ${index + 1}: Invalid quantity detected, defaulting to 1`);
        quantity = 1;
      }
      
      // CRT/PCS values show the breakdown
      if (crtQty !== null && pcsQty !== null) {
        console.log(`📦 Item ${index + 1}: CRT/PCS info: ${crtQty}/${pcsQty} → calculated quantity=${quantity})`);
      }
      
      const totalPrice = Number(item.totalPrice) || 0;
      let unitPrice = Number(item.unitPrice) || 0;
      
      console.log(`\n   📝 Item ${index + 1}: ${item.productName}`);
      console.log(`      Raw Data: Qty=${quantity}${crtQty !== null && pcsQty !== null ? ` (CRT/PCS: ${crtQty}/${pcsQty})` : ''}, Unit=QR ${unitPrice}, Total=QR ${totalPrice}`);
      
      // CRITICAL: Validate math - if unit price × quantity doesn't match total, recalculate
      const calculatedTotal = unitPrice * quantity;
      const difference = Math.abs(calculatedTotal - totalPrice);
      const tolerance = 0.10; // 10 cent tolerance for rounding
      const accuracyPercent = totalPrice > 0 ? ((1 - Math.min(difference / totalPrice, 1)) * 100) : 0;
      
      console.log(`      Math Check: ${quantity} × QR ${unitPrice} = QR ${calculatedTotal.toFixed(2)} vs Total QR ${totalPrice}`);
      
      // Check for common extraction errors
      if (difference > tolerance && totalPrice > 0 && quantity > 0) {
        console.log(`      ⚠️  Mismatch detected! Difference: QR ${difference.toFixed(2)} (${accuracyPercent.toFixed(1)}% accuracy)`);
        
        // Math doesn't match - check if values were swapped
        
        // Pattern 1: Check if unitPrice and totalPrice were swapped
        if (Math.abs(quantity * totalPrice - unitPrice) < tolerance) {
          console.log(`      🔧 AUTO-FIX: Unit Price and Total Price were swapped!`);
          const temp = unitPrice;
          unitPrice = totalPrice;
          // Don't swap totalPrice - recalculate it
          const correctedTotal = quantity * unitPrice;
          console.log(`      ✅ Corrected: Qty=${quantity}, Unit Price=QR ${unitPrice}, Total=QR ${correctedTotal.toFixed(2)}`);
          return {
            productName: item.productName || "Unknown Product",
            quantity: quantity,
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
            console.log(`      🔧 AUTO-FIX: Recalculating Unit Price from Total`);
            console.log(`      ✅ Corrected: Qty=${quantity}, Unit Price=QR ${correctedUnitPrice.toFixed(2)}, Total=QR ${totalPrice}`);
            unitPrice = parseFloat(correctedUnitPrice.toFixed(2));
          }
        } else {
          // Math doesn't match - recalculate unit price from total
          const correctedUnitPrice = totalPrice / quantity;
          console.log(`      🔧 AUTO-FIX: Recalculating Unit Price from Total ÷ Quantity`);
          console.log(`      ✅ Corrected: Qty=${quantity}, Unit Price=QR ${correctedUnitPrice.toFixed(2)}, Total=QR ${totalPrice}`);
          unitPrice = parseFloat(correctedUnitPrice.toFixed(2));
        }
      } else if (unitPrice === 0 && totalPrice > 0 && quantity > 0) {
        // Unit price is zero but we have total and quantity - calculate it
        unitPrice = parseFloat((totalPrice / quantity).toFixed(2));
        console.log(`      🔧 AUTO-FIX: Calculated Unit Price = Total ÷ Quantity`);
        console.log(`      ✅ Result: QR ${unitPrice} = QR ${totalPrice} ÷ ${quantity}`);
      } else if (totalPrice === 0 && unitPrice > 0 && quantity > 0) {
        // Total price is zero but we have unit price and quantity - calculate it
        const calculatedTotal = unitPrice * quantity;
        console.log(`      🔧 AUTO-FIX: Calculated Total Price = Quantity × Unit Price`);
        console.log(`      ✅ Result: QR ${calculatedTotal.toFixed(2)} = ${quantity} × QR ${unitPrice}`);
        return {
          productName: item.productName || "Unknown Product",
          quantity: quantity,
          crtQty: crtQty,
          pcsQty: pcsQty,
          unitPrice: parseFloat(unitPrice.toFixed(2)),
          totalPrice: parseFloat(calculatedTotal.toFixed(2)),
          sku: item.sku || null,
          barcode: item.barcode || null
        };
      } else {
        console.log(`      ✅ ACCURATE: Math validated (${accuracyPercent.toFixed(1)}% accuracy)`);
      }
      
      // Final validation: ensure total = quantity × unitPrice
      const finalTotal = parseFloat((quantity * unitPrice).toFixed(2));
      const finalDiff = Math.abs(finalTotal - totalPrice);
      if (finalDiff > tolerance) {
        // Use calculated total if it's more accurate
        console.log(`      🔧 FINAL FIX: Using calculated total QR ${finalTotal} (was QR ${totalPrice}, diff: QR ${finalDiff.toFixed(2)})`);
        return {
          productName: item.productName || "Unknown Product",
          quantity: quantity,
          crtQty: crtQty,
          pcsQty: pcsQty,
          unitPrice: parseFloat(unitPrice.toFixed(2)),
          totalPrice: finalTotal,
          sku: item.sku || null,
          barcode: item.barcode || null
        };
      }
      
      // Ensure unit price is always formatted to 2 decimal places
      const formattedUnitPrice = parseFloat(unitPrice.toFixed(2));
      const formattedTotalPrice = parseFloat(totalPrice.toFixed(2));
      
      return {
        productName: item.productName || "Unknown Product",
        quantity: quantity,
        crtQty: crtQty,
        pcsQty: pcsQty,
        unitPrice: formattedUnitPrice,
        totalPrice: formattedTotalPrice,
        sku: item.sku || null,
        barcode: item.barcode || null
      };
    });
    
    console.log("\n" + "=".repeat(80));
    console.log("📊 VALIDATION SUMMARY:");
    console.log("-".repeat(80));
    
    // Calculate overall accuracy
    let totalItemsCount = validatedItems.length;
    let accurateItems = 0;
    let correctedItems = 0;
    let totalAccuracySum = 0;
    
    validatedItems.forEach((item: any) => {
      const calculatedTotal = item.quantity * item.unitPrice;
      const actualTotal = item.totalPrice;
      const diff = Math.abs(calculatedTotal - actualTotal);
      const accuracy = actualTotal > 0 ? ((1 - Math.min(diff / actualTotal, 1)) * 100) : 100;
      
      totalAccuracySum += accuracy;
      
      if (diff < 0.10) {
        accurateItems++;
      } else {
        correctedItems++;
      }
    });
    
    const overallAccuracy = totalItemsCount > 0 ? (totalAccuracySum / totalItemsCount) : 0;
    
    console.log(`   Total Items Extracted:  ${totalItemsCount}`);
    console.log(`   ✅ Accurate Items:      ${accurateItems} (${totalItemsCount > 0 ? ((accurateItems/totalItemsCount)*100).toFixed(1) : 0}%)`);
    if (correctedItems > 0) {
      console.log(`   🔧 Auto-corrected:      ${correctedItems} (${totalItemsCount > 0 ? ((correctedItems/totalItemsCount)*100).toFixed(1) : 0}%)`);
    }
    console.log(`   📈 Overall Accuracy:    ${overallAccuracy.toFixed(1)}%`);
    console.log(`   🤖 AI Confidence:       ${Math.round((result.confidence || 0) * 100)}%`);
    console.log("=".repeat(80) + "\n");
    
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
    
    // Validate and structure the response
    const finalResult = {
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
    
    console.log("\n✅ FINAL INVOICE DATA READY FOR PROCESSING\n");
    
    return finalResult;
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