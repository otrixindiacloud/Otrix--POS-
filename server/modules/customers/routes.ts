import type { Express } from "express";
import { insertCustomerSchema, USER_ROLES } from "@shared/schema";
import * as XLSX from "xlsx";
import fs from "fs";
import { storage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { requireRole } from "../shared/authorization";
import { upload, dataFileUpload } from "../shared/upload";

export function registerCustomerRoutes(app: Express) {
  app.get("/api/customers", async (req, res) => {
    try {
      const storeId = req.query.storeId ? parseInt(req.query.storeId as string) : undefined;
      
      if (storeId) {
        console.log(`[Customers API] Fetching customers for store ${storeId}`);
        // Get customers who have made transactions at this store
        const customers = await storage.getCustomersByStore(storeId);
        console.log(`[Customers API] Found ${customers.length} customers for store ${storeId}`);
        res.json(customers);
      } else {
        // No store filter - return all customers (backwards compatibility)
        console.log('[Customers API] Fetching all customers (no store filter)');
        const customers = await storage.getCustomers();
        res.json(customers);
      }
    } catch (error) {
      console.error('[Customers API] Error:', error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/search", async (req, res) => {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ message: "Query parameter 'q' is required" });
    }
    const customers = await storage.searchCustomers(query);
    res.json(customers);
  });

  app.get("/api/customers/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid customer ID" });
    }
    const customer = await storage.getCustomer(id);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }
    res.json(customer);
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const customerData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(customerData);
      res.status(201).json(customer);
    } catch (error) {
      res.status(400).json({ message: "Invalid customer data", error });
    }
  });

  app.put("/api/customers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid customer ID" });
      }
      const customerData = insertCustomerSchema.partial().parse(req.body);
      const customer = await storage.updateCustomer(id, customerData);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(400).json({ message: "Invalid customer data", error });
    }
  });

  app.patch("/api/customers/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid customer ID" });
    }
    try {
      const updateData = insertCustomerSchema.partial().parse(req.body);
      const customer = await storage.updateCustomer(id, updateData);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(400).json({ message: "Invalid update data", error });
    }
  });

  app.delete("/api/customers/:id", isAuthenticated, requireRole([USER_ROLES.ADMIN, USER_ROLES.MANAGER]), async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid customer ID" });
    }
    try {
      const success = await storage.deleteCustomer(id);
      if (!success) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json({ message: "Customer deleted successfully" });
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ message: "Failed to delete customer", error });
    }
  });

  app.post("/api/customers/parse-upload", dataFileUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const filePath = req.file.path;
      let customers: any[] = [];

      try {
        // Read file as buffer for better compatibility with ES modules
        const fileBuffer = fs.readFileSync(filePath);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (rawData.length < 2) {
          return res.status(400).json({ message: "File must contain header row and at least one data row" });
        }

        const headers = (rawData[0] as string[]).map((header) => header.toLowerCase().trim());
        const nameIndex = headers.findIndex((header) => header.includes("name"));
        const emailIndex = headers.findIndex((header) => header.includes("email"));
        const phoneIndex = headers.findIndex((header) => header.includes("phone") || header.includes("mobile"));
        const addressIndex = headers.findIndex((header) => header.includes("address"));
        const creditLimitIndex = headers.findIndex((header) => header.includes("credit") && header.includes("limit"));
        const notesIndex = headers.findIndex((header) => header.includes("notes") || header.includes("note"));

        if (nameIndex === -1 || emailIndex === -1 || phoneIndex === -1) {
          return res.status(400).json({
            message: "Required columns missing. File must contain: Name, Email, Phone columns",
          });
        }

        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i] as any[];
          if (!row || row.length === 0) continue;

          const name = row[nameIndex]?.toString()?.trim();
          const email = row[emailIndex]?.toString()?.trim();
          const phone = row[phoneIndex]?.toString()?.trim();

          if (!name || !email || !phone) continue;

          const customer = {
            name,
            email,
            phone,
            address: addressIndex !== -1 ? row[addressIndex]?.toString()?.trim() || "" : "",
            creditLimit: creditLimitIndex !== -1 ? row[creditLimitIndex]?.toString()?.trim() || "0.00" : "0.00",
            notes: notesIndex !== -1 ? row[notesIndex]?.toString()?.trim() || "" : "",
          };

          if (customer.creditLimit && !/^\d+(\.\d{1,2})?$/.test(customer.creditLimit)) {
            customer.creditLimit = "0.00";
          }

          customers.push(customer);
        }

        res.json({ customers, count: customers.length });
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

  // Customer authentication endpoints
  app.post("/api/customers/register", async (req, res) => {
    try {
      const { name, email, phone, password } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ message: "Name, email, and password are required" });
      }

      const existingCustomer = await storage.getCustomerByEmail(email);
      if (existingCustomer) {
        return res.status(409).json({ message: "Customer with this email already exists" });
      }

      const customer = await storage.createCustomer({ name, email, phone });

      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.default.hash(password, 10);

      await storage.createCustomerAuth({
        customerId: customer.id,
        passwordHash: hashedPassword,
        isActive: true
      });

      res.status(201).json({
        customer: { id: customer.id, name: customer.name, email: customer.email },
        message: "Customer registered successfully"
      });
    } catch (error) {
      res.status(400).json({ message: "Failed to register customer", error });
    }
  });

  app.post("/api/customers/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const result = await storage.authenticateCustomer(email, password);
      if (!result) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      res.json({
        customer: {
          id: result.customer.id,
          name: result.customer.name,
          email: result.customer.email
        },
        message: "Login successful"
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to authenticate customer", error });
    }
  });

  app.post("/api/customers/reset-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const resetToken = await storage.resetCustomerPassword(email);
      if (!resetToken) {
        return res.status(404).json({ message: "Customer not found" });
      }

      res.json({
        message: "Password reset token generated",
        resetToken
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to reset password", error });
    }
  });

  app.post("/api/customers/update-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Reset token and new password are required" });
      }

      const success = await storage.updateCustomerPassword(token, newPassword);
      if (!success) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update password", error });
    }
  });
}
