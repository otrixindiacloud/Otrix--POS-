import { and, desc, eq, sql } from "drizzle-orm";

import {
  InsertTransaction,
  InsertTransactionItem,
  Transaction,
  TransactionItem,
  transactionItems,
  transactions,
  products,
} from "@shared/schema";

import { db } from "../../db";
import * as productStorage from "../products/storage";

// Type for storage instance with updateStoreProductStock method
type StorageWithStoreProductStock = {
  updateStoreProductStock: (storeId: number, productId: number, quantity: number, operation: 'add' | 'subtract' | 'set') => Promise<any>;
};

export async function getTransactions(storeId?: number): Promise<Transaction[]> {
  if (storeId) {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.storeId, storeId))
      .orderBy(desc(transactions.createdAt));
  }

  return await db.select().from(transactions).orderBy(desc(transactions.createdAt));
}

export async function getTransaction(id: number): Promise<Transaction | undefined> {
  const [transaction] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id));

  return transaction || undefined;
}

export async function createTransaction(
  insertTransaction: InsertTransaction,
): Promise<Transaction> {
  const [transaction] = await db
    .insert(transactions)
    .values(insertTransaction)
    .returning();
  return transaction;
}

export async function updateTransaction(
  id: number,
  transaction: Partial<InsertTransaction>,
): Promise<Transaction | undefined> {
  const [updatedTransaction] = await db
    .update(transactions)
    .set(transaction)
    .where(eq(transactions.id, id))
    .returning();
  return updatedTransaction || undefined;
}

type RefundPayload = {
  reason: string;
  refundAmount: number;
  refundedBy: number;
  refundedAt: Date;
};

export async function refundTransaction(
  id: number,
  refundData: RefundPayload,
  storage?: StorageWithStoreProductStock,
): Promise<{
  success: boolean;
  message: string;
  refundedTransaction?: Transaction;
}> {
  try {
    const originalTransaction = await getTransaction(id);
    if (!originalTransaction) {
      return { success: false, message: "Transaction not found" };
    }

    if (originalTransaction.status === "refunded") {
      return { success: false, message: "Transaction already refunded" };
    }

    if (originalTransaction.status === "voided") {
      return { success: false, message: "Cannot refund a voided transaction" };
    }

    const totalAmount = parseFloat(originalTransaction.total);
    if (refundData.refundAmount > totalAmount) {
      return {
        success: false,
        message: "Refund amount cannot exceed transaction total",
      };
    }

    const [refundedTransaction] = await db
      .update(transactions)
      .set({
        status: "refunded",
        // Note: refundReason, refundAmount, refundedBy, refundedAt fields don't exist in schema
        // These would need to be added to the schema if needed
      })
      .where(eq(transactions.id, id))
      .returning();

    const items = await getTransactionItems(id);
    const storeId = originalTransaction.storeId;
    
    for (const item of items) {
      // Check if productId exists before fetching product
      if (!item.productId) continue;
      
      const product = await productStorage.getProduct(item.productId);
      if (!product) {
        continue;
      }

      // Update product stock and quantity
      const newStock = (product.stock || 0) + item.quantity;
      const newQuantity = (product.quantity || 0) + item.quantity;
      await productStorage.updateProduct(item.productId, { 
        stock: newStock,
        quantity: newQuantity
      });

      // Also update storeProductStock if storage is provided
      if (storage && storeId) {
        try {
          await storage.updateStoreProductStock(
            storeId,
            item.productId,
            item.quantity,
            'add'
          );
          console.log(`✅ Updated storeProductStock for product ${item.productId}: added ${item.quantity} units`);
        } catch (storeStockError) {
          console.error(`❌ Failed to update storeProductStock for product ${item.productId}:`, storeStockError);
          // Continue even if storeProductStock update fails
        }
      }
    }

    return {
      success: true,
      message: "Transaction refunded successfully",
      refundedTransaction,
    };
  } catch (error) {
    console.error("Error refunding transaction:", error);
    return { success: false, message: "Failed to process refund" };
  }
}

type VoidPayload = {
  reason: string;
  voidedBy: number;
  voidedAt: Date;
};

