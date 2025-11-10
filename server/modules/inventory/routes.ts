import type { Express } from "express";
import { USER_ROLES, insertProductSchema } from "@shared/schema";
import { storage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { requireRole } from "../shared/authorization";
import { searchProductWithAI } from "../../openai-service";

export function registerInventoryRoutes(app: Express) {
  app.get("/api/products", async (req, res) => {
    const products = await storage.getProducts();
    res.json(products);
  });

  app.get("/api/products/recent", async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 8;
    const products = await storage.getRecentProducts(limit);
    res.json(products);
  });

  app.get("/api/products/categories", async (req, res) => {
    try {
      const categories = await storage.getProductCategories();
      res.json(categories);
    } catch (error) {
      console.error("Categories error:", error);
      res.status(500).json({ message: "Failed to get categories", error });
    }
  });

  app.get("/api/products/search", async (req, res) => {
    const query = req.query.q as string;
    const category = req.query.category as string;
    const sort = req.query.sort as string;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ message: "Query parameter 'q' is required" });
    }

    try {
      const products = await storage.searchProducts(query.trim(), category, sort);
      res.json(products);
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ message: "Failed to search products", error });
    }
  });

  app.get("/api/products/barcode/:barcode", async (req, res) => {
    const barcode = req.params.barcode;
    const product = await storage.getProductByBarcode(barcode);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  });

  app.get("/api/products/sku/:sku", async (req, res) => {
    const sku = req.params.sku;
    const product = await storage.getProductBySku(sku);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  });

  app.get("/api/products/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid product ID" });
    }
    const product = await storage.getProduct(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  });

  app.post("/api/products", async (req, res) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(productData);
      res.status(201).json(product);
    } catch (error) {
      res.status(400).json({ message: "Invalid product data", error });
    }
  });

  app.post("/api/products/bulk", async (req, res) => {
    try {
      const { products } = req.body;
      
      if (!Array.isArray(products)) {
        return res.status(400).json({ message: "products must be an array" });
      }

      const createdProducts = [];
      const errors = [];

      for (const productData of products) {
        try {
          // Generate SKU if not provided
          if (!productData.sku) {
            productData.sku = `IMPORT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          }

          // Ensure required fields
          if (!productData.name || !productData.price) {
            errors.push({
              product: productData.name || "Unknown",
              error: "Missing required fields (name or price)",
            });
            continue;
          }

          const validatedData = insertProductSchema.parse({
            ...productData,
            quantity: productData.quantity || productData.stock || 0,
            stock: productData.stock || productData.quantity || 0,
          });
          
          const product = await storage.createProduct(validatedData);
          createdProducts.push(product);
        } catch (error: any) {
          errors.push({
            product: productData.name || "Unknown",
            error: error.message || "Validation failed",
          });
        }
      }

      res.status(201).json({
        success: true,
        created: createdProducts.length,
        failed: errors.length,
        products: createdProducts,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      res.status(400).json({ 
        message: "Invalid request", 
        error: error.message 
      });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid product ID" });
    }
    try {
      // Get current product to validate quantity against stock
      const currentProduct = await storage.getProduct(id);
      if (!currentProduct) {
        return res.status(404).json({ message: "Product not found" });
      }

      const updateData = insertProductSchema.partial().parse(req.body);
      
      // Validate quantity: if quantity is being updated, it cannot exceed stock
      if (updateData.quantity !== undefined) {
        const newQuantity = typeof updateData.quantity === 'number' ? updateData.quantity : parseInt(String(updateData.quantity));
        const currentStock = currentProduct.stock || 0;
        
        // If stock is also being updated, use the new stock value
        const stockToCheck = updateData.stock !== undefined 
          ? (typeof updateData.stock === 'number' ? updateData.stock : parseInt(String(updateData.stock)))
          : currentStock;
        
        if (newQuantity > stockToCheck) {
          return res.status(400).json({ 
            message: `Quantity (${newQuantity}) cannot exceed stock (${stockToCheck}). Please adjust stock first.` 
          });
        }
      }

      const product = await storage.updateProduct(id, updateData);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(400).json({ message: "Invalid update data", error });
    }
  });

  app.delete("/api/products/:id", isAuthenticated, requireRole([USER_ROLES.ADMIN, USER_ROLES.MANAGER]), async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid product ID" });
    }
    try {
      const success = await storage.deleteProduct(id);
      if (!success) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product", error });
    }
  });

  app.post("/api/products/ai-search", async (req, res) => {
    try {
      const { query, isBarcode } = req.body;
      if (!query) {
        return res.status(400).json({ message: "Query is required" });
      }

      const productInfo = await searchProductWithAI(query, isBarcode || false);
      res.json(productInfo);
    } catch (error) {
      console.error("AI product search error:", error);
      res.status(500).json({ message: "Failed to search product with AI", error: (error as Error).message });
    }
  });

  // Product Siblings Routes
  // Get all siblings for a product
  app.get("/api/products/:id/siblings", async (req, res) => {
    const productId = parseInt(req.params.id);
    if (isNaN(productId) || productId <= 0) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    try {
      const siblings = await storage.getProductSiblings(productId);
      res.json(siblings);
    } catch (error) {
      console.error("Error fetching product siblings:", error);
      res.status(500).json({ message: "Failed to fetch product siblings", error });
    }
  });

  // Add a sibling relationship
  app.post("/api/products/:id/siblings", isAuthenticated, async (req, res) => {
    const productId = parseInt(req.params.id);
    if (isNaN(productId) || productId <= 0) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    try {
      const { siblingId, relationshipType, notes } = req.body;

      if (!siblingId || !relationshipType) {
        return res.status(400).json({ message: "siblingId and relationshipType are required" });
      }

      if (productId === siblingId) {
        return res.status(400).json({ message: "Cannot add product as its own sibling" });
      }

      const validTypes = ["similar", "alternative", "complementary", "substitute"];
      if (!validTypes.includes(relationshipType)) {
        return res.status(400).json({ 
          message: "Invalid relationship type. Must be one of: similar, alternative, complementary, substitute" 
        });
      }

      const sibling = await storage.addProductSibling({
        productId,
        siblingId,
        relationshipType,
        notes: notes || null,
        createdBy: (req as any).user?.id || null,
      });

      res.status(201).json(sibling);
    } catch (error: any) {
      console.error("Error adding product sibling:", error);
      if (error.message?.includes("duplicate") || error.message?.includes("unique")) {
        return res.status(409).json({ message: "This sibling relationship already exists" });
      }
      res.status(500).json({ message: "Failed to add product sibling", error: error.message });
    }
  });

  // Remove a sibling relationship
  app.delete("/api/products/:id/siblings/:siblingRelationId", isAuthenticated, async (req, res) => {
    const productId = parseInt(req.params.id);
    const siblingRelationId = parseInt(req.params.siblingRelationId);

    if (isNaN(productId) || productId <= 0 || isNaN(siblingRelationId) || siblingRelationId <= 0) {
      return res.status(400).json({ message: "Invalid product or sibling relation ID" });
    }

    try {
      const success = await storage.removeProductSibling(siblingRelationId);
      if (!success) {
        return res.status(404).json({ message: "Sibling relationship not found" });
      }
      res.json({ message: "Sibling relationship removed successfully" });
    } catch (error) {
      console.error("Error removing product sibling:", error);
      res.status(500).json({ message: "Failed to remove product sibling", error });
    }
  });
}
