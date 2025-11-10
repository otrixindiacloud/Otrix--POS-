import { db } from "./db";
import { transactions, transactionItems, customers, products } from "@shared/schema";
import { eq, desc, and, gte, lt, sql, inArray } from "drizzle-orm";

export interface RiskFactors {
  highValueTransaction: boolean;
  unusualQuantity: boolean;
  firstTimeCustomer: boolean;
  frequentReturns: boolean;
  suspiciousPaymentPattern: boolean;
  lowStockItems: boolean;
  multipleHighValueItems: boolean;
  cashOnlyLargeTransaction: boolean;
  rapidSequentialTransactions: boolean;
  unusualTimeTransaction: boolean;
}

export interface RiskAssessment {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number; // 0-100
  riskFactors: RiskFactors;
  riskReasons: string[];
  color: string;
  badge: string;
  recommendations: string[];
}

export async function assessTransactionRisk(
  transactionData: {
    customerId?: number;
    total: number;
    items: Array<{
      productId: number;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
    paymentMethod: string;
    cashTendered?: number;
    createdAt?: Date;
  }
): Promise<RiskAssessment> {
  const factors: RiskFactors = {
    highValueTransaction: false,
    unusualQuantity: false,
    firstTimeCustomer: false,
    frequentReturns: false,
    suspiciousPaymentPattern: false,
    lowStockItems: false,
    multipleHighValueItems: false,
    cashOnlyLargeTransaction: false,
    rapidSequentialTransactions: false,
    unusualTimeTransaction: false
  };

  const reasons: string[] = [];
  const recommendations: string[] = [];
  let riskScore = 0;

  // 1. High Value Transaction Analysis
  const HIGH_VALUE_THRESHOLD = 500;
  if (transactionData.total > HIGH_VALUE_THRESHOLD) {
    factors.highValueTransaction = true;
    riskScore += 25;
    reasons.push(`High value transaction (QR ${transactionData.total.toFixed(2)})`);
    recommendations.push('Verify customer identity and payment method');
  }

  // 2. Cash Only Large Transaction
  if (transactionData.paymentMethod === 'cash' && transactionData.total > 200) {
    factors.cashOnlyLargeTransaction = true;
    riskScore += 20;
    reasons.push(`Large cash transaction (QR ${transactionData.total.toFixed(2)})`);
    recommendations.push('Count cash carefully and consider counterfeit detection');
  }

  // 3. Unusual Quantity Analysis
  const totalItems = transactionData.items.reduce((sum, item) => sum + item.quantity, 0);
  if (totalItems > 50) {
    factors.unusualQuantity = true;
    riskScore += 15;
    reasons.push(`Unusually large quantity (${totalItems} items)`);
    recommendations.push('Verify legitimate business purpose');
  }

  // 4. Multiple High Value Items
  const highValueItems = transactionData.items.filter(item => item.unitPrice > 100);
  if (highValueItems.length >= 3) {
    factors.multipleHighValueItems = true;
    riskScore += 20;
    reasons.push(`Multiple high-value items (${highValueItems.length} items)`);
    recommendations.push('Verify customer purchasing power and intent');
  }

  // 5. Suspicious Payment Pattern
  if (transactionData.paymentMethod === 'card' && transactionData.cashTendered && transactionData.cashTendered > 0) {
    factors.suspiciousPaymentPattern = true;
    riskScore += 10;
    reasons.push('Mixed payment methods detected');
    recommendations.push('Verify payment method consistency');
  }

  // 6. Unusual Time Transaction
  const currentHour = new Date().getHours();
  if (currentHour < 6 || currentHour > 22) {
    factors.unusualTimeTransaction = true;
    riskScore += 5;
    reasons.push('Transaction outside normal business hours');
    recommendations.push('Extra vigilance for off-hours transactions');
  }

  // 7. Customer-based Risk Assessment
  if (transactionData.customerId) {
    try {
      // Check if first-time customer
      const customerTransactions = await db
        .select()
        .from(transactions)
        .where(eq(transactions.customerId, transactionData.customerId))
        .limit(1);

      if (customerTransactions.length === 0) {
        factors.firstTimeCustomer = true;
        riskScore += 10;
        reasons.push('First-time customer transaction');
        recommendations.push('Verify customer information and ID');
      }

      // Check for frequent returns (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentReturns = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.customerId, transactionData.customerId),
            eq(transactions.status, 'voided'),
            gte(transactions.createdAt, thirtyDaysAgo)
          )
        );

      if (recentReturns.length >= 3) {
        factors.frequentReturns = true;
        riskScore += 15;
        reasons.push(`Frequent returns (${recentReturns.length} in last 30 days)`);
        recommendations.push('Review return policy compliance');
      }

      // Check for rapid sequential transactions
      const lastHour = new Date();
      lastHour.setHours(lastHour.getHours() - 1);
      
      const recentTransactions = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.customerId, transactionData.customerId),
            gte(transactions.createdAt, lastHour)
          )
        );

      if (recentTransactions.length >= 3) {
        factors.rapidSequentialTransactions = true;
        riskScore += 20;
        reasons.push(`Multiple transactions in last hour (${recentTransactions.length})`);
        recommendations.push('Verify legitimate need for multiple transactions');
      }
    } catch (error) {
      console.error('Error checking customer risk factors:', error);
    }
  }

  // 8. Product-based Risk Assessment
  try {
    const productIds = transactionData.items.map(item => item.productId);
    if (productIds.length > 0) {
      const productData = await db
        .select({
          id: products.id,
          stock: products.stock,
          quantity: products.quantity,
          price: products.price
        })
        .from(products)
        .where(inArray(products.id, productIds));

      // Check for low stock items
      const lowStockItems = productData.filter(product => 
        (product.stock || 0) < 10 && 
        transactionData.items.some(item => 
          item.productId === product.id && item.quantity > (product.stock || 0) * 0.5
        )
      );

      if (lowStockItems.length > 0) {
        factors.lowStockItems = true;
        riskScore += 10;
        reasons.push(`Transaction includes low-stock items (${lowStockItems.length} items)`);
        recommendations.push('Verify stock levels and update inventory');
      }
    }
  } catch (error) {
    console.error('Error checking product risk factors:', error);
  }

  // Determine risk level based on score
  let riskLevel: 'low' | 'medium' | 'high' | 'critical';
  let color: string;
  let badge: string;

  if (riskScore >= 60) {
    riskLevel = 'critical';
    color = 'rgb(239, 68, 68)'; // red-500
    badge = 'CRITICAL';
  } else if (riskScore >= 35) {
    riskLevel = 'high';
    color = 'rgb(245, 101, 101)'; // red-400
    badge = 'HIGH RISK';
  } else if (riskScore >= 15) {
    riskLevel = 'medium';
    color = 'rgb(251, 146, 60)'; // orange-400
    badge = 'MEDIUM';
  } else {
    riskLevel = 'low';
    color = 'rgb(34, 197, 94)'; // green-500
    badge = 'LOW';
  }

  // Add general recommendations based on risk level
  if (riskLevel === 'critical') {
    recommendations.push('Manager approval required', 'Document transaction details');
  } else if (riskLevel === 'high') {
    recommendations.push('Supervisor review recommended', 'Verify customer identity');
  } else if (riskLevel === 'medium') {
    recommendations.push('Additional verification suggested');
  }

  return {
    riskLevel,
    riskScore,
    riskFactors: factors,
    riskReasons: reasons,
    color,
    badge,
    recommendations
  };
}

