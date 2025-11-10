import { Router } from "express";
import {
  getAllCompetitors,
  getCompetitorById,
  createCompetitor,
  updateCompetitor,
  deleteCompetitor,
  hardDeleteCompetitor,
  searchCompetitors,
  getCompetitorPrices,
  getProductCompetitorPrices,
  getCompetitorPriceById,
  createCompetitorPrice,
  updateCompetitorPrice,
  deleteCompetitorPrice,
  hardDeleteCompetitorPrice,
  getPriceComparison,
  bulkCreateCompetitorPrices,
  getCompetitorStats,
} from "./storage";
import { insertCompetitorSchema, insertCompetitorPriceSchema } from "@shared/schema";
import {
  matchCompetitorProduct,
  batchMatchProducts,
  suggestMatches,
  extractProductFromUrl,
  analyzeDataQuality,
  type CompetitorProduct,
} from "../../competitor-matching-service";
import {
  scrapeEcommercePortal,
  scrapeProductListingPage,
} from "../../services/ecommerce-scraper";

const router = Router();

// ==================== COMPETITOR ROUTES ====================

/**
 * GET /api/competitors
 * Get all competitors
 */
router.get("/", async (req, res) => {
  try {
    const activeOnly = req.query.activeOnly === "true";
    const competitors = await getAllCompetitors(activeOnly);
    res.json(competitors);
  } catch (error: any) {
    console.error("Error fetching competitors:", error);
    res.status(500).json({ 
      error: "Failed to fetch competitors",
      message: error.message 
    });
  }
});

/**
 * GET /api/competitors/search?q=query
 * Search competitors
 */
router.get("/search", async (req, res) => {
  try {
    const query = req.query.q as string;
    
    if (!query || query.trim() === "") {
      return res.status(400).json({ error: "Search query is required" });
    }

    const competitors = await searchCompetitors(query);
    res.json(competitors);
  } catch (error: any) {
    console.error("Error searching competitors:", error);
    res.status(500).json({ 
      error: "Failed to search competitors",
      message: error.message 
    });
  }
});

/**
 * GET /api/competitors/:id
 * Get competitor by ID
 */
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid competitor ID" });
    }

    const competitor = await getCompetitorById(id);
    
    if (!competitor) {
      return res.status(404).json({ error: "Competitor not found" });
    }

    res.json(competitor);
  } catch (error: any) {
    console.error("Error fetching competitor:", error);
    res.status(500).json({ 
      error: "Failed to fetch competitor",
      message: error.message 
    });
  }
});

/**
 * GET /api/competitors/:id/stats
 * Get competitor statistics
 */
router.get("/:id/stats", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid competitor ID" });
    }

    const stats = await getCompetitorStats(id);
    res.json(stats);
  } catch (error: any) {
    console.error("Error fetching competitor stats:", error);
    res.status(500).json({ 
      error: "Failed to fetch competitor statistics",
      message: error.message 
    });
  }
});

/**
 * POST /api/competitors
 * Create a new competitor
 */
router.post("/", async (req, res) => {
  try {
    const validatedData = insertCompetitorSchema.parse(req.body);
    const newCompetitor = await createCompetitor(validatedData);
    res.status(201).json(newCompetitor);
  } catch (error: any) {
    console.error("Error creating competitor:", error);
    
    if (error.name === "ZodError") {
      return res.status(400).json({ 
        error: "Validation error",
        details: error.errors 
      });
    }
    
    res.status(500).json({ 
      error: "Failed to create competitor",
      message: error.message 
    });
  }
});

/**
 * PUT /api/competitors/:id
 * Update competitor
 */
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid competitor ID" });
    }

    const updated = await updateCompetitor(id, req.body);
    
    if (!updated) {
      return res.status(404).json({ error: "Competitor not found" });
    }

    res.json(updated);
  } catch (error: any) {
    console.error("Error updating competitor:", error);
    res.status(500).json({ 
      error: "Failed to update competitor",
      message: error.message 
    });
  }
});

/**
 * DELETE /api/competitors/:id
 * Soft delete competitor
 */
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const hard = req.query.hard === "true";
    
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid competitor ID" });
    }

    const success = hard 
      ? await hardDeleteCompetitor(id)
      : await deleteCompetitor(id);
    
    if (!success) {
      return res.status(404).json({ error: "Competitor not found" });
    }

    res.json({ 
      success: true,
      message: hard ? "Competitor permanently deleted" : "Competitor deactivated"
    });
  } catch (error: any) {
    console.error("Error deleting competitor:", error);
    res.status(500).json({ 
      error: "Failed to delete competitor",
      message: error.message 
    });
  }
});

// ==================== COMPETITOR PRICE ROUTES ====================

/**
 * GET /api/competitors/:id/prices
 * Get all prices for a competitor
 */
router.get("/:id/prices", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const activeOnly = req.query.activeOnly !== "false";
    
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid competitor ID" });
    }

    const prices = await getCompetitorPrices(id, activeOnly);
    res.json(prices);
  } catch (error: any) {
    console.error("Error fetching competitor prices:", error);
    res.status(500).json({ 
      error: "Failed to fetch competitor prices",
      message: error.message 
    });
  }
});

