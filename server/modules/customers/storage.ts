import { db } from "../../db";
import {
  customers,
  customerAuth,
  type Customer,
  type InsertCustomer,
  type CustomerAuth as CustomerAuthRecord,
  type InsertCustomerAuth
} from "@shared/schema";
import { and, eq, gte, ilike } from "drizzle-orm";

/**
 * Customer data access utilities scoped to the customer module.
 */
export async function getCustomers(): Promise<Customer[]> {
  return db.select().from(customers).where(eq(customers.isActive, true));
}

export async function getCustomer(id: number): Promise<Customer | undefined> {
  const [customer] = await db.select().from(customers).where(eq(customers.id, id));
  return customer || undefined;
}

export async function getCustomerByEmail(email: string): Promise<Customer | undefined> {
  const [customer] = await db.select().from(customers).where(eq(customers.email, email));
  return customer || undefined;
}

export async function createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
  const [customer] = await db.insert(customers).values(insertCustomer).returning();
  return customer;
}

export async function updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined> {
  const [updatedCustomer] = await db
    .update(customers)
    .set(customer)
    .where(eq(customers.id, id))
    .returning();
  return updatedCustomer || undefined;
}

export async function deleteCustomer(id: number): Promise<boolean> {
  try {
    const result = await db.delete(customers).where(eq(customers.id, id));
    return (result.rowCount || 0) > 0;
  } catch (error) {
    console.error("Error deleting customer:", error);
    return false;
  }
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  if (!query) {
    return [];
  }

  return db
    .select()
    .from(customers)
    .where(and(eq(customers.isActive, true), ilike(customers.name, `%${query}%`)));
}

export async function getCustomerAuth(customerId: number): Promise<CustomerAuthRecord | undefined> {
  const [auth] = await db.select().from(customerAuth).where(eq(customerAuth.customerId, customerId));
  return auth || undefined;
}

export async function createCustomerAuth(auth: InsertCustomerAuth): Promise<CustomerAuthRecord> {
  const [created] = await db.insert(customerAuth).values(auth).returning();
  return created;
}

export async function updateCustomerAuth(
  id: number,
  auth: Partial<InsertCustomerAuth>
): Promise<CustomerAuthRecord | undefined> {
  const [updated] = await db.update(customerAuth).set(auth).where(eq(customerAuth.id, id)).returning();
  return updated || undefined;
}

export async function authenticateCustomer(
  email: string,
  password: string
): Promise<{ customer: Customer; auth: CustomerAuthRecord } | undefined> {
  const bcrypt = await import("bcryptjs");

  const [customer] = await db.select().from(customers).where(eq(customers.email, email));
  if (!customer) return undefined;

  const [auth] = await db.select().from(customerAuth).where(eq(customerAuth.customerId, customer.id));
  if (!auth || !auth.isActive) return undefined;

  const isValid = await bcrypt.default.compare(password, auth.passwordHash);
  if (!isValid) return undefined;

  await db
    .update(customerAuth)
    .set({ lastLoginAt: new Date() })
    .where(eq(customerAuth.id, auth.id));

  return { customer, auth };
}

export async function resetCustomerPassword(email: string): Promise<string | undefined> {
  const [customer] = await db.select().from(customers).where(eq(customers.email, email));
  if (!customer) return undefined;

  const resetToken =
    Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db
    .update(customerAuth)
    .set({ passwordResetToken: resetToken, passwordResetExpiry: expiry })
    .where(eq(customerAuth.customerId, customer.id));

  return resetToken;
}

export async function updateCustomerPassword(token: string, newPassword: string): Promise<boolean> {
  const bcrypt = await import("bcryptjs");

  const [auth] = await db
    .select()
    .from(customerAuth)
    .where(
      and(eq(customerAuth.passwordResetToken, token), gte(customerAuth.passwordResetExpiry, new Date()))
    );

  if (!auth) return false;

  const hashedPassword = await bcrypt.default.hash(newPassword, 10);

  await db
    .update(customerAuth)
    .set({
      passwordHash: hashedPassword,
      passwordResetToken: null,
      passwordResetExpiry: null
    })
    .where(eq(customerAuth.id, auth.id));

  return true;
}
