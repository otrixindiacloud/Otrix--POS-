import { db } from "../../db";
import {
  competitors,
  competitorPrices,
  products,
  users,
  type Competitor,
  type CompetitorPrice,
  type InsertCompetitor,
  type InsertCompetitorPrice,
} from "@shared/schema";
import { eq, desc, asc, and, or, ilike, sql } from "drizzle-orm";

/**
 * Competitor Management Storage Module
 * Handles CRUD operations for competitors and their product pricing
 */

// ==================== COMPETITORS ====================

/**
 * Get all competitors with optional filtering
 */
export async function getAllCompetitors(activeOnly: boolean = false) {
  const conditions = activeOnly ? eq(competitors.isActive, true) : undefined;
  
  const result = await db
    .select({
      id: competitors.id,
      name: competitors.name,
      description: competitors.description,
      address: competitors.address,
      city: competitors.city,
      country: competitors.country,
      website: competitors.website,
      phone: competitors.phone,
      email: competitors.email,
      contactPerson: competitors.contactPerson,
      businessType: competitors.businessType,
      notes: competitors.notes,
      isActive: competitors.isActive,
      createdAt: competitors.createdAt,
      updatedAt: competitors.updatedAt,
      createdBy: competitors.createdBy,
      priceCount: sql<number>`cast(count(${competitorPrices.id}) as int)`,
    })
    .from(competitors)
    .leftJoin(competitorPrices, eq(competitors.id, competitorPrices.competitorId))
    .where(conditions)
    .groupBy(competitors.id)
    .orderBy(desc(competitors.createdAt));

  return result;
}

/**
 * Get competitor by ID with detailed information
 */
export async function getCompetitorById(id: number) {
  const result = await db
    .select({
      competitor: competitors,
      createdByUser: {
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
      },
    })
    .from(competitors)
    .leftJoin(users, eq(competitors.createdBy, users.id))
    .where(eq(competitors.id, id))
    .limit(1);

  if (!result || result.length === 0) {
    return null;
  }

  return result[0];
}

/**
 * Create a new competitor
 */
export async function createCompetitor(data: InsertCompetitor): Promise<Competitor> {
  const [newCompetitor] = await db
    .insert(competitors)
    .values(data)
    .returning();

  return newCompetitor;
}

/**
 * Update competitor
 */
export async function updateCompetitor(
  id: number,
  data: Partial<InsertCompetitor>
): Promise<Competitor | null> {
  const [updated] = await db
    .update(competitors)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(competitors.id, id))
    .returning();

  return updated || null;
}

/**
 * Delete competitor (soft delete by setting isActive to false)
 */
export async function deleteCompetitor(id: number): Promise<boolean> {
  const [updated] = await db
    .update(competitors)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(competitors.id, id))
    .returning();

  return !!updated;
}

/**
 * Hard delete competitor and all associated prices
 */
export async function hardDeleteCompetitor(id: number): Promise<boolean> {
  // Delete associated prices first (cascade will handle this, but being explicit)
  await db
    .delete(competitorPrices)
    .where(eq(competitorPrices.competitorId, id));

  const result = await db
    .delete(competitors)
    .where(eq(competitors.id, id))
    .returning();

  return result.length > 0;
}

/**
 * Search competitors by name, address, or email
 */
export async function searchCompetitors(query: string) {
  const searchTerm = `%${query}%`;
  
  return await db
    .select()
    .from(competitors)
    .where(
      and(
        eq(competitors.isActive, true),
        or(
          ilike(competitors.name, searchTerm),
          ilike(competitors.address, searchTerm),
          ilike(competitors.email, searchTerm),
          ilike(competitors.contactPerson, searchTerm)
        )
      )
    )
    .orderBy(asc(competitors.name));
}

// ==================== COMPETITOR PRICES ====================

/**
 * Get all competitor prices for a specific competitor
 */
export async function getCompetitorPrices(competitorId: number, activeOnly: boolean = true) {
  const conditions = activeOnly
    ? and(
        eq(competitorPrices.competitorId, competitorId),
        eq(competitorPrices.isActive, true)
      )
    : eq(competitorPrices.competitorId, competitorId);

  return await db
    .select({
      id: competitorPrices.id,
      competitorId: competitorPrices.competitorId,
      productId: competitorPrices.productId,
      price: competitorPrices.price,
      originalPrice: competitorPrices.originalPrice,
      currency: competitorPrices.currency,
      productName: competitorPrices.productName,
      productUrl: competitorPrices.productUrl,
      notes: competitorPrices.notes,
      priceDate: competitorPrices.priceDate,
      expiryDate: competitorPrices.expiryDate,
      isActive: competitorPrices.isActive,
      createdAt: competitorPrices.createdAt,
      updatedAt: competitorPrices.updatedAt,
      recordedBy: competitorPrices.recordedBy,
      product: {
        id: products.id,
        sku: products.sku,
        name: products.name,
        price: products.price,
        imageUrl: products.imageUrl,
      },
    })
    .from(competitorPrices)
    .leftJoin(products, eq(competitorPrices.productId, products.id))
    .where(conditions)
    .orderBy(desc(competitorPrices.priceDate));
}

/**
 * Get competitor prices for a specific product across all competitors
 */
