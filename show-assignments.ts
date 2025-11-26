import { db } from "./server/db";
import { products, storeProducts, stores } from "@shared/schema";
import { eq } from "drizzle-orm";

async function showCurrentAssignments() {
  console.log("📊 Current Product-Store Assignments:\n");

  const allStores = await db.select().from(stores).where(eq(stores.isActive, true));
  
  for (const store of allStores) {
    console.log(`\n🏪 Store: ${store.name} (ID: ${store.id})`);
    console.log("─".repeat(50));
    
    const storeProds = await db
      .select({
        productId: storeProducts.productId,
        productName: products.name,
        price: storeProducts.price,
        stock: storeProducts.stockQuantity,
      })
      .from(storeProducts)
      .innerJoin(products, eq(products.id, storeProducts.productId))
      .where(eq(storeProducts.storeId, store.id));
    
    if (storeProds.length === 0) {
      console.log("  (No products assigned)");
    } else {
      storeProds.forEach(sp => {
        console.log(`  ✓ ${sp.productName} - QR ${sp.price} (Stock: ${sp.stock})`);
      });
    }
  }
  
  process.exit(0);
}

showCurrentAssignments().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
