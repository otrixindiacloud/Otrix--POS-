import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { pdfService } from "./pdf-service";
import { 
  insertProductSchema, insertTransactionSchema,
  insertTransactionItemSchema, insertHeldTransactionSchema,
  insertCreditTransactionSchema, cartItemSchema,
  insertStockAdjustmentSchema, insertSavedReportSchema, insertStockTakingSessionSchema,
  insertStockTakingItemSchema,
  USER_ROLES, TransactionItem, type Store
} from "@shared/schema";
import { z } from "zod";
import { assessTransactionRisk, getTransactionRiskHistory, getDailyRiskSummary } from "./risk-assessment-service";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { upload } from "./modules/shared/upload";
import { requireRole } from "./modules/shared/authorization";

// Define transaction item with product details for receipt generation
interface TransactionItemWithProduct extends TransactionItem {
  productName: string;
  productSku?: string;
  productBarcode?: string;
}
import { registerCustomerRoutes } from "./modules/customers/routes";
import { registerInventoryRoutes } from "./modules/inventory/routes";
import { registerSupplierRoutes } from "./modules/suppliers/routes";
import { registerTillRoutes } from "./modules/till/routes";
import { registerAuthRoutes } from "./modules/auth/routes";
import { registerCommonRoutes } from "./modules/common/routes";
import { registerPromotionRoutes } from "./modules/promotion/routes";
import { registerAiRoutes } from "./modules/ai/routes";
import { registerInvoiceRoutes } from "./modules/invoices/routes";
import { generateInvoiceForTransaction } from "./modules/invoices/service";
import competitorRoutes from "./modules/competitors/routes";
import * as productStorage from "./modules/products/storage";

function resolveStoreTimezone(store?: Store | null): string {
  if (store?.settings && typeof store.settings === "object" && store.settings !== null) {
    const maybeTimezone = (store.settings as Record<string, unknown>)["timezone"];
    if (typeof maybeTimezone === "string" && maybeTimezone.trim().length > 0) {
      return maybeTimezone;
    }
  }

  if (typeof process.env.DEFAULT_STORE_TIMEZONE === "string" && process.env.DEFAULT_STORE_TIMEZONE.trim().length > 0) {
    return process.env.DEFAULT_STORE_TIMEZONE.trim();
  }

  if (store?.baseCurrency === "QAR") {
    return "Asia/Qatar";
  }

  return "UTC";
}

function formatDateInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
  }).format(date);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Authentication
  setupAuth(app);
  registerAuthRoutes(app);

  // Serve static files for invoices
  app.use('/static', express.static(path.join(process.cwd(), 'static')));

  // Register modular routes
  registerCommonRoutes(app);
  registerCustomerRoutes(app);
  registerInventoryRoutes(app);
  registerSupplierRoutes(app);
  registerTillRoutes(app);
  registerPromotionRoutes(app);
  registerAiRoutes(app);
  registerInvoiceRoutes(app);
  
  // Competitor routes
  app.use('/api/competitors', isAuthenticated, competitorRoutes);

  // User management routes
  app.get('/api/users', isAuthenticated, requireRole([USER_ROLES.ADMIN]), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch('/api/users/:userId/role', isAuthenticated, requireRole([USER_ROLES.ADMIN]), async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { role } = req.body;
      
      if (isNaN(userId) || userId <= 0) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      if (!Object.values(USER_ROLES).includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const user = await storage.updateUserRoleById(userId, role);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.patch('/api/users/me/default-store', isAuthenticated, async (req, res) => {
    try {
      const authUser = req.user as any;
      if (!authUser?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { storeId } = req.body;

      if (storeId === undefined) {
        return res.status(400).json({ message: "storeId is required" });
      }

      if (storeId !== null && storeId !== undefined) {
        if (typeof storeId !== "number" || Number.isNaN(storeId) || storeId <= 0) {
          return res.status(400).json({ message: "Invalid store ID" });
        }

        const accessibleStores = await storage.getUserAccessibleStores(authUser.id);
        const hasAccess = accessibleStores.some((store) => store.id === storeId);
        if (!hasAccess) {
          return res.status(403).json({ message: "User does not have access to this store" });
        }
      }

  const updatedUser = await storage.updateUserDefaultStore(authUser.id, storeId === null ? null : storeId);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ defaultStoreId: updatedUser.defaultStoreId });
    } catch (error) {
      console.error("Error updating default store:", error);
      res.status(500).json({ message: "Failed to update default store" });
    }
  });

  // Transactions
  app.get("/api/transactions", isAuthenticated, async (req, res) => {
    const storeId = req.query.storeId ? parseInt(req.query.storeId as string) : undefined;
    const transactions = await storage.getTransactions(storeId);
    res.json(transactions);
  });

  app.get("/api/transactions/number", isAuthenticated, async (req, res) => {
    const transactionNumber = await storage.generateTransactionNumber();
    res.json({ transactionNumber });
  });

  app.get("/api/transactions/:id", isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid transaction ID" });
    }
    const transaction = await storage.getTransaction(id);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    res.json(transaction);
  });

  // Refund transaction
  app.post("/api/transactions/:id/refund", isAuthenticated, requireRole([USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.SUPERVISOR]), async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid transaction ID" });
    }
    try {
      const { reason, refundAmount, refundedBy } = req.body;
      
      if (!reason || !refundAmount || !refundedBy) {
        return res.status(400).json({ message: "Reason, refund amount, and refunded by are required" });
      }
      
      const result = await storage.refundTransaction(id, {
        reason,
        refundAmount: parseFloat(refundAmount),
        refundedBy,
        refundedAt: new Date()
      });
      
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error processing refund:", error);
      res.status(500).json({ message: "Failed to process refund", error });
    }
  });

  // Void transaction
  app.post("/api/transactions/:id/void", isAuthenticated, requireRole([USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.SUPERVISOR]), async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid transaction ID" });
    }
    try {
      const { reason, voidedBy } = req.body;
      
      if (!reason || !voidedBy) {
        return res.status(400).json({ message: "Reason and voided by are required" });
      }
      
      const result = await storage.voidTransaction(id, {
        reason,
        voidedBy,
        voidedAt: new Date()
      });
      
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error voiding transaction:", error);
      res.status(500).json({ message: "Failed to void transaction", error });
    }
  });

  app.get("/api/transactions/:id/items", isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid transaction ID" });
    }
    const items = await storage.getTransactionItems(id);
    res.json(items);
  });

  app.get("/api/transactions/:id/receipt", isAuthenticated, async (req, res) => {
    console.log("🧾 Receipt request received for transaction ID:", req.params.id);
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id) || id <= 0) {
        console.log("❌ Invalid transaction ID:", req.params.id);
        return res.status(400).json({ message: "Invalid transaction ID" });
      }

      console.log("📋 Getting transaction details for ID:", id);
      // Get transaction details
      const transaction = await storage.getTransaction(id);
      if (!transaction) {
        console.log("❌ Transaction not found:", id);
        return res.status(404).json({ message: "Transaction not found" });
      }

      console.log("✅ Transaction found:", transaction.transactionNumber || transaction.id);

      console.log("✅ Transaction found:", transaction.transactionNumber || transaction.id);

      console.log("📦 Getting transaction items...");
      // Get transaction items with product details
      const items = await storage.getTransactionItems(id) as TransactionItemWithProduct[];

      console.log("🏪 Getting store details...");
      // Get store details
      const store = await storage.getStore(transaction.storeId);
      if (!store) {
        console.log("❌ Store not found:", transaction.storeId);
        return res.status(404).json({ message: "Store not found" });
      }

      console.log("👤 Getting customer details...");
      // Get customer details if available
      let customer = undefined;
      if (transaction.customerId) {
        customer = await storage.getCustomer(transaction.customerId);
      }

      console.log("📄 Generating receipt PDF...");
      // Generate receipt PDF
      const receipt = await pdfService.generateReceiptPDF(transaction, items, store, customer);
      
      console.log("✅ Receipt generated successfully:", receipt.url);
      res.json({ 
        success: true, 
        receiptUrl: receipt.url,
        message: "Receipt generated successfully" 
      });
    } catch (error) {
      console.error("❌ Error generating receipt:", error);
      res.status(500).json({ 
        message: "Failed to generate receipt", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Debug endpoint to test API routing
  app.get("/api/test-receipt", (req, res) => {
    console.log("🔧 Test receipt endpoint hit");
    res.json({ message: "Receipt API routing is working", timestamp: new Date().toISOString() });
  });

  app.post("/api/transactions", isAuthenticated, async (req, res) => {
    try {
      console.log("Transaction request body:", JSON.stringify(req.body, null, 2));

      const rawStoreId = req.body.storeId;
      const storeId = typeof rawStoreId === "number" ? rawStoreId : parseInt(String(rawStoreId ?? ""), 10);
      if (!storeId || Number.isNaN(storeId) || storeId <= 0) {
        return res.status(400).json({ message: "A valid storeId is required to create a transaction." });
      }

      const store = await storage.getStore(storeId);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }

      const timezone = resolveStoreTimezone(store);

      // CRITICAL VALIDATION: Check if a day operation is open
      const openDay = await storage.getOpenDayOperation(storeId);
      
      if (!openDay) {
        return res.status(400).json({ 
          message: "No day operation is currently open. Please open a day before creating transactions.",
          code: "DAY_NOT_OPEN",
          action: "OPEN_DAY"
        });
      }
      
      // CRITICAL VALIDATION: Ensure transaction date matches open day date
      let referenceDate = new Date();
      if (req.body.createdAt) {
        const parsed = new Date(req.body.createdAt);
        if (!Number.isNaN(parsed.getTime())) {
          referenceDate = parsed;
        } else {
          console.warn("Unable to parse provided createdAt, falling back to current time", req.body.createdAt);
        }
      }

      const transactionDate = formatDateInTimezone(referenceDate, timezone);
      
      if (transactionDate !== openDay.date) {
        return res.status(400).json({
          message: `Transaction date (${transactionDate}) does not match open day (${openDay.date}). Please ensure you're creating transactions for the correct day.`,
          code: "DATE_MISMATCH",
          openDayDate: openDay.date,
          transactionDate: transactionDate,
          timezone
        });
      }
      
      console.log(`✅ Day validation passed: Open day ${openDay.date}, Transaction date ${transactionDate}`);
      
      // Always generate transaction number on server side to avoid race conditions
      // This ensures uniqueness even with concurrent requests
      const serverGeneratedTransactionNumber = await storage.generateTransactionNumber();
      
      // Validate and parse transaction data with better error handling
      let transactionData;
      try {
        // Override client-provided transaction number with server-generated one
        const bodyWithServerNumber = { ...req.body, transactionNumber: serverGeneratedTransactionNumber };
        transactionData = insertTransactionSchema.parse(bodyWithServerNumber);
        console.log("Parsed transaction data:", JSON.stringify(transactionData, null, 2));
      } catch (validationError) {
        console.error("Transaction validation error:", validationError);
        if (validationError instanceof Error && 'issues' in validationError) {
          const zodError = validationError as any;
          const errorMessages = zodError.issues?.map((issue: any) => `${issue.path.join('.')}: ${issue.message}`).join(', ');
          return res.status(400).json({
            message: "Invalid transaction data",
            error: "Validation failed",
            details: errorMessages,
            receivedData: req.body
          });
        }
        throw validationError;
      }
      
      const transaction = await storage.createTransaction(transactionData);
      
      let transactionItems: any[] = [];
      
      // Create transaction items if provided
      if (req.body.items && Array.isArray(req.body.items)) {
        for (const itemData of req.body.items) {
          console.log("Processing item:", JSON.stringify(itemData, null, 2));
          
          // Normalize productId - ensure it's a valid number or null
          let normalizedProductId: number | null = null;
          if (itemData.productId !== null && itemData.productId !== undefined) {
            const parsed = typeof itemData.productId === 'string' 
              ? parseInt(itemData.productId, 10) 
              : Number(itemData.productId);
            
            if (!isNaN(parsed) && parsed > 0 && parsed <= 2147483647) {
              normalizedProductId = parsed;
            } else if (!isNaN(parsed)) {
              console.error(`Invalid productId value: ${itemData.productId} (parsed as ${parsed})`);
              return res.status(400).json({
                message: "Invalid productId",
                error: `productId must be a valid integer between 1 and 2147483647, got: ${itemData.productId}`,
                receivedProductId: itemData.productId
              });
            }
          }
          
          const item = insertTransactionItemSchema.parse({
            ...itemData,
            productId: normalizedProductId,
            transactionId: transaction.id,
            unitPrice: itemData.unitPrice ? String(itemData.unitPrice) : String(itemData.price || 0),
            total: String(itemData.total || 0)
          });
          const createdItem = await storage.createTransactionItem(item);
          transactionItems.push(createdItem);
        }
      }
      
      // Update inventory stock when transaction is completed
      console.log(`📦 Stock reduction check: transaction.status=${transaction.status}, transactionItems.length=${transactionItems.length}`);
      
      if (transaction.status === 'completed' && transactionItems.length > 0) {
        console.log(`🔄 Starting stock reduction for ${transactionItems.length} items`);
        
        for (const item of transactionItems) {
          // Ensure quantity is a number
          const quantity = typeof item.quantity === 'number' ? item.quantity : parseInt(String(item.quantity || 0), 10);
          
          console.log(`📦 Processing item: productId=${item.productId}, quantity=${quantity} (type: ${typeof item.quantity})`);
          
          if (item.productId && quantity > 0) {
            try {
              // Update store-specific stock
              await storage.updateStoreProductStock(
                storeId,
                item.productId,
                quantity,
                'subtract'
              );
              console.log(`✅ Updated storeProductStock for product ${item.productId}: subtracted ${quantity} units`);
              
              // Also update main product stock (for product detail page and inventory views)
              const product = await productStorage.getProduct(item.productId);
              if (product) {
                const currentStock = typeof product.stock === 'number' ? product.stock : parseInt(String(product.stock || 0), 10);
                const newStock = Math.max(0, currentStock - quantity);
                const currentQuantity = typeof product.quantity === 'number' ? product.quantity : parseInt(String(product.quantity || 0), 10);
                const newQuantity = Math.max(0, currentQuantity - quantity);
                
                console.log(`📊 Product ${item.productId} stock: ${currentStock} -> ${newStock} (subtracted ${quantity})`);
                
                await productStorage.updateProduct(item.productId, {
                  stock: newStock,
                  quantity: newQuantity
                });
                console.log(`✅ Updated main product stock for product ${item.productId}: subtracted ${quantity} units (new stock: ${newStock})`);
              } else {
                console.warn(`⚠️ Product ${item.productId} not found when updating main product stock`);
              }
            } catch (stockError) {
              console.error(`❌ Failed to update stock for product ${item.productId}:`, stockError);
              console.error(`❌ Error details:`, stockError instanceof Error ? stockError.stack : stockError);
              // Don't fail the transaction if stock update fails, but log the error
            }
          } else {
            console.warn(`⚠️ Skipping stock update for item: productId=${item.productId}, quantity=${quantity} (invalid data)`);
          }
        }
      } else {
        console.warn(`⚠️ Stock reduction skipped: transaction.status=${transaction.status}, items=${transactionItems.length}`);
      }
      
      // Update customer credit balance and create credit transaction if payment method is credit
      if (transaction.paymentMethod === 'credit' && transaction.customerId) {
        try {
          const customer = await storage.getCustomer(transaction.customerId);
          if (customer) {
            const currentBalance = parseFloat(String(customer.creditBalance || "0"));
            const transactionTotal = parseFloat(String(transaction.total || "0"));
            const newBalance = (currentBalance + transactionTotal).toFixed(2);
            
            // Update customer credit balance
            await storage.updateCustomerCreditBalance(transaction.customerId, newBalance);
            console.log(`Updated customer ${transaction.customerId} credit balance to ${newBalance}`);
            
            // Create credit transaction record for this sale
            const cashierId = (req.user as any)?.id || transaction.cashierId || null;
            const creditTransactionData = {
              customerId: transaction.customerId,
              cashierId: cashierId,
              transactionId: transaction.id,
              type: 'charge',
              amount: transactionTotal.toFixed(2),
              paymentMethod: 'credit',
              reference: transaction.transactionNumber || null,
              description: `Credit sale - Transaction #${transaction.transactionNumber || transaction.id}`,
              previousBalance: currentBalance.toFixed(2),
              newBalance: newBalance,
            };
            
            await storage.createCreditTransaction(creditTransactionData);
            console.log(`Created credit transaction for customer ${transaction.customerId} from sale transaction ${transaction.id}`);
          }
        } catch (creditError) {
          console.error("Failed to update customer credit balance or create credit transaction:", creditError);
          // Don't fail the transaction if credit balance update fails
        }
      }

      const invoiceResult = await generateInvoiceForTransaction({
        transaction,
        transactionItems,
        shareVia: req.body?.shareVia,
        forceWhatsappLink: true,
      });

      if (invoiceResult.error) {
        console.error("Invoice generation error:", invoiceResult.error);
      }

      res.status(201).json({
        transaction,
        transactionItems,
        generatedInvoice: invoiceResult.generatedInvoice,
        whatsappLink: invoiceResult.whatsappLink,
      });
      return;
    } catch (error) {
      console.error("Transaction creation error:", error);
      // Handle duplicate transaction number error with multiple retries
      const isDuplicateKeyError = error instanceof Error && (
        error.message.includes('duplicate key value violates unique constraint') ||
        error.message.includes('transactions_transaction_number_unique') ||
        (error as any).code === '23505' // PostgreSQL unique violation error code
      );
      
      if (isDuplicateKeyError) {
        const maxRetries = 3;
        let attempts = 0;
        
        while (attempts < maxRetries) {
          try {
            attempts++;
            console.log(`Duplicate transaction number detected, generating new one... (attempt ${attempts}/${maxRetries})`);
            const newTransactionNumber = await storage.generateTransactionNumber();
            const updatedData = { ...insertTransactionSchema.parse(req.body), transactionNumber: newTransactionNumber };
            
            const transaction = await storage.createTransaction(updatedData);
            
            let transactionItems: any[] = [];
            if (req.body.items && Array.isArray(req.body.items)) {
              for (const itemData of req.body.items) {
                // Normalize productId - ensure it's a valid number or null
                let normalizedProductId: number | null = null;
                if (itemData.productId !== null && itemData.productId !== undefined) {
                  const parsed = typeof itemData.productId === 'string' 
                    ? parseInt(itemData.productId, 10) 
                    : Number(itemData.productId);
                  
                  if (!isNaN(parsed) && parsed > 0 && parsed <= 2147483647) {
                    normalizedProductId = parsed;
                  } else if (!isNaN(parsed)) {
                    console.error(`Invalid productId value: ${itemData.productId} (parsed as ${parsed})`);
                    return res.status(400).json({
                      message: "Invalid productId",
                      error: `productId must be a valid integer between 1 and 2147483647, got: ${itemData.productId}`,
                      receivedProductId: itemData.productId
                    });
                  }
                }
                
                const item = insertTransactionItemSchema.parse({
                  ...itemData,
                  productId: normalizedProductId,
                  transactionId: transaction.id,
                  unitPrice: itemData.unitPrice ? String(itemData.unitPrice) : String(itemData.price || 0),
                  total: String(itemData.total || 0)
                });
                const createdItem = await storage.createTransactionItem(item);
                transactionItems.push(createdItem);
              }
            }
            
            // Update inventory stock when transaction is completed
            if (transaction.status === 'completed' && transactionItems.length > 0) {
              const transactionStoreId = transaction.storeId;
              for (const item of transactionItems) {
                if (item.productId && item.quantity) {
                  try {
                    // Update store-specific stock
                    await storage.updateStoreProductStock(
                      transactionStoreId,
                      item.productId,
                      item.quantity,
                      'subtract'
                    );
                    console.log(`✅ Updated storeProductStock for product ${item.productId}: subtracted ${item.quantity} units`);
                    
                    // Also update main product stock (for product detail page and inventory views)
                    const product = await productStorage.getProduct(item.productId);
                    if (product) {
                      const currentStock = product.stock || 0;
                      const newStock = Math.max(0, currentStock - item.quantity);
                      const currentQuantity = product.quantity || 0;
                      const newQuantity = Math.max(0, currentQuantity - item.quantity);
                      
                      await productStorage.updateProduct(item.productId, {
                        stock: newStock,
                        quantity: newQuantity
                      });
                      console.log(`✅ Updated main product stock for product ${item.productId}: subtracted ${item.quantity} units (new stock: ${newStock})`);
                    } else {
                      console.warn(`⚠️ Product ${item.productId} not found when updating main product stock`);
                    }
                  } catch (stockError) {
                    console.error(`❌ Failed to update stock for product ${item.productId}:`, stockError);
                    // Don't fail the transaction if stock update fails, but log the error
                  }
                }
              }
            }
            
            // Update customer credit balance if payment method is credit
            if (transaction.paymentMethod === 'credit' && transaction.customerId) {
              try {
                const customer = await storage.getCustomer(transaction.customerId);
                if (customer) {
                  const currentBalance = parseFloat(String(customer.creditBalance || "0"));
                  const transactionTotal = parseFloat(String(transaction.total || "0"));
                  const newBalance = (currentBalance + transactionTotal).toFixed(2);
                  
                  await storage.updateCustomerCreditBalance(transaction.customerId, newBalance);
                  console.log(`Updated customer ${transaction.customerId} credit balance to ${newBalance}`);
                }
              } catch (creditError) {
                console.error("Failed to update customer credit balance:", creditError);
                // Don't fail the transaction if credit balance update fails
              }
            }
            
            const invoiceResult = await generateInvoiceForTransaction({
              transaction,
              transactionItems,
              shareVia: req.body?.shareVia,
              forceWhatsappLink: true,
            });

            if (invoiceResult.error) {
              console.error("Invoice generation error:", invoiceResult.error);
            }

            res.status(201).json({
              transaction,
              transactionItems,
              generatedInvoice: invoiceResult.generatedInvoice,
              whatsappLink: invoiceResult.whatsappLink,
            });
            return;
          } catch (retryError) {
            console.error(`Retry ${attempts} failed:`, retryError);
            if (attempts === maxRetries) {
              console.error("All retry attempts failed");
              break;
            }
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }
      
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      res.status(400).json({ 
        message: "Invalid transaction data", 
        error: error instanceof Error ? error.message : String(error),
        details: error
      });
    }
  });

  app.get("/api/transactions/:id/items", async (req, res) => {
    const transactionId = parseInt(req.params.id);
    if (isNaN(transactionId) || transactionId <= 0) {
      return res.status(400).json({ message: "Invalid transaction ID" });
    }
    const items = await storage.getTransactionItems(transactionId);
    res.json(items);
  });

  app.patch("/api/transactions/:id/mark-printed", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid transaction ID" });
    }
    try {
      const transaction = await storage.updateTransaction(id, { receiptPrinted: true });
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      res.json(transaction);
    } catch (error) {
      res.status(400).json({ message: "Failed to mark receipt as printed", error });
    }
  });

  // Held Transactions
  app.get("/api/held-transactions", async (req, res) => {
    const heldTransactions = await storage.getHeldTransactions();
    res.json(heldTransactions);
  });

  // VAT Configurations
  app.get("/api/vat-configurations/:storeId", async (req, res) => {
    try {
      const storeId = parseInt(req.params.storeId);
      const vatConfigs = await storage.getVatConfigurations(storeId);
      res.json(vatConfigs);
    } catch (error) {
      console.error("Error fetching VAT configurations:", error);
      res.status(500).json({ error: "Failed to fetch VAT configurations" });
    }
  });

  app.post("/api/held-transactions", async (req, res) => {
    try {
      const heldTxData = insertHeldTransactionSchema.parse(req.body);
      const heldTransaction = await storage.createHeldTransaction(heldTxData);
      res.status(201).json(heldTransaction);
    } catch (error) {
      res.status(400).json({ message: "Invalid held transaction data", error });
    }
  });

  app.get("/api/held-transactions/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid held transaction ID" });
    }
    const heldTransaction = await storage.getHeldTransaction(id);
    if (!heldTransaction) {
      return res.status(404).json({ message: "Held transaction not found" });
    }
    res.json(heldTransaction);
  });

  app.delete("/api/held-transactions/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid held transaction ID" });
    }
    try {
      const deleted = await storage.deleteHeldTransaction(id);
      if (!deleted) {
        return res.status(404).json({ message: "Held transaction not found" });
      }
      res.json({ message: "Held transaction deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete held transaction", error });
    }
  });

  // Credit Transactions
  app.get("/api/credit-transactions", isAuthenticated, async (req, res) => {
    try {
      const customerId = req.query.customerId ? parseInt(req.query.customerId as string) : undefined;
      const storeId = req.query.storeId ? parseInt(req.query.storeId as string) : undefined;
      console.log(`[Credit Transactions API] Fetching transactions for customerId: ${customerId}, storeId: ${storeId}`);
      const creditTransactions = await storage.getCreditTransactions(customerId, storeId);
      console.log(`[Credit Transactions API] Found ${creditTransactions.length} transactions`);
      res.json(creditTransactions);
    } catch (error) {
      console.error("[Credit Transactions API] Error:", error);
      res.status(500).json({ message: "Failed to fetch credit transactions", error: String(error) });
    }
  });

  app.post("/api/credit-transactions", isAuthenticated, async (req, res) => {
    try {
      const creditTransactionData = insertCreditTransactionSchema.parse(req.body);
      
      // Create the credit transaction
      const creditTransaction = await storage.createCreditTransaction(creditTransactionData);
      
      // Update customer credit balance
      await storage.updateCustomerCreditBalance(
        creditTransactionData.customerId, 
        creditTransactionData.newBalance
      );
      
      res.status(201).json(creditTransaction);
    } catch (error) {
      res.status(400).json({ message: "Invalid credit transaction data", error });
    }
  });

  app.get("/api/credit-transactions/:id", isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid credit transaction ID" });
    }
    const creditTransaction = await storage.getCreditTransaction(id);
    if (!creditTransaction) {
      return res.status(404).json({ message: "Credit transaction not found" });
    }
    res.json(creditTransaction);
  });

  // Get transactions by date
  app.get("/api/transactions/date/:date", async (req, res) => {
    try {
      const date = req.params.date;
      const storeId = req.query.storeId ? parseInt(req.query.storeId as string) : undefined;
      const transactions = await storage.getTransactionsByDate(date, storeId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions by date:", error);
      res.status(500).json({ message: "Failed to get transactions", error: (error as Error).message });
    }
  });



  // Sales reporting
  app.get("/api/reports/sales", async (req, res) => {
    const { date, start_date, end_date } = req.query;
    
    try {
      let transactions;
      if (date) {
        transactions = await storage.getTransactionsByDate(date as string);
      } else {
        transactions = await storage.getTransactions();
        // Filter by date range if provided
        if (start_date && end_date) {
          transactions = transactions.filter(t => {
            if (!t.createdAt) return false;
            const txDate = t.createdAt.toISOString().split('T')[0];
            return txDate >= start_date && txDate <= end_date;
          });
        }
      }

      const completedTransactions = transactions.filter(t => t.status === 'completed');
      
      const report = {
        totalSales: completedTransactions.reduce((sum, t) => sum + parseFloat(t.total), 0),
        totalTransactions: completedTransactions.length,
        cashSales: completedTransactions
          .filter(t => t.paymentMethod === 'cash')
          .reduce((sum, t) => sum + parseFloat(t.total), 0),
        cardSales: completedTransactions
          .filter(t => t.paymentMethod === 'card')
          .reduce((sum, t) => sum + parseFloat(t.total), 0),
        creditSales: completedTransactions
          .filter(t => t.paymentMethod === 'credit')
          .reduce((sum, t) => sum + parseFloat(t.total), 0),
        averageTransaction: completedTransactions.length > 0 
          ? completedTransactions.reduce((sum, t) => sum + parseFloat(t.total), 0) / completedTransactions.length 
          : 0
      };

      res.json(report);
    } catch (error) {
      res.status(500).json({ message: 'Failed to generate sales report', error });
    }
  });

  // Report stats endpoint
  app.get("/api/reports/stats", isAuthenticated, async (req, res) => {
    try {
      const { date, storeId } = req.query;
      
      if (!date || typeof date !== 'string') {
        return res.status(400).json({ message: 'Date parameter is required (YYYY-MM-DD format)' });
      }

      const storeIdNum = storeId ? parseInt(storeId as string) : undefined;
      const stats = await storage.getReportStats(date, storeIdNum);
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching report stats:", error);
      res.status(500).json({ 
        message: "Failed to fetch report stats", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // AI Recommendations endpoint
  // AI Reports endpoints

  // User Store Assignment endpoints (Admin only)
  app.get("/api/admin/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/users/:userId/stores", isAuthenticated, requireRole([USER_ROLES.ADMIN]), async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const [assignments, accessibleStores] = await Promise.all([
        storage.getUserStoreAssignmentsWithDetails(userId),
        storage.getUserAccessibleStores(userId),
      ]);

      res.json({ assignments, accessibleStores });
    } catch (error) {
      console.error('Error fetching user stores:', error);
      res.status(500).json({ message: "Failed to fetch user stores" });
    }
  });

  app.get("/api/admin/stores/:storeId/users", isAuthenticated, requireRole([USER_ROLES.ADMIN]), async (req, res) => {
    try {
      const storeId = parseInt(req.params.storeId);
      if (isNaN(storeId)) {
        return res.status(400).json({ message: "Invalid store ID" });
      }

      const assignments = await storage.getStoreUserAssignmentsWithDetails(storeId);
      res.json(assignments);
    } catch (error) {
      console.error('Error fetching store users:', error);
      res.status(500).json({ message: "Failed to fetch store users" });
    }
  });

  app.post("/api/admin/users/:userId/stores/:storeId/assign", isAuthenticated, requireRole([USER_ROLES.ADMIN]), async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const storeId = parseInt(req.params.storeId);
      
      if (isNaN(userId) || isNaN(storeId)) {
        return res.status(400).json({ message: "Invalid user ID or store ID" });
      }

      const { canAccess = true } = req.body;
      const assignedBy = (req.user as any)?.id;
      
      const assignment = await storage.assignUserToStore({
        userId,
        storeId,
        canAccess,
        assignedBy
      });
      
      res.json(assignment);
    } catch (error) {
      console.error('Error assigning user to store:', error);
      res.status(500).json({ message: "Failed to assign user to store" });
    }
  });

  app.delete("/api/admin/users/:userId/stores/:storeId", isAuthenticated, requireRole([USER_ROLES.ADMIN]), async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const storeId = parseInt(req.params.storeId);
      
      if (isNaN(userId) || isNaN(storeId)) {
        return res.status(400).json({ message: "Invalid user ID or store ID" });
      }
      
      const removed = await storage.removeUserFromStore(userId, storeId);
      
      if (removed) {
        res.json({ message: "User removed from store successfully" });
      } else {
        res.status(404).json({ message: "User store assignment not found" });
      }
    } catch (error) {
      console.error('Error removing user from store:', error);
      res.status(500).json({ message: "Failed to remove user from store" });
    }
  });

  app.patch("/api/admin/users/:userId/stores/:storeId/access", isAuthenticated, requireRole([USER_ROLES.ADMIN]), async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const storeId = parseInt(req.params.storeId);
      const { canAccess } = req.body;
      
      if (isNaN(userId) || isNaN(storeId)) {
        return res.status(400).json({ message: "Invalid user ID or store ID" });
      }
      
      if (typeof canAccess !== 'boolean') {
        return res.status(400).json({ message: "canAccess must be a boolean" });
      }
      
      const updated = await storage.updateUserStoreAccess(userId, storeId, canAccess);
      
      if (updated) {
        res.json(updated);
      } else {
        res.status(404).json({ message: "User store assignment not found" });
      }
    } catch (error) {
      console.error('Error updating user store access:', error);
      res.status(500).json({ message: "Failed to update user store access" });
    }
  });

  // Risk Assessment endpoints
  app.post("/api/risk/assess", async (req, res) => {
    try {
      const { assessTransactionRisk } = await import("./risk-assessment-service");
      const riskAssessment = await assessTransactionRisk(req.body);
      res.json(riskAssessment);
    } catch (error) {
      console.error('Risk Assessment Error:', error);
      res.status(500).json({ 
        message: "Failed to assess transaction risk", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  app.get("/api/risk/customer/:customerId", async (req, res) => {
    try {
      const customerId = parseInt(req.params.customerId);
      if (isNaN(customerId) || customerId <= 0) {
        return res.status(400).json({ message: "Invalid customer ID" });
      }
      
      const { getTransactionRiskHistory } = await import("./risk-assessment-service");
      const riskHistory = await getTransactionRiskHistory(customerId);
      res.json(riskHistory);
    } catch (error) {
      console.error('Customer Risk History Error:', error);
      res.status(500).json({ 
        message: "Failed to get customer risk history", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  app.get("/api/risk/daily/:date", async (req, res) => {
    try {
      const date = req.params.date;
      const { getDailyRiskSummary } = await import("./risk-assessment-service");
      const riskSummary = await getDailyRiskSummary(date);
      res.json(riskSummary);
    } catch (error) {
      console.error('Daily Risk Summary Error:', error);
      res.status(500).json({ 
        message: "Failed to get daily risk summary", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Receipt/Bill printing route
  app.get("/receipt/:transactionId", async (req, res) => {
    try {
      const transactionId = parseInt(req.params.transactionId);
      
      // Validate transaction ID
      if (isNaN(transactionId) || transactionId <= 0) {
        return res.status(400).send("Invalid transaction ID");
      }
      
      // Get transaction details
      const transaction = await storage.getTransaction(transactionId);
      if (!transaction) {
        return res.status(404).send("Transaction not found");
      }

      // Get transaction items
      const items = await storage.getTransactionItems(transactionId);
      
      // Get customer info if available
      const customer = transaction.customerId ? await storage.getCustomer(transaction.customerId) : null;

      // Generate HTML receipt
      const receiptHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt - ${transaction.transactionNumber}</title>
          <style>
            body { font-family: monospace; margin: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .transaction-info { margin-bottom: 20px; }
            .items-table { width: 100%; border-collapse: collapse; }
            .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .items-table th { background-color: #f2f2f2; }
            .total { font-weight: bold; font-size: 1.2em; margin-top: 20px; text-align: right; }
            .footer { margin-top: 30px; text-align: center; }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>POS System</h1>
            <h2>Receipt</h2>
          </div>
          
          <div class="transaction-info">
            <p><strong>Transaction #:</strong> ${transaction.transactionNumber}</p>
            <p><strong>Date:</strong> ${new Date(transaction.createdAt || new Date()).toLocaleString()}</p>
            ${customer ? `<p><strong>Customer:</strong> ${customer.name}</p>` : ''}
            <p><strong>Payment Method:</strong> ${transaction.paymentMethod}</p>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr>
                  <td>Item #${item.productId}</td>
                  <td>${item.quantity}</td>
                  <td>QR ${parseFloat(String(item.unitPrice)).toFixed(2)}</td>
                  <td>QR ${parseFloat(String(item.total)).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="total">
            <p>Subtotal: QR ${parseFloat(String(transaction.subtotal)).toFixed(2)}</p>
            <p>Tax: QR ${parseFloat(String(transaction.tax)).toFixed(2)}</p>
            <p><strong>Total: QR ${parseFloat(String(transaction.total)).toFixed(2)}</strong></p>
          </div>

          <div class="footer">
            <p>Thank you for your business!</p>
            <button class="no-print" onclick="window.print()">Print Receipt</button>
          </div>
        </body>
        </html>
      `;

      res.send(receiptHtml);
    } catch (error) {
      console.error("Error generating receipt:", error);
      res.status(500).send("Error generating receipt");
    }
  });

  // Returns endpoint
  app.post("/api/returns", async (req, res) => {
    try {
      const { transactionId, items, reason } = req.body;
      
      // In a real app, you'd create a returns table and process the refund
      // For now, we'll just acknowledge the return
      const returnData = {
        id: Date.now(),
        transactionId,
        items,
        reason,
        status: 'processed',
        refundAmount: items.reduce((sum: number, item: any) => {
          return sum + (item.price || 0) * (item.quantity || 0);
        }, 0),
        processedAt: new Date().toISOString()
      };
      
      res.status(201).json(returnData);
    } catch (error) {
      console.error("Error processing return:", error);
      res.status(500).json({ message: "Failed to process return" });
    }
  });

  // Image upload endpoint
  app.post("/api/upload/image", upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      // For now, we'll store images in the uploads directory and return the file path
      // In production, you would upload to a cloud storage service like AWS S3
      const imageUrl = `/uploads/${req.file.filename}`;
      
      res.json({ url: imageUrl });
    } catch (error) {
      res.status(500).json({ message: "Failed to upload image", error });
    }
  });

  // Serve uploaded files statically
  app.use('/uploads', express.static('uploads'));

  // ========== INVOICE MANAGEMENT ROUTES ==========
  app.get("/api/invoices/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid invoice ID" });
      }
      
      const invoice = await storage.getGeneratedInvoice(id);
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      res.json(invoice);
    } catch (error: any) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ message: "Failed to fetch invoice", error: error.message });
    }
  });

  app.get("/api/invoices/:id/download", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid invoice ID" });
      }
      
      const invoice = await storage.getGeneratedInvoice(id);
      
      if (!invoice || !invoice.pdfFilePath) {
        return res.status(404).json({ message: "Invoice PDF not found" });
      }
      
      const filePath = path.join(process.cwd(), invoice.pdfFilePath);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "PDF file not found on server" });
      }
      
      res.download(filePath, `invoice-${invoice.invoiceNumber}.pdf`);
    } catch (error: any) {
      console.error("Error downloading invoice:", error);
      res.status(500).json({ message: "Failed to download invoice", error: error.message });
    }
  });

  // ========== STOCK ADJUSTMENT ROUTES ==========
  
  // Get stock adjustments (optional product filter)
  app.get("/api/stock-adjustments", async (req, res) => {
    try {
      const productId = req.query.productId ? parseInt(req.query.productId as string) : undefined;
      const adjustments = await storage.getStockAdjustments(productId);
      res.json(adjustments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stock adjustments", error });
    }
  });

  // Create manual stock adjustment
  app.post("/api/stock-adjustments", async (req, res) => {
    try {
      const adjustmentData = insertStockAdjustmentSchema.parse(req.body);
      const adjustment = await storage.createStockAdjustment(adjustmentData);
      
      // Update product stock
      const product = await storage.getProduct(adjustmentData.productId);
      if (product) {
        const newStock = adjustmentData.newStock;
        await storage.updateProduct(adjustmentData.productId, { 
          stock: newStock,
          quantity: newStock
        });
      }
      
      res.status(201).json(adjustment);
    } catch (error) {
      res.status(400).json({ message: "Failed to create stock adjustment", error });
    }
  });

  // ========== SAVED REPORTS ROUTES ==========
  
  // Get all saved reports
  app.get("/api/saved-reports", async (req, res) => {
    try {
      const reports = await storage.getSavedReports();
      res.json(reports);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch saved reports", error });
    }
  });

  // Get specific saved report
  app.get("/api/saved-reports/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid report ID" });
      }
      
      const report = await storage.getSavedReport(id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      res.json(report);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch saved report", error });
    }
  });

  // Create new saved report
  app.post("/api/saved-reports", async (req, res) => {
    try {
      const reportData = insertSavedReportSchema.parse(req.body);
      const report = await storage.createSavedReport(reportData);
      res.status(201).json(report);
    } catch (error) {
      res.status(400).json({ message: "Failed to save report", error });
    }
  });

  // Update saved report
  app.patch("/api/saved-reports/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid report ID" });
      }
      
      const updateData = insertSavedReportSchema.partial().parse(req.body);
      const report = await storage.updateSavedReport(id, updateData);
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      res.json(report);
    } catch (error) {
      res.status(400).json({ message: "Failed to update report", error });
    }
  });

  // Delete saved report
  app.delete("/api/saved-reports/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid report ID" });
      }
      
      const deleted = await storage.deleteSavedReport(id);
      if (!deleted) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      res.json({ message: "Report deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete report", error });
    }
  });

  // ========== RISK ASSESSMENT ROUTES ==========
  
  // Assess transaction risk
  app.post("/api/risk/assess", async (req, res) => {
    try {
      const transactionData = req.body;
      const riskAssessment = await assessTransactionRisk(transactionData);
      res.json(riskAssessment);
    } catch (error) {
      res.status(500).json({ message: "Failed to assess transaction risk", error });
    }
  });

  // Get customer risk history
  app.get("/api/risk/customer/:id", async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      if (isNaN(customerId)) {
        return res.status(400).json({ message: "Invalid customer ID" });
      }
      
      const limit = parseInt(req.query.limit as string) || 10;
      const riskHistory = await getTransactionRiskHistory(customerId, limit);
      res.json(riskHistory);
    } catch (error) {
      res.status(500).json({ message: "Failed to get customer risk history", error });
    }
  });

  // Get daily risk summary
  app.get("/api/risk/daily/:date", async (req, res) => {
    try {
      const date = req.params.date;
      const riskSummary = await getDailyRiskSummary(date);
      res.json(riskSummary);
    } catch (error) {
      res.status(500).json({ message: "Failed to get daily risk summary", error });
    }
  });

  // Stock Upload endpoint
  app.post("/api/inventory/upload-stock", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
      }

      const filePath = req.file.path;
      const fileExtension = req.file.originalname.split('.').pop()?.toLowerCase();
      
      let stockData: any[] = [];
      
      // Parse file based on extension
      if (fileExtension === 'csv') {
        // For CSV files, read and parse manually
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const lines = fileContent.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          fs.unlinkSync(filePath);
          return res.status(400).json({ 
            success: false, 
            message: "CSV file must have at least a header row and one data row" 
          });
        }
        
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const requiredHeaders = ['name', 'barcode', 'qty', 'cost', 'price'];
        
        // Validate headers
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
          fs.unlinkSync(filePath);
          return res.status(400).json({
            success: false,
            message: `Missing required columns: ${missingHeaders.join(', ')}`
          });
        }
        
        // Parse data rows
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          if (values.length === headers.length) {
            const row: any = {};
            headers.forEach((header: string, index: number) => {
              row[header] = values[index];
            });
            stockData.push(row);
          }
        }
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        // For Excel files
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        stockData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (stockData.length < 2) {
          fs.unlinkSync(filePath);
          return res.status(400).json({ 
            success: false, 
            message: "Excel file must have at least a header row and one data row" 
          });
        }
        
        const headers = stockData[0].map((h: string) => h.toString().toLowerCase().trim());
        const requiredHeaders = ['name', 'barcode', 'qty', 'cost', 'price'];
        
        // Validate headers
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
          fs.unlinkSync(filePath);
          return res.status(400).json({
            success: false,
            message: `Missing required columns: ${missingHeaders.join(', ')}`
          });
        }
        
        // Convert to object format
        const dataRows = stockData.slice(1);
        stockData = dataRows.map((row: any[]) => {
          const obj: any = {};
          headers.forEach((header: string, index: number) => {
            obj[header] = row[index] ? row[index].toString().trim() : '';
          });
          return obj;
        });
      } else {
        fs.unlinkSync(filePath);
        return res.status(400).json({ 
          success: false, 
          message: "Unsupported file format. Please use CSV, XLSX, or XLS" 
        });
      }

      // Process stock data
      let processedCount = 0;
      let newProductsCount = 0;
      let updatedProductsCount = 0;
      const errors: string[] = [];

      for (const item of stockData) {
        try {
          const name = item.name?.toString().trim();
          const barcode = item.barcode?.toString().trim();
          const qty = parseInt(item.qty?.toString()) || 0;
          const cost = parseFloat(item.cost?.toString()) || 0;
          const price = parseFloat(item.price?.toString()) || 0;

          // Validate required fields
          if (!name) {
            errors.push(`Row ${processedCount + 1}: Product name is required`);
            continue;
          }
          
          if (!barcode) {
            errors.push(`Row ${processedCount + 1}: Barcode is required`);
            continue;
          }

          if (qty < 0) {
            errors.push(`Row ${processedCount + 1}: Quantity cannot be negative`);
            continue;
          }

          if (cost < 0 || price < 0) {
            errors.push(`Row ${processedCount + 1}: Cost and price cannot be negative`);
            continue;
          }

          // Check if product exists by barcode
          const existingProduct = await storage.getProductByBarcode(barcode);
          
          if (existingProduct) {
            // Update existing product's stock
            await storage.updateProduct(existingProduct.id, {
              quantity: qty,
              cost: cost.toString(),
              price: price.toString()
            });
            updatedProductsCount++;
          } else {
            // Create new product
            const sku = `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
            
            await storage.createProduct({
              name,
              sku,
              barcode,
              price: price.toString(),
              cost: cost.toString(),
              quantity: qty,
              category: "Imported",
              description: `Imported via stock upload on ${new Date().toLocaleDateString()}`
            });
            newProductsCount++;
          }
          
          processedCount++;
        } catch (error) {
          errors.push(`Row ${processedCount + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Clean up uploaded file
      fs.unlinkSync(filePath);

      const result = {
        success: errors.length < stockData.length, // Success if at least some items processed
        message: errors.length > 0 
          ? `Processed ${processedCount} items with ${errors.length} errors`
          : `Successfully processed ${processedCount} items`,
        processedCount,
        newProductsCount,
        updatedProductsCount,
        errors: errors.slice(0, 10) // Limit errors to first 10
      };

      res.json(result);
    } catch (error) {
      // Clean up file in case of error
      if (req.file?.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      
      console.error("Stock upload error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Internal server error during upload processing" 
      });
    }
  });

  // ========== STOCK TAKING ROUTES ==========
  
  // Get all stock taking sessions
  app.get("/api/stock-taking/sessions", async (req, res) => {
    try {
      const sessions = await storage.getStockTakingSessions();
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stock taking sessions", error });
    }
  });

  // Get stock taking session details
  app.get("/api/stock-taking/sessions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid session ID" });
      }
      
      const session = await storage.getStockTakingSession(id);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      const items = await storage.getStockTakingItems(id);
      res.json({ session, items });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch session details", error });
    }
  });

  // Submit stock taking
  app.post("/api/stock-taking/submit", async (req, res) => {
    try {
      const { items, stockDate } = req.body;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "Items array is required" });
      }

      const result = await storage.submitStockTaking(items, stockDate);
      res.status(201).json(result);
    } catch (error) {
      console.error("Stock taking submission error:", error);
      res.status(500).json({ message: "Failed to submit stock taking", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Get stock taking comparison for a specific date
  app.get("/api/stock-taking/comparison", async (req, res) => {
    try {
      const date = req.query.date as string;
      if (!date) {
        return res.status(400).json({ message: "Date parameter is required" });
      }

      const comparisonData = await storage.getStockTakingComparison(date);
      res.json(comparisonData);
    } catch (error) {
      console.error("Stock taking comparison error:", error);
      res.status(500).json({ message: "Failed to get comparison data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Update products stock to zero
  app.post("/api/products/update-stock-zero", async (req, res) => {
    try {
      const { productIds } = req.body;
      
      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ message: "Product IDs array is required" });
      }

      const updatedCount = await storage.updateProductsStockToZero(productIds);
      res.json({ message: `Updated ${updatedCount} products to zero stock`, updatedCount });
    } catch (error) {
      console.error("Update stock to zero error:", error);
      res.status(500).json({ message: "Failed to update stock", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // ========== VAT MANAGEMENT ROUTES ==========
  
  // Get VAT configurations for a store
  app.get("/api/stores/:storeId/vat-configurations", isAuthenticated, async (req, res) => {
    try {
      const storeId = parseInt(req.params.storeId);
      if (isNaN(storeId)) {
        return res.status(400).json({ message: "Invalid store ID" });
      }
      
      const configs = await storage.getVatConfigurations(storeId);
      res.json(configs);
    } catch (error) {
      console.error("Error fetching VAT configurations:", error);
      res.status(500).json({ message: "Failed to fetch VAT configurations", error });
    }
  });

  // Alternative endpoint that matches the VATCalculator hook
  app.get("/api/vat-configurations", isAuthenticated, async (req, res) => {
    try {
      const storeId = parseInt(req.query.storeId as string);
      if (isNaN(storeId)) {
        return res.status(400).json({ message: "Invalid store ID parameter" });
      }
      
      const configs = await storage.getVatConfigurations(storeId);
      res.json(configs);
    } catch (error) {
      console.error("Error fetching VAT configurations:", error);
      res.status(500).json({ message: "Failed to fetch VAT configurations", error });
    }
  });

  // Create VAT configuration
  app.post("/api/vat-configurations", isAuthenticated, requireRole([USER_ROLES.ADMIN, USER_ROLES.MANAGER]), async (req, res) => {
    try {
      const configData = req.body;
      const config = await storage.createVatConfiguration(configData);
      res.status(201).json(config);
    } catch (error) {
      res.status(400).json({ message: "Failed to create VAT configuration", error });
    }
  });

  // Update VAT configuration
  app.patch("/api/vat-configurations/:id", isAuthenticated, requireRole([USER_ROLES.ADMIN, USER_ROLES.MANAGER]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid configuration ID" });
      }
      
      const config = await storage.updateVatConfiguration(id, req.body);
      if (!config) {
        return res.status(404).json({ message: "VAT configuration not found" });
      }
      res.json(config);
    } catch (error) {
      res.status(400).json({ message: "Failed to update VAT configuration", error });
    }
  });

  // Delete VAT configuration
  app.delete("/api/vat-configurations/:id", isAuthenticated, requireRole([USER_ROLES.ADMIN, USER_ROLES.MANAGER]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid configuration ID" });
      }
      
      const deleted = await storage.deleteVatConfiguration(id);
      if (!deleted) {
        return res.status(404).json({ message: "VAT configuration not found" });
      }
      res.json({ message: "VAT configuration deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete VAT configuration", error });
    }
  });

  // Calculate VAT for items
  app.post("/api/vat/calculate", isAuthenticated, async (req, res) => {
    try {
      const { items, storeId } = req.body;
      if (!items || !Array.isArray(items) || !storeId) {
        return res.status(400).json({ message: "Items array and storeId are required" });
      }
      
      const vatCalculation = await storage.calculateVAT(items, storeId);
      res.json(vatCalculation);
    } catch (error) {
      res.status(500).json({ message: "Failed to calculate VAT", error });
    }
  });

  // ========== CURRENCY MANAGEMENT ROUTES ==========
  
  // Get all currency rates
  app.get("/api/currency-rates", isAuthenticated, async (req, res) => {
    try {
      const rates = await storage.getCurrencyRates();
      res.json(rates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch currency rates", error });
    }
  });

  // Get specific currency rate
  app.get("/api/currency-rates/:from/:to", isAuthenticated, async (req, res) => {
    try {
      const { from, to } = req.params;
      const rate = await storage.getCurrencyRate(from.toUpperCase(), to.toUpperCase());
      if (!rate) {
        return res.status(404).json({ message: "Currency rate not found" });
      }
      res.json(rate);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch currency rate", error });
    }
  });

  // Create currency rate
  app.post("/api/currency-rates", isAuthenticated, requireRole([USER_ROLES.ADMIN, USER_ROLES.MANAGER]), async (req, res) => {
    try {
      const rateData = req.body;
      const rate = await storage.createCurrencyRate(rateData);
      res.status(201).json(rate);
    } catch (error) {
      res.status(400).json({ message: "Failed to create currency rate", error });
    }
  });

  // Update currency rate
  app.patch("/api/currency-rates/:id", isAuthenticated, requireRole([USER_ROLES.ADMIN, USER_ROLES.MANAGER]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid rate ID" });
      }
      
      const rate = await storage.updateCurrencyRate(id, req.body);
      if (!rate) {
        return res.status(404).json({ message: "Currency rate not found" });
      }
      res.json(rate);
    } catch (error) {
      res.status(400).json({ message: "Failed to update currency rate", error });
    }
  });

  // Convert currency
  app.post("/api/currency/convert", isAuthenticated, async (req, res) => {
    try {
      const { amount, fromCurrency, toCurrency } = req.body;
      if (!amount || !fromCurrency || !toCurrency) {
        return res.status(400).json({ message: "Amount, fromCurrency, and toCurrency are required" });
      }
      
      const convertedAmount = await storage.convertCurrency(amount, fromCurrency.toUpperCase(), toCurrency.toUpperCase());
      res.json({ 
        originalAmount: amount,
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        convertedAmount 
      });
    } catch (error) {
      res.status(400).json({ message: "Failed to convert currency", error: error instanceof Error ? error.message : String(error) });
    }
  });
  // ========== CURRENCY MANAGEMENT ROUTES ==========
  
  // Get all currency rates
  app.get("/api/currency-rates", isAuthenticated, async (req, res) => {
    try {
      const rates = await storage.getCurrencyRates();
      res.json(rates);
    } catch (error) {
      console.error('Error fetching currency rates:', error);
      res.status(500).json({ message: "Failed to fetch currency rates", error });
    }
  });

  // Get specific currency rate
  app.get("/api/currency-rates/:from/:to", isAuthenticated, async (req, res) => {
    try {
      const { from, to } = req.params;
      const rate = await storage.getCurrencyRate(from, to);
      if (!rate) {
        return res.status(404).json({ message: "Currency rate not found" });
      }
      res.json(rate);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch currency rate", error });
    }
  });

  // Create currency rate
  app.post("/api/currency-rates", isAuthenticated, requireRole([USER_ROLES.ADMIN, USER_ROLES.MANAGER]), async (req, res) => {
    try {
      const rateData = req.body;
      const rate = await storage.createCurrencyRate(rateData);
      res.status(201).json(rate);
    } catch (error) {
      res.status(400).json({ message: "Failed to create currency rate", error });
    }
  });

  // Update currency rate
  app.patch("/api/currency-rates/:id", isAuthenticated, requireRole([USER_ROLES.ADMIN, USER_ROLES.MANAGER]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid rate ID" });
      }
      
      const rate = await storage.updateCurrencyRate(id, req.body);
      if (!rate) {
        return res.status(404).json({ message: "Currency rate not found" });
      }
      res.json(rate);
    } catch (error) {
      res.status(400).json({ message: "Failed to update currency rate", error });
    }
  });

  // Convert currency amounts
  app.post("/api/currency/convert", isAuthenticated, async (req, res) => {
    try {
      const { amount, fromCurrency, toCurrency } = req.body;
      const convertedAmount = await storage.convertCurrency(amount, fromCurrency, toCurrency);
      res.json({ 
        originalAmount: amount, 
        convertedAmount, 
        fromCurrency, 
        toCurrency 
      });
    } catch (error) {
      res.status(400).json({ message: "Failed to convert currency", error });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
