import OpenAI from "openai";
import { storage } from "./storage";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ReportQuery {
  sql: string;
  description: string;
  chartType: 'bar' | 'line' | 'pie' | 'table' | 'number';
  title: string;
  columns: string[];
  explanation?: string;
}

interface ReportResult {
  data: any[];
  query: ReportQuery;
  summary: string;
  insights: string[];
  hasBillData: boolean;
  transactionIds?: number[];
  additionalVisuals: {
    pieChart?: ReportQuery;
    barChart?: ReportQuery;
    pieData?: any[];
    barData?: any[];
  };
}

export async function generateDynamicReport(userQuery: string): Promise<ReportResult> {
  // Check if we have a valid OpenAI API key
  // To get an API key: https://platform.openai.com/api-keys
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'set-me' || !apiKey.startsWith('sk-') || apiKey.length < 20) {
    throw new Error('OpenAI API key is required. Please set a valid OpenAI API key in your .env file. Get one at https://platform.openai.com/api-keys (it should start with "sk-")');
  }

  try {
    // Generate SQL query from natural language
    const queryResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert PostgreSQL analyst for a Point of Sale (POS) system. Generate ONLY PostgreSQL-compatible SQL queries based on natural language requests.

Database Schema:
- transactions: id, transaction_number, customer_id, cashier_id, subtotal, tax, total, status, payment_method, created_at, cash_tendered, card_type, card_last4, auth_code, receipt_printed
- transaction_items: id, transaction_id, product_id, quantity, unit_price, total
- products: id, sku, name, description, price, cost, stock, quantity, barcode, image_url, category, supplier_id, is_active
- customers: id, name, email, phone, address, credit_balance, credit_limit, is_active
- day_operations: id, date, opened_at, closed_at, opening_cash, closing_cash, total_sales, total_transactions, cash_sales, card_sales, credit_sales
- suppliers: id, name, contact_person, email, phone, address, is_active

CRITICAL PostgreSQL Rules:
1. ONLY generate SELECT queries, never INSERT/UPDATE/DELETE
2. Use ONLY PostgreSQL syntax - NO MySQL functions like CURDATE(), NOW(), etc.
3. For current date use: CURRENT_DATE
4. For current timestamp use: CURRENT_TIMESTAMP  
5. For date calculations use: CURRENT_DATE - INTERVAL '30 days'
6. For date formatting use: DATE(created_at) or created_at::date
7. Always cast decimals: total::numeric for calculations
8. Use ILIKE for case-insensitive text search
9. Column names: transaction_items.total (not total_price), products.quantity (not stock)
10. FORBIDDEN: Never use 'user_id' - use 'cashier_id' instead

Chart Types:
- 'bar': For comparisons (sales by category, top products)
- 'line': For trends over time (daily sales, monthly revenue)
- 'pie': For distributions (payment methods, product categories)
- 'table': For detailed listings (transaction details, customer info)
- 'number': For single metrics (total sales, customer count)

Example PostgreSQL queries:
{
  "sql": "SELECT created_at::date as date, SUM(total::numeric) as revenue FROM transactions WHERE created_at >= CURRENT_DATE - INTERVAL '30 days' GROUP BY created_at::date ORDER BY date",
  "description": "Daily revenue for the last 30 days",
  "chartType": "line",
  "title": "Daily Revenue Trend (Last 30 Days)",
  "columns": ["date", "revenue"]
}

IMPORTANT: Always respond with valid JSON format containing the required fields.`
        },
        {
          role: "user",
          content: userQuery
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 500
    });

    const queryData: ReportQuery = JSON.parse(queryResponse.choices[0].message.content || '{}');

    // Execute the generated SQL query
    const data = await executeReportQuery(queryData.sql);

    // Generate insights from the data
    const insights = await generateInsights(userQuery, data, queryData);

    // Check if this is transaction/bill level data
    const hasBillData = queryData.sql.toLowerCase().includes('transaction') && 
                        data.some(row => row.transaction_id || row.transaction_number);
    
    const transactionIds = hasBillData ? 
      data.map(row => row.transaction_id || row.id).filter(id => id) : 
      undefined;

    // Generate additional visualizations (pie and bar charts)
    const additionalVisuals = await generateAdditionalVisuals(userQuery, data, queryData);

    return {
      data,
      query: queryData,
      summary: queryData.description,
      insights,
      hasBillData,
      transactionIds,
      additionalVisuals
    };

  } catch (error) {
    console.error('Error generating dynamic report:', error);
    throw new Error('Failed to generate report: ' + (error as Error).message);
  }
}

async function executeReportQuery(sql: string): Promise<any[]> {
  try {
    // Use the existing database connection from storage
    const { pool } = await import('./db');
    const result = await pool.query(sql);
    return result.rows;
  } catch (error) {
    console.error('Error executing report query:', error);
    throw new Error('Failed to execute query: ' + (error as Error).message);
  }
}

async function generateInsights(userQuery: string, data: any[], queryInfo: ReportQuery): Promise<string[]> {
  if (data.length === 0) {
    return ["No data available for the requested period or criteria."];
  }

  // Check if we have a valid OpenAI API key
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.length < 10) {
    return ["Analysis completed successfully.", `Found ${data.length} records matching your criteria.`];
  }

  try {
    const dataPreview = data.slice(0, 5); // Send only first 5 rows for analysis
    
    const insightsResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a business analyst. Analyze the provided data and generate 3-5 key business insights.
          Focus on:
          - Trends and patterns
          - Notable numbers or changes
          - Business recommendations
          - Performance indicators
          
          Keep insights concise and actionable. Return as a JSON array of strings.
          
          IMPORTANT: Always respond with valid JSON format.`
        },
        {
          role: "user",
          content: `Query: ${userQuery}
          Data sample: ${JSON.stringify(dataPreview)}
          Total records: ${data.length}
          
          Generate business insights from this data.`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 400
    });

    const result = JSON.parse(insightsResponse.choices[0].message.content || '{"insights": []}');
    return result.insights || [];

  } catch (error) {
    console.error('Error generating insights:', error);
    return ["Analysis completed successfully.", `Found ${data.length} records matching your criteria.`];
  }
}

