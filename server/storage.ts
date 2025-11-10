import { 
  users, customers, products, transactions, transactionItems, 
  dayOperations, heldTransactions, creditTransactions,
  suppliers, supplierInvoices, supplierInvoiceItems, stockAdjustments, supplierPayments, savedReports,
  stockTakingSessions, stockTakingItems, dailyProductMonitoring,
  stores, userStores, storeProducts, generatedInvoices, generatedInvoiceItems, shifts,
  currencyRates, vatConfigurations, customerAuth, promotions, promotionRules, promotionUsage,
  productSiblings,
  type User, type InsertUser, type UpsertUser, type Customer, type InsertCustomer,
  type Product, type InsertProduct, type Transaction, type InsertTransaction,
  type TransactionItem, type InsertTransactionItem, type DayOperation, 
  type InsertDayOperation, type HeldTransaction, type InsertHeldTransaction,
  type CreditTransaction, type InsertCreditTransaction,
  type Supplier, type InsertSupplier, type SupplierInvoice, type InsertSupplierInvoice,
  type SupplierInvoiceItem, type InsertSupplierInvoiceItem,
  type StockAdjustment, type InsertStockAdjustment,
  type SupplierPayment, type InsertSupplierPayment, type SavedReport, type InsertSavedReport,
  type StockTakingSession, type InsertStockTakingSession,
  type StockTakingItem, type InsertStockTakingItem,
  type DailyProductMonitoring, type InsertDailyProductMonitoring,
  type Store, type InsertStore, type UserStore, type InsertUserStore, type StoreProduct, type InsertStoreProduct,
  type GeneratedInvoice, type InsertGeneratedInvoice, type GeneratedInvoiceItem, type InsertGeneratedInvoiceItem,
  type Shift, type InsertShift,
  type CurrencyRate, type InsertCurrencyRate, type VatConfiguration, type InsertVatConfiguration,
  type CustomerAuth, type InsertCustomerAuth, type Promotion, type InsertPromotion,
  type PromotionRule, type InsertPromotionRule, type PromotionUsage, type InsertPromotionUsage,
  type ProductSibling, type InsertProductSibling
} from "@shared/schema";
import { db } from "./db";
import * as productStorage from "./modules/products/storage";
import * as transactionStorage from "./modules/transactions/storage";
import { eq, like, desc, asc, and, or, ilike, gte, lte, sql, isNull, isNotNull } from "drizzle-orm";

type SanitizedUser = Pick<User, "id" | "username" | "email" | "firstName" | "lastName" | "profileImageUrl" | "role" | "defaultStoreId" | "isActive" | "createdAt" | "updatedAt">;

export type StoreAccess = Store & {
  assignmentId: number | null;
  canAccess: boolean | null;
  assignedAt: Date | null;
  assignedBy: number | null;
  accessType: "assignment" | "manager" | "default";
};

export type UserStoreAssignmentDetail = {
  store: Store;
  assignment: UserStore;
};

export type StoreUserAssignmentDetail = {
  user: SanitizedUser;
  assignment: UserStore;
};

export interface IStorage {
  // Users (Authentication)
  getUser(id: number): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserRole(username: string, role: string): Promise<User | undefined>;
  updateUserRoleById(id: number, role: string): Promise<User | undefined>;

