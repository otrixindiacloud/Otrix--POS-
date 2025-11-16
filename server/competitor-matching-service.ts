/**
 * Competitor Product Matching Service
 * 
 * Uses AI to intelligently match competitor products with our catalog
 * based on names, barcodes, SKUs, descriptions, and images
 */

import OpenAI from "openai";
import type { Product } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface CompetitorProduct {
  name: string;
  sku?: string;
  barcode?: string;
  price: number;
  originalPrice?: number;
  url?: string;
  imageUrl?: string;
  description?: string;
  availability?: string;
}

export interface ProductMatch {
  productId: number;
  product: Product;
  confidence: number; // 0-100
  matchReason: string;
  matchedBy: 'exact_barcode' | 'exact_sku' | 'ai_analysis' | 'manual';
}

/**
 * Match a competitor product to our catalog using multiple strategies
 */
export async function matchCompetitorProduct(
  competitorProduct: CompetitorProduct,
  ourCatalog: Product[]
): Promise<ProductMatch | null> {
  
  // Strategy 1: Exact barcode match (highest confidence)
  if (competitorProduct.barcode) {
    const barcodeMatch = ourCatalog.find(
      p => p.barcode && p.barcode.toLowerCase() === competitorProduct.barcode!.toLowerCase()
    );
    
    if (barcodeMatch) {
      return {
        productId: barcodeMatch.id,
        product: barcodeMatch,
        confidence: 100,
        matchReason: 'Exact barcode match',
        matchedBy: 'exact_barcode',
      };
    }
  }

  // Strategy 2: Exact SKU match (high confidence)
  if (competitorProduct.sku) {
    const skuMatch = ourCatalog.find(
      p => p.sku.toLowerCase() === competitorProduct.sku!.toLowerCase()
    );
    
    if (skuMatch) {
      return {
        productId: skuMatch.id,
        product: skuMatch,
        confidence: 95,
        matchReason: 'Exact SKU match',
        matchedBy: 'exact_sku',
      };
    }
  }

  // Strategy 3: AI-powered fuzzy matching
  const aiMatch = await aiMatchProduct(competitorProduct, ourCatalog);
  
  // Slightly lower threshold to reduce false negatives
  if (aiMatch && aiMatch.confidence >= 60) {
    return aiMatch;
  }

  return null;
}

/**
 * Use AI to match products based on names, descriptions, and context
 */
async function aiMatchProduct(
  competitorProduct: CompetitorProduct,
  ourCatalog: Product[]
): Promise<ProductMatch | null> {
  
  try {
    // Create a concise catalog summary for AI
    const catalogSummary = ourCatalog.slice(0, 50).map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      description: p.description,
      category: p.category,
    }));

    const prompt = `You are a product matching expert. Match the competitor's product to our catalog.

COMPETITOR PRODUCT:
- Name: ${competitorProduct.name}
- SKU: ${competitorProduct.sku || 'N/A'}
- Barcode: ${competitorProduct.barcode || 'N/A'}
- Description: ${competitorProduct.description || 'N/A'}
- Price: ${competitorProduct.price}

OUR CATALOG (showing first 50 products):
${JSON.stringify(catalogSummary, null, 2)}

INSTRUCTIONS:
1. Analyze the competitor product details
2. Find the best match from our catalog
3. Consider: name similarity, category, typical pricing, brand, size
4. Return ONLY a JSON response with this structure:
{
  "productId": <number or null>,
  "confidence": <0-100>,
  "matchReason": "<brief explanation>",
  "alternativeMatches": [<array of possible productIds>]
}

If no good match exists (confidence < 70), return productId as null.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a product matching assistant. Return only valid JSON responses.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    if (!result.productId || result.confidence < 70) {
      return null;
    }

    const matchedProduct = ourCatalog.find(p => p.id === result.productId);
    
    if (!matchedProduct) {
      return null;
    }

    return {
      productId: result.productId,
      product: matchedProduct,
      confidence: result.confidence,
      matchReason: result.matchReason || 'AI-based product matching',
      matchedBy: 'ai_analysis',
    };

  } catch (error) {
    console.error('AI product matching failed:', error);
    return null;
  }
}

/**
 * Batch match multiple competitor products
 */
export async function batchMatchProducts(
  competitorProducts: CompetitorProduct[],
  ourCatalog: Product[]
): Promise<Map<string, ProductMatch | null>> {
  
  const matches = new Map<string, ProductMatch | null>();

  for (const compProduct of competitorProducts) {
    const key = `${compProduct.name}_${compProduct.sku || compProduct.barcode || ''}`;
    const match = await matchCompetitorProduct(compProduct, ourCatalog);
    matches.set(key, match);
  }

  return matches;
}

/**
 * Suggest potential product matches for manual review
 */
export async function suggestMatches(
  competitorProduct: CompetitorProduct,
  ourCatalog: Product[],
  limit: number = 5
): Promise<ProductMatch[]> {
  
  const suggestions: ProductMatch[] = [];

  // Try exact matches first
  const exactMatch = await matchCompetitorProduct(competitorProduct, ourCatalog);
  if (exactMatch) {
    suggestions.push(exactMatch);
  }

  // Use AI for fuzzy suggestions
  try {
    const catalogSummary = ourCatalog.map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      category: p.category,
      price: p.price,
    }));

    const prompt = `Find the top ${limit} most likely product matches for this competitor product.

