/**
 * Sync Script: Assign all existing products to all stores
 * 
 * This script ensures that all products in the products table are properly
 * assigned to all stores in the store_products table. This is necessary for
 * the store-wise inventory system to work correctly.
 * 
 * Run this script with: npx tsx server/sync-products-to-stores.ts
 */

import { db } from "./db";
import { products, stores, storeProducts } from "@shared/schema";
import { eq, and } from "drizzle-orm";

async function syncProductsToStores() {
  console.log("🔄 Starting product synchronization to stores...\n");

  try {
    // Fetch all active stores
    const allStores = await db.select().from(stores).where(eq(stores.isActive, true));
    console.log(`📍 Found ${allStores.length} active stores`);

    if (allStores.length === 0) {
      console.log("⚠️  No active stores found. Please create stores first.");
      return;
    }

    // Fetch all active products
    const allProducts = await db.select().from(products).where(eq(products.isActive, true));
    console.log(`📦 Found ${allProducts.length} active products\n`);

    if (allProducts.length === 0) {
      console.log("⚠️  No active products found. Nothing to sync.");
      return;
    }

    let assignedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // For each store
    for (const store of allStores) {
      console.log(`\n🏪 Processing store: ${store.name} (ID: ${store.id})`);

      // For each product
      for (const product of allProducts) {
        try {
          // Check if this product is already assigned to this store
          const existing = await db
            .select()
            .from(storeProducts)
            .where(
              and(
                eq(storeProducts.storeId, store.id),
                eq(storeProducts.productId, product.id)
              )
            )
            .limit(1);

          if (existing.length > 0) {
            skippedCount++;
            continue;
          }

          // Create store product assignment
          await db.insert(storeProducts).values({
            storeId: store.id,
            productId: product.id,
            price: product.price || "0.00",
            cost: product.cost || null,
            stock: product.stock || 0,
            minStock: 5, // Default minimum stock
            maxStock: 100, // Default maximum stock
            isActive: true,
          });

          assignedCount++;
          process.stdout.write(`  ✓ Assigned product: ${product.name} (${assignedCount} assigned)\r`);
        } catch (error) {
          errorCount++;
          console.error(`  ✗ Error assigning product ${product.name}:`, error);
        }
      }

      console.log(`\n  ✅ Completed store: ${store.name}`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 Synchronization Summary:");
    console.log("=".repeat(60));
    console.log(`✅ Products assigned: ${assignedCount}`);
    console.log(`⏭️  Products skipped (already assigned): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log("=".repeat(60));
    console.log("\n✨ Synchronization completed successfully!");
  } catch (error) {
    console.error("\n❌ Fatal error during synchronization:", error);
    process.exit(1);
  }
}

// Run the sync
syncProductsToStores()
  .then(() => {
    console.log("\n👋 Exiting...");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Unhandled error:", error);
    process.exit(1);
  });