  // Customers
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  getCustomerByEmail(email: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<boolean>;
  searchCustomers(query: string): Promise<Customer[]>;

  // Products
  getProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  getProductByBarcode(barcode: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
  searchProducts(query: string, category?: string, sort?: string): Promise<Product[]>;
  getRecentProducts(limit?: number): Promise<Product[]>;
  getProductCategories(): Promise<string[]>;

  // Product Siblings
  getProductSiblings(productId: number): Promise<Array<ProductSibling & { siblingProduct: Product }>>;
  addProductSibling(sibling: InsertProductSibling): Promise<ProductSibling>;
  removeProductSibling(siblingRelationId: number): Promise<boolean>;

  // Transactions
  getTransactions(storeId?: number): Promise<Transaction[]>;
  getTransaction(id: number): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: number, transaction: Partial<InsertTransaction>): Promise<Transaction | undefined>;
  refundTransaction(id: number, refundData: { reason: string; refundAmount: number; refundedBy: number; refundedAt: Date }): Promise<{ success: boolean; message: string; refundedTransaction?: Transaction }>;
  voidTransaction(id: number, voidData: { reason: string; voidedBy: number; voidedAt: Date }): Promise<{ success: boolean; message: string; voidedTransaction?: Transaction }>;
  getTransactionsByDate(date: string, storeId?: number): Promise<Transaction[]>;
  generateTransactionNumber(): Promise<string>;
  getReportStats(date: string, storeId?: number): Promise<{
    todaysRevenue: number;
    todaysOrders: number;
    totalRevenue: number;
    totalCustomers: number;
  }>;

  // Transaction Items
  getTransactionItems(transactionId: number): Promise<TransactionItem[]>;
  createTransactionItem(item: InsertTransactionItem): Promise<TransactionItem>;

  // Day Operations
  getCurrentDayOperation(storeId?: number): Promise<DayOperation | undefined>;
  getOpenDayOperation(storeId?: number): Promise<DayOperation | undefined>;
  getDayOperationById(id: number): Promise<DayOperation | undefined>;
  createDayOperation(dayOp: InsertDayOperation): Promise<DayOperation>;
  updateDayOperation(id: number, dayOp: Partial<InsertDayOperation>): Promise<DayOperation | undefined>;
  getDayOperationByDate(date: string, storeId?: number): Promise<DayOperation | undefined>;
  getLastClosedDayOperation(storeId?: number): Promise<DayOperation | undefined>;
  listDayOperations(options?: {
    storeId?: number;
    status?: DayOperation["status"];
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{ data: DayOperation[]; total: number }>;

  // Held Transactions
  getHeldTransactions(): Promise<HeldTransaction[]>;
  createHeldTransaction(heldTx: InsertHeldTransaction): Promise<HeldTransaction>;
  getHeldTransaction(id: number): Promise<HeldTransaction | undefined>;

  // Credit Transactions
  getCreditTransactions(customerId?: number, storeId?: number): Promise<CreditTransaction[]>;
  createCreditTransaction(creditTx: InsertCreditTransaction): Promise<CreditTransaction>;
  getCreditTransaction(id: number): Promise<CreditTransaction | undefined>;
  updateCustomerCreditBalance(customerId: number, amount: string): Promise<Customer | undefined>;

  // Suppliers
  getSuppliers(): Promise<Supplier[]>;
  getSupplier(id: number): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: number, supplier: Partial<InsertSupplier>): Promise<Supplier | undefined>;
  deleteSupplier(id: number): Promise<boolean>;
  searchSuppliers(query: string): Promise<Supplier[]>;

  // Supplier Invoices
  getSupplierInvoices(): Promise<SupplierInvoice[]>;
  getSupplierInvoice(id: number): Promise<SupplierInvoice | undefined>;
  getSupplierInvoiceByNumber(invoiceNumber: string): Promise<SupplierInvoice | undefined>;
  createSupplierInvoice(invoice: InsertSupplierInvoice): Promise<SupplierInvoice>;
  updateSupplierInvoice(id: number, invoice: Partial<InsertSupplierInvoice>): Promise<SupplierInvoice | undefined>;
  getSupplierInvoicesBySupplier(supplierId: number): Promise<SupplierInvoice[]>;

  // Supplier Invoice Items
  getSupplierInvoiceItems(invoiceId: number): Promise<SupplierInvoiceItem[]>;
  createSupplierInvoiceItem(item: InsertSupplierInvoiceItem): Promise<SupplierInvoiceItem>;
  updateSupplierInvoiceItem(id: number, item: Partial<InsertSupplierInvoiceItem>): Promise<SupplierInvoiceItem | undefined>;

  // Stock Adjustments
  getStockAdjustments(productId?: number): Promise<StockAdjustment[]>;
  createStockAdjustment(adjustment: InsertStockAdjustment): Promise<StockAdjustment>;
  getStockAdjustmentsByInvoice(invoiceId: number): Promise<StockAdjustment[]>;

  // Supplier Payments
  getSupplierPayments(invoiceId?: number): Promise<SupplierPayment[]>;
  createSupplierPayment(payment: InsertSupplierPayment): Promise<SupplierPayment>;
  getSupplierPaymentsByInvoice(invoiceId: number): Promise<SupplierPayment[]>;

  // Saved Reports
  getSavedReports(): Promise<SavedReport[]>;
  getSavedReport(id: number): Promise<SavedReport | undefined>;
  createSavedReport(report: InsertSavedReport): Promise<SavedReport>;
  updateSavedReport(id: number, report: Partial<InsertSavedReport>): Promise<SavedReport | undefined>;
  deleteSavedReport(id: number): Promise<boolean>;

  // Stock Taking
  getStockTakingSessions(): Promise<StockTakingSession[]>;
  getStockTakingSession(id: number): Promise<StockTakingSession | undefined>;
  createStockTakingSession(session: InsertStockTakingSession): Promise<StockTakingSession>;
  updateStockTakingSession(id: number, session: Partial<InsertStockTakingSession>): Promise<StockTakingSession | undefined>;
  getStockTakingItems(sessionId: number): Promise<StockTakingItem[]>;
  createStockTakingItem(item: InsertStockTakingItem): Promise<StockTakingItem>;
  submitStockTaking(items: any[], stockDate?: string): Promise<{ session: StockTakingSession; newProducts: number; updatedProducts: number }>;
  getStockTakingComparison(date: string): Promise<any[]>;
  updateProductsStockToZero(productIds: number[]): Promise<number>;

  // Daily Product Monitoring
  getProductsRequiringDailyMonitoring(): Promise<Product[]>;
  updateProductDailyMonitoring(productId: number, requiresDailyMonitoring: boolean): Promise<Product | undefined>;
  getDailyProductMonitoring(date: string): Promise<DailyProductMonitoring[]>;
  getDailyProductMonitoringByDayOperation(dayOperationId: number): Promise<DailyProductMonitoring[]>;
  initializeDailyProductMonitoring(dayOperationId: number): Promise<DailyProductMonitoring[]>;
  updateDailyProductMonitoring(id: number, data: Partial<InsertDailyProductMonitoring>): Promise<DailyProductMonitoring | undefined>;
  reconcileDailyProductMonitoring(id: number, actualClosingStock: number, notes?: string, reconciledBy?: number): Promise<DailyProductMonitoring | undefined>;

  // Shift management
  getActiveShifts(storeId?: number): Promise<Shift[]>;
  createShift(shift: InsertShift): Promise<Shift>;
  updateShift(id: number, shift: Partial<InsertShift>): Promise<Shift | undefined>;
  closeShift(id: number): Promise<Shift | undefined>;

  // Store Management
  getStores(): Promise<Store[]>;
  getStore(id: number): Promise<Store | undefined>;
  getStoreByCode(code: string): Promise<Store | undefined>;
  createStore(store: InsertStore): Promise<Store>;
  updateStore(id: number, store: Partial<InsertStore>): Promise<Store | undefined>;
  getActiveStores(): Promise<Store[]>;

  // Store Products (Store-specific pricing and inventory)
  getStoreProducts(storeId: number): Promise<StoreProduct[]>;
  getStoreProduct(storeId: number, productId: number): Promise<StoreProduct | undefined>;
  createStoreProduct(storeProduct: InsertStoreProduct): Promise<StoreProduct>;
  updateStoreProduct(storeId: number, productId: number, data: Partial<InsertStoreProduct>): Promise<StoreProduct | undefined>;
  deleteStoreProduct(storeId: number, productId: number): Promise<boolean>;
  getProductsByStore(storeId: number): Promise<Product[]>;
  getStoreSpecificPrice(storeId: number, productId: number): Promise<string | undefined>;
  searchStoreProducts(storeId: number, query: string): Promise<StoreProduct[]>;
  getStoreProductByBarcode(storeId: number, barcode: string): Promise<StoreProduct | undefined>;
  updateStoreProductStock(storeId: number, productId: number, quantity: number, operation: 'add' | 'subtract' | 'set'): Promise<StoreProduct | undefined>;

  // User Store Assignments
  getUserStoreAssignments(userId: number): Promise<UserStore[]>;
  getStoreUserAssignments(storeId: number): Promise<UserStore[]>;
  getUserStoreAssignmentsWithDetails(userId: number): Promise<UserStoreAssignmentDetail[]>;
  getStoreUserAssignmentsWithDetails(storeId: number): Promise<StoreUserAssignmentDetail[]>;
  assignUserToStore(userStore: InsertUserStore): Promise<UserStore>;
  removeUserFromStore(userId: number, storeId: number): Promise<boolean>;
  getUserAccessibleStores(userId: number): Promise<StoreAccess[]>;
  updateUserDefaultStore(userId: number, storeId: number | null): Promise<User | undefined>;
  updateUserStoreAccess(userId: number, storeId: number, canAccess: boolean): Promise<UserStore | undefined>;

  // VAT Management
  getVatConfigurations(storeId: number): Promise<VatConfiguration[]>;
  createVatConfiguration(config: InsertVatConfiguration): Promise<VatConfiguration>;
  updateVatConfiguration(id: number, config: Partial<InsertVatConfiguration>): Promise<VatConfiguration | undefined>;
  deleteVatConfiguration(id: number): Promise<boolean>;
  getVatRateForCategory(storeId: number, category?: string): Promise<number>;

  // Currency Management
  getCurrencyRates(): Promise<CurrencyRate[]>;
  getCurrencyRate(fromCurrency: string, toCurrency: string): Promise<CurrencyRate | undefined>;
  createCurrencyRate(rate: InsertCurrencyRate): Promise<CurrencyRate>;
  updateCurrencyRate(id: number, rate: Partial<InsertCurrencyRate>): Promise<CurrencyRate | undefined>;
  convertCurrency(amount: number, fromCurrency: string, toCurrency: string): Promise<number>;

  // Customer Authentication for Online Orders
  getCustomerAuth(customerId: number): Promise<CustomerAuth | undefined>;
  createCustomerAuth(auth: InsertCustomerAuth): Promise<CustomerAuth>;
  updateCustomerAuth(id: number, auth: Partial<InsertCustomerAuth>): Promise<CustomerAuth | undefined>;
  authenticateCustomer(email: string, password: string): Promise<{ customer: Customer; auth: CustomerAuth } | undefined>;
  resetCustomerPassword(email: string): Promise<string | undefined>; // Returns reset token
  updateCustomerPassword(token: string, newPassword: string): Promise<boolean>;

  // Promotions Management
  getPromotions(storeId: number): Promise<Promotion[]>;
  getActivePromotions(storeId: number): Promise<Promotion[]>;
  getPromotion(id: number): Promise<Promotion | undefined>;
  createPromotion(promotion: InsertPromotion): Promise<Promotion>;
  updatePromotion(id: number, promotion: Partial<InsertPromotion>): Promise<Promotion | undefined>;
  deletePromotion(id: number): Promise<boolean>;
  
  // Promotion Rules
  getPromotionRules(promotionId: number): Promise<PromotionRule[]>;
  createPromotionRule(rule: InsertPromotionRule): Promise<PromotionRule>;
  deletePromotionRule(id: number): Promise<boolean>;
  
  // Promotion Usage and Application
  getApplicablePromotions(storeId: number, cartItems: any[]): Promise<Promotion[]>;
  applyPromotion(promotionId: number, cartItems: any[]): Promise<{ success: boolean; discount: number; appliedItems: any[] }>;
  applyPromotions(storeId: number, items: any[], customerId?: number): Promise<{ promotions: Promotion[]; totalDiscount: number; appliedPromotions: any[] }>;
  recordPromotionUsage(usage: InsertPromotionUsage): Promise<PromotionUsage>;
  getPromotionUsage(promotionId?: number, customerId?: number): Promise<PromotionUsage[]>;
  
  // VAT Calculations
  calculateVAT(items: any[], storeId: number): Promise<{ vatAmount: number; itemsWithVat: any[] }>;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    // Initialize with seed data if database is empty
    this.seedDataIfEmpty();
  }

  private async seedDataIfEmpty() {
    try {
      const bcrypt = await import("bcryptjs");
      
      // Check if we have any users and seed demo users if empty
      const existingUsers = await db.select().from(users).limit(1);
      if (existingUsers.length === 0) {
        const demoUsers = [
          { username: "admin", password: "admin", firstName: "Admin", lastName: "User", role: "admin" },
          { username: "manager", password: "manager", firstName: "Manager", lastName: "User", role: "manager" },
          { username: "supervisor", password: "supervisor", firstName: "Supervisor", lastName: "User", role: "supervisor" },
          { username: "cashier", password: "cashier", firstName: "Cashier", lastName: "User", role: "cashier" },
          { username: "delivery", password: "delivery", firstName: "Delivery", lastName: "User", role: "delivery" },
          { username: "customer", password: "customer", firstName: "Customer", lastName: "User", role: "customer" },
        ];

        for (const user of demoUsers) {
          const hashedPassword = await bcrypt.default.hash(user.password, 10);
          await db.insert(users).values({
            username: user.username,
            password: hashedPassword,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            email: `${user.username}@example.com`,
            isActive: true,
          });
        }
        console.log("Demo users created successfully");
      }

      // Check if we have any customers and seed if empty
      const existingCustomers = await db.select().from(customers).limit(1);
      if (existingCustomers.length === 0) {
        // Seed some sample customers
        await db.insert(customers).values([
          {
            name: "John Doe",
            email: "john@example.com",
            phone: "555-0123",
            creditLimit: "1000.00",
            creditBalance: "0.00",
            isActive: true,
          },
          {
            name: "Jane Smith",
            email: "jane@example.com",
            phone: "555-0456",
            creditLimit: "500.00",
            creditBalance: "100.00",
            isActive: true,
          },
        ]);

        // Seed some sample products with mock image URLs
        await db.insert(products).values([
          {
            sku: "APPLE-001",
            name: "Red Apples",
            description: "Fresh red apples per pound",
            price: "3.99",
            cost: "2.00",
            stock: 50,
            barcode: "1234567890123",
            imageUrl: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400&h=400&fit=crop",
            category: "Fruits",
            isActive: true,
          },
          {
            sku: "BANANA-001",
            name: "Bananas",
            description: "Yellow bananas per bunch",
            price: "2.49",
            cost: "1.25",
            stock: 30,
            barcode: "1234567890124",
            imageUrl: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&h=400&fit=crop",
            category: "Fruits",
            isActive: true,
          },
          {
            sku: "MILK-001",
            name: "Whole Milk",
            description: "1 gallon whole milk",
            price: "4.99",
            cost: "3.50",
            stock: 20,
            barcode: "1234567890125",
            imageUrl: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&h=400&fit=crop",
            category: "Dairy",
            isActive: true,
          },
          {
            sku: "BREAD-001",
            name: "White Bread",
            description: "Sliced white bread loaf",
            price: "2.99",
            cost: "1.80",
            stock: 25,
            barcode: "1234567890126",
            imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=400&fit=crop",
            category: "Bakery",
            isActive: true,
          },
          {
            sku: "COFFEE-001",
            name: "Premium Coffee Beans",
            description: "Arabica coffee beans - 1lb bag",
            price: "12.99",
            cost: "7.50",
            stock: 40,
            barcode: "1234567890127",
            imageUrl: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&h=400&fit=crop",
            category: "Beverages",
            isActive: true,
          },
          {
            sku: "PASTA-001",
            name: "Spaghetti Pasta",
            description: "Italian durum wheat pasta - 500g",
            price: "3.49",
            cost: "1.75",
            stock: 60,
            barcode: "1234567890128",
            imageUrl: "https://images.unsplash.com/photo-1551892374-ecf8050cf384?w=400&h=400&fit=crop",
            category: "Pantry",
            isActive: true,
          },
          {
            sku: "CHEESE-001",
            name: "Cheddar Cheese",
            description: "Aged cheddar cheese block - 8oz",
            price: "5.99",
            cost: "3.25",
            stock: 35,
            barcode: "1234567890129",
            imageUrl: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400&h=400&fit=crop",
            category: "Dairy",
            isActive: true,
          },
          {
            sku: "CHIPS-001",
            name: "Potato Chips",
            description: "Crispy salted potato chips - family size",
            price: "4.49",
            cost: "2.10",
            stock: 50,
            barcode: "1234567890130",
            imageUrl: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&h=400&fit=crop",
            category: "Snacks",
            isActive: true,
          },
          {
            sku: "JUICE-001",
            name: "Orange Juice",
            description: "Fresh squeezed orange juice - 64oz",
            price: "6.99",
            cost: "4.25",
            stock: 25,
            barcode: "1234567890131",
            imageUrl: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&h=400&fit=crop",
            category: "Beverages",
            isActive: true,
          },
          {
            sku: "SOAP-001",
            name: "Hand Soap",
            description: "Antibacterial hand soap - 16oz pump",
            price: "3.99",
            cost: "1.90",
            stock: 45,
            barcode: "1234567890132",
            imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop",
            category: "Household",
            isActive: true,
          },
        ]);
      }
    } catch (error) {
      console.error("Error seeding data:", error);
    }
  }

  // User methods (Authentication)
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.username,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.isActive, true));
  }

  async updateUserRole(username: string, role: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.username, username))
      .returning();
    return user || undefined;
  }

  async updateUserRoleById(id: number, role: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  // Customer methods
  async getCustomers(): Promise<Customer[]> {
    return await db.select().from(customers).where(eq(customers.isActive, true)).orderBy(desc(customers.id));
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer || undefined;
  }

  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.email, email));
    return customer || undefined;
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const [customer] = await db
      .insert(customers)
      .values(insertCustomer)
      .returning();
    return customer;
  }

  async updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [updatedCustomer] = await db
      .update(customers)
      .set(customer)
      .where(eq(customers.id, id))
      .returning();
    return updatedCustomer || undefined;
  }

  async deleteCustomer(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(customers)
        .where(eq(customers.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error("Error deleting customer:", error);
      return false;
    }
  }

  async searchCustomers(query: string): Promise<Customer[]> {
    return await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.isActive, true),
          like(customers.name, `%${query}%`)
        )
      );
  }

  // Product methods
  async getProducts(): Promise<Product[]> {
    return productStorage.getProducts();
  }

  async getProduct(id: number): Promise<Product | undefined> {
    return productStorage.getProduct(id);
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    return productStorage.getProductBySku(sku);
  }

  async getProductByBarcode(barcode: string): Promise<Product | undefined> {
    return productStorage.getProductByBarcode(barcode);
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    return productStorage.createProduct(insertProduct);
  }

  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined> {
    return productStorage.updateProduct(id, product);
  }

  async deleteProduct(id: number): Promise<boolean> {
    return productStorage.deleteProduct(id);
  }

  async searchProducts(query: string, category?: string, sort?: string): Promise<Product[]> {
    return productStorage.searchProducts(query, category, sort);
  }

  async getProductCategories(): Promise<string[]> {
    return productStorage.getProductCategories();
  }

  async getRecentProducts(limit = 8): Promise<Product[]> {
    return productStorage.getRecentProducts(limit);
  }

  // Product Siblings methods
  async getProductSiblings(productId: number): Promise<Array<ProductSibling & { siblingProduct: Product }>> {
    const siblings = await db
      .select({
        id: productSiblings.id,
        productId: productSiblings.productId,
        siblingId: productSiblings.siblingId,
        relationshipType: productSiblings.relationshipType,
        notes: productSiblings.notes,
        createdAt: productSiblings.createdAt,
        createdBy: productSiblings.createdBy,
        siblingProduct: products,
      })
      .from(productSiblings)
      .innerJoin(products, eq(productSiblings.siblingId, products.id))
      .where(eq(productSiblings.productId, productId))
      .orderBy(desc(productSiblings.createdAt));

    return siblings;
  }

  async addProductSibling(sibling: InsertProductSibling): Promise<ProductSibling> {
    const [newSibling] = await db.insert(productSiblings).values(sibling).returning();
    if (!newSibling) {
      throw new Error("Failed to create product sibling");
    }
    return newSibling;
  }

  async removeProductSibling(siblingRelationId: number): Promise<boolean> {
    const result = await db
      .delete(productSiblings)
      .where(eq(productSiblings.id, siblingRelationId));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Transaction methods
  async getTransactions(storeId?: number): Promise<Transaction[]> {
    return transactionStorage.getTransactions(storeId);
  }

  async getTransaction(id: number): Promise<Transaction | undefined> {
    return transactionStorage.getTransaction(id);
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    return transactionStorage.createTransaction(insertTransaction);
  }

  async updateTransaction(id: number, transaction: Partial<InsertTransaction>): Promise<Transaction | undefined> {
    return transactionStorage.updateTransaction(id, transaction);
  }

  async refundTransaction(
    id: number,
    refundData: { reason: string; refundAmount: number; refundedBy: number; refundedAt: Date },
  ): Promise<{ success: boolean; message: string; refundedTransaction?: Transaction }> {
    return transactionStorage.refundTransaction(id, refundData, this);
  }

  async voidTransaction(
    id: number,
    voidData: { reason: string; voidedBy: number; voidedAt: Date },
  ): Promise<{ success: boolean; message: string; voidedTransaction?: Transaction }> {
    return transactionStorage.voidTransaction(id, voidData, this);
  }

  async getTransactionsByDate(date: string, storeId?: number): Promise<Transaction[]> {
    return transactionStorage.getTransactionsByDate(date, storeId);
  }

  async generateTransactionNumber(): Promise<string> {
    return transactionStorage.generateTransactionNumber();
  }

  async getReportStats(date: string, storeId?: number): Promise<{
    todaysRevenue: number;
    todaysOrders: number;
    totalRevenue: number;
    totalCustomers: number;
  }> {
    // Get today's transactions
    const todaysTransactions = await transactionStorage.getTransactionsByDate(date, storeId);
    
    // Calculate today's revenue (only completed transactions)
    const todaysRevenue = todaysTransactions
      .filter(tx => tx.status === 'completed')
      .reduce((sum, tx) => sum + parseFloat(tx.total || "0"), 0);
    
    // Count today's orders (only completed transactions)
    const todaysOrders = todaysTransactions.filter(tx => tx.status === 'completed').length;
    
    // Get all transactions for total revenue and customers
    const allTransactions = await transactionStorage.getTransactions(storeId);
    
    // Calculate total revenue (all time, only completed transactions)
    const totalRevenue = allTransactions
      .filter(tx => tx.status === 'completed')
      .reduce((sum, tx) => sum + parseFloat(tx.total || "0"), 0);
    
    // Count unique customers (only from completed transactions)
    const uniqueCustomerIds = new Set(
      allTransactions
        .filter(tx => tx.status === 'completed' && tx.customerId)
        .map(tx => tx.customerId)
    );
    const totalCustomers = uniqueCustomerIds.size;
    
    return {
      todaysRevenue,
      todaysOrders,
      totalRevenue,
      totalCustomers
    };
  }

  // Transaction Items
  async getTransactionItems(transactionId: number): Promise<TransactionItem[]> {
    return transactionStorage.getTransactionItems(transactionId);
  }

  async createTransactionItem(insertItem: InsertTransactionItem): Promise<TransactionItem> {
    return transactionStorage.createTransactionItem(insertItem);
  }

  // Day Operations methods
  async getCurrentDayOperation(storeId?: number): Promise<DayOperation | undefined> {
    const today = new Date().toISOString().slice(0, 10);
    const whereConditions = [
      eq(dayOperations.date, today),
      eq(dayOperations.status, 'open')
    ];
    
    if (storeId) {
      whereConditions.push(eq(dayOperations.storeId, storeId));
    }
    
    const [dayOp] = await db
      .select()
      .from(dayOperations)
      .where(and(...whereConditions));
    return dayOp || undefined;
  }

  async getOpenDayOperation(storeId?: number): Promise<DayOperation | undefined> {
    const whereConditions = [eq(dayOperations.status, 'open')];
    
    if (storeId) {
      whereConditions.push(eq(dayOperations.storeId, storeId));
    }
    
    const [dayOp] = await db
      .select()
      .from(dayOperations)
      .where(and(...whereConditions))
      .orderBy(desc(dayOperations.date));
    return dayOp || undefined;
  }

  async getDayOperationById(id: number): Promise<DayOperation | undefined> {
    const [dayOp] = await db
      .select()
      .from(dayOperations)
      .where(eq(dayOperations.id, id));
    return dayOp || undefined;
  }

  async createDayOperation(insertDayOp: InsertDayOperation): Promise<DayOperation> {
    const [dayOp] = await db
      .insert(dayOperations)
      .values({
        ...insertDayOp,
        openedAt: new Date(),
        closedAt: null,
      })
      .returning();
    return dayOp;
  }

  async updateDayOperation(id: number, dayOp: Partial<InsertDayOperation>): Promise<DayOperation | undefined> {
    const updateData: any = { ...dayOp };
    if (dayOp.status === 'closed') {
      updateData.closedAt = new Date();
    } else if (dayOp.status === 'open' && 'reopenedAt' in dayOp) {
      // Handle reopening
      updateData.closedAt = null;
      updateData.reopenedAt = new Date();
    }
    
    const [updatedDayOp] = await db
      .update(dayOperations)
      .set(updateData)
      .where(eq(dayOperations.id, id))
      .returning();
    return updatedDayOp || undefined;
  }

  async getDayOperationByDate(date: string, storeId?: number): Promise<DayOperation | undefined> {
    const whereConditions = [eq(dayOperations.date, date)];
    
    if (storeId) {
      whereConditions.push(eq(dayOperations.storeId, storeId));
    }
    
    const [dayOp] = await db
      .select()
      .from(dayOperations)
      .where(and(...whereConditions));
    return dayOp || undefined;
  }

  async getLastClosedDayOperation(storeId?: number): Promise<DayOperation | undefined> {
    const whereConditions = [eq(dayOperations.status, 'closed')];

    if (storeId) {
      whereConditions.push(eq(dayOperations.storeId, storeId));
    }

    const [dayOp] = await db
      .select()
      .from(dayOperations)
      .where(and(...whereConditions))
      .orderBy(desc(dayOperations.date))
      .limit(1);
    return dayOp || undefined;
  }

  async listDayOperations(options: {
    storeId?: number;
    status?: DayOperation['status'];
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<{ data: DayOperation[]; total: number }> {
    const {
      storeId,
      status,
      limit = 30,
      offset = 0,
      startDate,
      endDate
    } = options;

    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safeOffset = Math.max(offset, 0);

    const whereConditions = [] as any[];

    if (storeId) {
      whereConditions.push(eq(dayOperations.storeId, storeId));
    }

    if (status) {
      whereConditions.push(eq(dayOperations.status, status));
    }

    if (startDate) {
      whereConditions.push(gte(dayOperations.date, startDate));
    }

    if (endDate) {
      whereConditions.push(lte(dayOperations.date, endDate));
    }

    const whereClause = whereConditions.length ? and(...whereConditions) : undefined;

    const dataQuery = db
      .select()
      .from(dayOperations)
      .orderBy(desc(dayOperations.date), desc(dayOperations.id))
      .limit(safeLimit)
      .offset(safeOffset);

    const totalQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(dayOperations);

    const [data, totalResult] = await Promise.all([
      whereClause ? dataQuery.where(whereClause) : dataQuery,
      whereClause ? totalQuery.where(whereClause) : totalQuery
    ]);

    const total = Number(totalResult[0]?.count ?? 0);

    return { data, total };
  }

  // Held Transactions methods
  async getHeldTransactions(): Promise<HeldTransaction[]> {
    return await db.select().from(heldTransactions).orderBy(desc(heldTransactions.createdAt));
  }

  async createHeldTransaction(insertHeldTx: InsertHeldTransaction): Promise<HeldTransaction> {
    const [heldTx] = await db
      .insert(heldTransactions)
      .values(insertHeldTx)
      .returning();
    return heldTx;
  }

  async getHeldTransaction(id: number): Promise<HeldTransaction | undefined> {
    const [heldTx] = await db.select().from(heldTransactions).where(eq(heldTransactions.id, id));
    return heldTx || undefined;
  }

  async deleteHeldTransaction(id: number): Promise<boolean> {
    const result = await db.delete(heldTransactions).where(eq(heldTransactions.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Credit Transactions methods
  async getCreditTransactions(customerId?: number, storeId?: number): Promise<CreditTransaction[]> {
    if (storeId && customerId) {
      // When both storeId and customerId are provided:
      // 1. Include credit transactions with transactionId that match the storeId
      // 2. Include credit transactions without transactionId (manual transactions) for this customer
      const results = await db.select({
        creditTransaction: creditTransactions,
        transaction: transactions
      })
        .from(creditTransactions)
        .leftJoin(transactions, eq(creditTransactions.transactionId, transactions.id))
        .where(
          and(
            eq(creditTransactions.customerId, customerId),
            or(
              // Include transactions with matching storeId
              eq(transactions.storeId, storeId),
              // Include manual transactions (no transactionId) for this customer
              isNull(creditTransactions.transactionId)
            )
          )
        )
        .orderBy(desc(creditTransactions.createdAt));
      
      return results.map(r => r.creditTransaction);
    } else if (storeId) {
      // When only storeId is provided, only include transactions with transactionId that match storeId
      const results = await db.select({
        creditTransaction: creditTransactions
      })
        .from(creditTransactions)
        .innerJoin(transactions, eq(creditTransactions.transactionId, transactions.id))
        .where(eq(transactions.storeId, storeId))
        .orderBy(desc(creditTransactions.createdAt));
      
      return results.map(r => r.creditTransaction);
    }
    
    if (customerId) {
      // Return all transactions for the customer, no limit
      return await db.select()
        .from(creditTransactions)
        .where(eq(creditTransactions.customerId, customerId))
        .orderBy(desc(creditTransactions.createdAt));
    }
    
    // Return all transactions, no limit
    return await db.select()
      .from(creditTransactions)
      .orderBy(desc(creditTransactions.createdAt));
  }

  async createCreditTransaction(insertCreditTx: InsertCreditTransaction): Promise<CreditTransaction> {
    const [creditTx] = await db
      .insert(creditTransactions)
      .values(insertCreditTx)
      .returning();
    return creditTx;
  }

  async getCreditTransaction(id: number): Promise<CreditTransaction | undefined> {
    const [creditTx] = await db.select().from(creditTransactions).where(eq(creditTransactions.id, id));
    return creditTx || undefined;
  }

  async updateCustomerCreditBalance(customerId: number, amount: string): Promise<Customer | undefined> {
    const [customer] = await db
      .update(customers)
      .set({ creditBalance: amount })
      .where(eq(customers.id, customerId))
      .returning();
    return customer || undefined;
  }

  // Supplier methods
  async getSuppliers(): Promise<Supplier[]> {
    return await db.select().from(suppliers).where(eq(suppliers.isActive, true));
  }

  async getSupplier(id: number): Promise<Supplier | undefined> {
    const [result] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return result || undefined;
  }

  async createSupplier(insertSupplier: InsertSupplier): Promise<Supplier> {
    const [result] = await db.insert(suppliers).values(insertSupplier).returning();
    return result;
  }

  async updateSupplier(id: number, supplier: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const [result] = await db
      .update(suppliers)
      .set(supplier)
      .where(eq(suppliers.id, id))
      .returning();
    return result || undefined;
  }

  async deleteSupplier(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(suppliers)
        .where(eq(suppliers.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error("Error deleting supplier:", error);
      return false;
    }
  }

  async searchSuppliers(query: string): Promise<Supplier[]> {
    const searchTerm = `%${query}%`;
    return await db
      .select()
      .from(suppliers)
      .where(
        and(
          eq(suppliers.isActive, true),
          or(
            like(suppliers.name, searchTerm),
            like(suppliers.email, searchTerm),
            like(suppliers.phone, searchTerm)
          )
        )
      );
  }

  // Supplier Invoice methods
  async getSupplierInvoices(): Promise<SupplierInvoice[]> {
    return await db.select().from(supplierInvoices).orderBy(desc(supplierInvoices.createdAt));
  }

  async getSupplierInvoice(id: number): Promise<SupplierInvoice | undefined> {
    const [result] = await db.select().from(supplierInvoices).where(eq(supplierInvoices.id, id));
    return result || undefined;
  }

  async getSupplierInvoiceByNumber(invoiceNumber: string): Promise<SupplierInvoice | undefined> {
    const [result] = await db.select().from(supplierInvoices).where(eq(supplierInvoices.invoiceNumber, invoiceNumber));
    return result || undefined;
  }

  async createSupplierInvoice(insertInvoice: InsertSupplierInvoice): Promise<SupplierInvoice> {
    const [result] = await db.insert(supplierInvoices).values(insertInvoice).returning();
    return result;
  }

  async updateSupplierInvoice(id: number, invoice: Partial<InsertSupplierInvoice>): Promise<SupplierInvoice | undefined> {
    const [result] = await db
      .update(supplierInvoices)
      .set(invoice)
      .where(eq(supplierInvoices.id, id))
      .returning();
    return result || undefined;
  }

  async getSupplierInvoicesBySupplier(supplierId: number): Promise<SupplierInvoice[]> {
    return await db.select()
      .from(supplierInvoices)
      .where(eq(supplierInvoices.supplierId, supplierId))
      .orderBy(desc(supplierInvoices.createdAt));
  }

  // Supplier Invoice Items methods
  async getSupplierInvoiceItems(invoiceId: number): Promise<SupplierInvoiceItem[]> {
    return await db.select().from(supplierInvoiceItems).where(eq(supplierInvoiceItems.invoiceId, invoiceId));
  }

  async createSupplierInvoiceItem(insertItem: InsertSupplierInvoiceItem): Promise<SupplierInvoiceItem> {
    const [result] = await db.insert(supplierInvoiceItems).values(insertItem).returning();
    return result;
  }

  async updateSupplierInvoiceItem(id: number, item: Partial<InsertSupplierInvoiceItem>): Promise<SupplierInvoiceItem | undefined> {
    const [result] = await db
      .update(supplierInvoiceItems)
      .set(item)
      .where(eq(supplierInvoiceItems.id, id))
      .returning();
    return result || undefined;
  }

  // Stock Adjustments methods
  async getStockAdjustments(productId?: number): Promise<StockAdjustment[]> {
    if (productId) {
      return await db.select().from(stockAdjustments).where(eq(stockAdjustments.productId, productId));
    }
    return await db.select().from(stockAdjustments).orderBy(desc(stockAdjustments.createdAt));
  }

  async createStockAdjustment(insertAdjustment: InsertStockAdjustment): Promise<StockAdjustment> {
    const [result] = await db.insert(stockAdjustments).values(insertAdjustment).returning();
    return result;
  }

  async getStockAdjustmentsByInvoice(invoiceId: number): Promise<StockAdjustment[]> {
    return await db.select().from(stockAdjustments).where(eq(stockAdjustments.invoiceId, invoiceId));
  }

  // Supplier Payments methods
  async getSupplierPayments(invoiceId?: number): Promise<SupplierPayment[]> {
    if (invoiceId) {
      return await db.select().from(supplierPayments).where(eq(supplierPayments.invoiceId, invoiceId));
    }
    return await db.select().from(supplierPayments).orderBy(desc(supplierPayments.createdAt));
  }

  async createSupplierPayment(insertPayment: InsertSupplierPayment): Promise<SupplierPayment> {
    const [result] = await db.insert(supplierPayments).values(insertPayment).returning();
    return result;
  }

  async getSupplierPaymentsByInvoice(invoiceId: number): Promise<SupplierPayment[]> {
    return await db.select().from(supplierPayments).where(eq(supplierPayments.invoiceId, invoiceId));
  }

  // Saved Reports methods
  async getSavedReports(): Promise<SavedReport[]> {
    return await db.select().from(savedReports).orderBy(desc(savedReports.createdAt));
  }

  async getSavedReport(id: number): Promise<SavedReport | undefined> {
    const [report] = await db.select().from(savedReports).where(eq(savedReports.id, id));
    return report || undefined;
  }

  async createSavedReport(insertReport: InsertSavedReport): Promise<SavedReport> {
    const [report] = await db.insert(savedReports).values(insertReport).returning();
    return report;
  }

  async updateSavedReport(id: number, report: Partial<InsertSavedReport>): Promise<SavedReport | undefined> {
    const [updatedReport] = await db
      .update(savedReports)
      .set({ ...report, updatedAt: new Date() })
      .where(eq(savedReports.id, id))
      .returning();
    return updatedReport || undefined;
  }

  async deleteSavedReport(id: number): Promise<boolean> {
    const result = await db.delete(savedReports).where(eq(savedReports.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Stock Taking methods
  async getStockTakingSessions(): Promise<StockTakingSession[]> {
    return await db.select().from(stockTakingSessions).orderBy(desc(stockTakingSessions.createdAt));
  }

  async getStockTakingSession(id: number): Promise<StockTakingSession | undefined> {
    const [session] = await db.select().from(stockTakingSessions).where(eq(stockTakingSessions.id, id));
    return session || undefined;
  }

  async createStockTakingSession(insertSession: InsertStockTakingSession): Promise<StockTakingSession> {
    const [session] = await db
      .insert(stockTakingSessions)
      .values({
        ...insertSession,
        createdAt: new Date(),
      })
      .returning();
    return session;
  }

  async updateStockTakingSession(id: number, session: Partial<InsertStockTakingSession>): Promise<StockTakingSession | undefined> {
    const updateData: any = { ...session };
    if (session.status === 'completed') {
      updateData.completedAt = new Date();
    }
    
    const [updatedSession] = await db
      .update(stockTakingSessions)
      .set(updateData)
      .where(eq(stockTakingSessions.id, id))
      .returning();
    return updatedSession || undefined;
  }

  async getStockTakingItems(sessionId: number): Promise<StockTakingItem[]> {
    return await db.select().from(stockTakingItems).where(eq(stockTakingItems.sessionId, sessionId));
  }

  async createStockTakingItem(insertItem: InsertStockTakingItem): Promise<StockTakingItem> {
    const [item] = await db
      .insert(stockTakingItems)
      .values({
        ...insertItem,
        createdAt: new Date(),
      })
      .returning();
    return item;
  }

  async submitStockTaking(items: any[], stockDate?: string): Promise<{ session: StockTakingSession; newProducts: number; updatedProducts: number }> {
    let newProducts = 0;
    let updatedProducts = 0;
    
    const sessionDate = stockDate || new Date().toISOString().slice(0, 10);
    const session = await this.createStockTakingSession({
      sessionDate,
      status: 'completed',
      totalItems: items.length,
      totalVarianceValue: items.reduce((sum, item) => sum + parseFloat(item.varianceValue || '0'), 0).toFixed(2),
    });

    for (const item of items) {
      await this.createStockTakingItem({
        sessionId: session.id,
        productId: item.productId || null,
        sku: item.sku,
        barcode: item.barcode || null,
        name: item.name,
        uom: item.uom || 'pcs',
        systemQty: item.systemQty.toString(),
        actualQty: item.actualQty.toString(),
        variance: item.variance.toString(),
        costPrice: item.costPrice || '0.00',
        varianceValue: item.varianceValue || '0.00',
        notes: item.notes || null,
        isNewProduct: !item.productId,
      });

      if (!item.productId) {
        // Create new product
        await this.createProduct({
          sku: item.sku,
          name: item.name,
          description: `Product created during stock taking on ${sessionDate}`,
          price: item.costPrice || '0.00',
          cost: item.costPrice || '0.00',
          stock: parseInt(item.actualQty) || 0,
          barcode: item.barcode || null,
          isActive: true,
        });
        newProducts++;
      } else {
        // Update existing product stock
        const existingProduct = await this.getProduct(item.productId);
        if (existingProduct) {
          await this.updateProduct(item.productId, {
            stock: parseInt(item.actualQty) || 0,
          });
          updatedProducts++;
        }
      }
    }

    await this.updateStockTakingSession(session.id, {
      newProducts,
      totalItems: items.length,
    });

    return { session, newProducts, updatedProducts };
  }

  async getStockTakingComparison(date: string): Promise<any[]> {
    const comparisonData: any[] = [];
    
    const stockTakingItemsResult = await db
      .select()
      .from(stockTakingItems)
      .where(sql`DATE(${stockTakingItems.createdAt}) = ${date}`);

    const countedItemsMap = new Map();
    stockTakingItemsResult.forEach((item) => {
      const productId = item.productId;
      countedItemsMap.set(productId, item);
    });

    // Create comparison data for counted items
    const countedItems = Array.from(countedItemsMap.entries());
    for (const [productId, item] of countedItems) {
      comparisonData.push({
        ...item,
        status: 'counted'
      });
    }

    // Add products that weren't counted
    const allProducts = await db.select().from(products).where(eq(products.isActive, true));
    for (const product of allProducts) {
      if (!countedItemsMap.has(product.id)) {
        comparisonData.push({
          productId: product.id,
          sku: product.sku,
          name: product.name,
          systemQty: product.stock?.toString() || '0',
          actualQty: '0',
          variance: (-(product.stock || 0)).toString(),
          status: 'not_counted'
        });
      }
    }

    return comparisonData;
  }

  async updateProductsStockToZero(productIds: number[]): Promise<number> {
    let updatedCount = 0;
    for (const productId of productIds) {
      const product = await this.getProduct(productId);
      if (product) {
        await this.updateProduct(productId, { stock: 0 });
        updatedCount++;
      }
    }
    return updatedCount;
  }

  // Daily Product Monitoring methods
  async getProductsRequiringDailyMonitoring(): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.requiresDailyMonitoring, true));
  }

  async updateProductDailyMonitoring(productId: number, requiresDailyMonitoring: boolean): Promise<Product | undefined> {
    const [product] = await db
      .update(products)
      .set({ requiresDailyMonitoring })
      .where(eq(products.id, productId))
      .returning();
    return product || undefined;
  }

  async getDailyProductMonitoring(date: string): Promise<DailyProductMonitoring[]> {
    return await db.select().from(dailyProductMonitoring).where(eq(dailyProductMonitoring.date, date));
  }

  async getDailyProductMonitoringByDayOperation(dayOperationId: number): Promise<DailyProductMonitoring[]> {
    return await db
      .select({
        id: dailyProductMonitoring.id,
        dayOperationId: dailyProductMonitoring.dayOperationId,
        productId: dailyProductMonitoring.productId,
        date: dailyProductMonitoring.date,
        openingStock: dailyProductMonitoring.openingStock,
        openingValue: dailyProductMonitoring.openingValue,
        totalSalesQty: dailyProductMonitoring.totalSalesQty,
        cashSalesQty: dailyProductMonitoring.cashSalesQty,
        cardSalesQty: dailyProductMonitoring.cardSalesQty,
        creditSalesQty: dailyProductMonitoring.creditSalesQty,
        totalSalesValue: dailyProductMonitoring.totalSalesValue,
        cashSalesValue: dailyProductMonitoring.cashSalesValue,
        cardSalesValue: dailyProductMonitoring.cardSalesValue,
        creditSalesValue: dailyProductMonitoring.creditSalesValue,
        totalPurchaseQty: dailyProductMonitoring.totalPurchaseQty,
        totalPurchaseValue: dailyProductMonitoring.totalPurchaseValue,
        manualOpeningStock: dailyProductMonitoring.manualOpeningStock,
        manualSalesQty: dailyProductMonitoring.manualSalesQty,
        manualPurchaseQty: dailyProductMonitoring.manualPurchaseQty,
        manualClosingStock: dailyProductMonitoring.manualClosingStock,
        systemClosingStock: dailyProductMonitoring.systemClosingStock,
        actualClosingStock: dailyProductMonitoring.actualClosingStock,
        variance: dailyProductMonitoring.variance,
        varianceValue: dailyProductMonitoring.varianceValue,
        isReconciled: dailyProductMonitoring.isReconciled,
        notes: dailyProductMonitoring.notes,
        reconciledBy: dailyProductMonitoring.reconciledBy,
        reconciledAt: dailyProductMonitoring.reconciledAt,
        createdAt: dailyProductMonitoring.createdAt,
        updatedAt: dailyProductMonitoring.updatedAt,
        product: {
          id: products.id,
          sku: products.sku,
          name: products.name,
          description: products.description,
          price: products.price,
          cost: products.cost,
          stock: products.stock,
          quantity: products.quantity,
          barcode: products.barcode,
          imageUrl: products.imageUrl,
          category: products.category,
          supplierId: products.supplierId,
          isActive: products.isActive,
          requiresDailyMonitoring: products.requiresDailyMonitoring,
        }
      })
      .from(dailyProductMonitoring)
      .leftJoin(products, eq(dailyProductMonitoring.productId, products.id))
      .where(eq(dailyProductMonitoring.dayOperationId, dayOperationId));
  }

  async initializeDailyProductMonitoring(dayOperationId: number): Promise<DailyProductMonitoring[]> {
    // Get the day operation to get the date
    const dayOperation = await this.getDayOperationById(dayOperationId);
    if (!dayOperation) {
      throw new Error("Day operation not found");
    }

    // Get all products requiring daily monitoring
    const monitoringProducts = await this.getProductsRequiringDailyMonitoring();
    
    const monitoringRecords: DailyProductMonitoring[] = [];
    
    for (const product of monitoringProducts) {
      // Check if monitoring record already exists for this day and product
      const existing = await db
        .select()
        .from(dailyProductMonitoring)
        .where(
          and(
            eq(dailyProductMonitoring.dayOperationId, dayOperationId),
            eq(dailyProductMonitoring.productId, product.id)
          )
        );

      if (existing.length === 0) {
        // Calculate opening stock from product's current stock
        const openingStock = product.stock || 0;
        const openingValue = (product.cost || '0') === '0' ? '0.00' : (parseFloat(product.cost || '0') * openingStock).toFixed(2);

        // Auto-populate sales data from transactions for this date
        const salesData = await db
          .select({
            totalQty: sql<number>`COALESCE(SUM(${transactionItems.quantity}), 0)`,
            cashQty: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.paymentMethod} = 'cash' THEN ${transactionItems.quantity} ELSE 0 END), 0)`,
            cardQty: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.paymentMethod} = 'card' THEN ${transactionItems.quantity} ELSE 0 END), 0)`,
            creditQty: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.paymentMethod} = 'credit' THEN ${transactionItems.quantity} ELSE 0 END), 0)`,
            totalValue: sql<string>`COALESCE(SUM(${transactionItems.total}), 0)`,
            cashValue: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.paymentMethod} = 'cash' THEN ${transactionItems.total} ELSE 0 END), 0)`,
            cardValue: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.paymentMethod} = 'card' THEN ${transactionItems.total} ELSE 0 END), 0)`,
            creditValue: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.paymentMethod} = 'credit' THEN ${transactionItems.total} ELSE 0 END), 0)`,
          })
          .from(transactionItems)
          .leftJoin(transactions, eq(transactionItems.transactionId, transactions.id))
          .where(
            and(
              eq(transactionItems.productId, product.id),
              sql`DATE(${transactions.createdAt}) = ${dayOperation.date}`,
              eq(transactions.status, 'completed')
            )
          );

        const sales = salesData[0] || {
          totalQty: 0, cashQty: 0, cardQty: 0, creditQty: 0,
          totalValue: '0.00', cashValue: '0.00', cardValue: '0.00', creditValue: '0.00'
        };

        // Auto-populate purchase data from supplier invoices for this date
        const purchaseData = await db
          .select({
            totalQty: sql<number>`COALESCE(SUM(${supplierInvoiceItems.quantity}), 0)`,
            totalValue: sql<string>`COALESCE(SUM(${supplierInvoiceItems.totalCost}), 0)`
          })
          .from(supplierInvoiceItems)
          .leftJoin(supplierInvoices, eq(supplierInvoiceItems.invoiceId, supplierInvoices.id))
          .where(
            and(
              eq(supplierInvoiceItems.productId, product.id),
              sql`DATE(${supplierInvoices.invoiceDate}) = ${dayOperation.date}`,
              eq(supplierInvoices.type, 'receipt')
            )
          );

        const purchases = purchaseData[0] || { totalQty: 0, totalValue: '0.00' };

        // Calculate system closing stock
        const systemClosingStock = openingStock + purchases.totalQty - sales.totalQty;

        const [monitoringRecord] = await db
          .insert(dailyProductMonitoring)
          .values({
            dayOperationId,
            productId: product.id,
            date: dayOperation.date,
            openingStock: openingStock.toString(),
            openingValue,
            totalSalesQty: sales.totalQty.toString(),
            cashSalesQty: sales.cashQty.toString(),
            cardSalesQty: sales.cardQty.toString(),
            creditSalesQty: sales.creditQty.toString(),
            totalSalesValue: sales.totalValue,
            cashSalesValue: sales.cashValue,
            cardSalesValue: sales.cardValue,
            creditSalesValue: sales.creditValue,
            totalPurchaseQty: purchases.totalQty.toString(),
            totalPurchaseValue: purchases.totalValue,
            systemClosingStock: systemClosingStock.toString(),
            variance: '0.00',
            varianceValue: '0.00',
            isReconciled: false,
          })
          .returning();

        monitoringRecords.push(monitoringRecord);
      }
    }

    return monitoringRecords;
  }

  async updateDailyProductMonitoring(id: number, data: Partial<InsertDailyProductMonitoring>): Promise<DailyProductMonitoring | undefined> {
    const [monitoring] = await db
      .update(dailyProductMonitoring)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(dailyProductMonitoring.id, id))
      .returning();
    return monitoring || undefined;
  }

  async reconcileDailyProductMonitoring(id: number, actualClosingStock: number, notes?: string, reconciledBy?: number): Promise<DailyProductMonitoring | undefined> {
    // Get the current monitoring record
    const [current] = await db.select().from(dailyProductMonitoring).where(eq(dailyProductMonitoring.id, id));
    if (!current) return undefined;

    const systemClosingStock = parseFloat(current.systemClosingStock);
    const variance = actualClosingStock - systemClosingStock;
    
    // Calculate variance value (variance * cost price)
    const product = await this.getProduct(current.productId);
    const costPrice = parseFloat(product?.cost || '0');
    const varianceValue = variance * costPrice;

    const [monitoring] = await db
      .update(dailyProductMonitoring)
      .set({
        actualClosingStock: actualClosingStock.toString(),
        variance: variance.toString(),
        varianceValue: varianceValue.toFixed(2),
        isReconciled: true,
        notes,
        reconciledBy,
        reconciledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(dailyProductMonitoring.id, id))
      .returning();

    return monitoring || undefined;
  }

  // Store Management methods
  async getStores(): Promise<Store[]> {
    return await db.select().from(stores);
  }

  async getStore(id: number): Promise<Store | undefined> {
    const [store] = await db.select().from(stores).where(eq(stores.id, id));
    return store || undefined;
  }

  async getStoreByCode(code: string): Promise<Store | undefined> {
    const [store] = await db.select().from(stores).where(eq(stores.code, code));
    return store || undefined;
  }

  async createStore(insertStore: InsertStore): Promise<Store> {
    const [store] = await db
      .insert(stores)
      .values(insertStore)
      .returning();
    return store;
  }

  async updateStore(id: number, storeData: Partial<InsertStore>): Promise<Store | undefined> {
    const [store] = await db
      .update(stores)
      .set({ ...storeData, updatedAt: new Date() })
      .where(eq(stores.id, id))
      .returning();
    return store || undefined;
  }

  async getActiveStores(): Promise<Store[]> {
    return await db.select().from(stores).where(eq(stores.isActive, true));
  }

  // Store Products (Store-specific pricing) methods
  async getStoreProducts(storeId: number): Promise<StoreProduct[]> {
    try {
      return await db.select().from(storeProducts).where(eq(storeProducts.storeId, storeId));
    } catch (error: any) {
      // If error is about missing columns, retry with SQL defaults
      if (error?.code === '42703' && (error?.message?.includes('cost') || error?.message?.includes('stock'))) {
        return await db
          .select({
            id: storeProducts.id,
            storeId: storeProducts.storeId,
            productId: storeProducts.productId,
            price: storeProducts.price,
            cost: sql<string | null>`NULL`.as('cost'),
            stock: sql<number>`0`.as('stock'),
            minStock: sql<number>`0`.as('minStock'),
            maxStock: sql<number>`0`.as('maxStock'),
            isActive: sql<boolean>`true`.as('isActive'),
            lastRestockDate: sql<Date | null>`NULL`.as('lastRestockDate'),
            createdAt: storeProducts.createdAt,
            updatedAt: storeProducts.updatedAt,
          })
          .from(storeProducts)
          .where(eq(storeProducts.storeId, storeId));
      }
      throw error;
    }
  }

  async getStoreProduct(storeId: number, productId: number): Promise<StoreProduct | undefined> {
    try {
      const [storeProduct] = await db
        .select()
        .from(storeProducts)
        .where(
          and(
            eq(storeProducts.storeId, storeId),
            eq(storeProducts.productId, productId)
          )
        );
      return storeProduct || undefined;
    } catch (error: any) {
      // If error is about missing columns, retry with SQL defaults (without referencing missing columns)
      if (error?.code === '42703' && (error?.message?.includes('cost') || error?.message?.includes('stock'))) {
        try {
          const [storeProduct] = await db
            .select({
              id: storeProducts.id,
              storeId: storeProducts.storeId,
              productId: storeProducts.productId,
              price: storeProducts.price,
              cost: sql<string | null>`NULL`.as('cost'),
              stock: sql<number>`0`.as('stock'),
              minStock: sql<number>`0`.as('minStock'),
              maxStock: sql<number>`0`.as('maxStock'),
              isActive: storeProducts.isActive,
              lastRestockDate: storeProducts.lastRestockDate,
              createdAt: storeProducts.createdAt,
              updatedAt: storeProducts.updatedAt,
            })
            .from(storeProducts)
            .where(
              and(
                eq(storeProducts.storeId, storeId),
                eq(storeProducts.productId, productId)
              )
            );
          return storeProduct || undefined;
        } catch (retryError: any) {
          // If still failing, try with only columns that definitely exist
          const [storeProduct] = await db
            .select({
              id: storeProducts.id,
              storeId: storeProducts.storeId,
              productId: storeProducts.productId,
              price: storeProducts.price,
              cost: sql<string | null>`NULL`.as('cost'),
              stock: sql<number>`0`.as('stock'),
              minStock: sql<number>`0`.as('minStock'),
              maxStock: sql<number>`0`.as('maxStock'),
              isActive: sql<boolean>`true`.as('isActive'),
              lastRestockDate: sql<Date | null>`NULL`.as('lastRestockDate'),
              createdAt: storeProducts.createdAt,
              updatedAt: storeProducts.updatedAt,
            })
            .from(storeProducts)
            .where(
              and(
                eq(storeProducts.storeId, storeId),
                eq(storeProducts.productId, productId)
              )
            );
          return storeProduct || undefined;
        }
      }
      throw error;
    }
  }

  async createStoreProduct(insertStoreProduct: InsertStoreProduct): Promise<StoreProduct> {
    const [storeProduct] = await db
      .insert(storeProducts)
      .values(insertStoreProduct)
      .returning();
    return storeProduct;
  }

  async updateStoreProduct(storeId: number, productId: number, data: Partial<InsertStoreProduct>): Promise<StoreProduct | undefined> {
    try {
      // Filter out stock from data if column doesn't exist, but we'll handle it in the catch
      const updateData = { ...data, updatedAt: new Date() };
      const [storeProduct] = await db
        .update(storeProducts)
        .set(updateData)
        .where(
          and(
            eq(storeProducts.storeId, storeId),
            eq(storeProducts.productId, productId)
          )
        )
        .returning();
      return storeProduct || undefined;
    } catch (error: any) {
      // If error is about missing columns, update without them and return with defaults
      if (error?.code === '42703' && (error?.message?.includes('stock') || error?.message?.includes('cost'))) {
        // Remove stock/cost from update data if columns don't exist
        const { stock, cost, ...updateDataWithoutStock } = data;
        const [storeProduct] = await db
          .update(storeProducts)
          .set({ ...updateDataWithoutStock, updatedAt: new Date() })
          .where(
            and(
              eq(storeProducts.storeId, storeId),
              eq(storeProducts.productId, productId)
            )
          )
          .returning({
            id: storeProducts.id,
            storeId: storeProducts.storeId,
            productId: storeProducts.productId,
            price: storeProducts.price,
            cost: sql<string | null>`NULL`.as('cost'),
            stock: sql<number>`0`.as('stock'),
            minStock: sql<number>`0`.as('minStock'),
            maxStock: sql<number>`0`.as('maxStock'),
            isActive: sql<boolean>`true`.as('isActive'),
            lastRestockDate: sql<Date | null>`NULL`.as('lastRestockDate'),
            createdAt: storeProducts.createdAt,
            updatedAt: storeProducts.updatedAt,
          });
        return storeProduct || undefined;
      }
      throw error;
    }
  }

  async getProductsByStore(storeId: number): Promise<Product[]> {
    try {
      const results = await db
        .select({
          id: products.id,
          sku: products.sku,
          name: products.name,
          description: products.description,
          basePrice: products.price,
          storePrice: storeProducts.price,
          baseCost: products.cost,
          storeCost: storeProducts.cost,
          baseStock: products.stock,
          storeStock: storeProducts.stock,
          quantity: products.quantity,
          barcode: products.barcode,
          imageUrl: products.imageUrl,
          category: products.category,
          productType: products.productType,
          supplierId: products.supplierId,
          baseIsActive: products.isActive,
          storeIsActive: storeProducts.isActive,
          requiresDailyMonitoring: products.requiresDailyMonitoring,
          vatRate: products.vatRate,
          vatExempt: products.vatExempt,
          createdAt: products.createdAt,
          updatedAt: products.updatedAt,
        })
        .from(products)
        .leftJoin(storeProducts, and(
          eq(products.id, storeProducts.productId),
          eq(storeProducts.storeId, storeId)
        ))
        .where(
          eq(products.isActive, true)
        );
      
      // Map results to Product format, using store-specific values when available
      return results.map((row) => ({
        id: row.id,
        sku: row.sku,
        name: row.name,
        description: row.description,
        price: row.storePrice || row.basePrice || '0.00',
        cost: row.storeCost || row.baseCost || null,
        stock: row.storeStock ?? row.baseStock ?? 0,
        quantity: row.quantity,
        barcode: row.barcode,
        imageUrl: row.imageUrl,
        category: row.category,
        productType: row.productType,
        supplierId: row.supplierId,
        isActive: row.storeIsActive ?? row.baseIsActive ?? true,
        requiresDailyMonitoring: row.requiresDailyMonitoring,
        vatRate: row.vatRate,
        vatExempt: row.vatExempt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    })) as Product[];
    } catch (error: any) {
      // If error is about missing columns, retry with SQL defaults
      if (error?.code === '42703' && (error?.message?.includes('cost') || error?.message?.includes('stock'))) {
        const results = await db
          .select({
            id: products.id,
            sku: products.sku,
            name: products.name,
            description: products.description,
            basePrice: products.price,
            storePrice: storeProducts.price,
            baseCost: products.cost,
            storeCost: sql<string | null>`NULL`.as('storeCost'),
            baseStock: products.stock,
            storeStock: sql<number>`0`.as('storeStock'),
            quantity: products.quantity,
            barcode: products.barcode,
            imageUrl: products.imageUrl,
            category: products.category,
            productType: products.productType,
            supplierId: products.supplierId,
            baseIsActive: products.isActive,
            storeIsActive: sql<boolean>`true`.as('storeIsActive'),
            requiresDailyMonitoring: products.requiresDailyMonitoring,
            vatRate: products.vatRate,
            vatExempt: products.vatExempt,
            createdAt: products.createdAt,
            updatedAt: products.updatedAt,
          })
          .from(products)
          .leftJoin(storeProducts, and(
            eq(products.id, storeProducts.productId),
            eq(storeProducts.storeId, storeId)
          ))
          .where(
            eq(products.isActive, true)
          );
        
        // Map results to Product format, using store-specific values when available
        return results.map((row) => ({
          id: row.id,
          sku: row.sku,
          name: row.name,
          description: row.description,
          price: row.storePrice || row.basePrice || '0.00',
          cost: row.storeCost || row.baseCost || null,
          stock: row.storeStock ?? row.baseStock ?? 0,
          quantity: row.quantity,
          barcode: row.barcode,
          imageUrl: row.imageUrl,
          category: row.category,
          productType: row.productType,
          supplierId: row.supplierId,
          isActive: row.storeIsActive ?? row.baseIsActive ?? true,
          requiresDailyMonitoring: row.requiresDailyMonitoring,
          vatRate: row.vatRate,
          vatExempt: row.vatExempt,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })) as Product[];
      }
      throw error;
    }
  }

  async getStoreSpecificPrice(storeId: number, productId: number): Promise<string | undefined> {
    const storeProduct = await this.getStoreProduct(storeId, productId);
    if (storeProduct && storeProduct.price) {
      return storeProduct.price;
    }
    
    // Fall back to product's default price
    const product = await this.getProduct(productId);
    return product?.price;
  }

  async deleteStoreProduct(storeId: number, productId: number): Promise<boolean> {
    const result = await db
      .delete(storeProducts)
      .where(
        and(
          eq(storeProducts.storeId, storeId),
          eq(storeProducts.productId, productId)
        )
      );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async searchStoreProducts(storeId: number, query: string): Promise<StoreProduct[]> {
    try {
      const results = await db
        .select({
          id: storeProducts.id,
          storeId: storeProducts.storeId,
          productId: storeProducts.productId,
          price: storeProducts.price,
          cost: storeProducts.cost,
          stock: storeProducts.stock,
          minStock: storeProducts.minStock,
          maxStock: storeProducts.maxStock,
          lastRestockDate: storeProducts.lastRestockDate,
          isActive: storeProducts.isActive,
          createdAt: storeProducts.createdAt,
          updatedAt: storeProducts.updatedAt
        })
        .from(storeProducts)
        .leftJoin(products, eq(storeProducts.productId, products.id))
        .where(
          and(
            eq(storeProducts.storeId, storeId),
            or(
              ilike(products.name, `%${query}%`),
              ilike(products.sku, `%${query}%`),
              ilike(products.barcode, `%${query}%`)
            )
          )
        );
      return results;
    } catch (error: any) {
      // If error is about missing columns, retry with SQL defaults
      if (error?.code === '42703' && (error?.message?.includes('cost') || error?.message?.includes('stock'))) {
        const results = await db
          .select({
            id: storeProducts.id,
            storeId: storeProducts.storeId,
            productId: storeProducts.productId,
            price: storeProducts.price,
            cost: sql<string | null>`NULL`.as('cost'),
            stock: sql<number>`0`.as('stock'),
            minStock: sql<number>`0`.as('minStock'),
            maxStock: sql<number>`0`.as('maxStock'),
            isActive: sql<boolean>`true`.as('isActive'),
            lastRestockDate: sql<Date | null>`NULL`.as('lastRestockDate'),
            createdAt: storeProducts.createdAt,
            updatedAt: storeProducts.updatedAt
          })
          .from(storeProducts)
          .leftJoin(products, eq(storeProducts.productId, products.id))
          .where(
            and(
              eq(storeProducts.storeId, storeId),
              or(
                ilike(products.name, `%${query}%`),
                ilike(products.sku, `%${query}%`),
                ilike(products.barcode, `%${query}%`)
              )
            )
          );
        return results;
      }
      throw error;
    }
  }

  async getStoreProductByBarcode(storeId: number, barcode: string): Promise<StoreProduct | undefined> {
    try {
      const [storeProduct] = await db
        .select({
          id: storeProducts.id,
          storeId: storeProducts.storeId,
          productId: storeProducts.productId,
          price: storeProducts.price,
          cost: storeProducts.cost,
          stock: storeProducts.stock,
          minStock: storeProducts.minStock,
          maxStock: storeProducts.maxStock,
          lastRestockDate: storeProducts.lastRestockDate,
          isActive: storeProducts.isActive,
          createdAt: storeProducts.createdAt,
          updatedAt: storeProducts.updatedAt
        })
        .from(storeProducts)
        .leftJoin(products, eq(storeProducts.productId, products.id))
        .where(
          and(
            eq(storeProducts.storeId, storeId),
            eq(products.barcode, barcode)
          )
        )
        .limit(1);
      return storeProduct || undefined;
    } catch (error: any) {
      // If error is about missing columns, retry with SQL defaults
      if (error?.code === '42703' && (error?.message?.includes('cost') || error?.message?.includes('stock'))) {
        const [storeProduct] = await db
          .select({
            id: storeProducts.id,
            storeId: storeProducts.storeId,
            productId: storeProducts.productId,
            price: storeProducts.price,
            cost: sql<string | null>`NULL`.as('cost'),
            stock: sql<number>`0`.as('stock'),
            minStock: sql<number>`0`.as('minStock'),
            maxStock: sql<number>`0`.as('maxStock'),
            isActive: sql<boolean>`true`.as('isActive'),
            lastRestockDate: sql<Date | null>`NULL`.as('lastRestockDate'),
            createdAt: storeProducts.createdAt,
            updatedAt: storeProducts.updatedAt
          })
          .from(storeProducts)
          .leftJoin(products, eq(storeProducts.productId, products.id))
          .where(
            and(
              eq(storeProducts.storeId, storeId),
              eq(products.barcode, barcode)
            )
          )
          .limit(1);
        return storeProduct || undefined;
      }
      throw error;
    }
  }

  async updateStoreProductStock(
    storeId: number, 
    productId: number, 
    quantity: number, 
    operation: 'add' | 'subtract' | 'set'
  ): Promise<StoreProduct | undefined> {
    const storeProduct = await this.getStoreProduct(storeId, productId);
    if (!storeProduct) {
      return undefined;
    }

    let newStock: number;
    const currentStock = storeProduct.stock || 0;
    
    switch (operation) {
      case 'add':
        newStock = currentStock + quantity;
        break;
      case 'subtract':
        newStock = Math.max(0, currentStock - quantity);
        break;
      case 'set':
        newStock = quantity;
        break;
      default:
        return undefined;
    }

    try {
      return await this.updateStoreProduct(storeId, productId, { stock: newStock });
    } catch (error: any) {
      // If stock column doesn't exist, just return the storeProduct without updating
      // This allows the transaction to complete even if stock tracking isn't set up
      if (error?.code === '42703' && error?.message?.includes('stock')) {
        console.warn(`⚠️ Stock column does not exist in store_products table. Stock update skipped for product ${productId}.`);
        return storeProduct;
      }
      throw error;
    }
  }

  // User Store Assignments Methods
  async getUserStoreAssignments(userId: number): Promise<UserStore[]> {
    return await db
      .select()
      .from(userStores)
      .where(eq(userStores.userId, userId));
  }

  async getStoreUserAssignments(storeId: number): Promise<UserStore[]> {
    return await db
      .select()
      .from(userStores)
      .where(eq(userStores.storeId, storeId));
  }

  async getUserStoreAssignmentsWithDetails(userId: number): Promise<UserStoreAssignmentDetail[]> {
    const assignments = await this.getUserStoreAssignments(userId);
    if (assignments.length === 0) {
      return [];
    }

    const results: UserStoreAssignmentDetail[] = [];
    for (const assignment of assignments) {
      const store = await this.getStore(assignment.storeId);
      if (store && store.isActive) {
        results.push({ store, assignment });
      }
    }
    return results;
  }

  async getStoreUserAssignmentsWithDetails(storeId: number): Promise<StoreUserAssignmentDetail[]> {
    const assignments = await this.getStoreUserAssignments(storeId);
    if (assignments.length === 0) {
      return [];
    }

    const results: StoreUserAssignmentDetail[] = [];
    for (const assignment of assignments) {
      const user = await this.getUser(assignment.userId);
      if (user && user.isActive) {
        const { password: _password, ...sanitized } = user;
        results.push({ assignment, user: sanitized as SanitizedUser });
      }
    }
    return results;
  }

  private async ensureDefaultStore(userId: number, storeId: number): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) {
      return;
    }

    if (!user.defaultStoreId) {
      await this.updateUserDefaultStore(userId, storeId);
      return;
    }

    if (user.defaultStoreId === storeId) {
      return;
    }

    const currentDefault = await this.getStore(user.defaultStoreId);
    if (!currentDefault || !currentDefault.isActive) {
      await this.updateUserDefaultStore(userId, storeId);
    }
  }

  private async handleDefaultStoreRemoval(userId: number, storeId: number): Promise<void> {
    const user = await this.getUser(userId);
    if (!user || user.defaultStoreId !== storeId) {
      return;
    }

    await this.updateUserDefaultStore(userId, null);
    const accessible = await this.getUserAccessibleStores(userId);
    if (accessible.length > 0) {
      await this.updateUserDefaultStore(userId, accessible[0].id);
    }
  }

  async assignUserToStore(userStore: InsertUserStore): Promise<UserStore> {
    // First check if assignment already exists
    const existing = await db
      .select()
      .from(userStores)
      .where(
        and(
          eq(userStores.userId, userStore.userId),
          eq(userStores.storeId, userStore.storeId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing assignment
      const [updated] = await db
        .update(userStores)
        .set({
          canAccess: userStore.canAccess ?? true,
          assignedBy: userStore.assignedBy,
          assignedAt: new Date()
        })
        .where(
          and(
            eq(userStores.userId, userStore.userId),
            eq(userStores.storeId, userStore.storeId)
          )
        )
        .returning();
      if (updated && updated.canAccess) {
        await this.ensureDefaultStore(userStore.userId, userStore.storeId);
      } else if (updated && updated.canAccess === false) {
        await this.handleDefaultStoreRemoval(userStore.userId, userStore.storeId);
      }
      return updated;
    }

    // Create new assignment
    const [assignment] = await db
      .insert(userStores)
      .values(userStore)
      .returning();
    if (assignment && assignment.canAccess) {
      await this.ensureDefaultStore(userStore.userId, userStore.storeId);
    }
    return assignment;
  }

  async removeUserFromStore(userId: number, storeId: number): Promise<boolean> {
    const result = await db
      .delete(userStores)
      .where(
        and(
          eq(userStores.userId, userId),
          eq(userStores.storeId, storeId)
        )
      );
    const removed = result.rowCount !== null && result.rowCount > 0;
    if (removed) {
      await this.handleDefaultStoreRemoval(userId, storeId);
    }
    return removed;
  }

  async getUserAccessibleStores(userId: number): Promise<StoreAccess[]> {
    const user = await this.getUser(userId);
    if (!user || !user.isActive) {
      return [];
    }

    const rows = await db
      .select({
        id: stores.id,
        name: stores.name,
        code: stores.code,
        address: stores.address,
        phone: stores.phone,
        email: stores.email,
        managerId: stores.managerId,
        isActive: stores.isActive,
        settings: stores.settings,
        baseCurrency: stores.baseCurrency,
        vatEnabled: stores.vatEnabled,
        defaultVatRate: stores.defaultVatRate,
        createdAt: stores.createdAt,
        updatedAt: stores.updatedAt,
        assignmentId: userStores.id,
        canAccess: userStores.canAccess,
        assignedAt: userStores.assignedAt,
        assignedBy: userStores.assignedBy,
      })
      .from(stores)
      .leftJoin(
        userStores,
        and(
          eq(stores.id, userStores.storeId),
          eq(userStores.userId, userId)
        )
      )
      .where(
        and(
          eq(stores.isActive, true),
          or(
            eq(userStores.canAccess, true),
            and(
              isNull(userStores.canAccess),
              isNotNull(userStores.id)
            ),
            eq(stores.managerId, userId)
          )
        )
      );

    const accessibleStores = new Map<number, StoreAccess>();

    for (const record of rows) {
  const isManager = record.managerId === userId;
  const hasAssignment = record.assignmentId !== null && record.assignmentId !== undefined;
  const assignmentAllowsAccess = record.canAccess !== false;

      const accessType: StoreAccess["accessType"] = assignmentAllowsAccess
        ? "assignment"
        : isManager
          ? "manager"
          : "assignment";

      accessibleStores.set(record.id, {
        id: record.id,
        name: record.name,
        code: record.code,
        address: record.address,
        phone: record.phone,
        email: record.email,
        managerId: record.managerId,
        isActive: record.isActive,
        settings: record.settings,
        baseCurrency: record.baseCurrency,
        vatEnabled: record.vatEnabled,
        defaultVatRate: record.defaultVatRate,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        assignmentId: hasAssignment ? record.assignmentId! : null,
        canAccess: hasAssignment ? record.canAccess ?? null : null,
        assignedAt: hasAssignment ? record.assignedAt ?? null : null,
        assignedBy: hasAssignment ? record.assignedBy ?? null : null,
        accessType,
      });
    }

    const result = Array.from(accessibleStores.values());
    result.sort((a, b) => {
      if (user.defaultStoreId && a.id === user.defaultStoreId) return -1;
      if (user.defaultStoreId && b.id === user.defaultStoreId) return 1;
      return a.name.localeCompare(b.name);
    });

    return result;
  }

  async updateUserStoreAccess(userId: number, storeId: number, canAccess: boolean): Promise<UserStore | undefined> {
    const [updated] = await db
      .update(userStores)
      .set({ canAccess })
      .where(
        and(
          eq(userStores.userId, userId),
          eq(userStores.storeId, storeId)
        )
      )
      .returning();
    if (updated) {
      if (canAccess) {
        await this.ensureDefaultStore(userId, storeId);
      } else {
        await this.handleDefaultStoreRemoval(userId, storeId);
      }
    }
    return updated;
  }

  async updateUserDefaultStore(userId: number, storeId: number | null): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ defaultStoreId: storeId, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  // Generated Invoices
  async createGeneratedInvoice(invoice: InsertGeneratedInvoice): Promise<GeneratedInvoice> {
    const [created] = await db.insert(generatedInvoices).values(invoice).returning();
    return created;
  }

  async getGeneratedInvoice(id: number): Promise<GeneratedInvoice | undefined> {
    const [invoice] = await db.select().from(generatedInvoices).where(eq(generatedInvoices.id, id));
    return invoice;
  }

  async getGeneratedInvoiceByNumber(invoiceNumber: string): Promise<GeneratedInvoice | undefined> {
    const [invoice] = await db.select().from(generatedInvoices).where(eq(generatedInvoices.invoiceNumber, invoiceNumber));
    return invoice;
  }

  async updateGeneratedInvoice(id: number, invoice: Partial<InsertGeneratedInvoice>): Promise<GeneratedInvoice | undefined> {
    const [updated] = await db.update(generatedInvoices).set(invoice).where(eq(generatedInvoices.id, id)).returning();
    return updated;
  }

  async createGeneratedInvoiceItem(item: InsertGeneratedInvoiceItem): Promise<GeneratedInvoiceItem> {
    const [created] = await db.insert(generatedInvoiceItems).values(item).returning();
    return created;
  }

  async getGeneratedInvoiceItems(invoiceId: number): Promise<GeneratedInvoiceItem[]> {
    return await db.select().from(generatedInvoiceItems).where(eq(generatedInvoiceItems.invoiceId, invoiceId));
  }

  // Shifts
  async createShift(shift: InsertShift): Promise<Shift> {
    try {
      const shiftData = {
        ...shift,
        startTime: shift.startTime instanceof Date ? shift.startTime : new Date(shift.startTime || new Date())
      };
      const [created] = await db.insert(shifts).values(shiftData).returning();
      return created;
    } catch (error: any) {
      // Handle missing table error with helpful message
      if (error?.code === '42P01') {
        throw new Error('Shifts table does not exist. Please run database migrations to create the required tables.');
      }
      // Re-throw other errors
      throw error;
    }
  }

  async getActiveShifts(storeId?: number): Promise<Shift[]> {
    try {
      if (storeId) {
        return await db.select().from(shifts).where(
          and(
            eq(shifts.status, "active"),
            eq(shifts.storeId, storeId)
          )
        );
      }
      return await db.select().from(shifts).where(eq(shifts.status, "active"));
    } catch (error: any) {
      // Handle missing table error gracefully (42P01 = relation does not exist)
      if (error?.code === '42P01') {
        console.warn('Shifts table does not exist. Returning empty array. Run migrations to create the table.');
        return [];
      }
      // Re-throw other errors
      throw error;
    }
  }

  async getShift(id: number): Promise<Shift | undefined> {
    try {
      const [shift] = await db.select().from(shifts).where(eq(shifts.id, id));
      return shift;
    } catch (error: any) {
      // Handle missing table error gracefully (42P01 = relation does not exist)
      if (error?.code === '42P01') {
        console.warn('Shifts table does not exist. Returning undefined. Run migrations to create the table.');
        return undefined;
      }
      // Re-throw other errors
      throw error;
    }
  }

  async updateShift(id: number, shift: Partial<InsertShift>): Promise<Shift | undefined> {
    try {
      const shiftData = {
        ...shift,
        startTime: shift.startTime instanceof Date ? shift.startTime : 
                   shift.startTime ? new Date(shift.startTime) : undefined
      };
      const [updated] = await db.update(shifts).set(shiftData).where(eq(shifts.id, id)).returning();
      return updated;
    } catch (error: any) {
      // Handle missing table error with helpful message
      if (error?.code === '42P01') {
        throw new Error('Shifts table does not exist. Please run database migrations to create the required tables.');
      }
      // Re-throw other errors
      throw error;
    }
  }

  async closeShift(id: number): Promise<Shift | undefined> {
    try {
      const [updated] = await db.update(shifts)
        .set({ 
          status: "completed", 
          endTime: new Date()
        })
        .where(eq(shifts.id, id))
        .returning();
      return updated;
    } catch (error: any) {
      // Handle missing table error with helpful message
      if (error?.code === '42P01') {
        throw new Error('Shifts table does not exist. Please run database migrations to create the required tables.');
      }
      // Re-throw other errors
      throw error;
    }
  }

  // VAT Management Methods
  async getVatConfigurations(storeId: number): Promise<VatConfiguration[]> {
    return await db.select().from(vatConfigurations)
      .where(and(eq(vatConfigurations.storeId, storeId), eq(vatConfigurations.isActive, true)));
  }

  async createVatConfiguration(config: InsertVatConfiguration): Promise<VatConfiguration> {
    const [created] = await db.insert(vatConfigurations).values(config).returning();
    return created;
  }

  async updateVatConfiguration(id: number, config: Partial<InsertVatConfiguration>): Promise<VatConfiguration | undefined> {
    const [updated] = await db.update(vatConfigurations).set(config).where(eq(vatConfigurations.id, id)).returning();
    return updated;
  }

  async deleteVatConfiguration(id: number): Promise<boolean> {
    const result = await db.delete(vatConfigurations).where(eq(vatConfigurations.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getVatRateForCategory(storeId: number, category?: string): Promise<number> {
    if (category) {
      const [config] = await db.select().from(vatConfigurations)
        .where(and(
          eq(vatConfigurations.storeId, storeId),
          eq(vatConfigurations.category, category),
          eq(vatConfigurations.isActive, true)
        ))
        .limit(1);
      if (config) return parseFloat(config.vatRate);
    }

    // Get default VAT rate from store
    const [store] = await db.select().from(stores).where(eq(stores.id, storeId));
    return store?.defaultVatRate ? parseFloat(store.defaultVatRate) : 5.00;
  }

  async calculateVAT(items: any[], storeId: number): Promise<{ vatAmount: number; itemsWithVat: any[] }> {
    let totalVatAmount = 0;
    const itemsWithVat = [];

    for (const item of items) {
      let vatRate = 0;
      
      // Check if product has specific VAT rate
      if (item.vatRate && !item.vatExempt) {
        vatRate = parseFloat(item.vatRate);
      } else if (!item.vatExempt) {
        // Get category-specific or store default VAT rate
        vatRate = await this.getVatRateForCategory(storeId, item.category);
      }

      const itemTotal = parseFloat(item.price) * item.quantity;
      const itemVat = itemTotal * (vatRate / 100);
      totalVatAmount += itemVat;

      itemsWithVat.push({
        ...item,
        vatRate,
        vatAmount: itemVat,
        totalWithVat: itemTotal + itemVat
      });
    }

    return { vatAmount: totalVatAmount, itemsWithVat };
  }

  // Currency Management Methods
  async getCurrencyRates(): Promise<CurrencyRate[]> {
    return await db.select().from(currencyRates).orderBy(desc(currencyRates.effectiveDate));
  }

  async getCurrencyRate(fromCurrency: string, toCurrency: string): Promise<CurrencyRate | undefined> {
    const [rate] = await db.select().from(currencyRates)
      .where(and(
        eq(currencyRates.fromCurrency, fromCurrency),
        eq(currencyRates.toCurrency, toCurrency)
      ))
      .orderBy(desc(currencyRates.effectiveDate))
      .limit(1);
    return rate;
  }

  async createCurrencyRate(rate: InsertCurrencyRate): Promise<CurrencyRate> {
    const [created] = await db.insert(currencyRates).values(rate).returning();
    return created;
  }

  async updateCurrencyRate(id: number, rate: Partial<InsertCurrencyRate>): Promise<CurrencyRate | undefined> {
    const [updated] = await db.update(currencyRates).set(rate).where(eq(currencyRates.id, id)).returning();
    return updated;
  }

  async convertCurrency(amount: number, fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) return amount;
    
    const rate = await this.getCurrencyRate(fromCurrency, toCurrency);
    if (!rate) {
      throw new Error(`Exchange rate not found for ${fromCurrency} to ${toCurrency}`);
    }
    
    return amount * parseFloat(rate.rate);
  }

  // Customer Authentication Methods
  async getCustomerAuth(customerId: number): Promise<CustomerAuth | undefined> {
    const [auth] = await db.select().from(customerAuth).where(eq(customerAuth.customerId, customerId));
    return auth;
  }

  async createCustomerAuth(auth: InsertCustomerAuth): Promise<CustomerAuth> {
    const [created] = await db.insert(customerAuth).values(auth).returning();
    return created;
  }

  async updateCustomerAuth(id: number, auth: Partial<InsertCustomerAuth>): Promise<CustomerAuth | undefined> {
    const [updated] = await db.update(customerAuth).set(auth).where(eq(customerAuth.id, id)).returning();
    return updated;
  }

  async authenticateCustomer(email: string, password: string): Promise<{ customer: Customer; auth: CustomerAuth } | undefined> {
    const bcrypt = await import("bcryptjs");
    
    // Find customer by email
    const [customer] = await db.select().from(customers).where(eq(customers.email, email));
    if (!customer) return undefined;

    // Get auth record
    const [auth] = await db.select().from(customerAuth).where(eq(customerAuth.customerId, customer.id));
    if (!auth || !auth.isActive) return undefined;

    // Verify password
    const isValid = await bcrypt.default.compare(password, auth.passwordHash);
    if (!isValid) return undefined;

    // Update last login
    await db.update(customerAuth)
      .set({ lastLoginAt: new Date() })
      .where(eq(customerAuth.id, auth.id));

    return { customer, auth };
  }

  async resetCustomerPassword(email: string): Promise<string | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.email, email));
    if (!customer) return undefined;

    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.update(customerAuth)
      .set({ 
        passwordResetToken: resetToken,
        passwordResetExpiry: expiry
      })
      .where(eq(customerAuth.customerId, customer.id));

    return resetToken;
  }

  async updateCustomerPassword(token: string, newPassword: string): Promise<boolean> {
    const bcrypt = await import("bcryptjs");
    
    const [auth] = await db.select().from(customerAuth)
      .where(and(
        eq(customerAuth.passwordResetToken, token),
        gte(customerAuth.passwordResetExpiry, new Date())
      ));

    if (!auth) return false;

    const hashedPassword = await bcrypt.default.hash(newPassword, 10);
    
    await db.update(customerAuth)
      .set({
        passwordHash: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiry: null
      })
      .where(eq(customerAuth.id, auth.id));

    return true;
  }

  // Promotions Management Methods
  async getPromotions(storeId: number): Promise<Promotion[]> {
    return await db.select().from(promotions).where(eq(promotions.storeId, storeId));
  }

  async getActivePromotions(storeId: number): Promise<Promotion[]> {
    const now = new Date();
    return await db.select().from(promotions)
      .where(and(
        eq(promotions.storeId, storeId),
        eq(promotions.isActive, true),
        lte(promotions.startDate, now),
        gte(promotions.endDate, now)
      ));
  }

  async getPromotion(id: number): Promise<Promotion | undefined> {
    const [promotion] = await db.select().from(promotions).where(eq(promotions.id, id));
    return promotion;
  }

  async createPromotion(promotion: InsertPromotion): Promise<Promotion> {
    const [created] = await db.insert(promotions).values(promotion).returning();
    return created;
  }

  async updatePromotion(id: number, promotion: Partial<InsertPromotion>): Promise<Promotion | undefined> {
    const [updated] = await db.update(promotions).set(promotion).where(eq(promotions.id, id)).returning();
    return updated;
  }

  async deletePromotion(id: number): Promise<boolean> {
    const result = await db.delete(promotions).where(eq(promotions.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Promotion Rules Methods
  async getPromotionRules(promotionId: number): Promise<PromotionRule[]> {
    return await db.select().from(promotionRules).where(eq(promotionRules.promotionId, promotionId));
  }

  async createPromotionRule(rule: InsertPromotionRule): Promise<PromotionRule> {
    const [created] = await db.insert(promotionRules).values(rule).returning();
    return created;
  }

  async deletePromotionRule(id: number): Promise<boolean> {
    const result = await db.delete(promotionRules).where(eq(promotionRules.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Promotion Application and Usage Methods
  async getApplicablePromotions(storeId: number, cartItems: any[]): Promise<Promotion[]> {
    const activePromotions = await this.getActivePromotions(storeId);
    const applicablePromotions: Promotion[] = [];

    for (const promotion of activePromotions) {
      const rules = await this.getPromotionRules(promotion.id);
      let canApply = false;

      // Check if promotion applies to cart items
      for (const rule of rules) {
        if (rule.ruleType === 'all_products') {
          canApply = true;
          break;
        } else if (rule.ruleType === 'product' && rule.productId) {
          canApply = cartItems.some(item => item.productId === rule.productId);
          if (canApply) break;
        } else if (rule.ruleType === 'category' && rule.category) {
          canApply = cartItems.some(item => item.category === rule.category);
          if (canApply) break;
        }
      }

      // Check minimum order amount
      if (canApply && promotion.minOrderAmount) {
        const cartTotal = cartItems.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
        canApply = cartTotal >= parseFloat(promotion.minOrderAmount);
      }

      if (canApply) {
        applicablePromotions.push(promotion);
      }
    }

    return applicablePromotions;
  }

  async applyPromotion(promotionId: number, cartItems: any[]): Promise<{ success: boolean; discount: number; appliedItems: any[] }> {
    const promotion = await this.getPromotion(promotionId);
    if (!promotion || !promotion.isActive) {
      return { success: false, discount: 0, appliedItems: [] };
    }

    const rules = await this.getPromotionRules(promotion.id);
    let discount = 0;
    const appliedItems: any[] = [];

    // Calculate discount based on promotion type
    const cartTotal = cartItems.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);

    switch (promotion.type) {
      case 'percentage':
        discount = cartTotal * (parseFloat(promotion.value || '0') / 100);
        break;
      case 'fixed_amount':
        discount = parseFloat(promotion.value || '0');
        break;
      case 'buy_x_get_y':
        // Handle Buy X Get Y promotions
        for (const rule of rules) {
          if (rule.buyQuantity && rule.getQuantity) {
            const eligibleItems = rule.ruleType === 'all_products' 
              ? cartItems 
              : rule.ruleType === 'product' && rule.productId
                ? cartItems.filter(item => item.productId === rule.productId)
                : rule.ruleType === 'category' && rule.category
                  ? cartItems.filter(item => item.category === rule.category)
                  : [];
            
            const totalEligibleQty = eligibleItems.reduce((sum, item) => sum + item.quantity, 0);
            const setsQualified = Math.floor(totalEligibleQty / rule.buyQuantity);
            const freeItems = setsQualified * rule.getQuantity;
            
            if (freeItems > 0) {
              // Calculate discount as the value of free items (lowest priced items first)
              const sortedItems = [...eligibleItems].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
              let remainingFreeItems = freeItems;
              
              for (const item of sortedItems) {
                if (remainingFreeItems <= 0) break;
                const freeFromThisItem = Math.min(remainingFreeItems, item.quantity);
                discount += freeFromThisItem * parseFloat(item.price);
                remainingFreeItems -= freeFromThisItem;
                appliedItems.push({...item, discountedQuantity: freeFromThisItem});
              }
            }
          }
        }
        break;
      default:
        discount = 0;
    }

    // Apply maximum discount limit
    if (promotion.maxDiscountAmount && discount > parseFloat(promotion.maxDiscountAmount)) {
      discount = parseFloat(promotion.maxDiscountAmount);
    }

    // Mark applicable items
    for (const rule of rules) {
      if (rule.ruleType === 'all_products') {
        appliedItems.push(...cartItems);
        break;
      } else if (rule.ruleType === 'product' && rule.productId) {
        appliedItems.push(...cartItems.filter(item => item.productId === rule.productId));
      } else if (rule.ruleType === 'category' && rule.category) {
        appliedItems.push(...cartItems.filter(item => item.category === rule.category));
      }
    }

    return { success: true, discount, appliedItems };
  }

  async applyPromotions(storeId: number, items: any[], customerId?: number): Promise<{ promotions: Promotion[]; totalDiscount: number; appliedPromotions: any[] }> {
    const activePromotions = await this.getActivePromotions(storeId);
    let totalDiscount = 0;
    const appliedPromotions: any[] = [];

    for (const promotion of activePromotions) {
      const rules = await this.getPromotionRules(promotion.id);
      let canApply = false;
      let discountAmount = 0;

      // Check if promotion applies to any items
      for (const rule of rules) {
        if (rule.ruleType === 'all_products') {
          canApply = true;
          break;
        } else if (rule.ruleType === 'category') {
          canApply = items.some(item => item.category === rule.category);
          if (canApply) break;
        } else if (rule.ruleType === 'product') {
          canApply = items.some(item => item.productId === rule.productId);
          if (canApply) break;
        }
      }

      if (canApply) {
        const orderTotal = items.reduce((sum, item) => sum + parseFloat(item.total), 0);
        
        // Check minimum order amount
        if (promotion.minOrderAmount && orderTotal < parseFloat(promotion.minOrderAmount)) {
          continue;
        }

        // Calculate discount
        if (promotion.type === 'percentage') {
          discountAmount = orderTotal * (parseFloat(promotion.value || "0") / 100);
        } else if (promotion.type === 'fixed_amount') {
          discountAmount = parseFloat(promotion.value || "0");
        }

        // Apply maximum discount cap
        if (promotion.maxDiscountAmount && discountAmount > parseFloat(promotion.maxDiscountAmount)) {
          discountAmount = parseFloat(promotion.maxDiscountAmount);
        }

        // Check usage limits
        if (promotion.usageLimit && (promotion.usageCount || 0) >= promotion.usageLimit) {
          continue;
        }

        // Customer-specific limits would be checked here
        
        totalDiscount += discountAmount;
        appliedPromotions.push({
          promotionId: promotion.id,
          name: promotion.name,
          discountAmount,
          type: promotion.type
        });
      }
    }

    return { promotions: activePromotions, totalDiscount, appliedPromotions };
  }

  async recordPromotionUsage(usage: InsertPromotionUsage): Promise<PromotionUsage> {
    const [created] = await db.insert(promotionUsage).values(usage).returning();
    
    // Update promotion usage count
    await db.update(promotions)
      .set({ usageCount: sql`${promotions.usageCount} + 1` })
      .where(eq(promotions.id, usage.promotionId));
    
    return created;
  }

  async getPromotionUsage(promotionId?: number, customerId?: number): Promise<PromotionUsage[]> {
    if (promotionId && customerId) {
      return await db.select().from(promotionUsage).where(and(
        eq(promotionUsage.promotionId, promotionId),
        eq(promotionUsage.customerId, customerId)
      ));
    } else if (promotionId) {
      return await db.select().from(promotionUsage).where(eq(promotionUsage.promotionId, promotionId));
    } else if (customerId) {
      return await db.select().from(promotionUsage).where(eq(promotionUsage.customerId, customerId));
    }
    
    return await db.select().from(promotionUsage);
  }


}

export const storage = new DatabaseStorage();