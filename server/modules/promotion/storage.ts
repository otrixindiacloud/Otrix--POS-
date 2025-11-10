import { db } from "../../db";
import {
  promotions,
  promotionRules,
  promotionUsage,
  type Promotion,
  type InsertPromotion,
  type PromotionRule,
  type InsertPromotionRule,
  type PromotionUsage,
  type InsertPromotionUsage
} from "@shared/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";

/**
 * Promotion data access helpers kept alongside the promotion module.
 */
export async function getPromotions(storeId: number): Promise<Promotion[]> {
  return db.select().from(promotions).where(eq(promotions.storeId, storeId));
}

export async function getActivePromotions(storeId: number): Promise<Promotion[]> {
  const now = new Date();
  return db
    .select()
    .from(promotions)
    .where(
      and(
        eq(promotions.storeId, storeId),
        eq(promotions.isActive, true),
        lte(promotions.startDate, now),
        gte(promotions.endDate, now)
      )
    );
}

export async function getPromotion(id: number): Promise<Promotion | undefined> {
  const [promotion] = await db.select().from(promotions).where(eq(promotions.id, id));
  return promotion;
}

export async function createPromotion(promotion: InsertPromotion): Promise<Promotion> {
  const [created] = await db.insert(promotions).values(promotion).returning();
  return created;
}

export async function updatePromotion(
  id: number,
  promotion: Partial<InsertPromotion>
): Promise<Promotion | undefined> {
  const [updated] = await db
    .update(promotions)
    .set(promotion)
    .where(eq(promotions.id, id))
    .returning();
  return updated;
}

export async function deletePromotion(id: number): Promise<boolean> {
  const result = await db.delete(promotions).where(eq(promotions.id, id));
  return (result.rowCount || 0) > 0;
}

export async function getPromotionRules(promotionId: number): Promise<PromotionRule[]> {
  return db.select().from(promotionRules).where(eq(promotionRules.promotionId, promotionId));
}

export async function createPromotionRule(rule: InsertPromotionRule): Promise<PromotionRule> {
  const [created] = await db.insert(promotionRules).values(rule).returning();
  return created;
}

export async function deletePromotionRule(id: number): Promise<boolean> {
  const result = await db.delete(promotionRules).where(eq(promotionRules.id, id));
  return (result.rowCount || 0) > 0;
}

export async function getApplicablePromotions(storeId: number, cartItems: any[]): Promise<Promotion[]> {
  const active = await getActivePromotions(storeId);
  const applicable: Promotion[] = [];

  for (const promotion of active) {
    const rules = await getPromotionRules(promotion.id);
    let canApply = false;

    for (const rule of rules) {
      if (rule.ruleType === "all_products") {
        canApply = true;
        break;
      }
      if (rule.ruleType === "product" && rule.productId) {
        canApply = cartItems.some((item) => item.productId === rule.productId);
        if (canApply) break;
      }
      if (rule.ruleType === "category" && rule.category) {
        canApply = cartItems.some((item) => item.category === rule.category);
        if (canApply) break;
      }
    }

    if (canApply && promotion.minOrderAmount) {
      const cartTotal = cartItems.reduce(
        (sum, item) => sum + parseFloat(item.price) * item.quantity,
        0
      );
      canApply = cartTotal >= parseFloat(promotion.minOrderAmount);
    }

    if (canApply) {
      applicable.push(promotion);
    }
  }

  return applicable;
}

