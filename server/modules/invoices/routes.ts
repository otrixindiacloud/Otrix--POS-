import type { Express } from "express";
import { storage } from "../../storage";
import { generateInvoiceForTransaction } from "./service";

export function registerInvoiceRoutes(app: Express) {
  app.post("/api/transactions/:id/generate-invoice", async (req, res) => {
    const transactionId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(transactionId) || transactionId <= 0) {
      return res.status(400).json({ message: "Invalid transaction ID" });
    }

    try {
      const transaction = await storage.getTransaction(transactionId);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      const transactionItems = await storage.getTransactionItems(transactionId);
      const { shareVia } = req.body as { shareVia?: string };

      const result = await generateInvoiceForTransaction({
        transaction,
        transactionItems,
        shareVia,
      });

      if (!result.generatedInvoice) {
        return res.status(500).json({
          message: "Failed to generate invoice",
          error:
            result.error instanceof Error
              ? result.error.message
              : result.error ?? "Unknown error",
        });
      }

      const responsePayload: Record<string, unknown> = {
        generatedInvoice: result.generatedInvoice,
        invoiceUrl: result.invoiceUrl,
        message: "Invoice generated successfully",
      };

      if (result.whatsappLink) {
        responsePayload.whatsappLink = result.whatsappLink;
      }

      res.json(responsePayload);
    } catch (error) {
      console.error("Invoice generation route error:", error);
      res.status(500).json({
        message: "Failed to generate invoice",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
