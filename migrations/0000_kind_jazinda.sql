CREATE TABLE "cash_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"day_operation_id" integer,
	"type" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"payment_method" text NOT NULL,
	"direction" text NOT NULL,
	"description" text NOT NULL,
	"reference" text,
	"cashier_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "competitor_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"competitor_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"original_price" numeric(10, 2),
	"currency" text DEFAULT 'QAR' NOT NULL,
	"product_name" text,
	"product_sku" text,
	"product_barcode" text,
	"product_url" text,
	"image_url" text,
	"availability" text,
	"match_confidence" numeric(5, 2),
	"matched_by" text,
	"notes" text,
	"price_date" timestamp DEFAULT now() NOT NULL,
	"expiry_date" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"recorded_by" integer
);
--> statement-breakpoint
CREATE TABLE "competitors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"address" text,
	"city" text,
	"country" text,
	"website" text,
	"phone" text,
	"email" text,
	"contact_person" text,
	"business_type" text,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"cashier_id" integer,
	"transaction_id" integer,
	"type" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"payment_method" text,
	"reference" text,
	"description" text,
	"previous_balance" numeric(10, 2) NOT NULL,
	"new_balance" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "currency_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_currency" text NOT NULL,
	"to_currency" text NOT NULL,
	"rate" numeric(15, 6) NOT NULL,
	"effective_date" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_auth" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"password_hash" text NOT NULL,
	"is_email_verified" boolean DEFAULT false,
	"email_verification_token" text,
	"password_reset_token" text,
	"password_reset_expiry" timestamp,
	"last_login_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "customer_auth_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"address" text,
	"credit_limit" numeric(10, 2) DEFAULT '0.00',
	"credit_balance" numeric(10, 2) DEFAULT '0.00',
	"profile_image" text,
	"id_card_image" text,
	"notes" text,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "daily_product_monitoring" (
	"id" serial PRIMARY KEY NOT NULL,
	"day_operation_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"date" text NOT NULL,
	"opening_stock" numeric(10, 2) NOT NULL,
	"opening_value" numeric(10, 2) NOT NULL,
	"total_sales_qty" numeric(10, 2) DEFAULT '0.00',
	"cash_sales_qty" numeric(10, 2) DEFAULT '0.00',
	"card_sales_qty" numeric(10, 2) DEFAULT '0.00',
	"credit_sales_qty" numeric(10, 2) DEFAULT '0.00',
	"total_sales_value" numeric(10, 2) DEFAULT '0.00',
	"cash_sales_value" numeric(10, 2) DEFAULT '0.00',
	"card_sales_value" numeric(10, 2) DEFAULT '0.00',
	"credit_sales_value" numeric(10, 2) DEFAULT '0.00',
	"total_purchase_qty" numeric(10, 2) DEFAULT '0.00',
	"total_purchase_value" numeric(10, 2) DEFAULT '0.00',
	"manual_opening_stock" numeric(10, 2),
	"manual_sales_qty" numeric(10, 2),
	"manual_purchase_qty" numeric(10, 2),
	"manual_closing_stock" numeric(10, 2),
	"system_closing_stock" numeric(10, 2) NOT NULL,
	"actual_closing_stock" numeric(10, 2),
	"variance" numeric(10, 2) DEFAULT '0.00',
	"variance_value" numeric(10, 2) DEFAULT '0.00',
	"is_reconciled" boolean DEFAULT false,
	"notes" text,
	"reconciled_by" integer,
	"reconciled_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "day_operations" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"date" text NOT NULL,
	"cashier_id" integer,
	"opening_cash" numeric(10, 2),
	"opening_bank_balance" numeric(10, 2) DEFAULT '0.00',
	"total_sales" numeric(10, 2),
	"cash_sales" numeric(10, 2),
	"card_sales" numeric(10, 2),
	"credit_sales" numeric(10, 2),
	"split_sales" numeric(10, 2) DEFAULT '0.00',
	"cash_purchases" numeric(10, 2) DEFAULT '0.00',
	"card_purchases" numeric(10, 2) DEFAULT '0.00',
	"bank_purchases" numeric(10, 2) DEFAULT '0.00',
	"owner_deposits" numeric(10, 2) DEFAULT '0.00',
	"owner_withdrawals" numeric(10, 2) DEFAULT '0.00',
	"owner_bank_deposits" numeric(10, 2) DEFAULT '0.00',
	"owner_bank_withdrawals" numeric(10, 2) DEFAULT '0.00',
	"expense_payments" numeric(10, 2) DEFAULT '0.00',
	"supplier_payments" numeric(10, 2) DEFAULT '0.00',
	"bank_transfers" numeric(10, 2) DEFAULT '0.00',
	"total_transactions" integer DEFAULT 0,
	"cash_transaction_count" integer DEFAULT 0,
	"card_transaction_count" integer DEFAULT 0,
	"credit_transaction_count" integer DEFAULT 0,
	"split_transaction_count" integer DEFAULT 0,
	"expected_cash" numeric(10, 2),
	"actual_cash_count" numeric(10, 2),
	"closing_cash" numeric(10, 2),
	"cash_difference" numeric(10, 2),
	"expected_bank_balance" numeric(10, 2) DEFAULT '0.00',
	"actual_bank_balance" numeric(10, 2) DEFAULT '0.00',
	"bank_difference" numeric(10, 2) DEFAULT '0.00',
	"pos_card_swipe_amount" numeric(10, 2) DEFAULT '0.00',
	"card_swipe_variance" numeric(10, 2) DEFAULT '0.00',
	"bank_withdrawals" numeric(10, 2) DEFAULT '0.00',
	"cash_count_500" integer DEFAULT 0,
	"cash_count_200" integer DEFAULT 0,
	"cash_count_100" integer DEFAULT 0,
	"cash_count_50" integer DEFAULT 0,
	"cash_count_20" integer DEFAULT 0,
	"cash_count_10" integer DEFAULT 0,
	"cash_count_5" integer DEFAULT 0,
	"cash_count_1" integer DEFAULT 0,
	"cash_count_050" integer DEFAULT 0,
	"cash_count_025" integer DEFAULT 0,
	"cash_misc_amount" numeric(10, 2) DEFAULT '0.00',
	"card_misc_amount" numeric(10, 2) DEFAULT '0.00',
	"misc_notes" text,
	"opened_at" timestamp,
	"closed_at" timestamp,
	"reopened_at" timestamp,
	"reopened_by" integer,
	"status" text NOT NULL,
	"reconciliation_notes" text
);
--> statement-breakpoint
CREATE TABLE "generated_invoice_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"product_id" integer,
	"product_name" text NOT NULL,
	"sku" text,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generated_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"transaction_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"customer_id" integer,
	"cashier_id" integer,
	"subtotal" numeric(10, 2) NOT NULL,
	"tax" numeric(10, 2) NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0.00',
	"total" numeric(10, 2) NOT NULL,
	"payment_method" text NOT NULL,
	"cash_tendered" numeric(10, 2),
	"card_type" text,
	"pdf_file_path" text,
	"pdf_url" text,
	"status" text DEFAULT 'generated' NOT NULL,
	"whatsapp_sent" boolean DEFAULT false,
	"email_sent" boolean DEFAULT false,
	"printed_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "generated_invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "held_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_data" jsonb NOT NULL,
	"customer_id" integer,
	"cashier_id" integer,
	"hold_reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_siblings" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"sibling_id" integer NOT NULL,
	"relationship_type" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"cost" numeric(10, 2),
	"stock" integer DEFAULT 0,
	"quantity" integer DEFAULT 0,
	"barcode" text,
	"image_url" text,
	"product_type" text,
	"category" text,
	"supplier_id" integer,
	"is_active" boolean DEFAULT true,
	"requires_daily_monitoring" boolean DEFAULT false,
	"vat_rate" numeric(5, 2),
	"vat_exempt" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "promotion_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"promotion_id" integer NOT NULL,
	"rule_type" text NOT NULL,
	"product_id" integer,
	"category" text,
	"buy_quantity" integer,
	"get_quantity" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "promotion_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"promotion_id" integer NOT NULL,
	"transaction_id" integer NOT NULL,
	"customer_id" integer,
	"discount_amount" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"value" numeric(10, 2),
	"min_order_amount" numeric(10, 2),
	"max_discount_amount" numeric(10, 2),
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"is_active" boolean DEFAULT true,
	"usage_limit" integer,
	"usage_count" integer DEFAULT 0,
	"customer_limit" integer,
	"applicable_to_customer_types" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "saved_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"user_query" text NOT NULL,
	"generated_sql" text NOT NULL,
	"report_data" jsonb NOT NULL,
	"insights" jsonb,
	"chart_type" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"day_operation_id" integer,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"total_sales" numeric(10, 2) DEFAULT '0.00',
	"total_cash" numeric(10, 2) DEFAULT '0.00',
	"total_card" numeric(10, 2) DEFAULT '0.00',
	"total_credit" numeric(10, 2) DEFAULT '0.00',
	"invoice_count" integer DEFAULT 0,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stock_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"invoice_id" integer,
	"adjustment_type" text NOT NULL,
	"quantity_change" integer NOT NULL,
	"previous_stock" integer NOT NULL,
	"new_stock" integer NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stock_taking_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"product_id" integer,
	"sku" text NOT NULL,
	"barcode" text,
	"name" text NOT NULL,
	"uom" text DEFAULT 'pcs' NOT NULL,
	"system_qty" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"actual_qty" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"variance" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"cost_price" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"selling_price" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"variance_value" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"is_new_product" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stock_taking_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_date" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"total_items" integer DEFAULT 0,
	"new_products" integer DEFAULT 0,
	"total_variance_value" numeric(10, 2) DEFAULT '0.00',
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "store_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"cost" numeric(10, 2),
	"stock" integer DEFAULT 0,
	"min_stock" integer DEFAULT 0,
	"max_stock" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"last_restock_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"address" text,
	"phone" text,
	"email" text,
	"manager_id" integer,
	"is_active" boolean DEFAULT true,
	"settings" jsonb,
	"base_currency" text DEFAULT 'QAR' NOT NULL,
	"vat_enabled" boolean DEFAULT true,
	"default_vat_rate" numeric(5, 2) DEFAULT '5.00',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "stores_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "supplier_invoice_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"product_id" integer,
	"sr_no" integer NOT NULL,
	"product_name" text NOT NULL,
	"item_code" text,
	"barcode" text NOT NULL,
	"quantity" integer NOT NULL,
	"uom" text DEFAULT 'pcs' NOT NULL,
	"unit_cost" numeric(10, 2) NOT NULL,
	"total_cost" numeric(10, 2) NOT NULL,
	"sku" text,
	"is_new_product" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "supplier_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"invoice_number" text NOT NULL,
	"invoice_date" timestamp NOT NULL,
	"due_date" timestamp,
	"subtotal" numeric(10, 2) NOT NULL,
	"tax" numeric(10, 2) DEFAULT '0.00',
	"total" numeric(10, 2) NOT NULL,
	"status" text NOT NULL,
	"payment_status" text DEFAULT 'not_paid' NOT NULL,
	"type" text NOT NULL,
	"cr_no" text,
	"customer_name" text,
	"customer_phone" text,
	"customer_mobile" text,
	"customer_email" text,
	"customer_address" text,
	"salesman_name" text,
	"invoice_image_url" text,
	"extracted_text" text,
	"notes" text,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "supplier_invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "supplier_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"payment_method" text NOT NULL,
	"reference" text,
	"payment_date" timestamp NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact_person" text,
	"email" text,
	"phone" text,
	"address" text,
	"tax_id" text,
	"payment_terms" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transaction_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" integer,
	"product_id" integer,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"vat_rate" numeric(5, 2) DEFAULT '5.00',
	"vat_amount" numeric(10, 2) DEFAULT '0.00',
	"original_unit_price" numeric(10, 2),
	"discount_amount" numeric(10, 2) DEFAULT '0.00',
	"promotion_id" integer
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_number" text NOT NULL,
	"store_id" integer NOT NULL,
	"customer_id" integer,
	"cashier_id" integer,
	"subtotal" numeric(10, 2) NOT NULL,
	"tax" numeric(10, 2) NOT NULL,
	"vat_amount" numeric(10, 2) DEFAULT '0.00',
	"discount_amount" numeric(10, 2) DEFAULT '0.00',
	"promotion_discount_amount" numeric(10, 2) DEFAULT '0.00',
	"total" numeric(10, 2) NOT NULL,
	"status" text NOT NULL,
	"payment_method" text,
	"cash_tendered" numeric(10, 2),
	"card_type" text,
	"card_last4" text,
	"auth_code" text,
	"receipt_printed" boolean DEFAULT false,
	"currency" text DEFAULT 'QAR' NOT NULL,
	"exchange_rate" numeric(15, 6) DEFAULT '1.000000',
	"base_currency_total" numeric(10, 2),
	"order_type" text DEFAULT 'pos' NOT NULL,
	"delivery_address" text,
	"delivery_notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "transactions_transaction_number_unique" UNIQUE("transaction_number")
);
--> statement-breakpoint
CREATE TABLE "user_stores" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"can_access" boolean DEFAULT true,
	"assigned_at" timestamp DEFAULT now(),
	"assigned_by" integer
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar NOT NULL,
	"password" varchar NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"role" text DEFAULT 'cashier' NOT NULL,
	"default_store_id" integer,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vat_configurations" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"category" text,
	"vat_rate" numeric(5, 2) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_day_operation_id_day_operations_id_fk" FOREIGN KEY ("day_operation_id") REFERENCES "public"."day_operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_prices" ADD CONSTRAINT "competitor_prices_competitor_id_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_prices" ADD CONSTRAINT "competitor_prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_prices" ADD CONSTRAINT "competitor_prices_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitors" ADD CONSTRAINT "competitors_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_auth" ADD CONSTRAINT "customer_auth_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_product_monitoring" ADD CONSTRAINT "daily_product_monitoring_day_operation_id_day_operations_id_fk" FOREIGN KEY ("day_operation_id") REFERENCES "public"."day_operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_product_monitoring" ADD CONSTRAINT "daily_product_monitoring_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_product_monitoring" ADD CONSTRAINT "daily_product_monitoring_reconciled_by_users_id_fk" FOREIGN KEY ("reconciled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_operations" ADD CONSTRAINT "day_operations_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_operations" ADD CONSTRAINT "day_operations_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_operations" ADD CONSTRAINT "day_operations_reopened_by_users_id_fk" FOREIGN KEY ("reopened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_invoice_items" ADD CONSTRAINT "generated_invoice_items_invoice_id_generated_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."generated_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_invoice_items" ADD CONSTRAINT "generated_invoice_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_invoices" ADD CONSTRAINT "generated_invoices_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_invoices" ADD CONSTRAINT "generated_invoices_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_invoices" ADD CONSTRAINT "generated_invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_invoices" ADD CONSTRAINT "generated_invoices_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "held_transactions" ADD CONSTRAINT "held_transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "held_transactions" ADD CONSTRAINT "held_transactions_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_siblings" ADD CONSTRAINT "product_siblings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_siblings" ADD CONSTRAINT "product_siblings_sibling_id_products_id_fk" FOREIGN KEY ("sibling_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_siblings" ADD CONSTRAINT "product_siblings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_rules" ADD CONSTRAINT "promotion_rules_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_rules" ADD CONSTRAINT "promotion_rules_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_usage" ADD CONSTRAINT "promotion_usage_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_usage" ADD CONSTRAINT "promotion_usage_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_usage" ADD CONSTRAINT "promotion_usage_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_day_operation_id_day_operations_id_fk" FOREIGN KEY ("day_operation_id") REFERENCES "public"."day_operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_taking_items" ADD CONSTRAINT "stock_taking_items_session_id_stock_taking_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."stock_taking_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_taking_items" ADD CONSTRAINT "stock_taking_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_items" ADD CONSTRAINT "supplier_invoice_items_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_items" ADD CONSTRAINT "supplier_invoice_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stores" ADD CONSTRAINT "user_stores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stores" ADD CONSTRAINT "user_stores_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stores" ADD CONSTRAINT "user_stores_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vat_configurations" ADD CONSTRAINT "vat_configurations_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "competitor_product_idx" ON "competitor_prices" USING btree ("competitor_id","product_id");--> statement-breakpoint
CREATE INDEX "product_competitor_idx" ON "competitor_prices" USING btree ("product_id","competitor_id");--> statement-breakpoint
CREATE INDEX "currency_pair_idx" ON "currency_rates" USING btree ("from_currency","to_currency");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_product_sibling" ON "product_siblings" USING btree ("product_id","sibling_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "unique_store_product" ON "store_products" USING btree ("store_id","product_id");--> statement-breakpoint
CREATE INDEX "unique_user_store" ON "user_stores" USING btree ("user_id","store_id");