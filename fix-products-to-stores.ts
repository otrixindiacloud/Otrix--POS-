import { db } from "./server/db";
import { products, storeProducts, stores } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";

async function fixProductsToStores() {
  console.log("🔍 Checking products and store assignments...\n");

  // Get all products
  const allProducts = await db.select().from(products);
  console.log(`Found ${allProducts.length} products in database:`);
  allProducts.forEach(p => console.log(`  - ${p.id}: ${p.name}`));

  // Get all stores
  const allStores = await db.select().from(stores).where(eq(stores.isActive, true));
  console.log(`\nFound ${allStores.length} active stores:`);
  allStores.forEach(s => console.log(`  - ${s.id}: ${s.name}`));

  // Get all store product assignments
  const allStoreProducts = await db.select().from(storeProducts);
  console.log(`\nFound ${allStoreProducts.length} store-product assignments`);

  // Find products not assigned to any store
  const assignedProductIds = new Set(allStoreProducts.map(sp => sp.productId));
  const unassignedProducts = allProducts.filter(p => !assignedProductIds.has(p.id));

  if (unassignedProducts.length > 0) {
    console.log(`\n⚠️  Found ${unassignedProducts.length} products not assigned to any store:`);
    unassignedProducts.forEach(p => console.log(`  - ${p.id}: ${p.name}`));

    // Assign unassigned products to all stores
    for (const product of unassignedProducts) {
      console.log(`\n📦 Assigning product "${product.name}" to all stores...`);
      for (const store of allStores) {
        try {
          await db.insert(storeProducts).values({
            storeId: store.id,
            productId: product.id,
            price: product.price,
            costPrice: product.cost || null,
            stockQuantity: (product.stock || 0).toString(),
            reorderLevel: "5",
            isActive: true,
          });
          console.log(`  ✅ Added to store "${store.name}"`);
        } catch (error: any) {
          if (error.code === '23505') { // Unique constraint violation
            console.log(`  ⏭️  Already assigned to store "${store.name}"`);
          } else {
            console.error(`  ❌ Error adding to store "${store.name}":`, error.message);
          }
        }
      }
    }

    console.log(`\n✅ All products have been assigned to stores!`);
  } else {
    console.log(`\n✅ All products are already assigned to stores!`);
  }

  // Verify the assignments
  const finalStoreProducts = await db.select().from(storeProducts);
  console.log(`\n📊 Final count: ${finalStoreProducts.length} store-product assignments`);
  
  process.exit(0);
}

fixProductsToStores().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