export async function applyPromotion(
  promotionId: number,
  cartItems: any[]
): Promise<{ success: boolean; discount: number; appliedItems: any[] }> {
  const promotion = await getPromotion(promotionId);
  if (!promotion || !promotion.isActive) {
    return { success: false, discount: 0, appliedItems: [] };
  }

  const rules = await getPromotionRules(promotion.id);
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + parseFloat(item.price) * item.quantity,
    0
  );

  let discount = 0;
  const appliedItems: any[] = [];

  switch (promotion.type) {
    case "percentage":
      discount = cartTotal * (parseFloat(promotion.value || "0") / 100);
      break;
    case "fixed_amount":
      discount = parseFloat(promotion.value || "0");
      break;
    case "buy_x_get_y":
      for (const rule of rules) {
        if (rule.buyQuantity && rule.getQuantity) {
          const eligibleItems =
            rule.ruleType === "all_products"
              ? cartItems
              : rule.ruleType === "product" && rule.productId
              ? cartItems.filter((item) => item.productId === rule.productId)
              : rule.ruleType === "category" && rule.category
              ? cartItems.filter((item) => item.category === rule.category)
              : [];

          const totalEligibleQty = eligibleItems.reduce((sum, item) => sum + item.quantity, 0);
          const setsQualified = Math.floor(totalEligibleQty / rule.buyQuantity);
          const freeItems = setsQualified * rule.getQuantity;

          if (freeItems > 0) {
            const sortedItems = [...eligibleItems].sort(
              (a, b) => parseFloat(a.price) - parseFloat(b.price)
            );
            let remainingFree = freeItems;

            for (const item of sortedItems) {
              if (remainingFree <= 0) break;
              const freeFromThisItem = Math.min(remainingFree, item.quantity);
              discount += freeFromThisItem * parseFloat(item.price);
              remainingFree -= freeFromThisItem;
              appliedItems.push({ ...item, discountedQuantity: freeFromThisItem });
            }
          }
        }
      }
      break;
    default:
      discount = 0;
  }

  if (promotion.maxDiscountAmount && discount > parseFloat(promotion.maxDiscountAmount)) {
    discount = parseFloat(promotion.maxDiscountAmount);
  }

  for (const rule of rules) {
    if (rule.ruleType === "all_products") {
      appliedItems.push(...cartItems);
      break;
    }
    if (rule.ruleType === "product" && rule.productId) {
      appliedItems.push(...cartItems.filter((item) => item.productId === rule.productId));
    } else if (rule.ruleType === "category" && rule.category) {
      appliedItems.push(...cartItems.filter((item) => item.category === rule.category));
    }
  }

  return { success: true, discount, appliedItems };
}

export async function applyPromotions(
  storeId: number,
  items: any[],
  customerId?: number
): Promise<{ promotions: Promotion[]; totalDiscount: number; appliedPromotions: any[] }> {
  const activePromos = await getActivePromotions(storeId);
  const appliedPromotions: any[] = [];
  let totalDiscount = 0;

  for (const promotion of activePromos) {
    const rules = await getPromotionRules(promotion.id);
    let canApply = false;
    let discountAmount = 0;

    for (const rule of rules) {
      if (rule.ruleType === "all_products") {
        canApply = true;
        break;
      }
      if (rule.ruleType === "category") {
        canApply = items.some((item) => item.category === rule.category);
        if (canApply) break;
      }
      if (rule.ruleType === "product") {
        canApply = items.some((item) => item.productId === rule.productId);
        if (canApply) break;
      }
    }

    if (!canApply) {
      continue;
    }

    const orderTotal = items.reduce((sum, item) => sum + parseFloat(item.total), 0);

    if (promotion.minOrderAmount && orderTotal < parseFloat(promotion.minOrderAmount)) {
      continue;
    }

    if (promotion.type === "percentage") {
      discountAmount = orderTotal * (parseFloat(promotion.value || "0") / 100);
    } else if (promotion.type === "fixed_amount") {
      discountAmount = parseFloat(promotion.value || "0");
    }

    if (promotion.maxDiscountAmount && discountAmount > parseFloat(promotion.maxDiscountAmount)) {
      discountAmount = parseFloat(promotion.maxDiscountAmount);
    }

    if (promotion.usageLimit && (promotion.usageCount || 0) >= promotion.usageLimit) {
      continue;
    }

    // Customer-specific limits could be enforced here in the future.

    totalDiscount += discountAmount;
    appliedPromotions.push({
      promotionId: promotion.id,
      name: promotion.name,
      discountAmount,
      type: promotion.type
    });
  }

  return { promotions: activePromos, totalDiscount, appliedPromotions };
}

export async function recordPromotionUsage(usage: InsertPromotionUsage): Promise<PromotionUsage> {
  const [created] = await db.insert(promotionUsage).values(usage).returning();

  await db
    .update(promotions)
    .set({ usageCount: sql`${promotions.usageCount} + 1` })
    .where(eq(promotions.id, usage.promotionId));

  return created;
}

export async function getPromotionUsage(
  promotionId?: number,
  customerId?: number
): Promise<PromotionUsage[]> {
  if (promotionId && customerId) {
    return db
      .select()
      .from(promotionUsage)
      .where(
        and(eq(promotionUsage.promotionId, promotionId), eq(promotionUsage.customerId, customerId))
      );
  }

  if (promotionId) {
    return db.select().from(promotionUsage).where(eq(promotionUsage.promotionId, promotionId));
  }

  if (customerId) {
    return db.select().from(promotionUsage).where(eq(promotionUsage.customerId, customerId));
  }

  return db.select().from(promotionUsage);
}