COMPETITOR PRODUCT:
- Name: ${competitorProduct.name}
- SKU: ${competitorProduct.sku || 'N/A'}
- Barcode: ${competitorProduct.barcode || 'N/A'}
- Price: ${competitorProduct.price}

OUR CATALOG:
${JSON.stringify(catalogSummary.slice(0, 100), null, 2)}

Return a JSON array of matches, sorted by confidence (highest first):
[
  {
    "productId": <number>,
    "confidence": <0-100>,
    "matchReason": "<explanation>"
  }
]

Include up to ${limit} matches with confidence >= 50.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a product matching assistant. Return only valid JSON arrays.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    const matches = result.matches || [];

    for (const match of matches.slice(0, limit)) {
      const product = ourCatalog.find(p => p.id === match.productId);
      if (product && match.confidence >= 50) {
        suggestions.push({
          productId: product.id,
          product,
          confidence: match.confidence,
          matchReason: match.matchReason,
          matchedBy: 'ai_analysis',
        });
      }
    }

  } catch (error) {
    console.error('AI suggestion failed:', error);
  }

  return suggestions;
}

/**
 * Extract product information from a competitor website URL using AI
 */
export async function extractProductFromUrl(url: string): Promise<CompetitorProduct | null> {
  
  try {
    // First try scraping the actual product page for accurate data
    try {
      const { scrapeProductPage } = await import("./services/ecommerce-scraper");
      const scraped = await scrapeProductPage(url);
      if (scraped && scraped.name) return scraped;
    } catch (e) {
      console.warn("Single product scraping failed, falling back to AI URL heuristic:", e);
    }

    // Fallback: Use AI heuristic based on the URL when scraping fails
    const prompt = `Extract product information from this URL: ${url}

Analyze the URL structure and make intelligent predictions about:
- Product name
- Possible SKU or product code
- Category hints

Return JSON:
{
  "name": "<predicted product name>",
  "sku": "<possible SKU from URL>",
  "category": "<predicted category>",
  "confidence": <0-100>
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a product information extraction assistant.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    if (result.confidence < 50) {
      return null;
    }

    return {
      name: result.name,
      sku: result.sku,
      price: 0,
      url,
    };

  } catch (error) {
    console.error('URL extraction failed:', error);
    return null;
  }
}

/**
 * Analyze competitor product data quality
 */
export function analyzeDataQuality(competitorProduct: CompetitorProduct): {
  score: number;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  if (!competitorProduct.name) {
    issues.push('Missing product name');
    score -= 30;
  }

  if (!competitorProduct.barcode && !competitorProduct.sku) {
    issues.push('Missing both barcode and SKU');
    suggestions.push('Add barcode or SKU for better matching');
    score -= 20;
  }

  if (!competitorProduct.url) {
    suggestions.push('Add product URL for reference');
    score -= 10;
  }

  if (!competitorProduct.imageUrl) {
    suggestions.push('Add product image for visual verification');
    score -= 10;
  }

  if (!competitorProduct.description) {
    suggestions.push('Add description for better AI matching');
    score -= 10;
  }

  if (competitorProduct.price <= 0) {
    issues.push('Invalid price');
    score -= 20;
  }

  return {
    score: Math.max(0, score),
    issues,
    suggestions,
  };
}