export async function getTransactionRiskHistory(customerId: number, limit = 10) {
  try {
    const customerTransactions = await db
      .select({
        id: transactions.id,
        transactionNumber: transactions.transactionNumber,
        total: transactions.total,
        paymentMethod: transactions.paymentMethod,
        status: transactions.status,
        createdAt: transactions.createdAt
      })
      .from(transactions)
      .where(eq(transactions.customerId, customerId))
      .orderBy(desc(transactions.createdAt))
      .limit(limit);

    const riskAssessments = [];
    
    for (const transaction of customerTransactions) {
      const items = await db
        .select()
        .from(transactionItems)
        .where(eq(transactionItems.transactionId, transaction.id));

      const transactionData = {
        customerId,
        total: parseFloat(transaction.total),
        items: items.map(item => ({
          productId: item.productId!,
          quantity: item.quantity,
          unitPrice: parseFloat(item.unitPrice),
          total: parseFloat(item.total)
        })),
        paymentMethod: transaction.paymentMethod || 'cash',
        createdAt: transaction.createdAt || new Date()
      };

      const risk = await assessTransactionRisk(transactionData);
      riskAssessments.push({
        ...transaction,
        riskAssessment: risk
      });
    }

    return riskAssessments;
  } catch (error) {
    console.error('Error getting transaction risk history:', error);
    return [];
  }
}

export async function getDailyRiskSummary(date: string) {
  try {
    const startOfDay = new Date(date);
    const endOfDay = new Date(date);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const dayTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          gte(transactions.createdAt, startOfDay),
          lt(transactions.createdAt, endOfDay)
        )
      );

    const riskSummary = {
      totalTransactions: dayTransactions.length,
      lowRisk: 0,
      mediumRisk: 0,
      highRisk: 0,
      criticalRisk: 0,
      totalRiskScore: 0,
      flaggedTransactions: [] as any[]
    };

    for (const transaction of dayTransactions) {
      const items = await db
        .select()
        .from(transactionItems)
        .where(eq(transactionItems.transactionId, transaction.id));

      const transactionData = {
        customerId: transaction.customerId || undefined,
        total: parseFloat(transaction.total),
        items: items.map(item => ({
          productId: item.productId!,
          quantity: item.quantity,
          unitPrice: parseFloat(item.unitPrice),
          total: parseFloat(item.total)
        })),
        paymentMethod: transaction.paymentMethod || 'cash',
        createdAt: transaction.createdAt || new Date()
      };

      const risk = await assessTransactionRisk(transactionData);
      riskSummary.totalRiskScore += risk.riskScore;

      switch (risk.riskLevel) {
        case 'low':
          riskSummary.lowRisk++;
          break;
        case 'medium':
          riskSummary.mediumRisk++;
          break;
        case 'high':
          riskSummary.highRisk++;
          break;
        case 'critical':
          riskSummary.criticalRisk++;
          break;
      }

      if (risk.riskLevel === 'high' || risk.riskLevel === 'critical') {
        riskSummary.flaggedTransactions.push({
          ...transaction,
          riskAssessment: risk
        });
      }
    }

    return riskSummary;
  } catch (error) {
    console.error('Error getting daily risk summary:', error);
    return null;
  }
}