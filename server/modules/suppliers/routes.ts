import type { Express } from "express";
import * as XLSX from "xlsx";
import fs from "fs";
import { eq } from "drizzle-orm";
import {
  insertSupplierSchema,
  insertSupplierInvoiceSchema,
  insertSupplierInvoiceItemSchema,
  insertStockAdjustmentSchema,
  USER_ROLES,
  suppliers,
  supplierInvoices,
  supplierInvoiceItems,
  supplierPayments
} from "@shared/schema";
import { storage } from "../../storage";
import { db } from "../../db";
import { isAuthenticated } from "../../auth";
import { requireRole } from "../shared/authorization";
import { upload, dataFileUpload } from "../shared/upload";
import { extractInvoiceData, matchProductsWithAI } from "../../openai-service";

export function registerSupplierRoutes(app: Express) {
  // Supplier management
  app.get("/api/suppliers", async (_req, res) => {
    try {
      const suppliers = await storage.getSuppliers();
      res.json(suppliers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch suppliers", error });
    }
  });

  app.post("/api/suppliers", async (req, res) => {
    try {
      const supplierData = insertSupplierSchema.parse(req.body);
      const supplier = await storage.createSupplier(supplierData);
      res.status(201).json(supplier);
    } catch (error) {
      res.status(400).json({ message: "Invalid supplier data", error });
    }
  });

  app.get("/api/suppliers/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ message: "Query parameter 'q' is required" });
      }
      const suppliers = await storage.searchSuppliers(query);
      res.json(suppliers);
    } catch (error) {
      res.status(500).json({ message: "Failed to search suppliers", error });
    }
  });

  app.patch("/api/suppliers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid supplier ID" });
      }

      const supplierData = insertSupplierSchema.partial().parse(req.body);
      const supplier = await storage.updateSupplier(id, supplierData);

      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }

      res.json(supplier);
    } catch (error) {
      res.status(400).json({ message: "Invalid supplier data", error });
    }
  });

  app.post("/api/suppliers/parse-upload", dataFileUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const filePath = req.file.path;
      let suppliers: any[] = [];

      try {
        // Read file as buffer for better compatibility with ES modules
        const fileBuffer = fs.readFileSync(filePath);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        console.log("📊 Raw data rows:", rawData.length);
        console.log("📊 First row (headers):", rawData[0]);

        if (rawData.length < 2) {
          return res.status(400).json({ message: "File must contain header row and at least one data row" });
        }

        const headers = (rawData[0] as string[]).map((h) => h?.toString().toLowerCase().trim() || "");
        console.log("📊 Processed headers:", headers);
        
        const nameIndex = headers.findIndex((h) => h.includes("name") && !h.includes("contact"));
        const contactPersonIndex = headers.findIndex((h) => h.includes("contact") && h.includes("person"));
        const emailIndex = headers.findIndex((h) => h.includes("email"));
        const phoneIndex = headers.findIndex((h) => h.includes("phone") || h.includes("mobile"));
        const addressIndex = headers.findIndex((h) => h.includes("address"));
        const notesIndex = headers.findIndex((h) => h.includes("notes") || h.includes("note"));

        console.log("📊 Column indices:", { nameIndex, contactPersonIndex, emailIndex, phoneIndex, addressIndex, notesIndex });

        if (nameIndex === -1 || contactPersonIndex === -1 || emailIndex === -1 || phoneIndex === -1) {
          return res.status(400).json({
            message: `Required columns missing. File must contain: Name, Contact Person, Email, Phone columns. Found: ${headers.join(", ")}`,
            foundColumns: headers,
            missingColumns: [
              nameIndex === -1 ? "Name" : null,
              contactPersonIndex === -1 ? "Contact Person" : null,
              emailIndex === -1 ? "Email" : null,
              phoneIndex === -1 ? "Phone" : null
            ].filter(Boolean)
          });
        }

        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i] as any[];
          if (!row || row.length === 0) continue;

          const name = row[nameIndex]?.toString()?.trim();
          const contactPerson = row[contactPersonIndex]?.toString()?.trim();
          const email = row[emailIndex]?.toString()?.trim();
          const phone = row[phoneIndex]?.toString()?.trim();

          if (!name || !contactPerson || !email || !phone) continue;

          const supplier = {
            name,
            contactPerson,
            email,
            phone,
            address: addressIndex !== -1 ? row[addressIndex]?.toString()?.trim() || "" : "",
            notes: notesIndex !== -1 ? row[notesIndex]?.toString()?.trim() || "" : ""
          };

          suppliers.push(supplier);
        }

        res.json({ suppliers, count: suppliers.length });
      } catch (parseError) {
        console.error("File parsing error:", parseError);
        return res.status(400).json({ message: "Failed to parse file. Please check the format." });
      } finally {
        try {
          fs.unlinkSync(filePath);
        } catch (cleanupError) {
          console.error("Cleanup error:", cleanupError);
        }
      }
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Supplier invoices and payments
  app.get("/api/supplier-invoices", async (_req, res) => {
    try {
      const invoices = await storage.getSupplierInvoices();
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoices", error });
    }
  });

  app.get("/api/suppliers/:id/invoices", async (req, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      if (isNaN(supplierId)) {
        return res.status(400).json({ message: "Invalid supplier ID" });
      }

      const invoices = await storage.getSupplierInvoicesBySupplier(supplierId);
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch supplier invoices", error });
    }
  });

  app.get("/api/supplier-invoices/:id/payments", async (req, res) => {
    try {
      const invoiceId = parseInt(req.params.id);
      if (isNaN(invoiceId)) {
        return res.status(400).json({ message: "Invalid invoice ID" });
      }

      const payments = await storage.getSupplierPaymentsByInvoice(invoiceId);
      res.json(payments);
    } catch (error) {
      res.status(500).json({
        message: "Failed to fetch payments",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post("/api/supplier-invoices/:id/payments", async (req, res) => {
    try {
      const invoiceId = parseInt(req.params.id);
      if (isNaN(invoiceId)) {
        return res.status(400).json({ message: "Invalid invoice ID" });
      }

      const { amount, paymentMethod, reference, paymentDate, notes } = req.body;

      const transformedPaymentData = {
        invoiceId,
        amount,
        paymentMethod,
        reference,
        paymentDate: new Date(paymentDate),
        notes
      };

      const payment = await storage.createSupplierPayment(transformedPaymentData);

      const allPayments = await storage.getSupplierPaymentsByInvoice(invoiceId);
      const totalPaid = allPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

      const invoice = await storage.getSupplierInvoice(invoiceId);
      if (invoice) {
        const invoiceTotal = parseFloat(invoice.total);
        const newStatus = totalPaid >= invoiceTotal ? "paid" : "pending";

        if (newStatus !== invoice.status) {
          await storage.updateSupplierInvoice(invoiceId, { status: newStatus });
        }
      }

      res.status(201).json(payment);
    } catch (error) {
      res.status(400).json({
        message: "Failed to create payment",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/api/supplier-payments/date/:date", async (req, res) => {
    try {
      const date = req.params.date;
      const startDate = new Date(date + "T00:00:00.000Z");
      const endDate = new Date(date + "T23:59:59.999Z");

      const allPayments = await storage.getSupplierPayments();
      const datePayments = allPayments.filter((payment) => {
        const paymentDate = new Date(payment.paymentDate);
        return paymentDate >= startDate && paymentDate <= endDate;
      });

      const cashPayments = datePayments
        .filter((payment) => payment.paymentMethod === "cash")
        .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

      const cardPayments = datePayments
        .filter((payment) => payment.paymentMethod === "card")
        .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

      const totalPayments = cashPayments + cardPayments;

      res.json({
        payments: datePayments,
        totals: {
          cash: cashPayments,
          card: cardPayments,
          total: totalPayments
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get supplier payments for date", error });
    }
  });

  app.post("/api/supplier-invoices/scan", upload.single("invoice"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No invoice image provided" });
      }

      const { isReturn = false } = req.body;

      const fsModule = await import("fs");
      const imageBuffer = fsModule.readFileSync(req.file.path);
      const base64Image = imageBuffer.toString("base64");

      const extractedData = await extractInvoiceData(base64Image, isReturn === "true");
      const existingProducts = await storage.getProducts();
      const productMatches = await matchProductsWithAI(extractedData.items, existingProducts);

      // Don't delete the file - keep it for viewing and downloading
      // fsModule.unlinkSync(req.file.path);

      res.json({
        extractedData,
        productMatches,
        imageUrl: `/uploads/${req.file.filename}`
      });
    } catch (error) {
      console.error("Error processing scanned invoice:", error);
      res.status(500).json({
        message: "Failed to process invoice",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post("/api/supplier-invoices", async (req, res) => {
    try {
      console.log("Creating supplier invoice with data:", req.body);
      
      const { invoiceData, items, stockAdjustments } = req.body;

      // Validate that required data is present
      if (!invoiceData) {
        return res.status(400).json({ message: "Invoice data is required" });
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "At least one invoice item is required" });
      }

      // Check if supplier exists
      if (invoiceData.supplierId) {
        const supplier = await storage.getSupplier(invoiceData.supplierId);
        if (!supplier) {
          return res.status(400).json({ message: "Invalid supplier ID" });
        }
      }

      // Check for duplicate invoice number
      if (invoiceData.invoiceNumber) {
        const existingInvoice = await storage.getSupplierInvoiceByNumber(invoiceData.invoiceNumber);
        if (existingInvoice) {
          // Generate a suggested alternative invoice number
          const timestamp = Date.now();
          const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
          const suggestedNumber = `${invoiceData.type?.toUpperCase() || 'INV'}-${timestamp}-${random}`;
          
          return res.status(400).json({ 
            message: "Invoice number already exists",
            suggestedInvoiceNumber: suggestedNumber
          });
        }
      }

      const transformedInvoiceData = {
        supplierId: invoiceData?.supplierId || null,
        invoiceNumber: invoiceData?.invoiceNumber || `INV-${Date.now()}`,
        invoiceDate: invoiceData?.invoiceDate ? new Date(invoiceData.invoiceDate) : new Date(),
        dueDate: invoiceData?.dueDate ? new Date(invoiceData.dueDate) : new Date(),
        subtotal: invoiceData?.subtotal?.toString() || "0.00",
        tax: invoiceData?.tax?.toString() || "0.00",
        total: invoiceData?.total?.toString() || "0.00",
        status: invoiceData?.status || "pending",
        type: invoiceData?.type || "receipt",
        paymentStatus: invoiceData?.paymentStatus || "not_paid",
        processedAt: invoiceData?.processedAt ? new Date(invoiceData.processedAt) : new Date(),
        // Include customer fields
        crNo: invoiceData?.crNo || null,
        customerName: invoiceData?.customerName || null,
        customerPhone: invoiceData?.customerPhone || null,
        customerMobile: invoiceData?.customerMobile || null,
        customerEmail: invoiceData?.customerEmail || null,
        customerAddress: invoiceData?.customerAddress || null,
        salesmanName: invoiceData?.salesmanName || null,
        notes: invoiceData?.notes || null,
        invoiceImageUrl: invoiceData?.invoiceImageUrl || null,
        extractedText: invoiceData?.extractedText || null,
      };

      console.log("Transformed invoice data:", transformedInvoiceData);

      const validatedInvoice = insertSupplierInvoiceSchema.parse(transformedInvoiceData);
      const invoice = await storage.createSupplierInvoice(validatedInvoice);

      const createdItems = [];
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        try {
          const transformedItem = {
            invoiceId: invoice.id,
            productId: item.productId || null,
            srNo: item.srNo || (index + 1),
            productName: item.productName || "",
            itemCode: item.itemCode || "",
            barcode: item.barcode || "",
            quantity: parseInt(item.quantity) || 1,
            uom: item.uom || "pcs",
            unitCost: item.unitCost?.toString() || "0.00",
            totalCost: item.totalCost?.toString() || "0.00",
            sku: item.sku || null,
          };

          const validatedItem = insertSupplierInvoiceItemSchema.parse(transformedItem);
          const createdItem = await storage.createSupplierInvoiceItem(validatedItem);
          createdItems.push(createdItem);
        } catch (itemError) {
          console.error(`Error processing item ${index}:`, itemError);
          throw new Error(`Invalid data for item ${index + 1}: ${itemError instanceof Error ? itemError.message : String(itemError)}`);
        }
      }

      const createdAdjustments = [];
      if (stockAdjustments && stockAdjustments.length > 0) {
        for (const adjustment of stockAdjustments) {
          try {
            const validatedAdjustment = insertStockAdjustmentSchema.parse({
              ...adjustment,
              invoiceId: invoice.id
            });
            const createdAdjustment = await storage.createStockAdjustment(validatedAdjustment);
            createdAdjustments.push(createdAdjustment);

            // Update product stock
            const product = await storage.getProduct(adjustment.productId);
            if (product) {
              const newStock = (product.stock || 0) + adjustment.quantityChange;
              await storage.updateProduct(adjustment.productId, {
                stock: newStock,
                quantity: newStock
              });
            }
          } catch (adjustmentError) {
            console.error("Error processing stock adjustment:", adjustmentError);
            // Continue without failing the entire invoice
          }
        }
      }

      res.status(201).json({
        invoice,
        items: createdItems,
        stockAdjustments: createdAdjustments
      });
    } catch (error: any) {
      console.error("Error creating supplier invoice:", error);
      
      // Handle validation errors
      if (error.name === 'ZodError') {
        const errorMessages = error.errors?.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({ 
          message: "Validation error", 
          details: errorMessages 
        });
      }
      
      // Handle database constraint errors
      if (error.code === '23505') { // PostgreSQL unique violation
        return res.status(400).json({ message: "Invoice number already exists" });
      }
      
      if (error.code === '23503') { // PostgreSQL foreign key violation
        return res.status(400).json({ message: "Invalid supplier or product reference" });
      }
      
      const errorMessage = error.message || "Failed to create invoice";
      res.status(500).json({ message: errorMessage });
    }
  });

  app.patch("/api/supplier-invoices/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid invoice ID" });
      }

      console.log("=== UPDATING INVOICE ===");
      console.log("Invoice ID:", id);
      console.log("Request body:", JSON.stringify(req.body, null, 2));

      // Parse and validate the update data
      const updateData = insertSupplierInvoiceSchema.partial().parse(req.body);
      
      // Convert date strings to Date objects for Drizzle ORM
      if (updateData.invoiceDate && typeof updateData.invoiceDate === 'string') {
        updateData.invoiceDate = new Date(updateData.invoiceDate);
      }
      if (updateData.dueDate && typeof updateData.dueDate === 'string') {
        updateData.dueDate = new Date(updateData.dueDate);
      }
      if (updateData.processedAt && typeof updateData.processedAt === 'string') {
        updateData.processedAt = new Date(updateData.processedAt);
      }
      
      console.log("Parsed update data:", JSON.stringify(updateData, null, 2));

      const invoice = await storage.updateSupplierInvoice(id, updateData);

      if (!invoice) {
        console.error("Invoice not found:", id);
        return res.status(404).json({ message: "Invoice not found" });
      }

      console.log("Invoice updated successfully:", invoice.id);
      res.json(invoice);
    } catch (error: any) {
      console.error("=== ERROR UPDATING INVOICE ===");
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      console.error("Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      
      // Return detailed error message for validation errors
      if (error.name === 'ZodError') {
        console.error("Zod validation errors:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ 
          message: "Invalid data format", 
          errors: error.errors,
          details: error.message 
        });
      }
      
      // Check for database constraint errors
      if (error.code === '23505' || error.message?.includes('unique constraint')) {
        return res.status(400).json({ 
          message: "Invoice number already exists", 
          error: "An invoice with this number already exists in the system"
        });
      }
      
      res.status(400).json({ 
        message: "Failed to update invoice", 
        error: error.message || String(error),
        code: error.code,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  app.get("/api/supplier-invoices/:id/items", async (req, res) => {
    try {
      const invoiceId = parseInt(req.params.id);
      if (isNaN(invoiceId)) {
        return res.status(400).json({ message: "Invalid invoice ID" });
      }

      const items = await storage.getSupplierInvoiceItems(invoiceId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoice items", error });
    }
  });

  // Delete supplier invoice
  app.delete("/api/supplier-invoices/:id", async (req, res) => {
    try {
      console.log("DELETE request received for invoice ID:", req.params.id);
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        console.error("Invalid invoice ID:", req.params.id);
        return res.status(400).json({ message: "Invalid invoice ID" });
      }
      
      console.log("Checking if invoice exists:", id);
      // First, check if invoice exists
      const invoice = await db.select().from(supplierInvoices).where(eq(supplierInvoices.id, id)).limit(1);
      if (!invoice || invoice.length === 0) {
        console.error("Invoice not found:", id);
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      console.log("Invoice found, deleting payments...");
      // Delete payments first (foreign key constraint)
      await db.delete(supplierPayments).where(eq(supplierPayments.invoiceId, id));
      
      console.log("Payments deleted, deleting items...");
      // Delete invoice items
      await db.delete(supplierInvoiceItems).where(eq(supplierInvoiceItems.invoiceId, id));
      
      console.log("Items deleted, deleting invoice...");
      // Delete the invoice
      await db.delete(supplierInvoices).where(eq(supplierInvoices.id, id));
      
      console.log("Invoice deleted successfully:", id);
      res.json({ success: true, message: "Invoice deleted successfully" });
    } catch (error) {
      console.error("Delete invoice error:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to delete invoice", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Delete supplier
  app.delete("/api/suppliers/:id", async (req, res) => {
    try {
      console.log("DELETE request received for supplier ID:", req.params.id);
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        console.error("Invalid supplier ID:", req.params.id);
        return res.status(400).json({ message: "Invalid supplier ID" });
      }
      
      console.log("Checking if supplier exists:", id);
      // First, check if supplier exists
      const supplier = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
      if (!supplier || supplier.length === 0) {
        console.error("Supplier not found:", id);
        return res.status(404).json({ message: "Supplier not found" });
      }
      
      console.log("Supplier found, deleting...");
      // Delete the supplier
      await db.delete(suppliers).where(eq(suppliers.id, id));
      
      console.log("Supplier deleted successfully:", id);
      res.json({ success: true, message: "Supplier deleted successfully" });
    } catch (error) {
      console.error("Delete supplier error:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to delete supplier", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
}
