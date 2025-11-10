import { db } from "../../db";
import {
  suppliers,
  supplierInvoices,
  supplierInvoiceItems,
  supplierPayments,
  type Supplier,
  type InsertSupplier,
  type SupplierInvoice,
  type InsertSupplierInvoice,
  type SupplierInvoiceItem,
  type InsertSupplierInvoiceItem,
  type SupplierPayment,
  type InsertSupplierPayment
} from "@shared/schema";
import { and, desc, eq, like, or } from "drizzle-orm";

/**
 * Supplier-centric data access helpers used by the supplier module.
 */
export async function getSuppliers(): Promise<Supplier[]> {
  return db.select().from(suppliers).where(eq(suppliers.isActive, true));
}

export async function getSupplier(id: number): Promise<Supplier | undefined> {
  const [result] = await db.select().from(suppliers).where(eq(suppliers.id, id));
  return result || undefined;
}

export async function createSupplier(insertSupplier: InsertSupplier): Promise<Supplier> {
  const [result] = await db.insert(suppliers).values(insertSupplier).returning();
  return result;
}

export async function updateSupplier(
  id: number,
  supplier: Partial<InsertSupplier>
): Promise<Supplier | undefined> {
  const [result] = await db
    .update(suppliers)
    .set(supplier)
    .where(eq(suppliers.id, id))
    .returning();
  return result || undefined;
}

export async function deleteSupplier(id: number): Promise<boolean> {
  try {
    const result = await db.delete(suppliers).where(eq(suppliers.id, id));
    return (result.rowCount || 0) > 0;
  } catch (error) {
    console.error("Error deleting supplier:", error);
    return false;
  }
}

export async function searchSuppliers(query: string): Promise<Supplier[]> {
  const searchTerm = `%${query}%`;
  return db
    .select()
    .from(suppliers)
    .where(
      and(
        eq(suppliers.isActive, true),
        or(
          like(suppliers.name, searchTerm),
          like(suppliers.email, searchTerm),
          like(suppliers.phone, searchTerm)
        )
      )
    );
}

export async function getSupplierInvoices(): Promise<SupplierInvoice[]> {
  return db.select().from(supplierInvoices).orderBy(desc(supplierInvoices.createdAt));
}

export async function getSupplierInvoice(id: number): Promise<SupplierInvoice | undefined> {
  const [result] = await db.select().from(supplierInvoices).where(eq(supplierInvoices.id, id));
  return result || undefined;
}

export async function createSupplierInvoice(
  insertInvoice: InsertSupplierInvoice
): Promise<SupplierInvoice> {
  const [result] = await db.insert(supplierInvoices).values(insertInvoice).returning();
  return result;
}

export async function updateSupplierInvoice(
  id: number,
  invoice: Partial<InsertSupplierInvoice>
): Promise<SupplierInvoice | undefined> {
  const [result] = await db
    .update(supplierInvoices)
    .set(invoice)
    .where(eq(supplierInvoices.id, id))
    .returning();
  return result || undefined;
}

export async function getSupplierInvoicesBySupplier(
  supplierId: number
): Promise<SupplierInvoice[]> {
  return db
    .select()
    .from(supplierInvoices)
    .where(eq(supplierInvoices.supplierId, supplierId))
    .orderBy(desc(supplierInvoices.createdAt));
}

export async function getSupplierInvoiceItems(
  invoiceId: number
): Promise<SupplierInvoiceItem[]> {
  return db
    .select()
    .from(supplierInvoiceItems)
    .where(eq(supplierInvoiceItems.invoiceId, invoiceId));
}

export async function createSupplierInvoiceItem(
  insertItem: InsertSupplierInvoiceItem
): Promise<SupplierInvoiceItem> {
  const [result] = await db.insert(supplierInvoiceItems).values(insertItem).returning();
  return result;
}

export async function updateSupplierInvoiceItem(
  id: number,
  item: Partial<InsertSupplierInvoiceItem>
): Promise<SupplierInvoiceItem | undefined> {
  const [result] = await db
    .update(supplierInvoiceItems)
    .set(item)
    .where(eq(supplierInvoiceItems.id, id))
    .returning();
  return result || undefined;
}

export async function getSupplierPayments(invoiceId?: number): Promise<SupplierPayment[]> {
  if (invoiceId) {
    return db.select().from(supplierPayments).where(eq(supplierPayments.invoiceId, invoiceId));
  }
  return db.select().from(supplierPayments).orderBy(desc(supplierPayments.createdAt));
}

export async function createSupplierPayment(
  insertPayment: InsertSupplierPayment
): Promise<SupplierPayment> {
  const [result] = await db.insert(supplierPayments).values(insertPayment).returning();
  return result;
}

export async function getSupplierPaymentsByInvoice(
  invoiceId: number
): Promise<SupplierPayment[]> {
  return db.select().from(supplierPayments).where(eq(supplierPayments.invoiceId, invoiceId));
}
