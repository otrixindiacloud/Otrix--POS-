import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";

import {
  InsertProduct,
  Product,
  products,
} from "@shared/schema";

import { db } from "../../db";

export async function getProducts(): Promise<Product[]> {
  return await db
    .select()
    .from(products)
    .orderBy(desc(products.createdAt));
}

export async function getProduct(id: number): Promise<Product | undefined> {
  const [product] = await db.select().from(products).where(eq(products.id, id));
  return product || undefined;
}

export async function getProductBySku(sku: string): Promise<Product | undefined> {
  const [product] = await db.select().from(products).where(eq(products.sku, sku));
  return product || undefined;
}

export async function getProductByBarcode(
  barcode: string,
): Promise<Product | undefined> {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.barcode, barcode));
  return product || undefined;
}

export async function createProduct(
  insertProduct: InsertProduct,
): Promise<Product> {
  // Normalize price and cost to strings if they're numbers
  const normalizedProduct = {
    ...insertProduct,
    price: typeof insertProduct.price === 'number' ? insertProduct.price.toString() : insertProduct.price,
    cost: insertProduct.cost ? (typeof insertProduct.cost === 'number' ? insertProduct.cost.toString() : insertProduct.cost) : undefined,
  };
  const [product] = await db.insert(products).values(normalizedProduct).returning();
  return product;
}

export async function updateProduct(
  id: number,
  product: Partial<InsertProduct>,
): Promise<Product | undefined> {
  // Normalize price and cost to strings if they're numbers
  const normalizedProduct: any = { ...product };
  if (product.price !== undefined) {
    normalizedProduct.price = typeof product.price === 'number' ? product.price.toString() : product.price;
  }
  if (product.cost !== undefined && product.cost !== null) {
    normalizedProduct.cost = typeof product.cost === 'number' ? product.cost.toString() : product.cost;
  }
  const [updatedProduct] = await db
    .update(products)
    .set(normalizedProduct)
    .where(eq(products.id, id))
    .returning();
  return updatedProduct || undefined;
}

export async function deleteProduct(id: number): Promise<boolean> {
  try {
    const result = await db.delete(products).where(eq(products.id, id));
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error("Error deleting product:", error);
    return false;
  }
}

export async function searchProducts(
  query: string,
  category?: string,
  sort?: string,
): Promise<Product[]> {
  const searchTerms = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((term) => term.length > 0);

  if (searchTerms.length === 0) {
    return [];
  }

  const searchConditions = searchTerms.map((term) =>
    or(
      ilike(products.name, `%${term}%`),
      ilike(products.category, `%${term}%`),
      ilike(products.description, `%${term}%`),
      ilike(products.sku, `%${term}%`),
      ilike(products.barcode, `%${term}%`),
      sql`LOWER(${products.sku}) LIKE ${`%${term}%`}`,
      sql`LOWER(${products.barcode}) LIKE ${`%${term}%`}`,
    ),
  );

  const flexibleSearchCondition = or(...searchConditions);

  const normalizedQuery = query.toLowerCase();

  const fullQueryCondition = or(
    ilike(products.name, `%${normalizedQuery}%`),
    ilike(products.category, `%${normalizedQuery}%`),
    ilike(products.description, `%${normalizedQuery}%`),
    ilike(products.sku, `%${normalizedQuery}%`),
    ilike(products.barcode, `%${normalizedQuery}%`),
  );

  const whereConditions = and(
    eq(products.isActive, true),
    or(fullQueryCondition, flexibleSearchCondition),
    category ? ilike(products.category, `%${category}%`) : sql`1=1`,
  );

  const orderClause = (() => {
    switch (sort) {
      case "name":
        return [asc(products.name)];
      case "price_low":
        return [asc(sql`CAST(${products.price} AS DECIMAL)`)] as const;
      case "price_high":
        return [desc(sql`CAST(${products.price} AS DECIMAL)`)] as const;
      case "stock_low":
        return [asc(sql`COALESCE(${products.stock}, 0)`)] as const;
      case "recent":
      default:
        return [
          desc(
            sql`CASE WHEN LOWER(${products.name}) = ${normalizedQuery} THEN 3
                     WHEN LOWER(${products.name}) LIKE ${`${normalizedQuery}%`} THEN 2
                     WHEN LOWER(${products.name}) LIKE ${`%${normalizedQuery}%`} THEN 1
                     ELSE 0 END`,
          ),
          desc(products.createdAt),
        ] as const;
    }
  })();

  return await db
    .select()
    .from(products)
    .where(whereConditions)
    .orderBy(...orderClause)
    .limit(50);
}

export async function getProductCategories(): Promise<string[]> {
  const result = await db
    .selectDistinct({ category: products.category })
    .from(products)
    .where(
      and(
        eq(products.isActive, true),
        sql`${products.category} IS NOT NULL AND ${products.category} != ''`,
      ),
    )
    .orderBy(products.category);

  return result
    .map((row) => row.category)
    .filter((category): category is string => Boolean(category));
}

export async function getRecentProducts(limit = 8): Promise<Product[]> {
  return await db
    .select()
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(desc(products.createdAt))
    .limit(limit);
}
