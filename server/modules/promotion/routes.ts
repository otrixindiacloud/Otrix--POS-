import type { Express } from "express";
import { storage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { requireRole } from "../shared/authorization";
import { USER_ROLES } from "@shared/schema";

export function registerPromotionRoutes(app: Express) {
  app.get("/api/stores/:storeId/promotions", isAuthenticated, async (req, res) => {
    try {
      const storeId = parseInt(req.params.storeId);
      if (isNaN(storeId)) {
        return res.status(400).json({ message: "Invalid store ID" });
      }

      const promotions = await storage.getPromotions(storeId);
      res.json(promotions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch promotions", error });
    }
  });

  app.get("/api/stores/:storeId/promotions/active", isAuthenticated, async (req, res) => {
    try {
      const storeId = parseInt(req.params.storeId);
      if (isNaN(storeId)) {
        return res.status(400).json({ message: "Invalid store ID" });
      }

      const promotions = await storage.getActivePromotions(storeId);
      res.json(promotions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active promotions", error });
    }
  });

  app.get("/api/promotions/active", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      let storeId = user?.defaultStoreId;

      if (!storeId) {
        const stores = await storage.getUserAccessibleStores(user.id);
        storeId = stores.length > 0 ? stores[0].id : 1;
      }

      const promotions = await storage.getActivePromotions(storeId);
      res.json(promotions);
    } catch (error) {
      console.error("Error fetching active promotions:", error);
      res.status(500).json({ message: "Failed to fetch active promotions", error });
    }
  });

  app.post("/api/promotions/applicable", isAuthenticated, async (req, res) => {
    try {
      const { storeId, cartItems } = req.body;

      if (!storeId || !cartItems) {
        return res.status(400).json({ message: "storeId and cartItems are required" });
      }

      const promotions = await storage.getActivePromotions(storeId);

      const applicablePromotions = promotions.filter((promotion) => promotion.isActive);
      res.json(applicablePromotions);
    } catch (error) {
      console.error("Error fetching applicable promotions:", error);
      res.status(500).json({ message: "Failed to fetch applicable promotions", error });
    }
  });

  app.get("/api/promotions/applicable", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      let storeId = user?.defaultStoreId;

      if (!storeId) {
        const stores = await storage.getUserAccessibleStores(user.id);
        storeId = stores.length > 0 ? stores[0].id : 1;
      }

      const cartItems = req.query.cartItems ? JSON.parse(req.query.cartItems as string) : [];
      const promotions = await storage.getApplicablePromotions(storeId, cartItems);
      res.json(promotions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch applicable promotions", error });
    }
  });

  app.post("/api/promotions/apply", isAuthenticated, async (req, res) => {
    try {
      const { promotionId, cartItems } = req.body;
      const result = await storage.applyPromotion(promotionId, cartItems);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to apply promotion", error });
    }
  });

  app.post("/api/promotions", isAuthenticated, requireRole([USER_ROLES.ADMIN, USER_ROLES.MANAGER]), async (req, res) => {
    try {
      const promotionData = req.body;
      const promotion = await storage.createPromotion(promotionData);
      res.status(201).json(promotion);
    } catch (error) {
      res.status(400).json({ message: "Failed to create promotion", error });
    }
  });

  app.patch("/api/promotions/:id", isAuthenticated, requireRole([USER_ROLES.ADMIN, USER_ROLES.MANAGER]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid promotion ID" });
      }

      const promotion = await storage.updatePromotion(id, req.body);
      if (!promotion) {
        return res.status(404).json({ message: "Promotion not found" });
      }
      res.json(promotion);
    } catch (error) {
      res.status(400).json({ message: "Failed to update promotion", error });
    }
  });

  app.delete("/api/promotions/:id", isAuthenticated, requireRole([USER_ROLES.ADMIN, USER_ROLES.MANAGER]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid promotion ID" });
      }

      const deleted = await storage.deletePromotion(id);
      if (!deleted) {
        return res.status(404).json({ message: "Promotion not found" });
      }
      res.json({ message: "Promotion deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete promotion", error });
    }
  });

  app.post("/api/promotions/apply", isAuthenticated, async (req, res) => {
    try {
      const { storeId, items, customerId } = req.body;
      if (!storeId || !items || !Array.isArray(items)) {
        return res.status(400).json({ message: "StoreId and items array are required" });
      }

      const result = await storage.applyPromotions(storeId, items, customerId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to apply promotions", error });
    }
  });

  app.get("/api/promotions/usage", isAuthenticated, requireRole([USER_ROLES.ADMIN, USER_ROLES.MANAGER]), async (req, res) => {
    try {
      const { promotionId, customerId } = req.query;
      const usage = await storage.getPromotionUsage(
        promotionId ? parseInt(promotionId as string) : undefined,
        customerId ? parseInt(customerId as string) : undefined
      );
      res.json(usage);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch promotion usage", error });
    }
  });
}
