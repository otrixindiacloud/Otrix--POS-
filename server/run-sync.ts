#!/usr/bin/env tsx
/**
 * Direct Sync Script - Run with: npm run sync
 * This directly syncs all products to all stores without needing auth
 */

import 'dotenv/config';
import { db } from "./db";
import { products, stores, storeProducts } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

async function syncProductsToStores() {
  console.log("\n🔄 Starting product synchronization to stores...\n");

  try {
    // Fetch all active stores
    const allStores = await db.select().from(stores).where(eq(stores.isActive, true));
    console.log(`📍 Found ${allStores.length} active stores:`);
    allStores.forEach(s => console.log(`   - ${s.name} (ID: ${s.id})`));

    if (allStores.length === 0) {
      console.log("\n⚠️  No active stores found. Please create stores first.");
      process.exit(1);
    }

    // Fetch all active products
    const allProducts = await db.select().from(products).where(eq(products.isActive, true));
    console.log(`\n📦 Found ${allProducts.length} active products\n`);

    if (allProducts.length === 0) {
      console.log("⚠️  No active products found. Nothing to sync.");
      process.exit(1);
    }

    let assignedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // For each store
    for (const store of allStores) {
      console.log(`\n🏪 Processing store: ${store.name} (ID: ${store.id})`);
      let storeAssigned = 0;

      // For each product
      for (const product of allProducts) {
        try {
          // Check if this product is already assigned to this store - use raw SQL to avoid schema issues
          const existing = await db.execute(sql`
            SELECT id FROM store_products 
            WHERE store_id = ${store.id} AND product_id = ${product.id}
            LIMIT 1
          `);

          if (existing.rows && existing.rows.length > 0) {
            skippedCount++;
            continue;
          }

          // Create store product assignment using raw SQL with correct column names
            await db.execute(sql`
              INSERT INTO store_products (store_id, product_id, price, cost_price, stock_quantity, reorder_level, is_active, created_at, updated_at)
              VALUES (${store.id}, ${product.id}, ${product.price || "0.00"}, ${product.cost || "0.00"}, ${product.stock || 0}, 5, true, NOW(), NOW())
            `);          assignedCount++;
          storeAssigned++;
          
        } catch (error) {
          errorCount++;
          console.error(`  ✗ Error assigning product ${product.name}:`, error);
        }
      }

      console.log(`  ✅ Assigned ${storeAssigned} products to ${store.name}`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 Synchronization Summary:");
    console.log("=".repeat(60));
    console.log(`✅ Products assigned:       ${assignedCount}`);
    console.log(`⏭️  Already assigned:        ${skippedCount}`);
    console.log(`❌ Errors:                  ${errorCount}`);
    console.log(`📍 Total stores:            ${allStores.length}`);
    console.log(`📦 Total products:          ${allProducts.length}`);
    console.log("=".repeat(60));
    console.log("\n✨ Synchronization completed successfully!\n");
    
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Fatal error during synchronization:", error);
    process.exit(1);
  }
}

// Run the sync
syncProductsToStores();
