import type { Express } from "express";
import { upload } from "../shared/upload";
import { storage } from "../../storage";
import { generateProductRecommendations } from "../../openai-service";

export function registerAiRoutes(app: Express) {
  app.post("/api/scan/ai", upload.single("image"), async (req, res) => {
    try {
      const type = req.body.type;

      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (type === "barcode") {
        const mockBarcode = "123456789012";
        const product = await storage.getProductByBarcode(mockBarcode);
        if (product) {
          res.json({ success: true, type: "product", data: product });
        } else {
          res.json({ success: false, message: "Product not found for detected barcode" });
        }
      } else if (type === "product") {
        const products = await storage.getProducts();
        const randomProduct = products[Math.floor(Math.random() * products.length)];
        res.json({ success: true, type: "product", data: randomProduct });
      } else if (type === "invoice") {
        res.json({
          success: true,
          type: "invoice",
          data: {
            items: [
              { sku: "WE-PRO-001", quantity: 10, cost: "45.00" },
              { sku: "WM-001", quantity: 25, cost: "12.00" },
            ],
            supplier: "Tech Wholesale Co.",
            total: "750.00",
          },
        });
      } else {
        res.status(400).json({ message: "Invalid scan type" });
      }
    } catch (error) {
      res.status(500).json({ message: "AI scanning failed", error });
    }
  });

  app.post("/api/ai/recommendations", async (req, res) => {
    try {
      const { customerId, cartItems } = req.body;
      const recommendations = await generateProductRecommendations(customerId, cartItems);
      res.json(recommendations);
    } catch (error) {
      console.error("Error generating recommendations:", error);
      res.status(500).json({ message: "Failed to generate recommendations" });
    }
  });

  app.post("/api/ai/reports/generate", async (req, res) => {
    try {
      const { query } = req.body;

      if (!query || typeof query !== "string") {
        return res.status(400).json({ message: "Query is required" });
      }

      console.log(`📊 Generating AI report for query: "${query}"`);

      const { generateDynamicReport } = await import("../../ai-reports-service");
      const report = await generateDynamicReport(query);
      
      console.log(`✅ AI report generated successfully: ${report.data.length} rows`);
      res.json(report);
    } catch (error) {
      console.error("❌ Error generating AI report:", error);
      
      // Check if this is an API key configuration error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isApiKeyError = errorMessage.includes('OpenAI API key') || 
                           errorMessage.includes('API key is required') ||
                           errorMessage.includes('Invalid API key') ||
                           errorMessage.includes('Unauthorized');
      
      // Check if it's a rate limit or quota error
      const isRateLimitError = errorMessage.includes('rate limit') || 
                              errorMessage.includes('429') ||
                              errorMessage.includes('quota') ||
                              errorMessage.includes('billing');
      
      // Return 400 for configuration errors, 429 for rate limits, 500 for actual server errors
      const statusCode = isApiKeyError ? 400 : isRateLimitError ? 429 : 500;
      
      res.status(statusCode).json({
        message: isApiKeyError 
          ? "OpenAI API key configuration error. Please check your environment variables."
          : isRateLimitError
          ? "OpenAI API rate limit exceeded. Please try again later."
          : "Failed to generate report",
        error: errorMessage,
      });
    }
  });

  app.get("/api/ai/reports/templates", async (_req, res) => {
    try {
      const { reportTemplates } = await import("../../ai-reports-service");
      res.json(reportTemplates);
    } catch (error) {
      console.error("Error fetching report templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });
}
