import { db } from "../../db";
import {
  generatedInvoices,
  generatedInvoiceItems,
  type GeneratedInvoice,
  type InsertGeneratedInvoice,
  type GeneratedInvoiceItem,
  type InsertGeneratedInvoiceItem,
} from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Invoice module storage helpers for generated invoices and their line items.
 */
export async function createGeneratedInvoice(
  invoice: InsertGeneratedInvoice
): Promise<GeneratedInvoice> {
  const [created] = await db.insert(generatedInvoices).values(invoice).returning();
  return created;
}

export async function getGeneratedInvoice(
  id: number
): Promise<GeneratedInvoice | undefined> {
  const [invoice] = await db
    .select()
    .from(generatedInvoices)
    .where(eq(generatedInvoices.id, id));
  return invoice || undefined;
}

export async function getGeneratedInvoiceByNumber(
  invoiceNumber: string
): Promise<GeneratedInvoice | undefined> {
  const [invoice] = await db
    .select()
    .from(generatedInvoices)
    .where(eq(generatedInvoices.invoiceNumber, invoiceNumber));
  return invoice || undefined;
}

export async function updateGeneratedInvoice(
  id: number,
  invoice: Partial<InsertGeneratedInvoice>
): Promise<GeneratedInvoice | undefined> {
  const [updated] = await db
    .update(generatedInvoices)
    .set(invoice)
    .where(eq(generatedInvoices.id, id))
    .returning();
  return updated || undefined;
}

export async function createGeneratedInvoiceItem(
  item: InsertGeneratedInvoiceItem
): Promise<GeneratedInvoiceItem> {
  const [created] = await db
    .insert(generatedInvoiceItems)
    .values(item)
    .returning();
  return created;
}

export async function getGeneratedInvoiceItems(
  invoiceId: number
): Promise<GeneratedInvoiceItem[]> {
  return db
    .select()
    .from(generatedInvoiceItems)
    .where(eq(generatedInvoiceItems.invoiceId, invoiceId));
}
