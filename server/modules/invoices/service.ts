import type {
  GeneratedInvoice,
  GeneratedInvoiceItem,
  InsertGeneratedInvoice,
  Transaction,
  TransactionItem,
} from "@shared/schema";
import { storage } from "../../storage";
import { pdfService } from "../../pdf-service";

interface GenerateInvoiceParams {
  transaction: Transaction;
  transactionItems: TransactionItem[];
  shareVia?: string | null;
  forceWhatsappLink?: boolean;
}

interface GenerateInvoiceResult {
  generatedInvoice: GeneratedInvoice | null;
  invoiceUrl: string | null;
  whatsappLink: string | null;
  error?: unknown;
}

const DEFAULT_DISCOUNT = "0.00";

export async function generateInvoiceForTransaction(
  params: GenerateInvoiceParams
): Promise<GenerateInvoiceResult> {
  const { transaction, transactionItems, shareVia, forceWhatsappLink } = params;

  try {
    const customer = transaction.customerId
      ? await storage.getCustomer(transaction.customerId)
      : null;
    const store = await storage.getStore(transaction.storeId);

    if (!store) {
      throw new Error("Store not found for invoice generation");
    }

    let generatedInvoice = await storage.getGeneratedInvoiceByNumber(
      transaction.transactionNumber
    );

    if (!generatedInvoice) {
      const invoicePayload: InsertGeneratedInvoice = {
        invoiceNumber: transaction.transactionNumber,
        transactionId: transaction.id,
        storeId: transaction.storeId,
        customerId: transaction.customerId,
        cashierId: transaction.cashierId,
        subtotal: transaction.subtotal,
        tax: transaction.tax || transaction.vatAmount, // Use tax or vatAmount
        discount: transaction.discountAmount || DEFAULT_DISCOUNT, // Use actual discount
        total: transaction.total,
        paymentMethod: transaction.paymentMethod || "cash",
        cashTendered: transaction.cashTendered,
        cardType: transaction.cardType,
        status: "generated",
      };

      generatedInvoice = await storage.createGeneratedInvoice(invoicePayload);

      if (transactionItems.length > 0) {
        for (const item of transactionItems) {
          if (!item.productId) continue;
          const product = await storage.getProduct(item.productId);

          await storage.createGeneratedInvoiceItem({
            invoiceId: generatedInvoice.id,
            productId: item.productId,
            productName: product?.name || "Unknown Product",
            sku: product?.sku || "",
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          });
        }
      }
    }

    let invoiceUrl = generatedInvoice.pdfUrl ?? null;

    if (!invoiceUrl) {
      try {
        const items: GeneratedInvoiceItem[] = await storage.getGeneratedInvoiceItems(
          generatedInvoice.id
        );

        const { filePath, url } = await pdfService.generateInvoicePDF({
          invoice: generatedInvoice,
          items,
          customer: customer ?? undefined,
          store,
          transaction,
        });

        await storage.updateGeneratedInvoice(generatedInvoice.id, {
          pdfFilePath: filePath,
          pdfUrl: url,
        });

        invoiceUrl = url;
      } catch (pdfError) {
        console.error("PDF generation error:", pdfError);
        return {
          generatedInvoice,
          invoiceUrl: null,
          whatsappLink: null,
          error: pdfError,
        };
      }
    }

  const shouldGenerateWhatsapp = Boolean(forceWhatsappLink) || shareVia === "whatsapp";
    const whatsappLink = invoiceUrl && shouldGenerateWhatsapp
      ? pdfService.generateWhatsAppLink(generatedInvoice, invoiceUrl)
      : null;

    return {
      generatedInvoice,
      invoiceUrl,
      whatsappLink,
    };
  } catch (error) {
    console.error("Invoice generation error:", error);
    return {
      generatedInvoice: null,
      invoiceUrl: null,
      whatsappLink: null,
      error,
    };
  }
}
