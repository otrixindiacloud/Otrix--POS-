import { pgTable, text, serial, integer, boolean, decimal, timestamp, jsonb, varchar, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User roles enumeration
export const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager', 
  SUPERVISOR: 'supervisor',
  CASHIER: 'cashier',
  DELIVERY: 'delivery',
  CUSTOMER: 'customer'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// Currency enumeration for multi-currency support
export const CURRENCIES = {
  QAR: 'QAR', // Qatari Riyal
  USD: 'USD', // US Dollar
  EUR: 'EUR', // Euro
  GBP: 'GBP', // British Pound
  AED: 'AED', // UAE Dirham
  SAR: 'SAR', // Saudi Riyal
  KWD: 'KWD', // Kuwaiti Dinar
  BHD: 'BHD', // Bahraini Dinar
} as const;

export type Currency = typeof CURRENCIES[keyof typeof CURRENCIES];

// VAT Rate configuration
export const VAT_RATES = {
  NONE: 0,
  STANDARD: 0, // 0% VAT (updated from 5%)
  REDUCED: 0,  // 0% for essential goods
  EXEMPT: 0,   // Exempt items
} as const;

export type VATRate = typeof VAT_RATES[keyof typeof VAT_RATES];

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username").unique().notNull(), // Traditional username
  password: varchar("password").notNull(), // Hashed password
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: text("role").notNull().default(USER_ROLES.CASHIER),
  defaultStoreId: integer("default_store_id"), // User's default store (reference added after stores definition)
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Stores table for multiple store management
export const stores = pgTable("stores", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").unique().notNull(), // Unique store code for identification
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  managerId: integer("manager_id").references(() => users.id),
  isActive: boolean("is_active").default(true),
  settings: jsonb("settings"), // Store-specific settings like tax rates, currency, etc.
  baseCurrency: text("base_currency").notNull().default("QAR"), // Store's base currency
  vatEnabled: boolean("vat_enabled").default(true), // Whether VAT is enabled for this store
  defaultVatRate: decimal("default_vat_rate", { precision: 5, scale: 2 }).default("0.00"), // Default VAT rate percentage
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Currency exchange rates table for multi-currency support
export const currencyRates = pgTable("currency_rates", {
  id: serial("id").primaryKey(),
  fromCurrency: text("from_currency").notNull(),
  toCurrency: text("to_currency").notNull(),
  rate: decimal("rate", { precision: 15, scale: 6 }).notNull(), // Exchange rate with high precision
  effectiveDate: timestamp("effective_date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("currency_pair_idx").on(table.fromCurrency, table.toCurrency),
]);

// VAT configuration table for different product categories and rates
export const vatConfigurations = pgTable("vat_configurations", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id).notNull(),
  category: text("category"), // Product category (null for default rate)
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).notNull(), // VAT rate percentage
  description: text("description"), // Description of the VAT rule
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Customer authentication for online orders
export const customerAuth = pgTable("customer_auth", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id).notNull().unique(),
  passwordHash: text("password_hash").notNull(), // Bcrypt hashed password
  isEmailVerified: boolean("is_email_verified").default(false),
  emailVerificationToken: text("email_verification_token"),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpiry: timestamp("password_reset_expiry"),
  lastLoginAt: timestamp("last_login_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Promotions and discounts system
export const promotions = pgTable("promotions", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // 'percentage', 'fixed_amount', 'buy_x_get_y', 'bundle'
  value: decimal("value", { precision: 10, scale: 2 }), // Discount value or percentage
  minOrderAmount: decimal("min_order_amount", { precision: 10, scale: 2 }), // Minimum order for promotion
  maxDiscountAmount: decimal("max_discount_amount", { precision: 10, scale: 2 }), // Maximum discount cap
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isActive: boolean("is_active").default(true),
  usageLimit: integer("usage_limit"), // Maximum number of times promotion can be used
  usageCount: integer("usage_count").default(0), // Current usage count
  customerLimit: integer("customer_limit"), // Max uses per customer
  applicableToCustomerTypes: text("applicable_to_customer_types").array(), // 'all', 'new', 'returning', 'vip'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Promotion rules for specific products or categories
export const promotionRules = pgTable("promotion_rules", {
  id: serial("id").primaryKey(),
  promotionId: integer("promotion_id").references(() => promotions.id).notNull(),
  ruleType: text("rule_type").notNull(), // 'product', 'category', 'all_products'
  productId: integer("product_id").references(() => products.id), // Specific product (if applicable)
  category: text("category"), // Product category (if applicable)
  buyQuantity: integer("buy_quantity"), // For buy X get Y promotions
  getQuantity: integer("get_quantity"), // For buy X get Y promotions
  createdAt: timestamp("created_at").defaultNow(),
});

// Promotion usage tracking
export const promotionUsage = pgTable("promotion_usage", {
  id: serial("id").primaryKey(),
  promotionId: integer("promotion_id").references(() => promotions.id).notNull(),
  transactionId: integer("transaction_id").references(() => transactions.id).notNull(),
  customerId: integer("customer_id").references(() => customers.id),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(), // Changed to required
  address: text("address"),
  creditLimit: decimal("credit_limit", { precision: 10, scale: 2 }).default("0.00"),
  creditBalance: decimal("credit_balance", { precision: 10, scale: 2 }).default("0.00"),
  profileImage: text("profile_image"),
  idCardImage: text("id_card_image"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
});

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  taxId: text("tax_id"),
  paymentTerms: text("payment_terms"), // e.g., "Net 30", "Due on receipt"
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(), // Default/base price
  cost: decimal("cost", { precision: 10, scale: 2 }),
  stock: integer("stock").default(0),
  quantity: integer("quantity").default(0),
  barcode: text("barcode"),
  imageUrl: text("image_url"),
  productType: text("product_type"), // e.g., "food", "non-food", "fresh", "frozen", "household", "personal-care"
  category: text("category"), // Specific category within the product type
  supplierId: integer("supplier_id").references(() => suppliers.id),
  isActive: boolean("is_active").default(true),
  requiresDailyMonitoring: boolean("requires_daily_monitoring").default(false), // New flag for daily monitoring
  // VAT configuration
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }), // Product-specific VAT rate (overrides store default if set)
  vatExempt: boolean("vat_exempt").default(false), // Whether this product is VAT exempt
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Product siblings - for linking similar/related/alternative products
export const productSiblings = pgTable("product_siblings", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  siblingId: integer("sibling_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  relationshipType: text("relationship_type").notNull(), // "similar", "alternative", "complementary", "substitute"
  notes: text("notes"), // Optional notes about the relationship
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
}, (table) => ({
  // Ensure no duplicate relationships and no self-referencing
  uniqueRelationship: uniqueIndex("unique_product_sibling").on(table.productId, table.siblingId),
}));

// Competitors table - for tracking competitive pricing
export const competitors = pgTable("competitors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  address: text("address"),
  city: text("city"),
  country: text("country"),
  website: text("website"),
  phone: text("phone"),
  email: text("email"),
  contactPerson: text("contact_person"),
  businessType: text("business_type"), // 'retail', 'wholesale', 'online', 'mixed'
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

// Competitor prices table - for tracking competitor product prices
export const competitorPrices = pgTable("competitor_prices", {
  id: serial("id").primaryKey(),
  competitorId: integer("competitor_id").notNull().references(() => competitors.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }), // If competitor has a sale/discount
  currency: text("currency").notNull().default("QAR"),
  productName: text("product_name"), // How competitor names/labels the product
  productSku: text("product_sku"), // Competitor's SKU for this product
  productBarcode: text("product_barcode"), // Competitor's barcode for this product
  productUrl: text("product_url"), // Link to product on competitor's website
  imageUrl: text("image_url"), // Competitor's product image
  availability: text("availability"), // in_stock, out_of_stock, limited
  matchConfidence: decimal("match_confidence", { precision: 5, scale: 2 }), // AI matching confidence score 0-100
  matchedBy: text("matched_by"), // 'manual', 'ai', 'barcode', 'sku'
  notes: text("notes"),
  priceDate: timestamp("price_date").notNull().defaultNow(), // When this price was recorded
  expiryDate: timestamp("expiry_date"), // Optional: when this pricing ends (for sales)
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  recordedBy: integer("recorded_by").references(() => users.id),
}, (table) => [
  // Index for quick competitor-product lookups
  index("competitor_product_idx").on(table.competitorId, table.productId),
  index("product_competitor_idx").on(table.productId, table.competitorId),
]);

// Generated invoices table for PDF storage and tracking
export const generatedInvoices = pgTable("generated_invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  transactionId: integer("transaction_id").references(() => transactions.id).notNull(),
  storeId: integer("store_id").references(() => stores.id).notNull(),
  customerId: integer("customer_id").references(() => customers.id),
  cashierId: integer("cashier_id").references(() => users.id),

  // Invoice content
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0.00"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),

  // Payment details
  paymentMethod: text("payment_method").notNull(),
  cashTendered: decimal("cash_tendered", { precision: 10, scale: 2 }),
  cardType: text("card_type"),

  // File storage
  pdfFilePath: text("pdf_file_path"), // Path to generated PDF file
  pdfUrl: text("pdf_url"), // Public URL for PDF access

  // Status and timestamps
  status: text("status").notNull().default("generated"), // 'generated', 'sent', 'delivered'
  whatsappSent: boolean("whatsapp_sent").default(false),
  emailSent: boolean("email_sent").default(false),
  printedCount: integer("printed_count").default(0),

  createdAt: timestamp("created_at").defaultNow(),
});

export const generatedInvoiceItems = pgTable("generated_invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").references(() => generatedInvoices.id).notNull(),
  productId: integer("product_id").references(() => products.id),
  productName: text("product_name").notNull(),
  sku: text("sku"),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
});