export async function getProductCompetitorPrices(productId: number, activeOnly: boolean = true) {
  const conditions = activeOnly
    ? and(
        eq(competitorPrices.productId, productId),
        eq(competitorPrices.isActive, true),
        eq(competitors.isActive, true)
      )
    : eq(competitorPrices.productId, productId);

  return await db
    .select({
      id: competitorPrices.id,
      competitorId: competitorPrices.competitorId,
      productId: competitorPrices.productId,
      price: competitorPrices.price,
      originalPrice: competitorPrices.originalPrice,
      currency: competitorPrices.currency,
      productName: competitorPrices.productName,
      productUrl: competitorPrices.productUrl,
      notes: competitorPrices.notes,
      priceDate: competitorPrices.priceDate,
      expiryDate: competitorPrices.expiryDate,
      isActive: competitorPrices.isActive,
      createdAt: competitorPrices.createdAt,
      updatedAt: competitorPrices.updatedAt,
      recordedBy: competitorPrices.recordedBy,
      competitor: {
        id: competitors.id,
        name: competitors.name,
        website: competitors.website,
        businessType: competitors.businessType,
      },
    })
    .from(competitorPrices)
    .leftJoin(competitors, eq(competitorPrices.competitorId, competitors.id))
    .where(conditions)
    .orderBy(asc(competitorPrices.price));
}

/**
 * Get a single competitor price record
 */
export async function getCompetitorPriceById(id: number) {
  const [result] = await db
    .select()
    .from(competitorPrices)
    .where(eq(competitorPrices.id, id))
    .limit(1);

  return result || null;
}

/**
 * Add a new competitor price
 */
export async function createCompetitorPrice(
  data: InsertCompetitorPrice
): Promise<CompetitorPrice> {
  const [newPrice] = await db
    .insert(competitorPrices)
    .values(data)
    .returning();

  return newPrice;
}

/**
 * Update competitor price
 */
export async function updateCompetitorPrice(
  id: number,
  data: Partial<InsertCompetitorPrice>
): Promise<CompetitorPrice | null> {
  const [updated] = await db
    .update(competitorPrices)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(competitorPrices.id, id))
    .returning();

  return updated || null;
}

/**
 * Delete competitor price (soft delete)
 */
export async function deleteCompetitorPrice(id: number): Promise<boolean> {
  const [updated] = await db
    .update(competitorPrices)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(competitorPrices.id, id))
    .returning();

  return !!updated;
}

/**
 * Hard delete competitor price
 */
export async function hardDeleteCompetitorPrice(id: number): Promise<boolean> {
  const result = await db
    .delete(competitorPrices)
    .where(eq(competitorPrices.id, id))
    .returning();

  return result.length > 0;
}

/**
 * Get price comparison for a product
 * Returns our price vs competitor prices with differences
 */
export async function getPriceComparison(productId: number) {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) {
    return null;
  }

  const competitorPricesList = await getProductCompetitorPrices(productId, true);

  const ourPrice = parseFloat(product.price);
  
  const comparison = {
    product: {
      id: product.id,
      name: product.name,
      sku: product.sku,
      price: ourPrice,
    },
    competitorPrices: competitorPricesList.map((cp) => {
      const competitorPrice = parseFloat(cp.price);
      const difference = competitorPrice - ourPrice;
      const percentageDiff = ((difference / ourPrice) * 100).toFixed(2);
      
      return {
        ...cp,
        difference,
        percentageDiff: parseFloat(percentageDiff),
        isLower: competitorPrice < ourPrice,
        isHigher: competitorPrice > ourPrice,
        isSame: Math.abs(difference) < 0.01,
      };
    }),
    lowestCompetitorPrice: competitorPricesList.length > 0
      ? Math.min(...competitorPricesList.map(cp => parseFloat(cp.price)))
      : null,
    highestCompetitorPrice: competitorPricesList.length > 0
      ? Math.max(...competitorPricesList.map(cp => parseFloat(cp.price)))
      : null,
    averageCompetitorPrice: competitorPricesList.length > 0
      ? competitorPricesList.reduce((sum, cp) => sum + parseFloat(cp.price), 0) / competitorPricesList.length
      : null,
  };

  return comparison;
}

/**
 * Bulk import competitor prices
 */
export async function bulkCreateCompetitorPrices(
  prices: InsertCompetitorPrice[]
): Promise<CompetitorPrice[]> {
  if (prices.length === 0) {
    return [];
  }

  const result = await db
    .insert(competitorPrices)
    .values(prices)
    .returning();

  return result;
}

/**
 * Get competitor statistics
 */
export async function getCompetitorStats(competitorId: number) {
  const prices = await getCompetitorPrices(competitorId, true);
  
  if (prices.length === 0) {
    return {
      totalProducts: 0,
      averagePrice: 0,
      lowestPrice: 0,
      highestPrice: 0,
      lastUpdated: null,
    };
  }

  const priceValues = prices.map(p => parseFloat(p.price));
  
  return {
    totalProducts: prices.length,
    averagePrice: priceValues.reduce((sum, p) => sum + p, 0) / prices.length,
    lowestPrice: Math.min(...priceValues),
    highestPrice: Math.max(...priceValues),
    lastUpdated: prices[0].updatedAt,
  };
}
