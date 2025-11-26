import { db } from "./server/db";
import { products, storeProducts, stores } from "@shared/schema";
import { eq, and } from "drizzle-orm";

async function manageProductStores() {
  console.log("🏪 Product-Store Management Tool\n");
  
  const allStores = await db.select().from(stores).where(eq(stores.isActive, true));
  const allProducts = await db.select().from(products);
  
  console.log("Current Stores:");
  allStores.forEach(s => console.log(`  ${s.id}. ${s.name}`));
  
  console.log("\nCurrent Products:");
  allProducts.forEach(p => console.log(`  ${p.id}. ${p.name}`));
  
  console.log("\n" + "=".repeat(60));
  console.log("INSTRUCTIONS:");
  console.log("=".repeat(60));
  console.log("\nTo assign products to specific stores, run:");
  console.log("\nFor Fresh Tomatoes (ID: 2) to Store 1 ONLY:");
  console.log("  1. Delete from Store 2");
  console.log("  2. Keep in Store 1");
  console.log("\nFor Fresh Milk (ID: 1) to Store 2 ONLY:");
  console.log("  1. Delete from Store 1");
  console.log("  2. Keep in Store 2");
  
  console.log("\n" + "=".repeat(60));
  console.log("EXAMPLE: Remove Product 2 (Tomatoes) from Store 2:");
  console.log("=".repeat(60));
  console.log("\nRun this command:");
  console.log('export $(cat .env | grep DATABASE_URL) && npx tsx -e "');
  console.log('import { db } from \'./server/db\';');
  console.log('import { storeProducts } from \'@shared/schema\';');
  console.log('import { eq, and } from \'drizzle-orm\';');
  console.log('await db.delete(storeProducts).where(and(eq(storeProducts.storeId, 2), eq(storeProducts.productId, 2)));');
  console.log('console.log(\'✅ Removed Tomatoes from Store 2\');');
  console.log('process.exit(0);');
  console.log('"');
  
  process.exit(0);
}

manageProductStores().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
