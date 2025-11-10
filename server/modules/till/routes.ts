import type { Express } from "express";
import {
  insertDayOperationSchema,
  insertShiftSchema,
  insertDailyProductMonitoringSchema,
  USER_ROLES,
  type DayOperation
} from "@shared/schema";
import { storage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { requireRole } from "../shared/authorization";

export function registerTillRoutes(app: Express) {
  const parseStoreId = (value: unknown): number | undefined => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return undefined;
    }

    return parsed;
  };

  // Day Operations
  app.get("/api/day-operations/current", isAuthenticated, async (req, res) => {
    try {
      const storeId = parseStoreId(req.query.storeId);
      const dayOperation = await storage.getCurrentDayOperation(storeId);
      res.json(dayOperation);
    } catch (error) {
      console.error("Current day operation error:", error);
      res.status(500).json({ message: "Failed to get current day operation", error });
    }
  });

  app.get("/api/day-operations/open", isAuthenticated, async (req, res) => {
    try {
      const storeId = parseStoreId(req.query.storeId);
      const dayOperation = await storage.getOpenDayOperation(storeId);
      res.json(dayOperation);
    } catch (error) {
      console.error("Open day operation error:", error);
      res.status(500).json({ message: "Failed to get open day operation", error });
    }
  });

  app.get("/api/day-operations/date/:date", isAuthenticated, async (req, res) => {
    try {
      const date = req.params.date;
      const storeId = parseStoreId(req.query.storeId);
      const dayOperation = await storage.getDayOperationByDate(date, storeId);
      res.json(dayOperation);
    } catch (error) {
      res.status(500).json({ message: "Failed to get day operation", error });
    }
  });

  app.get("/api/day-operations/status/:date", isAuthenticated, async (req, res) => {
    try {
      const date = req.params.date;
      const storeId = parseStoreId(req.query.storeId);
      const dayOperation = await storage.getDayOperationByDate(date, storeId);

      if (!dayOperation) {
        return res.json({
          status: "not_found",
          canOpen: true,
          canClose: false,
          message: "Day has not been opened yet"
        });
      } else if (dayOperation.status === "open") {
        return res.json({
          status: "open",
          canOpen: false,
          canClose: true,
          message: "Day is currently open",
          dayOperation
        });
      } else if (dayOperation.status === "closed") {
        const isAdmin = req.user?.role === "admin";
        return res.json({
          status: "closed",
          canOpen: false,
          canClose: false,
          canReopen: isAdmin,
          message: "Day has been closed",
          dayOperation
        });
      }

      return res.json({
        status: "unknown",
        canOpen: false,
        canClose: false,
        message: "Unable to determine day status"
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get day operation status", error });
    }
  });

  app.get("/api/day-operations", isAuthenticated, async (req, res) => {
    try {
      const storeId = parseStoreId(req.query.storeId);
      const statusParam = typeof req.query.status === "string" ? req.query.status.toLowerCase() : undefined;
      const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
      const offsetParam = req.query.offset ? Number(req.query.offset) : undefined;
      const startDateParam = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
      const endDateParam = typeof req.query.endDate === "string" ? req.query.endDate : undefined;

      const allowedStatuses = new Set(["open", "closed", "reopened"]);
      const status = statusParam && allowedStatuses.has(statusParam) ? (statusParam as DayOperation["status"]) : undefined;

      const isValidDate = (value?: string) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined);

      const limit = Number.isFinite(limitParam ?? NaN) ? Math.min(Math.max(limitParam!, 1), 100) : undefined;
      const offset = Number.isFinite(offsetParam ?? NaN) ? Math.max(offsetParam!, 0) : undefined;
      const startDate = isValidDate(startDateParam);
      const endDate = isValidDate(endDateParam);

      if (startDate && endDate && startDate > endDate) {
        return res.status(400).json({ message: "startDate cannot be after endDate" });
      }

      const { data, total } = await storage.listDayOperations({
        storeId,
        status,
        limit,
        offset,
        startDate,
        endDate
      });

      res.json({
        data,
        total,
        limit: limit ?? 30,
        offset: offset ?? 0
      });
    } catch (error) {
      console.error("Failed to list day operations:", error);
      res.status(500).json({ message: "Failed to list day operations", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/day-operations/previous-closing-cash", isAuthenticated, async (req, res) => {
    try {
      const storeId = parseStoreId(req.query.storeId);
      const targetDate = req.query.date as string | undefined;

      if (targetDate) {
        const targetDateObj = new Date(targetDate);
        const previousDate = new Date(targetDateObj);
        previousDate.setDate(previousDate.getDate() - 1);
        const previousDateStr = previousDate.toISOString().split("T")[0];

        const previousDay = await storage.getDayOperationByDate(previousDateStr, storeId);
        const previousClosingCash = previousDay?.closingCash || "0.00";
        res.json({ previousClosingCash });
      } else {
        const lastClosedDay = await storage.getLastClosedDayOperation(storeId);
        const previousClosingCash = lastClosedDay?.closingCash || "0.00";
        res.json({ previousClosingCash });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to get previous closing cash", error });
    }
  });

  app.get("/api/day-operations/previous-balances", isAuthenticated, async (req, res) => {
    try {
      const storeId = parseStoreId(req.query.storeId);
      const targetDate = req.query.date as string | undefined;

      if (targetDate) {
        const targetDateObj = new Date(targetDate);
        const previousDate = new Date(targetDateObj);
        previousDate.setDate(previousDate.getDate() - 1);
        const previousDateStr = previousDate.toISOString().split("T")[0];

        const previousDay = await storage.getDayOperationByDate(previousDateStr, storeId);
        const previousClosingCash = previousDay?.closingCash || "0.00";
        const previousBankBalance = previousDay?.actualBankBalance || "0.00";

        res.json({
          previousClosingCash,
          previousBankBalance,
          previousDay: previousDay || null
        });
      } else {
        const lastClosedDay = await storage.getLastClosedDayOperation(storeId);
        const previousClosingCash = lastClosedDay?.closingCash || "0.00";
        const previousBankBalance = lastClosedDay?.actualBankBalance || "0.00";

        res.json({
          previousClosingCash,
          previousBankBalance,
          previousDay: lastClosedDay || null
        });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to get previous balances", error });
    }
  });

  app.post("/api/day-operations/open", isAuthenticated, async (req, res) => {
    try {
      console.log("📥 Received day open request body:", JSON.stringify(req.body, null, 2));
      const openingData = insertDayOperationSchema.parse(req.body);
      console.log("✅ Validated opening data:", JSON.stringify(openingData, null, 2));
      const storeId = openingData.storeId;

      // MULTI-STORE FIX: Check for open day per store, not globally
      const currentlyOpenDay = await storage.getOpenDayOperation(storeId);
      if (currentlyOpenDay) {
        return res.status(409).json({
          message: `A day is already open for ${currentlyOpenDay.date}. Please close it first before opening a new day.`,
          openDay: currentlyOpenDay
        });
      }

      // MULTI-STORE FIX: Check existing day for specific store
      const existingDay = await storage.getDayOperationByDate(openingData.date, storeId);
      if (existingDay) {
        if (existingDay.status === "open") {
          return res.status(409).json({
            message: "Day is already open for this date",
            dayOperation: existingDay
          });
        } else if (existingDay.status === "closed") {
          return res.status(409).json({
            message: "Day has already been closed for this date. Contact administrator to reopen.",
            dayOperation: existingDay
          });
        }
      }

      if (!openingData.openingCash || !openingData.openingBankBalance) {
        const targetDateObj = new Date(openingData.date);
        const previousDate = new Date(targetDateObj);
        previousDate.setDate(previousDate.getDate() - 1);
        const previousDateStr = previousDate.toISOString().split("T")[0];

        // MULTI-STORE FIX: Get previous day for specific store
        const previousDay = await storage.getDayOperationByDate(previousDateStr, storeId);

        if (!openingData.openingCash && previousDay?.closingCash) {
          openingData.openingCash = previousDay.closingCash;
        }

        if (!openingData.openingBankBalance && previousDay?.actualBankBalance) {
          openingData.openingBankBalance = previousDay.actualBankBalance;
        }
      }

      const dayOperation = await storage.createDayOperation(openingData);
      
      // AUTO-INITIALIZE PRODUCT MONITORING (Phase 2.2 Enhancement)
      try {
        const monitoring = await storage.initializeDailyProductMonitoring(dayOperation.id);
        console.log(`✅ Auto-initialized product monitoring for day ${dayOperation.id}:`, {
          dayOperationId: dayOperation.id,
          date: dayOperation.date,
          productsMonitored: Array.isArray(monitoring) ? monitoring.length : 0
        });
      } catch (monitoringError) {
        console.error("⚠️  Failed to auto-initialize product monitoring:", monitoringError);
        // Don't fail day open if monitoring initialization fails
        // Monitoring can be initialized manually later if needed
      }
      
      res.status(201).json(dayOperation);
    } catch (error) {
      console.error("❌ Day operation open error:", error);
      
      // Enhanced error logging for Zod validation errors
      if (error && typeof error === 'object' && 'issues' in error) {
        console.error("Zod validation issues:", JSON.stringify(error, null, 2));
      }
      
      res.status(400).json({
        message: "Invalid day operation data",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.patch("/api/day-operations/:id", isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid day operation ID" });
    }

    try {
      console.log("Day operation update data:", JSON.stringify(req.body, null, 2));

      const allowedFields = [
        "cashierId",
        "openingCash",
        "openingBankBalance",
        "totalSales",
        "cashSales",
        "cardSales",
        "creditSales",
        "splitSales",
        "cashPurchases",
        "cardPurchases",
        "bankPurchases",
        "totalTransactions",
        "cashTransactionCount",
        "cardTransactionCount",
        "creditTransactionCount",
        "splitTransactionCount",
        "expectedCash",
        "actualCashCount",
        "closingCash",
        "cashDifference",
        "expectedBankBalance",
        "actualBankBalance",
        "bankDifference",
        "cashCount_500",
        "cashCount_200",
        "cashCount_100",
        "cashCount_50",
        "cashCount_20",
        "cashCount_10",
        "cashCount_5",
        "cashCount_1",
        "cashCount_050",
        "cashCount_025",
        "ownerDeposits",
        "ownerWithdrawals",
        "ownerBankDeposits",
        "ownerBankWithdrawals",
        "expensePayments",
        "supplierPayments",
        "bankTransfers",
        "creditPaymentsCash",
        "creditPaymentsCard",
        "creditRefundsGiven",
        "posCardSwipeAmount",
        "cardSwipeVariance",
        "bankWithdrawals",
        "cashMiscAmount",
        "cardMiscAmount",
        "miscNotes",
        "openedAt",
        "closedAt",
        "status",
        "reconciliationNotes"
      ];

      const filteredData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(req.body)) {
        if (allowedFields.includes(key)) {
          if (
            typeof value === "string" &&
            !isNaN(Number(value)) &&
            [
              "totalSales",
              "cashSales",
              "cardSales",
              "creditSales",
              "splitSales",
              "expectedCash",
              "actualCashCount",
              "closingCash",
              "cashDifference",
              "cashMiscAmount",
              "cardMiscAmount",
              "openingCash",
              "openingBankBalance",
              "expectedBankBalance",
              "actualBankBalance",
              "bankDifference",
              "cashPurchases",
              "cardPurchases",
              "bankPurchases",
              "ownerDeposits",
              "ownerWithdrawals",
              "ownerBankDeposits",
              "ownerBankWithdrawals",
              "expensePayments",
              "supplierPayments",
              "bankTransfers",
              "creditPaymentsCash",
              "creditPaymentsCard",
              "creditRefundsGiven",
              "posCardSwipeAmount",
              "cardSwipeVariance",
              "bankWithdrawals"
            ].includes(key)
          ) {
            filteredData[key] = value;
          } else if (
            typeof value === "number" &&
            [
              "totalTransactions",
              "cashTransactionCount",
              "cardTransactionCount",
              "creditTransactionCount",
              "splitTransactionCount"
            ].includes(key)
          ) {
            filteredData[key] = value;
          } else if (key.startsWith("cashCount_") && typeof value === "number") {
            filteredData[key] = value;
          } else if (["status", "miscNotes", "reconciliationNotes"].includes(key)) {
            filteredData[key] = value;
          } else if (["openedAt", "closedAt"].includes(key)) {
            filteredData[key] = value;
          }
        }
      }

      const dayOperation = await storage.updateDayOperation(id, filteredData);
      if (!dayOperation) {
        return res.status(404).json({ message: "Day operation not found" });
      }

      res.json(dayOperation);
    } catch (error) {
      console.error("Day operation update error:", error);
      res.status(400).json({ message: "Invalid update data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch("/api/day-operations/:id/close", isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid day operation ID" });
    }

    try {
      console.log("Day Close Request Body Keys:", Object.keys(req.body));
      console.log("Day Close Data Sample:", {
        expectedCash: req.body.expectedCash,
        actualCashCount: req.body.actualCashCount,
        cashDifference: req.body.cashDifference,
        closingCash: req.body.closingCash
      });

      const closeData = insertDayOperationSchema.partial().parse(req.body);
      const updatedCloseData = {
        ...closeData,
        status: "closed" as const,
        closedAt: new Date().toISOString()
      };

      console.log("Parsed Close Data Sample:", {
        expectedCash: closeData.expectedCash,
        actualCashCount: closeData.actualCashCount,
        cashDifference: closeData.cashDifference,
        closingCash: closeData.closingCash
      });

      const dayOperation = await storage.updateDayOperation(id, updatedCloseData);
      if (!dayOperation) {
        return res.status(404).json({ message: "Day operation not found" });
      }

      res.json(dayOperation);
    } catch (error) {
      console.error("Day Close Error:", error);
      res.status(400).json({ message: "Invalid close data", error });
    }
  });

  app.patch(
    "/api/day-operations/:id/reopen",
    isAuthenticated,
    requireRole([USER_ROLES.ADMIN]),
    async (req, res) => {
      const id = parseInt(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid day operation ID" });
      }

      try {
        const dayOperation = await storage.getDayOperationById(id);
        if (!dayOperation) {
          return res.status(404).json({ message: "Day operation not found" });
        }

        if (dayOperation.status !== "closed") {
          return res.status(400).json({ message: "Day operation is not closed, cannot reopen" });
        }

        // Check for currently open day in the same store
        const currentlyOpenDay = await storage.getOpenDayOperation(dayOperation.storeId);
        if (currentlyOpenDay && currentlyOpenDay.id !== dayOperation.id) {
          return res.status(409).json({
            message: `Cannot reopen day. Day ${currentlyOpenDay.date} is currently open. Please close it first.`,
            conflictingDay: currentlyOpenDay.date
          });
        }

        const reopenData = {
          status: "open" as const,
          closedAt: null,
          reopenedAt: new Date().toISOString(),
          reopenedBy: req.user?.id
        };

        const updatedDayOperation = await storage.updateDayOperation(id, reopenData);
        if (!updatedDayOperation) {
          return res.status(500).json({ message: "Failed to update day operation" });
        }
        res.json(updatedDayOperation);
      } catch (error) {
        console.error("Day reopen error:", error);
        res.status(400).json({ message: "Failed to reopen day", error: error instanceof Error ? error.message : String(error) });
      }
    }
  );

  // Shift Management
  app.get("/api/shifts", isAuthenticated, async (req, res) => {
    try {
      const storeId = req.query.storeId ? parseInt(req.query.storeId as string) : undefined;
      const shifts = await storage.getActiveShifts(storeId);
      res.json(shifts);
    } catch (error) {
      console.error("Error fetching shifts:", error);
      res.status(500).json({ message: "Failed to fetch shifts", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/shifts", isAuthenticated, async (req, res) => {
    try {
      console.log("Shift creation request:", req.body);

      // Use userId from request body, or fall back to authenticated user's ID
      const userId = req.body.userId || req.body.cashierId || req.user?.id;
      
      if (!userId) {
        return res.status(400).json({ 
          message: "Failed to create shift", 
          error: "User ID is required. Please ensure you are logged in." 
        });
      }

      const transformedData = {
        ...req.body,
        userId: userId, // Ensure userId is set
        startTime: req.body.startTime ? new Date(req.body.startTime) : new Date(),
        startingCash: req.body.startingCash ? req.body.startingCash.toString() : "0.00"
      };

      const shiftData = insertShiftSchema.parse(transformedData);
      const shift = await storage.createShift(shiftData);
      res.status(201).json(shift);
    } catch (error) {
      console.error("Error creating shift:", error);
      console.error("Request body:", req.body);
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(400).json({ 
        message: "Failed to create shift", 
        error: errorMessage 
      });
    }
  });

  app.patch("/api/shifts/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid shift ID" });
      }

      const shiftData = req.body;
      const shift = await storage.updateShift(id, shiftData);

      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }

      res.json(shift);
    } catch (error) {
      console.error("Error updating shift:", error);
      res.status(400).json({ message: "Failed to update shift", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/shifts/:id/close", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid shift ID" });
      }

      const shift = await storage.closeShift(id);

      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }

      res.json(shift);
    } catch (error) {
      console.error("Error closing shift:", error);
      res.status(400).json({ message: "Failed to close shift", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Daily Product Monitoring
  app.get("/api/products/daily-monitoring", async (_req, res) => {
    try {
      const products = await storage.getProductsRequiringDailyMonitoring();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch daily monitoring products", error });
    }
  });

  app.patch("/api/products/:id/daily-monitoring", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const { requiresDailyMonitoring } = req.body;

      if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      if (typeof requiresDailyMonitoring !== "boolean") {
        return res.status(400).json({ message: "requiresDailyMonitoring must be a boolean" });
      }

      const product = await storage.updateProductDailyMonitoring(productId, requiresDailyMonitoring);
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to update daily monitoring flag", error });
    }
  });

  app.get("/api/daily-monitoring/:date", async (req, res) => {
    try {
      const date = req.params.date;
      const monitoring = await storage.getDailyProductMonitoring(date);
      res.json(monitoring);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch daily monitoring", error });
    }
  });

  app.get("/api/day-operations/:id/product-monitoring", async (req, res) => {
    try {
      const dayOperationId = parseInt(req.params.id);

      if (isNaN(dayOperationId)) {
        return res.status(400).json({ message: "Invalid day operation ID" });
      }

      const monitoring = await storage.getDailyProductMonitoringByDayOperation(dayOperationId);
      res.json(monitoring);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch day operation monitoring", error });
    }
  });

  app.post("/api/day-operations/:id/initialize-monitoring", async (req, res) => {
    try {
      const dayOperationId = parseInt(req.params.id);

      if (isNaN(dayOperationId)) {
        return res.status(400).json({ message: "Invalid day operation ID" });
      }

      const monitoring = await storage.initializeDailyProductMonitoring(dayOperationId);
      res.json(monitoring);
    } catch (error) {
      res.status(500).json({ message: "Failed to initialize daily monitoring", error });
    }
  });

  app.patch("/api/daily-monitoring/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid monitoring record ID" });
      }

      const updateData = insertDailyProductMonitoringSchema.partial().parse(req.body);
      const monitoring = await storage.updateDailyProductMonitoring(id, updateData);

      if (!monitoring) {
        return res.status(404).json({ message: "Monitoring record not found" });
      }

      res.json(monitoring);
    } catch (error) {
      res.status(400).json({ message: "Invalid monitoring data", error });
    }
  });

  app.post("/api/daily-monitoring/:id/reconcile", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { actualClosingStock, notes } = req.body;

      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid monitoring record ID" });
      }

      if (typeof actualClosingStock !== "number") {
        return res.status(400).json({ message: "actualClosingStock is required and must be a number" });
      }

      const monitoring = await storage.reconcileDailyProductMonitoring(id, actualClosingStock, notes, req.user?.id);
      res.json(monitoring);
    } catch (error) {
      res.status(500).json({ message: "Failed to reconcile monitoring", error });
    }
  });
}