async function generateAdditionalVisuals(userQuery: string, originalData: any[], originalQuery: ReportQuery) {
  try {
    const additionalVisuals: any = {};

    // Generate pie chart query for distribution/breakdown
    const pieResponse = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: `You are a PostgreSQL data visualization expert. Create ONLY PostgreSQL-compatible SQL queries for pie charts showing distribution/breakdown data. 
          
          Database schema:
          - transactions: id, transaction_number, cashier_id, customer_id, total, payment_method, status, created_at
          - transaction_items: transaction_id, product_id, quantity, unit_price, total
          - products: id, sku, name, description, price, cost, stock, quantity, barcode, image_url, category, supplier_id, is_active
          - customers: id, name, email, phone, address, credit_limit, credit_balance, is_active
          
          PostgreSQL Rules:
          - Use CURRENT_DATE for today, CURRENT_DATE - INTERVAL '30 days' for date ranges
          - Use created_at::date for date formatting
          - Cast decimals: total::numeric for calculations
          - No MySQL functions like CURDATE(), NOW()
          
          Return JSON with: sql, description, title, columns, chartType (always "pie"), explanation (detailed explanation of what this visualization shows and how to interpret it)
          
          IMPORTANT: Always respond with valid JSON format containing the required fields.`
        },
        {
          role: "user",
          content: `Original query: "${userQuery}". Create a pie chart showing distribution/breakdown related to this data.`
        }
      ],
      response_format: { type: "json_object" }
    });

    const pieQuery = JSON.parse(pieResponse.choices[0].message.content || '{}');
    if (pieQuery.sql) {
      const pieData = await executeReportQuery(pieQuery.sql);
      additionalVisuals.pieChart = { ...pieQuery, chartType: 'pie' };
      additionalVisuals.pieData = pieData;
    }

    // Generate bar chart query for comparisons
    const barResponse = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: `You are a PostgreSQL data visualization expert. Create ONLY PostgreSQL-compatible SQL queries for bar charts showing comparison or ranking data.
          
          Database schema:
          - transactions: id, transaction_number, cashier_id, customer_id, total, payment_method, status, created_at
          - transaction_items: transaction_id, product_id, quantity, unit_price, total
          - products: id, sku, name, description, price, cost, stock, quantity, barcode, image_url, category, supplier_id, is_active
          - customers: id, name, email, phone, address, credit_limit, credit_balance, is_active
          
          PostgreSQL Rules:
          - Use CURRENT_DATE for today, CURRENT_DATE - INTERVAL '30 days' for date ranges
          - Use created_at::date for date formatting
          - Cast decimals: total::numeric for calculations
          - No MySQL functions like CURDATE(), NOW()
          
          Return JSON with: sql, description, title, columns, chartType (always "bar"), explanation (detailed explanation of what this visualization shows and how to interpret it)
          
          IMPORTANT: Always respond with valid JSON format containing the required fields.`
        },
        {
          role: "user",
          content: `Original query: "${userQuery}". Create a bar chart showing comparisons or rankings related to this data.`
        }
      ],
      response_format: { type: "json_object" }
    });

    const barQuery = JSON.parse(barResponse.choices[0].message.content || '{}');
    if (barQuery.sql) {
      const barData = await executeReportQuery(barQuery.sql);
      additionalVisuals.barChart = { ...barQuery, chartType: 'bar' };
      additionalVisuals.barData = barData;
    }

    return additionalVisuals;
  } catch (error) {
    console.error('Error generating additional visuals:', error);
    // Return fallback visualizations to ensure minimum 3 charts
    return {
      pieChart: {
        sql: "SELECT payment_method, COUNT(*) as count FROM transactions WHERE created_at >= CURRENT_DATE GROUP BY payment_method",
        description: "Payment method distribution",
        chartType: 'pie',
        title: "Payment Methods Distribution",
        columns: ["payment_method", "count"]
      },
      pieData: [],
      barChart: {
        sql: "SELECT created_at::date as date, COUNT(*) as transactions FROM transactions WHERE created_at >= CURRENT_DATE - INTERVAL '7 days' GROUP BY created_at::date ORDER BY date",
        description: "Daily transaction count",
        chartType: 'bar', 
        title: "Daily Transactions (Last 7 Days)",
        columns: ["date", "transactions"]
      },
      barData: []
    };
  }
}

// Predefined report templates for common queries
export const reportTemplates = [
  {
    id: 'daily-sales',
    name: 'Daily Sales Report',
    description: 'Show sales performance for today',
    query: 'Show me today\'s sales performance'
  },
  {
    id: 'top-products',
    name: 'Top Selling Products',
    description: 'Products with highest sales this month',
    query: 'What are the top 10 selling products this month?'
  },
  {
    id: 'customer-analysis',
    name: 'Customer Analysis',
    description: 'Customer purchase patterns and behavior',
    query: 'Show me customer purchase patterns and top customers by revenue'
  },
  {
    id: 'payment-methods',
    name: 'Payment Methods',
    description: 'Breakdown of payment methods used',
    query: 'Show me the distribution of payment methods used this month'
  },
  {
    id: 'hourly-sales',
    name: 'Hourly Sales Pattern',
    description: 'Sales performance by hour of day',
    query: 'Show me sales patterns by hour of the day for the last week'
  },
  {
    id: 'category-performance',
    name: 'Category Performance',
    description: 'Sales performance by product category',
    query: 'Compare sales performance across different product categories this month'
  }
];