/**
 * GET /api/competitors/prices/product/:productId
 * Get competitor prices for a specific product
 */
router.get("/prices/product/:productId", async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const activeOnly = req.query.activeOnly !== "false";
    
    if (isNaN(productId)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const prices = await getProductCompetitorPrices(productId, activeOnly);
    res.json(prices);
  } catch (error: any) {
    console.error("Error fetching product competitor prices:", error);
    res.status(500).json({ 
      error: "Failed to fetch product competitor prices",
      message: error.message 
    });
  }
});

/**
 * GET /api/competitors/prices/comparison/:productId
 * Get price comparison for a product
 */
router.get("/prices/comparison/:productId", async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    
    if (isNaN(productId)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const comparison = await getPriceComparison(productId);
    
    if (!comparison) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(comparison);
  } catch (error: any) {
    console.error("Error fetching price comparison:", error);
    res.status(500).json({ 
      error: "Failed to fetch price comparison",
      message: error.message 
    });
  }
});

/**
 * POST /api/competitors/prices
 * Add a new competitor price
 */
router.post("/prices", async (req, res) => {
  try {
    const validatedData = insertCompetitorPriceSchema.parse(req.body);
    const newPrice = await createCompetitorPrice(validatedData);
    res.status(201).json(newPrice);
  } catch (error: any) {
    console.error("Error creating competitor price:", error);
    
    if (error.name === "ZodError") {
      return res.status(400).json({ 
        error: "Validation error",
        details: error.errors 
      });
    }
    
    res.status(500).json({ 
      error: "Failed to create competitor price",
      message: error.message 
    });
  }
});

/**
 * POST /api/competitors/prices/bulk
 * Bulk import competitor prices
 */
router.post("/prices/bulk", async (req, res) => {
  try {
    const { prices } = req.body;
    
    if (!Array.isArray(prices)) {
      return res.status(400).json({ error: "prices must be an array" });
    }

    // Validate all prices
    const validatedPrices = prices.map(price => 
      insertCompetitorPriceSchema.parse(price)
    );

    const newPrices = await bulkCreateCompetitorPrices(validatedPrices);
    
    res.status(201).json({
      success: true,
      count: newPrices.length,
      prices: newPrices,
    });
  } catch (error: any) {
    console.error("Error bulk creating competitor prices:", error);
    
    if (error.name === "ZodError") {
      return res.status(400).json({ 
        error: "Validation error",
        details: error.errors 
      });
    }
    
    res.status(500).json({ 
      error: "Failed to bulk create competitor prices",
      message: error.message 
    });
  }
});

/**
 * PUT /api/competitors/prices/:id
 * Update competitor price
 */
router.put("/prices/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid price ID" });
    }

    const updated = await updateCompetitorPrice(id, req.body);
    
    if (!updated) {
      return res.status(404).json({ error: "Competitor price not found" });
    }

    res.json(updated);
  } catch (error: any) {
    console.error("Error updating competitor price:", error);
    res.status(500).json({ 
      error: "Failed to update competitor price",
      message: error.message 
    });
  }
});

/**
 * DELETE /api/competitors/prices/:id
 * Delete competitor price
 */
router.delete("/prices/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const hard = req.query.hard === "true";
    
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid price ID" });
    }

    const success = hard
      ? await hardDeleteCompetitorPrice(id)
      : await deleteCompetitorPrice(id);
    
    if (!success) {
      return res.status(404).json({ error: "Competitor price not found" });
    }

    res.json({ 
      success: true,
      message: hard ? "Price permanently deleted" : "Price deactivated"
    });
  } catch (error: any) {
    console.error("Error deleting competitor price:", error);
    res.status(500).json({ 
      error: "Failed to delete competitor price",
      message: error.message 
    });
  }
});

// ==================== AI MATCHING ROUTES ====================

/**
 * POST /api/competitors/match-product
 * Match a competitor product to our catalog using AI
 */
router.post("/match-product", async (req, res) => {
  try {
    const { competitorProduct } = req.body;

    if (!competitorProduct || !competitorProduct.name) {
      return res.status(400).json({ error: "Competitor product data required" });
    }

    // Fetch our catalog
    const { getProducts } = await import("../products/storage");
    const ourCatalog = await getProducts();

    const match = await matchCompetitorProduct(competitorProduct, ourCatalog);

    if (!match) {
      return res.json({
        matched: false,
        message: "No confident match found",
      });
    }

    res.json({
      matched: true,
      match: {
        productId: match.productId,
        productName: match.product.name,
        productSku: match.product.sku,
        productBarcode: match.product.barcode,
        confidence: match.confidence,
        matchReason: match.matchReason,
        matchedBy: match.matchedBy,
      },
    });
  } catch (error: any) {
    console.error("Error matching product:", error);
    res.status(500).json({
      error: "Failed to match product",
      message: error.message,
    });
  }
});

/**
 * POST /api/competitors/suggest-matches
 * Get AI suggestions for potential product matches
 */