// Shifts table for day operations tracking
export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  dayOperationId: integer("day_operation_id").references(() => dayOperations.id),

  // Shift times
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),

  // Shift summary
  totalSales: decimal("total_sales", { precision: 10, scale: 2 }).default("0.00"),
  totalCash: decimal("total_cash", { precision: 10, scale: 2 }).default("0.00"),
  totalCard: decimal("total_card", { precision: 10, scale: 2 }).default("0.00"),
  totalCredit: decimal("total_credit", { precision: 10, scale: 2 }).default("0.00"),
  invoiceCount: integer("invoice_count").default(0),

  // Status
  status: text("status").notNull().default("active"), // 'active', 'completed'
  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow(),
});

// User-Store assignments (Many-to-Many relationship)
export const userStores = pgTable("user_stores", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  storeId: integer("store_id").references(() => stores.id).notNull(),
  canAccess: boolean("can_access").default(true),
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: integer("assigned_by").references(() => users.id), // Who assigned this user to the store
}, (table) => [
  // Unique constraint: one assignment per user-store pair
  index("unique_user_store").on(table.userId, table.storeId),
]);

// Store-specific product pricing and inventory table
export const storeProducts = pgTable("store_products", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(), // Store-specific price
  cost: decimal("cost", { precision: 10, scale: 2 }), // Store-specific cost
  stock: integer("stock").default(0), // Store-specific stock
  minStock: integer("min_stock").default(0), // Store-specific minimum stock level
  maxStock: integer("max_stock").default(0), // Store-specific maximum stock level
  isActive: boolean("is_active").default(true), // Whether this product is active in this store
  lastRestockDate: timestamp("last_restock_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Unique constraint: one product per store
  index("unique_store_product").on(table.storeId, table.productId),
]);

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  transactionNumber: text("transaction_number").notNull().unique(),
  storeId: integer("store_id").references(() => stores.id).notNull(), // Store reference
  customerId: integer("customer_id").references(() => customers.id),
  cashierId: integer("cashier_id").references(() => users.id),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).notNull(), // VAT amount
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }).default("0.00"), // Separate VAT tracking
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0.00"), // Total discounts applied
  promotionDiscountAmount: decimal("promotion_discount_amount", { precision: 10, scale: 2 }).default("0.00"), // Promotion-specific discounts
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull(), // 'completed', 'hold', 'voided'
  paymentMethod: text("payment_method"), // 'cash', 'card', 'credit', 'split'
  cashTendered: decimal("cash_tendered", { precision: 10, scale: 2 }),
  cardType: text("card_type"), // Visa, Mastercard, etc.
  cardLast4: text("card_last4"), // Last 4 digits of card
  authCode: text("auth_code"), // Authorization code from POS terminal
  receiptPrinted: boolean("receipt_printed").default(false),
  // Multi-currency support
  currency: text("currency").notNull().default("QAR"), // Transaction currency
  exchangeRate: decimal("exchange_rate", { precision: 15, scale: 6 }).default("1.000000"), // Exchange rate used
  baseCurrencyTotal: decimal("base_currency_total", { precision: 10, scale: 2 }), // Total in store's base currency
  // Online order support
  orderType: text("order_type").notNull().default("pos"), // 'pos', 'online', 'delivery'
  deliveryAddress: text("delivery_address"), // For online/delivery orders
  deliveryNotes: text("delivery_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactionItems = pgTable("transaction_items", {
  id: serial("id").primaryKey(),
  transactionId: integer("transaction_id").references(() => transactions.id),
  productId: integer("product_id").references(() => products.id),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  // VAT support
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).default("5.00"), // VAT rate applied to this item
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }).default("0.00"), // VAT amount for this item
  // Promotion support  
  originalUnitPrice: decimal("original_unit_price", { precision: 10, scale: 2 }), // Price before any discounts
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0.00"), // Discount applied to this item
  promotionId: integer("promotion_id").references(() => promotions.id), // Applied promotion
});

