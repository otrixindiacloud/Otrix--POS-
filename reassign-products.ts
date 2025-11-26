import { db } from "./server/db";
import { products, storeProducts, stores } from "@shared/schema";
import { eq, and } from "drizzle-orm";

async function reassignProducts() {
  console.log("🔄 Reassigning Products to Specific Stores\n");
  
  // Clear all current assignments
  console.log("1️⃣ Clearing all current product-store assignments...");
  await db.delete(storeProducts);
  console.log("   ✅ Cleared\n");
  
  // Get stores
  const allStores = await db.select().from(stores).where(eq(stores.isActive, true));
  const store1 = allStores.find(s => s.id === 1);
  const store2 = allStores.find(s => s.id === 2);
  
  if (!store1 || !store2) {
    console.error("❌ Could not find both stores!");
    process.exit(1);
  }
  
  console.log(`Store 1: ${store1.name}`);
  console.log(`Store 2: ${store2.name}\n`);
  
  // Get products
  const allProducts = await db.select().from(products);
  const tomatoes = allProducts.find(p => p.id === 2);
  const milk = allProducts.find(p => p.id === 1);
  
  if (!tomatoes || !milk) {
    console.error("❌ Could not find products!");
    process.exit(1);
  }
  
  // Assign Fresh Tomatoes ONLY to Store 1 (Main)
  console.log(`2️⃣ Assigning "${tomatoes.name}" to "${store1.name}" ONLY...`);
  await db.insert(storeProducts).values({
    storeId: store1.id,
    productId: tomatoes.id,
    price: tomatoes.price,
    costPrice: tomatoes.cost || null,
    stockQuantity: (tomatoes.stock || 0).toString(),
    reorderLevel: "5",
    isActive: true,
  });
  console.log("   ✅ Done\n");
  
  // Assign Fresh Milk ONLY to Store 2 (BAZZAR MARKET)
  console.log(`3️⃣ Assigning "${milk.name}" to "${store2.name}" ONLY...`);
  await db.insert(storeProducts).values({
    storeId: store2.id,
    productId: milk.id,
    price: milk.price,
    costPrice: milk.cost || null,
    stockQuantity: (milk.stock || 0).toString(),
    reorderLevel: "5",
    isActive: true,
  });
  console.log("   ✅ Done\n");
  
  console.log("=" .repeat(60));
  console.log("✅ REASSIGNMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log(`\n📦 ${tomatoes.name} → ${store1.name} ONLY`);
  console.log(`📦 ${milk.name} → ${store2.name} ONLY`);
  console.log("\nNow each store will show only its own product!");
  
  process.exit(0);
}

reassignProducts().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