router.post("/suggest-matches", async (req, res) => {
  try {
    const { competitorProduct, limit = 5 } = req.body;

    if (!competitorProduct || !competitorProduct.name) {
      return res.status(400).json({ error: "Competitor product data required" });
    }

    // Fetch our catalog
    const { getProducts } = await import("../products/storage");
    const ourCatalog = await getProducts();

    const suggestions = await suggestMatches(competitorProduct, ourCatalog, limit);

    res.json({
      suggestions: suggestions.map(s => ({
        productId: s.productId,
        productName: s.product.name,
        productSku: s.product.sku,
        productBarcode: s.product.barcode,
        productPrice: s.product.price,
        confidence: s.confidence,
        matchReason: s.matchReason,
      })),
    });
  } catch (error: any) {
    console.error("Error suggesting matches:", error);
    res.status(500).json({
      error: "Failed to suggest matches",
      message: error.message,
    });
  }
});

/**
 * POST /api/competitors/extract-from-url
 * Extract product info from competitor URL using AI
 */
router.post("/extract-from-url", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    const productInfo = await extractProductFromUrl(url);

    if (!productInfo) {
      return res.json({
        success: false,
        message: "Could not extract product information from URL",
      });
    }

    res.json({
      success: true,
      product: productInfo,
    });
  } catch (error: any) {
    console.error("Error extracting from URL:", error);
    res.status(500).json({
      error: "Failed to extract product info",
      message: error.message,
    });
  }
});

/**
 * POST /api/competitors/batch-import
 * Import multiple competitor products and auto-match them
 */
router.post("/batch-import", async (req, res) => {
  try {
    const { competitorId, products } = req.body;

    if (!competitorId || !Array.isArray(products)) {
      return res.status(400).json({
        error: "competitorId and products array required",
      });
    }

    // Fetch our catalog
    const { getProducts } = await import("../products/storage");
    const ourCatalog = await getProducts();

    const results = {
      total: products.length,
      matched: 0,
      unmatched: 0,
      created: 0,
      errors: 0,
      details: [] as any[],
    };

    for (const compProduct of products) {
      try {
        // Analyze data quality
        const quality = analyzeDataQuality(compProduct);

        // Try to match
        const match = await matchCompetitorProduct(compProduct, ourCatalog);

        if (match && match.confidence >= 70) {
          // Create competitor price entry
          const priceData = {
            competitorId: parseInt(competitorId),
            productId: match.productId,
            price: compProduct.price.toString(),
            originalPrice: compProduct.originalPrice?.toString(),
            productName: compProduct.name,
            productSku: compProduct.sku,
            productBarcode: compProduct.barcode,
            productUrl: compProduct.url,
            imageUrl: compProduct.imageUrl,
            availability: compProduct.availability,
            matchConfidence: match.confidence.toString(),
            matchedBy: match.matchedBy,
            priceDate: new Date(),
          };

          await createCompetitorPrice(priceData);

          results.matched++;
          results.created++;
          results.details.push({
            competitorProduct: compProduct.name,
            status: "matched",
            ourProduct: match.product.name,
            confidence: match.confidence,
            quality: quality.score,
          });
        } else {
          results.unmatched++;
          results.details.push({
            competitorProduct: compProduct.name,
            status: "unmatched",
            reason: "No confident match found",
            quality: quality.score,
            issues: quality.issues,
          });
        }
      } catch (error: any) {
        results.errors++;
        results.details.push({
          competitorProduct: compProduct.name,
          status: "error",
          error: error.message,
        });
      }
    }

    res.json(results);
  } catch (error: any) {
    console.error("Error in batch import:", error);
    res.status(500).json({
      error: "Failed to batch import",
      message: error.message,
    });
  }
});

/**
 * POST /api/competitors/analyze-quality
 * Analyze the data quality of competitor product data
 */
router.post("/analyze-quality", async (req, res) => {
  try {
    const { competitorProduct } = req.body;

    if (!competitorProduct) {
      return res.status(400).json({ error: "Competitor product data required" });
    }

    const analysis = analyzeDataQuality(competitorProduct);

    res.json(analysis);
  } catch (error: any) {
    console.error("Error analyzing quality:", error);
    res.status(500).json({
      error: "Failed to analyze quality",
      message: error.message,
    });
  }
});

/**
 * POST /api/competitors/scrape-portal
 * Scrape all products from an e-commerce portal URL
 */
router.post("/scrape-portal", async (req, res) => {
  try {
    const { url, maxProducts = 1000 } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    console.log(`Starting to scrape products from: ${url}`);

    const result = await scrapeEcommercePortal(url, {
      maxProducts: parseInt(maxProducts) || 1000,
      delay: 1000,
    });

    if (!result.success) {
      return res.status(500).json({
        error: "Scraping failed",
        message: result.errors?.join(", ") || "Unknown error",
        products: result.products,
      });
    }

    res.json({
      success: true,
      products: result.products,
      totalFound: result.totalFound,
      errors: result.errors,
    });
  } catch (error: any) {
    console.error("Error scraping portal:", error);
    res.status(500).json({
      error: "Failed to scrape portal",
      message: error.message,
    });
  }
});

export default router;