export async function voidTransaction(
  id: number,
  voidData: VoidPayload,
  storage?: StorageWithStoreProductStock,
): Promise<{
  success: boolean;
  message: string;
  voidedTransaction?: Transaction;
}> {
  try {
    const originalTransaction = await getTransaction(id);
    if (!originalTransaction) {
      return { success: false, message: "Transaction not found" };
    }

    if (originalTransaction.status === "voided") {
      return { success: false, message: "Transaction already voided" };
    }

    if (originalTransaction.status === "refunded") {
      return { success: false, message: "Cannot void a refunded transaction" };
    }

    // Check if createdAt exists before using it
    const transactionDate = originalTransaction.createdAt 
      ? new Date(originalTransaction.createdAt)
      : new Date();
    const now = new Date();
    const daysDifference = Math.floor(
      (now.getTime() - transactionDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysDifference > 0) {
      return {
        success: false,
        message: "Transactions older than 1 day cannot be voided, use refund instead",
      };
    }

    const [voidedTransaction] = await db
      .update(transactions)
      .set({
        status: "voided",
        // Note: voidReason, voidedBy, voidedAt fields don't exist in schema
        // These would need to be added to the schema if needed
      })
      .where(eq(transactions.id, id))
      .returning();

    const items = await getTransactionItems(id);
    const storeId = originalTransaction.storeId;
    
    for (const item of items) {
      // Check if productId exists before fetching product
      if (!item.productId) continue;
      
      const product = await productStorage.getProduct(item.productId);
      if (!product) {
        continue;
      }

      // Update product stock and quantity
      const newStock = (product.stock || 0) + item.quantity;
      const newQuantity = (product.quantity || 0) + item.quantity;
      await productStorage.updateProduct(item.productId, { 
        stock: newStock,
        quantity: newQuantity
      });

      // Also update storeProductStock if storage is provided
      if (storage && storeId) {
        try {
          await storage.updateStoreProductStock(
            storeId,
            item.productId,
            item.quantity,
            'add'
          );
          console.log(`✅ Updated storeProductStock for product ${item.productId}: added ${item.quantity} units`);
        } catch (storeStockError) {
          console.error(`❌ Failed to update storeProductStock for product ${item.productId}:`, storeStockError);
          // Continue even if storeProductStock update fails
        }
      }
    }

    return {
      success: true,
      message: "Transaction voided successfully",
      voidedTransaction,
    };
  } catch (error) {
    console.error("Error voiding transaction:", error);
    return { success: false, message: "Failed to void transaction" };
  }
}

export async function getTransactionsByDate(
  date: string,
  storeId?: number,
): Promise<Transaction[]> {
  const whereConditions = [sql`DATE(${transactions.createdAt}) = ${date}`];

  if (storeId) {
    whereConditions.push(eq(transactions.storeId, storeId));
  }

  return await db
    .select()
    .from(transactions)
    .where(and(...whereConditions))
    .orderBy(desc(transactions.createdAt));
}

export async function generateTransactionNumber(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const maxRetries = 10;
  let attempts = 0;
  let baseSequence = 1;

  // Get the highest sequence number for today
  const result = await db
    .select({ transactionNumber: transactions.transactionNumber })
    .from(transactions)
    .where(sql`${transactions.transactionNumber} LIKE ${today + "%"}`)
    .orderBy(desc(transactions.transactionNumber))
    .limit(1);

  if (result.length > 0) {
    const lastNumber = result[0].transactionNumber;
    const lastSequence = parseInt(lastNumber.slice(-4));
    if (!isNaN(lastSequence)) {
      baseSequence = lastSequence + 1;
    }
  }

  // Try to find an available transaction number
  while (attempts < maxRetries) {
    const sequenceNumber = baseSequence + attempts;
    const finalNumber = String(sequenceNumber).padStart(4, "0");
    const transactionNumber = `${today}${finalNumber}`;

    // Verify the number doesn't already exist (double-check for race conditions)
    const existing = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.transactionNumber, transactionNumber))
      .limit(1);

    if (existing.length === 0) {
      return transactionNumber;
    }

    attempts++;
    // Small delay to allow other transactions to complete
    if (attempts < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 10 * attempts));
    }
  }

  // Fallback: use timestamp with milliseconds if all retries fail
  // This ensures we always return a unique number
  const timestamp = Date.now();
  const fallbackNumber = `${today}${String(timestamp).slice(-8)}`;
  return fallbackNumber;
}

export async function getTransactionItems(
  transactionId: number,
): Promise<TransactionItem[]> {
  const items = await db
    .select({
      id: transactionItems.id,
      transactionId: transactionItems.transactionId,
      productId: transactionItems.productId,
      quantity: transactionItems.quantity,
      unitPrice: transactionItems.unitPrice,
      total: transactionItems.total,
      vatRate: transactionItems.vatRate,
      vatAmount: transactionItems.vatAmount,
      originalUnitPrice: transactionItems.originalUnitPrice,
      discountAmount: transactionItems.discountAmount,
      promotionId: transactionItems.promotionId,
      // Include product details
      productName: products.name,
      productSku: products.sku,
      productBarcode: products.barcode,
    })
    .from(transactionItems)
    .leftJoin(products, eq(transactionItems.productId, products.id))
    .where(eq(transactionItems.transactionId, transactionId));

  return items as any;
}

export async function createTransactionItem(
  insertItem: InsertTransactionItem,
): Promise<TransactionItem> {
  const [item] = await db
    .insert(transactionItems)
    .values(insertItem)
    .returning();
  return item;
}