export const dayOperations = pgTable("day_operations", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id).notNull(), // Store reference
  date: text("date").notNull(), // YYYY-MM-DD format
  cashierId: integer("cashier_id").references(() => users.id),

  // Opening balances
  openingCash: decimal("opening_cash", { precision: 10, scale: 2 }),
  openingBankBalance: decimal("opening_bank_balance", { precision: 10, scale: 2 }).default("0.00"),

  // Sales totals
  totalSales: decimal("total_sales", { precision: 10, scale: 2 }),
  cashSales: decimal("cash_sales", { precision: 10, scale: 2 }),
  cardSales: decimal("card_sales", { precision: 10, scale: 2 }),
  creditSales: decimal("credit_sales", { precision: 10, scale: 2 }),
  splitSales: decimal("split_sales", { precision: 10, scale: 2 }).default("0.00"),

  // Purchase totals (counter purchases)
  cashPurchases: decimal("cash_purchases", { precision: 10, scale: 2 }).default("0.00"),
  cardPurchases: decimal("card_purchases", { precision: 10, scale: 2 }).default("0.00"),
  bankPurchases: decimal("bank_purchases", { precision: 10, scale: 2 }).default("0.00"),

  // Owner transactions
  ownerDeposits: decimal("owner_deposits", { precision: 10, scale: 2 }).default("0.00"),
  ownerWithdrawals: decimal("owner_withdrawals", { precision: 10, scale: 2 }).default("0.00"),
  ownerBankDeposits: decimal("owner_bank_deposits", { precision: 10, scale: 2 }).default("0.00"),
  ownerBankWithdrawals: decimal("owner_bank_withdrawals", { precision: 10, scale: 2 }).default("0.00"),

  // Other cash movements
  expensePayments: decimal("expense_payments", { precision: 10, scale: 2 }).default("0.00"),
  supplierPayments: decimal("supplier_payments", { precision: 10, scale: 2 }).default("0.00"),
  bankTransfers: decimal("bank_transfers", { precision: 10, scale: 2 }).default("0.00"), // Cash to bank or bank to cash

  // Transaction counts
  totalTransactions: integer("total_transactions").default(0),
  cashTransactionCount: integer("cash_transaction_count").default(0),
  cardTransactionCount: integer("card_transaction_count").default(0),
  creditTransactionCount: integer("credit_transaction_count").default(0),
  splitTransactionCount: integer("split_transaction_count").default(0),

  // Cash reconciliation
  expectedCash: decimal("expected_cash", { precision: 10, scale: 2 }),
  actualCashCount: decimal("actual_cash_count", { precision: 10, scale: 2 }),
  closingCash: decimal("closing_cash", { precision: 10, scale: 2 }),
  cashDifference: decimal("cash_difference", { precision: 10, scale: 2 }),

  // Bank reconciliation
  expectedBankBalance: decimal("expected_bank_balance", { precision: 10, scale: 2 }).default("0.00"),
  actualBankBalance: decimal("actual_bank_balance", { precision: 10, scale: 2 }).default("0.00"),
  bankDifference: decimal("bank_difference", { precision: 10, scale: 2 }).default("0.00"),

  // POS Card Swipe Amount (Manual entry)
  posCardSwipeAmount: decimal("pos_card_swipe_amount", { precision: 10, scale: 2 }).default("0.00"),
  cardSwipeVariance: decimal("card_swipe_variance", { precision: 10, scale: 2 }).default("0.00"),
  bankWithdrawals: decimal("bank_withdrawals", { precision: 10, scale: 2 }).default("0.00"),

  // Cash denominations count (Qatari Riyal)
  cashCount_500: integer("cash_count_500").default(0), // QR 500 notes
  cashCount_200: integer("cash_count_200").default(0), // QR 200 notes
  cashCount_100: integer("cash_count_100").default(0), // QR 100 notes
  cashCount_50: integer("cash_count_50").default(0),   // QR 50 notes
  cashCount_20: integer("cash_count_20").default(0),   // QR 20 notes
  cashCount_10: integer("cash_count_10").default(0),   // QR 10 notes
  cashCount_5: integer("cash_count_5").default(0),     // QR 5 notes
  cashCount_1: integer("cash_count_1").default(0),     // QR 1 notes
  cashCount_050: integer("cash_count_050").default(0), // 50 Dirhams coins
  cashCount_025: integer("cash_count_025").default(0), // 25 Dirhams coins

  // Miscellaneous transactions
  cashMiscAmount: decimal("cash_misc_amount", { precision: 10, scale: 2 }).default("0.00"),
  cardMiscAmount: decimal("card_misc_amount", { precision: 10, scale: 2 }).default("0.00"),
  miscNotes: text("misc_notes"),

  // Timestamps and status
  openedAt: timestamp("opened_at"),
  closedAt: timestamp("closed_at"),
  reopenedAt: timestamp("reopened_at"),
  reopenedBy: integer("reopened_by").references(() => users.id),
  status: text("status").notNull(), // 'open', 'closed'
  reconciliationNotes: text("reconciliation_notes"),
});

