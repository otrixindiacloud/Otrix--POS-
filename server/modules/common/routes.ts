import type { Express } from "express";
import { storage } from "../../storage";
import { insertStoreSchema, insertStoreProductSchema, USER_ROLES } from "@shared/schema";
import { isAuthenticated } from "../../auth";
import { requireRole } from "../shared/authorization";

export function registerCommonRoutes(app: Express) {
  // Store Management Routes
  app.get("/api/stores", isAuthenticated, async (_req, res) => {
    try {
      const stores = await storage.getStores();
      res.json(stores);
    } catch (error) {
      console.error("Error fetching stores:", error);
      res.status(500).json({ message: "Failed to fetch stores" });
    }
  });

  app.get("/api/stores/active", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const stores = user?.role === "admin"
        ? await storage.getActiveStores()
        : await storage.getUserAccessibleStores(user.id);
      res.json(stores);
    } catch (error) {
      console.error("Error fetching active stores:", error);
      res.status(500).json({ message: "Failed to fetch active stores" });
    }
  });

  app.get("/api/stores/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid store ID" });
      }
      const store = await storage.getStore(id);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }
      res.json(store);
    } catch (error) {
      console.error("Error fetching store:", error);
      res.status(500).json({ message: "Failed to fetch store" });
    }
  });

  app.post("/api/stores", isAuthenticated, requireRole([USER_ROLES.ADMIN]), async (req, res) => {
    try {
      console.log('Creating store with data:', req.body);
      const storeData = insertStoreSchema.parse(req.body);
      
      // Check for unique code constraint
      if (storeData.code) {
        const existingStore = await storage.getStoreByCode(storeData.code);
        if (existingStore) {
          return res.status(400).json({ message: "Store code already exists" });
        }
      }
      
      const store = await storage.createStore(storeData);
      res.status(201).json(store);
    } catch (error: any) {
      console.error("Error creating store:", error);
      
      // Handle validation errors
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid store data", 
          details: error.errors?.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      }
      
      // Handle database constraint errors
      if (error.code === '23505') { // PostgreSQL unique violation
        return res.status(400).json({ message: "Store code already exists" });
      }
      
      res.status(500).json({ message: "Internal server error while creating store" });
    }
  });

  app.put("/api/stores/:id", isAuthenticated, requireRole([USER_ROLES.ADMIN]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid store ID" });
      }
      
      console.log(`Updating store ${id} with data:`, req.body);
      
      // Validate the request body
      const storeData = insertStoreSchema.partial().parse(req.body);
      
      // Check if store exists before updating
      const existingStore = await storage.getStore(id);
      if (!existingStore) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      // Check for unique code constraint if code is being updated
      if (storeData.code && storeData.code !== existingStore.code) {
        const storeWithCode = await storage.getStoreByCode(storeData.code);
        if (storeWithCode && storeWithCode.id !== id) {
          return res.status(400).json({ message: "Store code already exists" });
        }
      }
      
      const store = await storage.updateStore(id, storeData);
      if (!store) {
        return res.status(500).json({ message: "Failed to update store in database" });
      }
      
      res.json(store);
    } catch (error: any) {
      console.error("Error updating store:", error);
      
      // Handle validation errors
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid store data", 
          details: error.errors?.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      }
      
      // Handle database constraint errors
      if (error.code === '23505') { // PostgreSQL unique violation
        return res.status(400).json({ message: "Store code already exists" });
      }
      
      res.status(500).json({ message: "Internal server error while updating store" });
    }
  });

  // Store Products Routes (Store-specific pricing)
  app.get("/api/stores/:storeId/products", isAuthenticated, async (req, res) => {
    try {
      const storeId = parseInt(req.params.storeId);
      if (isNaN(storeId) || storeId <= 0) {
        return res.status(400).json({ message: "Invalid store ID" });
      }
      const products = await storage.getProductsByStore(storeId);
      res.json(products);
    } catch (error) {
      console.error("Error fetching store products:", error);
      res.status(500).json({ message: "Failed to fetch store products" });
    }
  });

  app.get("/api/stores/:storeId/store-products", isAuthenticated, async (req, res) => {
    try {
      const storeId = parseInt(req.params.storeId);
      if (isNaN(storeId) || storeId <= 0) {
        return res.status(400).json({ message: "Invalid store ID" });
      }
      const storeProducts = await storage.getStoreProducts(storeId);
      res.json(storeProducts);
    } catch (error) {
      console.error("Error fetching store products:", error);
      res.status(500).json({ message: "Failed to fetch store products" });
    }
  });

  app.get("/api/stores/:storeId/products/:productId/price", isAuthenticated, async (req, res) => {
    try {
      const storeId = parseInt(req.params.storeId);
      const productId = parseInt(req.params.productId);
      if (isNaN(storeId) || storeId <= 0 || isNaN(productId) || productId <= 0) {
        return res.status(400).json({ message: "Invalid store or product ID" });
      }
      const price = await storage.getStoreSpecificPrice(storeId, productId);
      res.json({ price });
    } catch (error) {
      console.error("Error fetching store-specific price:", error);
      res.status(500).json({ message: "Failed to fetch store-specific price" });
    }
  });

  app.post(
    "/api/stores/:storeId/store-products",
    isAuthenticated,
    requireRole([USER_ROLES.ADMIN, USER_ROLES.MANAGER]),
    async (req, res) => {
      try {
        const storeId = parseInt(req.params.storeId);
        if (isNaN(storeId) || storeId <= 0) {
          return res.status(400).json({ message: "Invalid store ID" });
        }
        const storeProductData = insertStoreProductSchema.parse({ ...req.body, storeId });
        const storeProduct = await storage.createStoreProduct(storeProductData);
        res.status(201).json(storeProduct);
      } catch (error) {
        console.error("Error creating store product:", error);
        res.status(400).json({ message: "Invalid store product data", error });
      }
    }
  );

  app.put(
    "/api/stores/:storeId/store-products/:productId",
    isAuthenticated,
    requireRole([USER_ROLES.ADMIN, USER_ROLES.MANAGER]),
    async (req, res) => {
      try {
        const storeId = parseInt(req.params.storeId);
        const productId = parseInt(req.params.productId);
        if (isNaN(storeId) || storeId <= 0 || isNaN(productId) || productId <= 0) {
          return res.status(400).json({ message: "Invalid store or product ID" });
        }
        const updateData = insertStoreProductSchema.partial().parse(req.body);
        const updated = await storage.updateStoreProduct(storeId, productId, updateData);
        if (!updated) {
          return res.status(404).json({ message: "Store product not found" });
        }
        res.json(updated);
      } catch (error) {
        console.error("Error updating store product:", error);
        res.status(400).json({ message: "Invalid store product data", error });
      }
    }
  );
}