export const heldTransactions = pgTable("held_transactions", {
  id: serial("id").primaryKey(),
  transactionData: jsonb("transaction_data").notNull(),
  customerId: integer("customer_id").references(() => customers.id),
  cashierId: integer("cashier_id").references(() => users.id),
  holdReason: text("hold_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id).notNull(),
  cashierId: integer("cashier_id").references(() => users.id),
  transactionId: integer("transaction_id").references(() => transactions.id),
  type: text("type").notNull(), // 'charge', 'payment', 'adjustment', 'refund'
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method"), // 'cash', 'card', 'bank_transfer', 'check', 'adjustment'
  reference: text("reference"), // Check number, transfer reference, etc.
  description: text("description"),
  previousBalance: decimal("previous_balance", { precision: 10, scale: 2 }).notNull(),
  newBalance: decimal("new_balance", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const supplierInvoices = pgTable("supplier_invoices", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").references(() => suppliers.id).notNull(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  invoiceDate: timestamp("invoice_date").notNull(),
  dueDate: timestamp("due_date"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).default("0.00"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull(), // 'pending', 'paid', 'overdue', 'cancelled'
  paymentStatus: text("payment_status").notNull().default("not_paid"), // 'paid', 'partially_paid', 'not_paid', 'paid_by_card'
  type: text("type").notNull(), // 'receipt', 'return'

  // Customer/Client information fields
  crNo: text("cr_no"), // Commercial Registration Number
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  customerMobile: text("customer_mobile"),
  customerEmail: text("customer_email"),
  customerAddress: text("customer_address"),
  salesmanName: text("salesman_name"),

  invoiceImageUrl: text("invoice_image_url"),
  extractedText: text("extracted_text"),
  notes: text("notes"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const supplierInvoiceItems = pgTable("supplier_invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").references(() => supplierInvoices.id).notNull(),
  productId: integer("product_id").references(() => products.id),
  srNo: integer("sr_no").notNull(), // Serial Number for line items
  productName: text("product_name").notNull(),
  itemCode: text("item_code"), // Item Code field
  barcode: text("barcode").notNull(), // Mandatory barcode field
  quantity: integer("quantity").notNull(),
  uom: text("uom").notNull().default("pcs"), // Unit of Measurement
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull(),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(),
  sku: text("sku"),
  isNewProduct: boolean("is_new_product").default(false),
});

export const stockAdjustments = pgTable("stock_adjustments", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  invoiceId: integer("invoice_id").references(() => supplierInvoices.id),
  adjustmentType: text("adjustment_type").notNull(), // 'receipt', 'return', 'manual'
  quantityChange: integer("quantity_change").notNull(),
  previousStock: integer("previous_stock").notNull(),
  newStock: integer("new_stock").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const supplierPayments = pgTable("supplier_payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").references(() => supplierInvoices.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(), // 'cash', 'card', 'bank_transfer', 'check', 'credit'
  reference: text("reference"), // Check number, transfer reference, etc.
  paymentDate: timestamp("payment_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const savedReports = pgTable("saved_reports", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  userQuery: text("user_query").notNull(),
  generatedSql: text("generated_sql").notNull(),
  reportData: jsonb("report_data").notNull(),
  insights: jsonb("insights"),
  chartType: text("chart_type"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const stockTakingSessions = pgTable("stock_taking_sessions", {
  id: serial("id").primaryKey(),
  sessionDate: text("session_date").notNull(),
  status: text("status").notNull().default("in_progress"), // in_progress, completed
  totalItems: integer("total_items").default(0),
  newProducts: integer("new_products").default(0),
  totalVarianceValue: decimal("total_variance_value", { precision: 10, scale: 2 }).default("0.00"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const stockTakingItems = pgTable("stock_taking_items", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => stockTakingSessions.id, { onDelete: "cascade" }).notNull(),
  productId: integer("product_id").references(() => products.id),
  sku: text("sku").notNull(),
  barcode: text("barcode"),
  name: text("name").notNull(),
  uom: text("uom").notNull().default("pcs"),
  systemQty: decimal("system_qty", { precision: 10, scale: 2 }).notNull().default("0.00"),
  actualQty: decimal("actual_qty", { precision: 10, scale: 2 }).notNull().default("0.00"),
  variance: decimal("variance", { precision: 10, scale: 2 }).notNull().default("0.00"),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }).notNull().default("0.00"),
  sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }).notNull().default("0.00"),
  varianceValue: decimal("variance_value", { precision: 10, scale: 2 }).notNull().default("0.00"),
  isNewProduct: boolean("is_new_product").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Cash movement tracking table for detailed financial tracking
export const cashMovements = pgTable("cash_movements", {
  id: serial("id").primaryKey(),
  dayOperationId: integer("day_operation_id").references(() => dayOperations.id),
  type: text("type").notNull(), // 'owner_deposit', 'owner_withdrawal', 'expense_payment', 'supplier_payment', 'bank_transfer', 'miscellaneous'
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(), // 'cash', 'bank_debit', 'credit_card'
  direction: text("direction").notNull(), // 'in', 'out'
  description: text("description").notNull(),
  reference: text("reference"), // Invoice number, receipt, etc.
  cashierId: integer("cashier_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Daily product monitoring table for products requiring daily reconciliation
export const dailyProductMonitoring = pgTable("daily_product_monitoring", {
  id: serial("id").primaryKey(),
  dayOperationId: integer("day_operation_id").references(() => dayOperations.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  date: text("date").notNull(), // YYYY-MM-DD format

  // Opening balances
  openingStock: decimal("opening_stock", { precision: 10, scale: 2 }).notNull(),
  openingValue: decimal("opening_value", { precision: 10, scale: 2 }).notNull(),

  // Sales data (auto-populated from transactions)
  totalSalesQty: decimal("total_sales_qty", { precision: 10, scale: 2 }).default("0.00"),
  cashSalesQty: decimal("cash_sales_qty", { precision: 10, scale: 2 }).default("0.00"),
  cardSalesQty: decimal("card_sales_qty", { precision: 10, scale: 2 }).default("0.00"),
  creditSalesQty: decimal("credit_sales_qty", { precision: 10, scale: 2 }).default("0.00"),
  totalSalesValue: decimal("total_sales_value", { precision: 10, scale: 2 }).default("0.00"),
  cashSalesValue: decimal("cash_sales_value", { precision: 10, scale: 2 }).default("0.00"),
  cardSalesValue: decimal("card_sales_value", { precision: 10, scale: 2 }).default("0.00"),
  creditSalesValue: decimal("credit_sales_value", { precision: 10, scale: 2 }).default("0.00"),

  // Purchase data (auto-populated from supplier invoices)
  totalPurchaseQty: decimal("total_purchase_qty", { precision: 10, scale: 2 }).default("0.00"),
  totalPurchaseValue: decimal("total_purchase_value", { precision: 10, scale: 2 }).default("0.00"),

  // Manual adjustments (editable by user)
  manualOpeningStock: decimal("manual_opening_stock", { precision: 10, scale: 2 }),
  manualSalesQty: decimal("manual_sales_qty", { precision: 10, scale: 2 }),
  manualPurchaseQty: decimal("manual_purchase_qty", { precision: 10, scale: 2 }),
  manualClosingStock: decimal("manual_closing_stock", { precision: 10, scale: 2 }),

  // Calculated closing
  systemClosingStock: decimal("system_closing_stock", { precision: 10, scale: 2 }).notNull(),
  actualClosingStock: decimal("actual_closing_stock", { precision: 10, scale: 2 }),
  variance: decimal("variance", { precision: 10, scale: 2 }).default("0.00"),
  varianceValue: decimal("variance_value", { precision: 10, scale: 2 }).default("0.00"),

  // Status and notes
  isReconciled: boolean("is_reconciled").default(false),
  notes: text("notes"),
  reconciledBy: integer("reconciled_by").references(() => users.id),
  reconciledAt: timestamp("reconciled_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const storesRelations = relations(stores, ({ one, many }) => ({
  manager: one(users, {
    fields: [stores.managerId],
    references: [users.id],
  }),
  users: many(users),
  storeProducts: many(storeProducts),
  transactions: many(transactions),
  dayOperations: many(dayOperations),
}));

export const storeProductsRelations = relations(storeProducts, ({ one }) => ({
  store: one(stores, {
    fields: [storeProducts.storeId],
    references: [stores.id],
  }),
  product: one(products, {
    fields: [storeProducts.productId],
    references: [products.id],
  }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  transactions: many(transactions),
  heldTransactions: many(heldTransactions),
  creditTransactions: many(creditTransactions),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  store: one(stores, {
    fields: [transactions.storeId],
    references: [stores.id],
  }),
  customer: one(customers, {
    fields: [transactions.customerId],
    references: [customers.id],
  }),
  cashier: one(users, {
    fields: [transactions.cashierId],
    references: [users.id],
  }),
  items: many(transactionItems),
}));

export const transactionItemsRelations = relations(transactionItems, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionItems.transactionId],
    references: [transactions.id],
  }),
  product: one(products, {
    fields: [transactionItems.productId],
    references: [products.id],
  }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [products.supplierId],
    references: [suppliers.id],
  }),
  storeProducts: many(storeProducts),
  transactionItems: many(transactionItems),
  supplierInvoiceItems: many(supplierInvoiceItems),
  stockAdjustments: many(stockAdjustments),
  dailyMonitoring: many(dailyProductMonitoring),
}));

export const usersRelations = relations(users, ({ many }) => ({
  transactions: many(transactions),
  dayOperations: many(dayOperations),
  heldTransactions: many(heldTransactions),
}));

export const dayOperationsRelations = relations(dayOperations, ({ one, many }) => ({
  store: one(stores, {
    fields: [dayOperations.storeId],
    references: [stores.id],
  }),
  cashier: one(users, {
    fields: [dayOperations.cashierId],
    references: [users.id],  }),
  cashMovements: many(cashMovements),
  productMonitoring: many(dailyProductMonitoring),
}));

export const cashMovementsRelations = relations(cashMovements, ({ one }) => ({
  dayOperation: one(dayOperations, {
    fields: [cashMovements.dayOperationId],
    references: [dayOperations.id],
  }),
  cashier: one(users, {
    fields: [cashMovements.cashierId],
    references: [users.id],
  }),
}));

export const heldTransactionsRelations = relations(heldTransactions, ({ one }) => ({
  customer: one(customers, {
    fields: [heldTransactions.customerId],
    references: [customers.id],
  }),
  cashier: one(users, {
    fields: [heldTransactions.cashierId],
    references: [users.id],
  }),
}));

export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
  customer: one(customers, {
    fields: [creditTransactions.customerId],
    references: [customers.id],
  }),
  cashier: one(users, {
    fields: [creditTransactions.cashierId],
    references: [users.id],
  }),
  transaction: one(transactions, {
    fields: [creditTransactions.transactionId],
    references: [transactions.id],
  }),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  products: many(products),
  invoices: many(supplierInvoices),
}));

export const supplierInvoicesRelations = relations(supplierInvoices, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [supplierInvoices.supplierId],
    references: [suppliers.id],
  }),
  items: many(supplierInvoiceItems),
  stockAdjustments: many(stockAdjustments),
  payments: many(supplierPayments),
}));

export const supplierInvoiceItemsRelations = relations(supplierInvoiceItems, ({ one }) => ({
  invoice: one(supplierInvoices, {
    fields: [supplierInvoiceItems.invoiceId],
    references: [supplierInvoices.id],
  }),
  product: one(products, {
    fields: [supplierInvoiceItems.productId],
    references: [products.id],
  }),
}));

export const stockAdjustmentsRelations = relations(stockAdjustments, ({ one }) => ({
  product: one(products, {
    fields: [stockAdjustments.productId],
    references: [products.id],
  }),
  invoice: one(supplierInvoices, {
    fields: [stockAdjustments.invoiceId],
    references: [supplierInvoices.id],
  }),
}));

export const supplierPaymentsRelations = relations(supplierPayments, ({ one }) => ({
  invoice: one(supplierInvoices, {
    fields: [supplierPayments.invoiceId],
    references: [supplierInvoices.id],
  }),
}));

export const stockTakingSessionsRelations = relations(stockTakingSessions, ({ many }) => ({
  items: many(stockTakingItems),
}));

export const stockTakingItemsRelations = relations(stockTakingItems, ({ one }) => ({
  session: one(stockTakingSessions, {
    fields: [stockTakingItems.sessionId],
    references: [stockTakingSessions.id],
  }),
  product: one(products, {
    fields: [stockTakingItems.productId],
    references: [products.id],
  }),
}));

export const dailyProductMonitoringRelations = relations(dailyProductMonitoring, ({ one }) => ({
  dayOperation: one(dayOperations, {
    fields: [dailyProductMonitoring.dayOperationId],
    references: [dayOperations.id],
  }),
  product: one(products, {
    fields: [dailyProductMonitoring.productId],
    references: [products.id],
  }),
  reconciledBy: one(users, {
    fields: [dailyProductMonitoring.reconciledBy],
    references: [users.id],
  }),
}));

// Competitor relations
export const competitorsRelations = relations(competitors, ({ many }) => ({
  prices: many(competitorPrices),
}));

export const competitorPricesRelations = relations(competitorPrices, ({ one }) => ({
  competitor: one(competitors, {
    fields: [competitorPrices.competitorId],
    references: [competitors.id],
  }),
  product: one(products, {
    fields: [competitorPrices.productId],
    references: [products.id],
  }),
  recordedByUser: one(users, {
    fields: [competitorPrices.recordedBy],
    references: [users.id],
  }),
}));

// New feature relations
export const vatConfigurationsRelations = relations(vatConfigurations, ({ one }) => ({
  store: one(stores, {
    fields: [vatConfigurations.storeId],
    references: [stores.id],
  }),
}));

export const customerAuthRelations = relations(customerAuth, ({ one }) => ({
  customer: one(customers, {
    fields: [customerAuth.customerId],
    references: [customers.id],
  }),
}));

export const promotionsRelations = relations(promotions, ({ one, many }) => ({
  store: one(stores, {
    fields: [promotions.storeId],
    references: [stores.id],
  }),
  rules: many(promotionRules),
  usage: many(promotionUsage),
}));

export const promotionRulesRelations = relations(promotionRules, ({ one }) => ({
  promotion: one(promotions, {
    fields: [promotionRules.promotionId],
    references: [promotions.id],
  }),
  product: one(products, {
    fields: [promotionRules.productId],
    references: [products.id],
  }),
}));

export const promotionUsageRelations = relations(promotionUsage, ({ one }) => ({
  promotion: one(promotions, {
    fields: [promotionUsage.promotionId],
    references: [promotions.id],
  }),
  transaction: one(transactions, {
    fields: [promotionUsage.transactionId],
    references: [transactions.id],
  }),
  customer: one(customers, {
    fields: [promotionUsage.customerId],
    references: [customers.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ createdAt: true, updatedAt: true });
export const upsertUserSchema = createInsertSchema(users).omit({ createdAt: true, updatedAt: true });
export const insertStoreSchema = createInsertSchema(stores).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserStoreSchema = createInsertSchema(userStores).omit({ id: true, assignedAt: true });
export const insertStoreProductSchema = createInsertSchema(storeProducts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  name: z.string().min(1, "Product name is required"),
  description: z.string().min(1, "Description is required"),
  sku: z.string().min(1, "SKU is required"),
  barcode: z.string().min(1, "Barcode is required"),
  price: z.union([z.string(), z.number()]).refine((val) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return !isNaN(num) && num > 0;
  }, "Price must be greater than 0"),
  cost: z.union([z.string(), z.number()]).refine((val) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return !isNaN(num) && num >= 0;
  }, "Cost must be 0 or greater"),
});
export const insertProductSiblingSchema = createInsertSchema(productSiblings).omit({ id: true, createdAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
export const insertTransactionItemSchema = createInsertSchema(transactionItems).omit({ id: true }).extend({
  productId: z.union([
    z.number().int().max(2147483647).min(1),
    z.null(),
    z.undefined().transform(() => null)
  ]).nullable().optional(),
});
export const insertDayOperationSchema = createInsertSchema(dayOperations).omit({ id: true, openedAt: true, closedAt: true, reopenedAt: true });
export const insertHeldTransactionSchema = createInsertSchema(heldTransactions).omit({ id: true, createdAt: true });
export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({ id: true, createdAt: true });
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true, createdAt: true });
export const insertSupplierInvoiceSchema = createInsertSchema(supplierInvoices).omit({ id: true, createdAt: true }).extend({
  invoiceDate: z.union([z.string(), z.date()]),
  dueDate: z.union([z.string(), z.date(), z.null()]).optional(),
  processedAt: z.union([z.string(), z.date(), z.null()]).optional(),
  supplierId: z.number().optional(),
  subtotal: z.union([z.string(), z.number()]).optional(),
  tax: z.union([z.string(), z.number()]).optional(),
  total: z.union([z.string(), z.number()]).optional(),
});
export const insertSupplierInvoiceItemSchema = createInsertSchema(supplierInvoiceItems).omit({ id: true });
export const insertStockAdjustmentSchema = createInsertSchema(stockAdjustments).omit({ id: true, createdAt: true });
export const insertSupplierPaymentSchema = createInsertSchema(supplierPayments).omit({ id: true, createdAt: true });
export const insertSavedReportSchema = createInsertSchema(savedReports).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStockTakingSessionSchema = createInsertSchema(stockTakingSessions).omit({ id: true, createdAt: true, completedAt: true });
export const insertStockTakingItemSchema = createInsertSchema(stockTakingItems).omit({ id: true, createdAt: true });
export const insertCashMovementSchema = createInsertSchema(cashMovements).omit({ id: true, createdAt: true });
export const insertDailyProductMonitoringSchema = createInsertSchema(dailyProductMonitoring).omit({ id: true, createdAt: true, updatedAt: true, reconciledAt: true });

export const insertGeneratedInvoiceSchema = createInsertSchema(generatedInvoices).omit({
  id: true,
  createdAt: true,
});

export const insertGeneratedInvoiceItemSchema = createInsertSchema(generatedInvoiceItems).omit({
  id: true,
});

export const insertShiftSchema = createInsertSchema(shifts).omit({
  id: true,
  createdAt: true,
}).extend({
  startingCash: z.string().optional(),
  notes: z.string().optional(),
  startTime: z.union([z.string(), z.date()]).optional(),
});

// New feature schemas
export const insertCurrencyRateSchema = createInsertSchema(currencyRates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertVatConfigurationSchema = createInsertSchema(vatConfigurations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCustomerAuthSchema = createInsertSchema(customerAuth).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPromotionSchema = createInsertSchema(promotions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPromotionRuleSchema = createInsertSchema(promotionRules).omit({ id: true, createdAt: true });
export const insertPromotionUsageSchema = createInsertSchema(promotionUsage).omit({ id: true, createdAt: true });
export const insertCompetitorSchema = createInsertSchema(competitors).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCompetitorPriceSchema = createInsertSchema(competitorPrices).omit({ id: true, createdAt: true, updatedAt: true });

// Types
export type Store = typeof stores.$inferSelect;
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type UserStore = typeof userStores.$inferSelect;
export type InsertUserStore = z.infer<typeof insertUserStoreSchema>;
export type StoreProduct = typeof storeProducts.$inferSelect;
export type InsertStoreProduct = z.infer<typeof insertStoreProductSchema>;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type ProductSibling = typeof productSiblings.$inferSelect;
export type InsertProductSibling = z.infer<typeof insertProductSiblingSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type InsertTransactionItem = z.infer<typeof insertTransactionItemSchema>;
export type DayOperation = typeof dayOperations.$inferSelect;
export type InsertDayOperation = z.infer<typeof insertDayOperationSchema>;
export type HeldTransaction = typeof heldTransactions.$inferSelect;
export type InsertHeldTransaction = z.infer<typeof insertHeldTransactionSchema>;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type SupplierInvoice = typeof supplierInvoices.$inferSelect;
export type InsertSupplierInvoice = z.infer<typeof insertSupplierInvoiceSchema>;
export type SupplierInvoiceItem = typeof supplierInvoiceItems.$inferSelect;
export type InsertSupplierInvoiceItem = z.infer<typeof insertSupplierInvoiceItemSchema>;
export type StockAdjustment = typeof stockAdjustments.$inferSelect;
export type InsertStockAdjustment = z.infer<typeof insertStockAdjustmentSchema>;
export type SupplierPayment = typeof supplierPayments.$inferSelect;
export type InsertSupplierPayment = z.infer<typeof insertSupplierPaymentSchema>;
export type SavedReport = typeof savedReports.$inferSelect;
export type InsertSavedReport = z.infer<typeof insertSavedReportSchema>;
export type StockTakingSession = typeof stockTakingSessions.$inferSelect;
export type InsertStockTakingSession = z.infer<typeof insertStockTakingSessionSchema>;
export type StockTakingItem = typeof stockTakingItems.$inferSelect;
export type InsertStockTakingItem = z.infer<typeof insertStockTakingItemSchema>;
export type CashMovement = typeof cashMovements.$inferSelect;
export type InsertCashMovement = z.infer<typeof insertCashMovementSchema>;
export type DailyProductMonitoring = typeof dailyProductMonitoring.$inferSelect;
export type InsertDailyProductMonitoring = z.infer<typeof insertDailyProductMonitoringSchema>;
export type GeneratedInvoice = typeof generatedInvoices.$inferSelect;
export type InsertGeneratedInvoice = z.infer<typeof insertGeneratedInvoiceSchema>;
export type GeneratedInvoiceItem = typeof generatedInvoiceItems.$inferSelect;
export type InsertGeneratedInvoiceItem = z.infer<typeof insertGeneratedInvoiceItemSchema>;
export type Shift = typeof shifts.$inferSelect;
export type InsertShift = z.infer<typeof insertShiftSchema>;

// New feature types
export type CurrencyRate = typeof currencyRates.$inferSelect;
export type InsertCurrencyRate = z.infer<typeof insertCurrencyRateSchema>;
export type VatConfiguration = typeof vatConfigurations.$inferSelect;
export type InsertVatConfiguration = z.infer<typeof insertVatConfigurationSchema>;
export type CustomerAuth = typeof customerAuth.$inferSelect;
export type InsertCustomerAuth = z.infer<typeof insertCustomerAuthSchema>;
export type Promotion = typeof promotions.$inferSelect;
export type InsertPromotion = z.infer<typeof insertPromotionSchema>;
export type PromotionRule = typeof promotionRules.$inferSelect;
export type InsertPromotionRule = z.infer<typeof insertPromotionRuleSchema>;
export type PromotionUsage = typeof promotionUsage.$inferSelect;
export type InsertPromotionUsage = z.infer<typeof insertPromotionUsageSchema>;
export type Competitor = typeof competitors.$inferSelect;
export type InsertCompetitor = z.infer<typeof insertCompetitorSchema>;
export type CompetitorPrice = typeof competitorPrices.$inferSelect;
export type InsertCompetitorPrice = z.infer<typeof insertCompetitorPriceSchema>;

// Cart item type for frontend
export const cartItemSchema = z.object({
  productId: z.number().nullable().optional(), // Can be null for custom items
  sku: z.string(),
  name: z.string(),
  price: z.string(),
  quantity: z.number(),
  total: z.string(),
  imageUrl: z.string().optional(),
  vatRate: z.number().optional(), // VAT rate for this item
  discountAmount: z.string().optional(), // Discount amount for this item
  discountType: z.enum(['percentage', 'fixed']).optional(), // Discount type: percentage or fixed amount
  stock: z.number().optional(), // Current stock level at time of adding to cart
});

export type CartItem = z.infer<typeof cartItemSchema>;