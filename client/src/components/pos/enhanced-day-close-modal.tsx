import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  Calculator, 
  Coins, 
  CreditCard, 
  Banknote,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  User,
  TrendingUp,
  Activity,
  Calendar as CalendarIcon,
  Plus,
  Minus,
  ArrowUpDown,
  Building2,
  Wallet,
  ShoppingCart,
  Receipt,
  PiggyBank,
  XCircle,
  RotateCcw
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePOSStore } from "@/lib/pos-store";
import { useStore } from "@/hooks/useStore";
import { cn } from "@/lib/utils";

interface EnhancedDayCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayOperation?: any;
}

interface VarianceAnalysis {
  cashVariance: number;
  bankVariance: number;
  totalVariance: number;
  variancePercentage: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  insights: string[];
  recommendations: string[];
}

interface PerformanceMetrics {
  averageTransactionValue: number;
  transactionCount: number;
  salesPerHour: number;
  peakHours: string[];
  lowPerformanceIndicators: string[];
}

interface CashDenomination {
  value: number;
  label: string;
  count: number;
}

interface CashMovement {
  type: 'owner_deposit' | 'owner_withdrawal' | 'expense_payment' | 'supplier_payment' | 'bank_transfer' | 'miscellaneous';
  amount: number;
  paymentMethod: 'cash' | 'bank_debit' | 'credit_card';
  direction: 'in' | 'out';
  description: string;
  reference?: string;
}

interface DailyProductMonitoring {
  id: number;
  dayOperationId: number;
  productId: number;
  date: string;
  openingStock: string;
  openingValue: string;
  totalSalesQty: string;
  cashSalesQty: string;
  cardSalesQty: string;
  creditSalesQty: string;
  totalSalesValue: string;
  cashSalesValue: string;
  cardSalesValue: string;
  creditSalesValue: string;
  totalPurchaseQty: string;
  totalPurchaseValue: string;
  manualOpeningStock?: string;
  manualSalesQty?: string;
  manualPurchaseQty?: string;
  manualClosingStock?: string;
  systemClosingStock: string;
  actualClosingStock?: string;
  variance: string;
  varianceValue: string;
  isReconciled: boolean;
  notes?: string;
  reconciledBy?: number;
  reconciledAt?: string;
  createdAt: string;
  updatedAt?: string;
  product?: {
    id: number;
    sku: string;
    name: string;
    description?: string;
    price: string;
    cost: string;
    stock: number;
    barcode?: string;
    category?: string;
    isActive: boolean;
  };
}

interface ReconciliationData {
  // Cash counts (Qatari Riyal)
  cashCount_500: number;
  cashCount_200: number;
  cashCount_100: number;
  cashCount_50: number;
  cashCount_20: number;
  cashCount_10: number;
  cashCount_5: number;
  cashCount_1: number;
  cashCount_050: number;
  cashCount_025: number;
  
  // Owner transactions
  ownerDeposits: number;
  ownerWithdrawals: number;
  ownerBankDeposits: number;
  ownerBankWithdrawals: number;
  
  // Credit reconciliation (separated by payment method)
  creditPaymentsCash: number;
  creditPaymentsCard: number;
  creditRefundsGiven: number;
  
  // Other movements
  expensePayments: number;
  supplierPayments: number;
  bankTransfers: number;
  
  // Bank balances
  actualBankBalance: number;
  
  // POS Card Swipe Amount (Manual entry)
  posCardSwipeAmount: number;
  cardSwipeVariance: number;
  bankWithdrawals: number;
  
  // Miscellaneous amounts
  cashMiscAmount: number;
  cardMiscAmount: number;
  miscNotes: string;
  reconciliationNotes: string;
  
  // Editable day operation fields
  editableTotalSales?: number;
  editableCashSales?: number;
  editableCardSales?: number;
  editableCreditSales?: number;
  editableSplitSales?: number;
  editableOpeningCash?: number;
  editableOpeningBankBalance?: number;
}

export default function EnhancedDayCloseModal({ isOpen, onClose, dayOperation }: EnhancedDayCloseModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setCurrentDay, setIsDayOpen, selectedDate, setSelectedDate, openDayOpenModal } = usePOSStore();
  const { currentStore } = useStore();
  const storeId = currentStore?.id;
  const dayByDateUrl = `/api/day-operations/date/${selectedDate}${storeId ? `?storeId=${storeId}` : ""}`;
  const dayStatusUrl = `/api/day-operations/status/${selectedDate}${storeId ? `?storeId=${storeId}` : ""}`;
  const openDayUrl = `/api/day-operations/open${storeId ? `?storeId=${storeId}` : ""}`;
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  
  // Convert selectedDate string to Date for format function
  const selectedDateObj = new Date(selectedDate);

  // Get current user for admin check
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const response = await fetch("/api/auth/user");
      if (!response.ok) throw new Error("Failed to fetch user");
      return response.json();
    },
    enabled: isOpen
  });

  const [reconciliationData, setReconciliationData] = useState<ReconciliationData>({
    cashCount_500: 0,
    cashCount_200: 0,
    cashCount_100: 0,
    cashCount_50: 0,
    cashCount_20: 0,
    cashCount_10: 0,
    cashCount_5: 0,
    cashCount_1: 0,
    cashCount_050: 0,
    cashCount_025: 0,
    ownerDeposits: 0,
    ownerWithdrawals: 0,
    ownerBankDeposits: 0,
    ownerBankWithdrawals: 0,
    creditPaymentsCash: 0,
    creditPaymentsCard: 0,
    creditRefundsGiven: 0,
    expensePayments: 0,
    supplierPayments: 0,
    bankTransfers: 0,
    actualBankBalance: 0,
    posCardSwipeAmount: 0,
    cardSwipeVariance: 0,
    bankWithdrawals: 0,
    cashMiscAmount: 0,
    cardMiscAmount: 0,
    miscNotes: "",
    reconciliationNotes: "",
    editableTotalSales: undefined,
    editableCashSales: undefined,
    editableCardSales: undefined,
    editableCreditSales: undefined,
    editableSplitSales: undefined,
    editableOpeningCash: undefined,
    editableOpeningBankBalance: undefined
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tab validation state (Phase 2.3 Enhancement)
  const [tabValidation, setTabValidation] = useState({
    salesCash: { isComplete: false, hasErrors: false },
    movementsBank: { isComplete: false, hasErrors: false },
    monitoring: { isComplete: false, hasErrors: false },
    finalInsights: { isComplete: false, hasErrors: false }
  });

  // Get transactions for selected date for reconciliation
  const { data: todayTransactions = [] } = useQuery({
    queryKey: ["/api/transactions", selectedDate, storeId],
    queryFn: async () => {
      const url = `/api/transactions/date/${selectedDate}${storeId ? `?storeId=${storeId}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch transactions');
      return response.json();
    },
    enabled: isOpen
  });

  // Get credit transactions for selected date for auto-population
  const { data: todayCreditTransactions = [] } = useQuery({
    queryKey: ["/api/credit-transactions", selectedDate, storeId],
    queryFn: async () => {
      const url = `/api/credit-transactions${storeId ? `?storeId=${storeId}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch credit transactions');
      const allCredits = await response.json();
      
      // Filter for selected date
      return allCredits.filter((credit: any) => {
        if (!credit.createdAt) return false;
        const creditDate = new Date(credit.createdAt).toISOString().split('T')[0];
        return creditDate === selectedDate;
      });
    },
    enabled: isOpen
  });

  // Get supplier payments for selected date for auto-population
  const { data: todaySupplierPayments } = useQuery({
    queryKey: ["/api/supplier-payments/date", selectedDate],
    queryFn: async () => {
      const response = await fetch(`/api/supplier-payments/date/${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch supplier payments');
      return response.json();
    },
    enabled: isOpen
  });

  // Get day operation for selected date
  const { data: dayOpForDate } = useQuery({
    queryKey: [dayByDateUrl],
    queryFn: async () => {
      const response = await fetch(dayByDateUrl);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: isOpen && Boolean(storeId)
  });

  // Get day status for selected date
  const { data: dayStatus, isLoading: loadingStatus } = useQuery({
    queryKey: [dayStatusUrl],
    queryFn: async () => {
      const response = await fetch(dayStatusUrl);
      if (!response.ok) throw new Error('Failed to fetch day status');
      return response.json();
    },
    enabled: isOpen && Boolean(storeId),
    staleTime: 0, // Always fetch fresh data
  });

  // Reset reconciliation data when date changes
  useEffect(() => {
    setReconciliationData({
      cashCount_500: 0,
      cashCount_200: 0,
      cashCount_100: 0,
      cashCount_50: 0,
      cashCount_20: 0,
      cashCount_10: 0,
      cashCount_5: 0,
      cashCount_1: 0,
      cashCount_050: 0,
      cashCount_025: 0,
      ownerDeposits: 0,
      ownerWithdrawals: 0,
      ownerBankDeposits: 0,
      ownerBankWithdrawals: 0,
      creditPaymentsCash: 0,
      creditPaymentsCard: 0,
      creditRefundsGiven: 0,
      expensePayments: 0,
      supplierPayments: 0,
      bankTransfers: 0,
      actualBankBalance: 0,
      posCardSwipeAmount: 0,
      cardSwipeVariance: 0,
      bankWithdrawals: 0,
      cashMiscAmount: 0,
      cardMiscAmount: 0,
      miscNotes: "",
      reconciliationNotes: "",
      editableTotalSales: undefined,
      editableCashSales: undefined,
      editableCardSales: undefined,
      editableCreditSales: undefined,
      editableSplitSales: undefined,
      editableOpeningCash: undefined,
      editableOpeningBankBalance: undefined
    });
    setCashMovements([]);
  }, [selectedDate]);

  const cashDenominations: CashDenomination[] = [
    { value: 500, label: "QR 500", count: reconciliationData.cashCount_500 },
    { value: 200, label: "QR 200", count: reconciliationData.cashCount_200 },
    { value: 100, label: "QR 100", count: reconciliationData.cashCount_100 },
    { value: 50, label: "QR 50", count: reconciliationData.cashCount_50 },
    { value: 20, label: "QR 20", count: reconciliationData.cashCount_20 },
    { value: 10, label: "QR 10", count: reconciliationData.cashCount_10 },
    { value: 5, label: "QR 5", count: reconciliationData.cashCount_5 },
    { value: 1, label: "QR 1", count: reconciliationData.cashCount_1 },
    { value: 0.50, label: "50 Dirhams", count: reconciliationData.cashCount_050 },
    { value: 0.25, label: "25 Dirhams", count: reconciliationData.cashCount_025 }
  ];

  // Calculate totals from transaction data with split payment support
  function calculateTotals() {
    const cashTransactions = todayTransactions.filter((t: any) => t.paymentMethod === 'cash');
    const cardTransactions = todayTransactions.filter((t: any) => t.paymentMethod === 'card');
    const creditTransactions = todayTransactions.filter((t: any) => t.paymentMethod === 'credit');
    const splitTransactions = todayTransactions.filter((t: any) => t.paymentMethod === 'split');

    const cashSales = cashTransactions.reduce((sum: number, t: any) => sum + parseFloat(t.total || "0"), 0);
    const cardSales = cardTransactions.reduce((sum: number, t: any) => sum + parseFloat(t.total || "0"), 0);
    const creditSales = creditTransactions.reduce((sum: number, t: any) => sum + parseFloat(t.total || "0"), 0);
    const splitSales = splitTransactions.reduce((sum: number, t: any) => sum + parseFloat(t.total || "0"), 0);
    const totalSales = cashSales + cardSales + creditSales + splitSales;

    return {
      totalSales,
      cashSales,
      cardSales,
      creditSales,
      splitSales,
      totalTransactions: todayTransactions.length,
      cashTransactionCount: cashTransactions.length,
      cardTransactionCount: cardTransactions.length,
      creditTransactionCount: creditTransactions.length,
      splitTransactionCount: splitTransactions.length
    };
  }

  // Enhanced variance analysis with smart insights
  const calculateVarianceAnalysis = (): VarianceAnalysis => {
    const totals = calculateTotals();
    const currentDayOp = dayOpForDate;
    
    if (!currentDayOp) {
      return {
        cashVariance: 0,
        bankVariance: 0,
        totalVariance: 0,
        variancePercentage: 0,
        severity: 'low',
        insights: ['No day operation data available'],
        recommendations: ['Please ensure day is properly opened before analysis']
      };
    }

    // Calculate actual vs expected cash
    const actualCashCount = calculateActualCashCount();
    const expectedCash = calculateExpectedCash();
    const cashVariance = actualCashCount - expectedCash;

    // Calculate bank variance (must match the full calculation below)
    const actualBankBalance = parseFloat(reconciliationData.actualBankBalance.toString()) || 0;
    const openingBankBalance = parseFloat(currentDayOp.openingBankBalance || "0");
    const netOwnerBankMovement = (reconciliationData.ownerBankDeposits || 0) - (reconciliationData.ownerBankWithdrawals || 0);
    const netBankTransfers = reconciliationData.bankTransfers || 0; // Positive = cash to bank, Negative = bank to cash
    const expectedBankBalance = openingBankBalance + totals.cardSales + (reconciliationData.creditPaymentsCard || 0) + netOwnerBankMovement + netBankTransfers - (reconciliationData.bankWithdrawals || 0);
    const bankVariance = actualBankBalance - expectedBankBalance;

    const totalVariance = Math.abs(cashVariance) + Math.abs(bankVariance);
    const variancePercentage = totals.totalSales > 0 ? (totalVariance / totals.totalSales) * 100 : 0;

    // Determine severity
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (variancePercentage > 10) severity = 'critical';
    else if (variancePercentage > 5) severity = 'high';
    else if (variancePercentage > 2) severity = 'medium';

    // Generate insights
    const insights = [];
    const recommendations = [];

    if (Math.abs(cashVariance) > 50) {
      insights.push(`Significant cash variance of QR ${Math.abs(cashVariance).toFixed(2)} detected`);
      recommendations.push('Recount cash denominations carefully');
      recommendations.push('Check for unrecorded cash transactions');
    }

    if (Math.abs(bankVariance) > 100) {
      insights.push(`Bank balance variance of QR ${Math.abs(bankVariance).toFixed(2)} identified`);
      recommendations.push('Verify all card transactions are processed');
      recommendations.push('Check for pending bank transactions');
    }

    if (totals.totalTransactions === 0) {
      insights.push('No transactions recorded for this day');
      recommendations.push('Verify transaction data is properly synced');
    }

    const averageTransactionValue = totals.totalTransactions > 0 ? totals.totalSales / totals.totalTransactions : 0;
    if (averageTransactionValue && averageTransactionValue < 10) {
      insights.push('Low average transaction value detected');
      recommendations.push('Review small transaction patterns');
    }

    if (severity === 'low' && totalVariance < 10) {
      insights.push('Excellent day reconciliation within acceptable variance');
      recommendations.push('Continue following best practices');
    }

    return {
      cashVariance,
      bankVariance,
      totalVariance,
      variancePercentage,
      severity,
      insights,
      recommendations
    };
  };

  // Performance metrics calculation
  const calculatePerformanceMetrics = (): PerformanceMetrics => {
    const totals = calculateTotals();
    const averageTransactionValue = totals.totalTransactions > 0 ? totals.totalSales / totals.totalTransactions : 0;
    
    // Simple performance indicators
    const lowPerformanceIndicators = [];
    
    if (averageTransactionValue < 15) {
      lowPerformanceIndicators.push('Low average transaction value');
    }
    
    if (totals.totalTransactions < 10) {
      lowPerformanceIndicators.push('Low transaction count');
    }
    
    if (totals.totalSales < 500) {
      lowPerformanceIndicators.push('Low total sales');
    }

    return {
      averageTransactionValue,
      transactionCount: totals.totalTransactions,
      salesPerHour: totals.totalSales / 8, // Assuming 8-hour day
      peakHours: [], // Could be enhanced with hourly data
      lowPerformanceIndicators
    };
  };

  const totals = calculateTotals();

  // Auto-populate credit transactions from actual data
  const autoCreditPayments = useMemo(() => {
    const cashPayments = todayCreditTransactions
      .filter((credit: any) => credit.type === 'payment' && credit.paymentMethod === 'cash')
      .reduce((sum: number, credit: any) => sum + parseFloat(credit.amount || 0), 0);
    
    const cardPayments = todayCreditTransactions
      .filter((credit: any) => credit.type === 'payment' && credit.paymentMethod === 'card')
      .reduce((sum: number, credit: any) => sum + parseFloat(credit.amount || 0), 0);
    
    const refunds = todayCreditTransactions
      .filter((credit: any) => credit.type === 'refund')
      .reduce((sum: number, credit: any) => sum + parseFloat(credit.amount || 0), 0);

    return { cashPayments, cardPayments, refunds, total: cashPayments + cardPayments };
  }, [todayCreditTransactions]);

  // Auto-populate supplier payments from actual data
  const autoSupplierPayments = useMemo(() => {
    if (!todaySupplierPayments?.totals) return 0;
    
    // Return only cash supplier payments (not including card payments in cash reconciliation)
    return todaySupplierPayments.totals.cash;
  }, [todaySupplierPayments]);

  // FULLY AUTOMATED: Auto-populate ALL financial data when data loads
  useEffect(() => {
    if (!isOpen || !dayOpForDate) return;

    const totals = calculateTotals();
    const currentDayOp = dayOpForDate || dayOperation;

    // Auto-populate all sales data from transactions
    setReconciliationData(prev => {
      // Only update if values haven't been manually edited or are undefined
      const newData: Partial<ReconciliationData> = {};

      // Auto-populate sales totals (only if not manually edited)
      if (prev.editableTotalSales === undefined) {
        newData.editableTotalSales = totals.totalSales;
      }
      if (prev.editableCashSales === undefined) {
        newData.editableCashSales = totals.cashSales;
      }
      if (prev.editableCardSales === undefined) {
        newData.editableCardSales = totals.cardSales;
      }
      if (prev.editableCreditSales === undefined) {
        newData.editableCreditSales = totals.creditSales;
      }
      if (prev.editableSplitSales === undefined) {
        newData.editableSplitSales = totals.splitSales;
      }

      // Auto-populate opening balances (only if not manually edited)
      if (prev.editableOpeningCash === undefined && currentDayOp?.openingCash) {
        newData.editableOpeningCash = parseFloat(currentDayOp.openingCash);
      }
      if (prev.editableOpeningBankBalance === undefined && currentDayOp?.openingBankBalance) {
        newData.editableOpeningBankBalance = parseFloat(currentDayOp.openingBankBalance);
      }

      // Auto-populate credit reconciliation
      if (autoCreditPayments.cashPayments > 0 || prev.creditPaymentsCash === 0) {
        newData.creditPaymentsCash = autoCreditPayments.cashPayments;
      }
      if (autoCreditPayments.cardPayments > 0 || prev.creditPaymentsCard === 0) {
        newData.creditPaymentsCard = autoCreditPayments.cardPayments;
      }
      if (autoCreditPayments.refunds > 0 || prev.creditRefundsGiven === 0) {
        newData.creditRefundsGiven = autoCreditPayments.refunds;
      }

      // Auto-populate supplier payments
      if (autoSupplierPayments > 0 || prev.supplierPayments === 0) {
        newData.supplierPayments = autoSupplierPayments;
      }

      // Only update if there are changes
      if (Object.keys(newData).length > 0) {
        return { ...prev, ...newData };
      }
      return prev;
    });
  }, [isOpen, dayOpForDate, todayTransactions, autoCreditPayments, autoSupplierPayments, dayOperation]);

  // Calculate actual cash count from denominations
  const calculateActualCashCount = () => {
    return cashDenominations.reduce((sum, denom) => {
      return sum + (denom.value * denom.count);
    }, 0) + reconciliationData.cashMiscAmount;
  };

  // Calculate expected cash based on opening cash and transactions
  const calculateExpectedCash = () => {
    const currentDayOp = dayOpForDate || dayOperation;
    const openingCash = reconciliationData.editableOpeningCash ?? parseFloat(currentDayOp?.openingCash || "0");
    const totals = calculateTotals();
    
    // Cash inflows
    const cashSales = reconciliationData.editableCashSales ?? totals.cashSales;
    const ownerDeposits = reconciliationData.ownerDeposits;
    const creditPaymentsCash = reconciliationData.creditPaymentsCash;
    
    // Cash outflows
    const ownerWithdrawals = reconciliationData.ownerWithdrawals;
    const supplierPayments = reconciliationData.supplierPayments;
    const expensePayments = reconciliationData.expensePayments;
    const creditRefunds = reconciliationData.creditRefundsGiven;
    const bankTransfers = reconciliationData.bankTransfers;
    
    return openingCash + cashSales + ownerDeposits + creditPaymentsCash 
           - ownerWithdrawals - supplierPayments - expensePayments - creditRefunds - bankTransfers;
  };

  // Enhanced cash calculation considering all cash movements
  const currentDayOp = dayOpForDate || dayOperation;
  const openingCash = reconciliationData.editableOpeningCash ?? parseFloat(currentDayOp?.openingCash || "0");
  
  // Use editable values if provided, otherwise use calculated totals
  const actualCashSales = reconciliationData.editableCashSales ?? totals.cashSales;
  const actualCardSales = reconciliationData.editableCardSales ?? totals.cardSales;
  const actualCreditSales = reconciliationData.editableCreditSales ?? totals.creditSales;
  const actualSplitSales = reconciliationData.editableSplitSales ?? totals.splitSales;
  
  // Calculate totalSales from individual sales if editableTotalSales is not set
  // This ensures totalSales is always the sum of individual sales
  const calculatedTotalSales = actualCashSales + actualCardSales + actualCreditSales + actualSplitSales;
  
  const actualTotals = {
    totalSales: reconciliationData.editableTotalSales ?? calculatedTotalSales,
    cashSales: actualCashSales,
    cardSales: actualCardSales,
    creditSales: actualCreditSales,
    splitSales: actualSplitSales,
  };
  
  // Calculate net cash movements
  const netOwnerCashMovement = reconciliationData.ownerDeposits - reconciliationData.ownerWithdrawals;
  const netBankTransfers = reconciliationData.bankTransfers; // Positive = cash to bank, Negative = bank to cash

  // Calculate actual cash count and expected cash
  const actualCashCount = calculateActualCashCount();
  const expectedCash = calculateExpectedCash();
  const cashVariance = actualCashCount - expectedCash;
  
  // Get variance analysis and performance metrics
  const varianceAnalysis = calculateVarianceAnalysis();
  const performanceMetrics = calculatePerformanceMetrics();

  // Bank balance calculation
  const openingBankBalance = reconciliationData.editableOpeningBankBalance ?? parseFloat(currentDayOp?.openingBankBalance || "0");
  const netOwnerBankMovement = reconciliationData.ownerBankDeposits - reconciliationData.ownerBankWithdrawals;
  
  // Card reconciliation validation
  const cardReconciliationTotal = actualTotals.cardSales + (reconciliationData.creditPaymentsCard || 0);
  const cardSwipeVariance = reconciliationData.posCardSwipeAmount - cardReconciliationTotal;
  
  // Bank balance includes card sales, card credit payments, owner bank movements, and bank transfers
  const expectedBankBalance = openingBankBalance + actualTotals.cardSales + (reconciliationData.creditPaymentsCard || 0) + netOwnerBankMovement + netBankTransfers - reconciliationData.bankWithdrawals;
  const bankVariance = reconciliationData.actualBankBalance - expectedBankBalance;
  
  // Store card swipe variance in reconciliation data
  useEffect(() => {
    setReconciliationData(prev => ({
      ...prev,
      cardSwipeVariance
    }));
  }, [cardSwipeVariance]);
  
  // Tab validation logic (Phase 2.3 Enhancement)
  useEffect(() => {
    const actualCashCount = calculateActualCashCount();
    const expectedCash = calculateExpectedCash();
    const hasCashCounted = actualCashCount > 0;
    
    // Sales & Cash tab validation
    const salesCashComplete = hasCashCounted && totals.totalSales >= 0;
    const salesCashErrors = Math.abs(actualCashCount - expectedCash) > 100;
    
    // Movements & Bank tab validation
    const bankBalanceEntered = reconciliationData.actualBankBalance > 0 || openingBankBalance === 0;
    const movementsBankComplete = bankBalanceEntered;
    const movementsBankErrors = Math.abs(bankVariance) > 200;
    
    // Monitoring tab validation (optional, so always considered complete)
    const monitoringComplete = true;
    const monitoringErrors = false;
    
    // Final insights tab validation
    const varianceAnalysis = calculateVarianceAnalysis();
    const finalInsightsComplete = varianceAnalysis.severity !== 'critical';
    const finalInsightsErrors = varianceAnalysis.severity === 'critical';
    
    setTabValidation({
      salesCash: { isComplete: salesCashComplete, hasErrors: salesCashErrors },
      movementsBank: { isComplete: movementsBankComplete, hasErrors: movementsBankErrors },
      monitoring: { isComplete: monitoringComplete, hasErrors: monitoringErrors },
      finalInsights: { isComplete: finalInsightsComplete, hasErrors: finalInsightsErrors }
    });
  }, [reconciliationData, totals, openingBankBalance, bankVariance]);
  
  // Calculate net credit movement for display
  const netCreditMovement = (reconciliationData.creditPaymentsCash || 0) + (reconciliationData.creditPaymentsCard || 0) - (reconciliationData.creditRefundsGiven || 0);

  const updateCashCount = (denominationKey: keyof ReconciliationData, value: number) => {
    setReconciliationData(prev => ({
      ...prev,
      [denominationKey]: Math.max(0, value)
    }));
  };

  const updateMovementAmount = (key: keyof ReconciliationData, value: number | undefined) => {
    setReconciliationData(prev => ({
      ...prev,
      [key]: value !== undefined ? (key.startsWith('editable') ? value : Math.max(0, value)) : value
    }));
  };

  const addCashMovement = () => {
    setCashMovements(prev => [...prev, {
      type: 'miscellaneous',
      amount: 0,
      paymentMethod: 'cash',
      direction: 'in',
      description: '',
      reference: ''
    }]);
  };

  const updateCashMovement = (index: number, movement: Partial<CashMovement>) => {
    setCashMovements(prev => prev.map((item, i) => i === index ? { ...item, ...movement } : item));
  };

  const removeCashMovement = (index: number) => {
    setCashMovements(prev => prev.filter((_, i) => i !== index));
  };

  const closeDayMutation = useMutation({
    mutationFn: async () => {
      if (!storeId) {
        throw new Error('Select a store before reopening a day');
      }

      if (!dayOpForDate) {
        throw new Error('No day operation found for selected date');
      }

      if (!dayStatus?.canClose) {
        throw new Error('Day cannot be closed at this time');
      }

      const closingData = {
        ...totals,
        // Use actual totals (editable if provided)
        totalSales: actualTotals.totalSales,
        cashSales: actualTotals.cashSales,
        cardSales: actualTotals.cardSales,
        creditSales: actualTotals.creditSales,
        splitSales: actualTotals.splitSales,
        // Opening balances (editable if provided)
        openingCash: openingCash,
        openingBankBalance: openingBankBalance,
        // Calculations
        expectedCash: expectedCash,
        actualCashCount: actualCashCount,
        closingCash: actualCashCount,
        cashDifference: cashVariance,
        expectedBankBalance: expectedBankBalance,
        // actualBankBalance: reconciliationData.actualBankBalance, // Removed duplicate
        bankDifference: bankVariance,
        // Credit reconciliation
        // creditPaymentsCash: reconciliationData.creditPaymentsCash, // Removed duplicate
        creditNetImpact: netCreditMovement,
        // All other reconciliation data
        ...reconciliationData,
        status: 'closed',
        closedAt: new Date().toISOString()
      };

      return apiRequest({
        url: `/api/day-operations/${dayOpForDate.id}`,
        method: "PATCH",
        body: closingData
      });
    },
    onSuccess: () => {
      toast({
        title: "Day Closed Successfully",
        description: "Enhanced reconciliation completed and day has been closed.",
      });
      
      // Update global state immediately
      setCurrentDay(null);
      setIsDayOpen(false);
      
      const closedDateStr = dayOpForDate?.date || selectedDate;
      let nextDateForAutoOpen: string | null = null;
      if (closedDateStr) {
        const [yearStr, monthStr, dayStr] = closedDateStr.split("-");
        const year = Number(yearStr);
        const month = Number(monthStr);
        const day = Number(dayStr);

        if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
          const closedDateObj = new Date(year, month - 1, day);
          if (!Number.isNaN(closedDateObj.getTime())) {
            closedDateObj.setDate(closedDateObj.getDate() + 1);
            nextDateForAutoOpen = format(closedDateObj, "yyyy-MM-dd");
          }
        }
      }
      
      // Invalidate ALL relevant queries to refresh data across the app
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey?.[0];
          return typeof key === "string" && key.startsWith("/api/day-operations");
        }
      });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-monitoring"] });
      
      onClose();
      
      if (nextDateForAutoOpen) {
        setSelectedDate(nextDateForAutoOpen);
        const todayStr = format(new Date(), "yyyy-MM-dd");
        if (nextDateForAutoOpen <= todayStr) {
          openDayOpenModal();
        }
      }
      
      // NO PAGE RELOAD - React Query handles data refresh automatically!
      console.log('✅ Day closed successfully - all queries invalidated, no reload needed');
    },
    onError: (error: any) => {
      console.error("Day close error:", error);
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to close day. Please try again.";
      toast({
        title: "Error Closing Day",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const reopenDayMutation = useMutation({
    mutationFn: async () => {
      if (!dayOpForDate) {
        throw new Error('No day operation found for selected date');
      }

      if (!dayStatus?.canReopen) {
        throw new Error('Only administrators can reopen closed days');
      }

      // Check if another day is already open
      const response = await fetch(openDayUrl, { credentials: "include" });
      let currentOpenDay = null;
      if (response.ok) {
        try {
          const text = await response.text();
          if (text && text.trim() !== '') {
            currentOpenDay = JSON.parse(text);
          }
        } catch (parseError) {
          // If response is empty or invalid JSON, treat as no open day
          console.warn("Failed to parse open day response:", parseError);
        }
      }

      if (currentOpenDay && currentOpenDay.date !== dayOpForDate.date) {
        throw new Error(`Another day is already open for ${currentOpenDay.date}. Please close it first.`);
      }

      const reopenResponse = await apiRequest({
        url: `/api/day-operations/${dayOpForDate.id}/reopen`,
        method: "PATCH"
      });

      // Safely parse JSON response, handling empty or malformed responses
      try {
        const text = await reopenResponse.text();
        
        // If response is empty, return null - queries will refresh the data
        if (!text || text.trim() === '') {
          console.warn("Reopen response is empty, will refresh from server");
          return null;
        }
        
        // Try to parse as JSON
        return JSON.parse(text);
      } catch (parseError: any) {
        // If JSON parsing fails (empty body, malformed JSON, etc.), return null
        // The queries will refresh the data from the server
        console.warn("Failed to parse reopen response, will refresh from server:", parseError?.message || parseError);
        return null;
      }
    },
    onSuccess: (reopenedDay) => {
      toast({
        title: "Day Reopened Successfully",
        description: "The day has been reopened for amendments.",
      });
      
      // Update global state if we have the reopened day data
      if (reopenedDay) {
        setCurrentDay(reopenedDay);
        setIsDayOpen(true);
      }
      
      // Invalidate ALL relevant queries to refresh data across the app
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey?.[0];
          return typeof key === "string" && key.startsWith("/api/day-operations");
        }
      });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-monitoring"] });
      
      onClose();
      
      // NO PAGE RELOAD - React Query handles data refresh automatically!
      console.log('✅ Day reopened successfully - all queries invalidated, no reload needed');
    },
    onError: (error: any) => {
      console.error("Day reopen error:", error);
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to reopen day. Please try again.";
      toast({
        title: "Error Reopening Day",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const handleSubmit = () => {
    setIsSubmitting(true);
    closeDayMutation.mutate();
  };

  const handleReopen = () => {
    reopenDayMutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-4xl lg:max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="px-1 sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Calculator className="h-5 w-5" />
            <span className="hidden sm:inline">Enhanced Day Close Reconciliation</span>
            <span className="sm:hidden">Day Close</span>
            {currentStore && (
              <span className="text-sm font-normal text-muted-foreground hidden md:inline">
                - {currentStore.name}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-sm">
            Complete cash and bank reconciliation with all financial movements for {format(selectedDate, 'MMM d, yyyy')}
            {currentStore && (
              <span className="block text-xs mt-1">
                Store: <strong>{currentStore.name}</strong> (ID: {currentStore.id})
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-6 p-1 sm:p-2">
          {/* Date Selection and Status */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Select Date</CardTitle>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {format(selectedDate, "MMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={selectedDateObj}
                      onSelect={(date) => date && setSelectedDate(format(date, "yyyy-MM-dd"))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Day Status Indicators */}
              {!loadingStatus && dayStatus && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className={`flex items-center gap-2 p-3 rounded-lg border ${
                    dayStatus.isOpen ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}>
                    {dayStatus.isOpen ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className={`text-sm font-medium ${
                      dayStatus.isOpen ? 'text-green-700' : 'text-red-700'
                    }`}>
                      Day {dayStatus.isOpen ? 'Open' : 'Not Open'}
                    </span>
                  </div>

                  <div className={`flex items-center gap-2 p-3 rounded-lg border ${
                    dayStatus.canClose ? 'bg-primary/10 border-primary/30' : 'bg-warning/10 border-warning/30'
                  }`}>
                    {dayStatus.canClose ? (
                      <CheckCircle className="h-4 w-4 text-primary" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-warning" />
                    )}
                    <span className={`text-sm font-medium ${
                      dayStatus.canClose ? 'text-primary' : 'text-warning'
                    }`}>
                      {dayStatus.canClose ? 'Ready to Close' : 'Cannot Close'}
                    </span>
                  </div>

                  <div className={`flex items-center gap-2 p-3 rounded-lg border ${
                    dayOpForDate?.status === 'closed' ? 'bg-gray-50 border-gray-200' : 'bg-green-50 border-green-200'
                  }`}>
                    {dayOpForDate?.status === 'closed' ? (
                      <CheckCircle className="h-4 w-4 text-gray-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-green-600" />
                    )}
                    <span className={`text-sm font-medium ${
                      dayOpForDate?.status === 'closed' ? 'text-gray-700' : 'text-green-700'
                    }`}>
                      {dayOpForDate?.status === 'closed' ? 'Already Closed' : 'In Progress'}
                    </span>
                  </div>
                </div>
              )}
            </CardHeader>
          </Card>

          {/* Day Operation Status */}
          {!dayOpForDate && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No day operation found for {format(selectedDate, 'MMM d, yyyy')}. Please open the day first before attempting to close it.
              </AlertDescription>
            </Alert>
          )}

          {dayOpForDate && (
            <Tabs defaultValue="sales-cash" className="w-full">
              <div className="w-full overflow-x-auto pb-2">
                <TabsList className="grid w-full min-w-[600px] grid-cols-4 h-auto">
                  <TabsTrigger value="sales-cash" className="text-xs sm:text-sm px-2 sm:px-3 py-2">
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1">
                        <ShoppingCart className="h-4 w-4" />
                        <Banknote className="h-4 w-4" />
                        {/* Validation indicator */}
                        {tabValidation.salesCash.hasErrors && (
                          <AlertTriangle className="h-3 w-3 text-red-500 ml-1" />
                        )}
                        {tabValidation.salesCash.isComplete && !tabValidation.salesCash.hasErrors && (
                          <CheckCircle className="h-3 w-3 text-green-500 ml-1" />
                        )}
                      </div>
                      <span className="hidden sm:inline">Sales & Cash</span>
                      <span className="sm:hidden">Sales</span>
                    </div>
                  </TabsTrigger>
                  <TabsTrigger value="movements-bank" className="text-xs sm:text-sm px-2 sm:px-3 py-2">
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1">
                        <ArrowUpDown className="h-4 w-4" />
                        <Building2 className="h-4 w-4" />
                        {/* Validation indicator */}
                        {tabValidation.movementsBank.hasErrors && (
                          <AlertTriangle className="h-3 w-3 text-red-500 ml-1" />
                        )}
                        {tabValidation.movementsBank.isComplete && !tabValidation.movementsBank.hasErrors && (
                          <CheckCircle className="h-3 w-3 text-green-500 ml-1" />
                        )}
                      </div>
                      <span className="hidden sm:inline">Movements & Bank</span>
                      <span className="sm:hidden">Bank</span>
                    </div>
                  </TabsTrigger>
                  <TabsTrigger value="monitoring" className="text-xs sm:text-sm px-2 sm:px-3 py-2">
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1">
                        <Activity className="h-4 w-4" />
                        {/* Validation indicator */}
                        {tabValidation.monitoring.isComplete && (
                          <CheckCircle className="h-3 w-3 text-green-500 ml-1" />
                        )}
                      </div>
                      <span className="hidden sm:inline">Product Monitoring</span>
                      <span className="sm:hidden">Products</span>
                    </div>
                  </TabsTrigger>
                  <TabsTrigger value="final-insights" className="text-xs sm:text-sm px-2 sm:px-3 py-2">
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" />
                        <CheckCircle className="h-4 w-4" />
                        {/* Validation indicator */}
                        {tabValidation.finalInsights.hasErrors && (
                          <AlertTriangle className="h-3 w-3 text-red-500 ml-1" />
                        )}
                        {tabValidation.finalInsights.isComplete && !tabValidation.finalInsights.hasErrors && (
                          <CheckCircle className="h-3 w-3 text-green-500 ml-1" />
                        )}
                      </div>
                      <span className="hidden sm:inline">Review & Close</span>
                      <span className="sm:hidden">Review</span>
                    </div>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Sales & Cash Tab - Combines Sales Summary + Cash Count */}
              <TabsContent value="sales-cash" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-lg">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5" />
                        Sales Summary
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Force refresh all auto-populated data
                          const calculatedTotal = totals.cashSales + totals.cardSales + totals.creditSales + totals.splitSales;
                          setReconciliationData(prev => ({
                            ...prev,
                            // Force update all sales data
                            editableTotalSales: calculatedTotal,
                            editableCashSales: totals.cashSales,
                            editableCardSales: totals.cardSales,
                            editableCreditSales: totals.creditSales,
                            editableSplitSales: totals.splitSales,
                            // Force update opening balances
                            editableOpeningCash: parseFloat(currentDayOp?.openingCash || "0"),
                            editableOpeningBankBalance: parseFloat(currentDayOp?.openingBankBalance || "0"),
                            // Force update credit reconciliation
                            creditPaymentsCash: autoCreditPayments.cashPayments,
                            creditPaymentsCard: autoCreditPayments.cardPayments,
                            creditRefundsGiven: autoCreditPayments.refunds,
                            // Force update supplier payments
                            supplierPayments: autoSupplierPayments
                          }));
                          toast({
                            title: "Data Refreshed",
                            description: "All financial data has been auto-populated from today's transactions.",
                          });
                        }}
                        className="text-xs"
                      >
                        Refresh All Data
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
                      <div className="text-center p-3 sm:p-4 border rounded-lg bg-green-50 dark:bg-green-950/30">
                        <Coins className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 text-green-600" />
                        <p className="text-xs sm:text-sm font-medium">Total Sales</p>
                        <div className="space-y-1">
                          <p className="text-lg sm:text-2xl font-bold">QR {actualTotals.totalSales.toFixed(2)}</p>
                          <Input
                            type="number"
                            step="0.01"
                            value={reconciliationData.editableTotalSales ?? ""}
                            onChange={(e) => updateMovementAmount('editableTotalSales', parseFloat(e.target.value) || undefined)}
                            placeholder={totals.totalSales.toFixed(2)}
                            className="h-6 text-xs text-center"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{totals.totalTransactions} transactions</p>
                      </div>
                      <div className="text-center p-3 sm:p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/30">
                        <Banknote className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 text-blue-600" />
                        <p className="text-xs sm:text-sm font-medium">Cash Sales</p>
                        <div className="space-y-1">
                          <p className="text-lg sm:text-xl font-bold">QR {actualTotals.cashSales.toFixed(2)}</p>
                          <Input
                            type="number"
                            step="0.01"
                            value={reconciliationData.editableCashSales ?? ""}
                            onChange={(e) => updateMovementAmount('editableCashSales', parseFloat(e.target.value) || undefined)}
                            placeholder={totals.cashSales.toFixed(2)}
                            className="h-6 text-xs text-center"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{totals.cashTransactionCount} transactions</p>
                      </div>
                      <div className="text-center p-3 sm:p-4 border rounded-lg bg-purple-50 dark:bg-purple-950/30">
                        <CreditCard className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 text-purple-600" />
                        <p className="text-xs sm:text-sm font-medium">Card Sales</p>
                        <div className="space-y-1">
                          <p className="text-lg sm:text-xl font-bold">QR {actualTotals.cardSales.toFixed(2)}</p>
                          <Input
                            type="number"
                            step="0.01"
                            value={reconciliationData.editableCardSales ?? ""}
                            onChange={(e) => updateMovementAmount('editableCardSales', parseFloat(e.target.value) || undefined)}
                            placeholder={totals.cardSales.toFixed(2)}
                            className="h-6 text-xs text-center"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{totals.cardTransactionCount} transactions</p>
                      </div>
                      <div className="text-center p-3 sm:p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/30">
                        <Wallet className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 text-amber-600" />
                        <p className="text-xs sm:text-sm font-medium">Credit Sales</p>
                        <div className="space-y-1">
                          <p className="text-lg sm:text-xl font-bold">QR {actualTotals.creditSales.toFixed(2)}</p>
                          <Input
                            type="number"
                            step="0.01"
                            value={reconciliationData.editableCreditSales ?? ""}
                            onChange={(e) => updateMovementAmount('editableCreditSales', parseFloat(e.target.value) || undefined)}
                            placeholder={totals.creditSales.toFixed(2)}
                            className="h-6 text-xs text-center"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{totals.creditTransactionCount} transactions</p>
                      </div>
                      <div className="text-center p-3 sm:p-4 border rounded-lg bg-orange-50 dark:bg-orange-950/30">
                        <ArrowUpDown className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 text-orange-600" />
                        <p className="text-xs sm:text-sm font-medium">Split Payments</p>
                        <div className="space-y-1">
                          <p className="text-lg sm:text-xl font-bold">QR {actualTotals.splitSales.toFixed(2)}</p>
                          <Input
                            type="number"
                            step="0.01"
                            value={reconciliationData.editableSplitSales ?? ""}
                            onChange={(e) => updateMovementAmount('editableSplitSales', parseFloat(e.target.value) || undefined)}
                            placeholder={totals.splitSales.toFixed(2)}
                            className="h-6 text-xs text-center"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{totals.splitTransactionCount} transactions</p>
                      </div>
                    </div>

                    {/* Credit Reconciliation Section */}
                    <Separator className="my-6" />
                    <div className="space-y-4">
                      <h4 className="font-medium flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-amber-600" />
                        Credit Account Reconciliation
                      </h4>
                      
                      {/* Auto-populate status indicator */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                          ✓ Auto-populated: QR {autoCreditPayments.total.toFixed(2)} total payments
                        </Badge>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setReconciliationData(prev => ({
                              ...prev,
                              creditPaymentsCash: autoCreditPayments.cashPayments,
                              creditPaymentsCard: autoCreditPayments.cardPayments,
                              creditRefundsGiven: autoCreditPayments.refunds
                            }));
                            toast({
                              title: "Credit Data Refreshed",
                              description: "Credit reconciliation data has been refreshed from today's transactions.",
                            });
                          }}
                          className="text-xs"
                        >
                          Refresh Credit Data
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Banknote className="h-3 w-3" />
                            Credit Payments (Cash)
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={reconciliationData.creditPaymentsCash || 0}
                            onChange={(e) => updateMovementAmount('creditPaymentsCash', parseFloat(e.target.value) || 0)}
                            placeholder={`${autoCreditPayments.cashPayments.toFixed(2)} (Auto)`}
                            className="text-center font-medium"
                          />
                          <p className="text-xs text-muted-foreground">Cash payments received for credit accounts</p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <CreditCard className="h-3 w-3" />
                            Credit Payments (Card)
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={reconciliationData.creditPaymentsCard || 0}
                            onChange={(e) => updateMovementAmount('creditPaymentsCard', parseFloat(e.target.value) || 0)}
                            placeholder={`${autoCreditPayments.cardPayments.toFixed(2)} (Auto)`}
                            className="text-center font-medium"
                          />
                          <p className="text-xs text-muted-foreground">Card payments received for credit accounts</p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Credit Refunds Given</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={reconciliationData.creditRefundsGiven || 0}
                            onChange={(e) => updateMovementAmount('creditRefundsGiven', parseFloat(e.target.value) || 0)}
                            placeholder={`${autoCreditPayments.refunds.toFixed(2)} (Auto)`}
                            className="text-center font-medium"
                          />
                          <p className="text-xs text-muted-foreground">Cash refunds given to credit customers</p>
                        </div>
                        
                        <div className="flex items-center justify-center">
                          <div className="text-center p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/30">
                            <p className="text-sm font-medium">Net Credit Impact</p>
                            <p className="text-xl font-bold text-amber-600">
                              QR {netCreditMovement.toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {netCreditMovement >= 0 ? 'Cash In' : 'Cash Out'}
                            </p>
                            <div className="text-xs text-muted-foreground mt-1">
                              Cash: QR {(reconciliationData.creditPaymentsCash || 0).toFixed(2)}<br/>
                              Card: QR {(reconciliationData.creditPaymentsCard || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Physical Cash Count Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Banknote className="h-5 w-5" />
                      Physical Cash Count
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
                      {cashDenominations.map((denom, index) => (
                        <div key={index} className="space-y-2 p-3 border rounded-lg bg-gray-50">
                          <Label className="text-sm font-medium text-center block">{denom.label}</Label>
                          <div className="space-y-2">
                            <Input
                              type="number"
                              min="0"
                              value={denom.count}
                              onChange={(e) => updateCashCount(`cashCount_${denom.value.toString().replace('.', '')}` as keyof ReconciliationData, parseInt(e.target.value) || 0)}
                              className="w-full text-center font-medium"
                              placeholder="0"
                            />
                            <div className="text-center">
                              <span className="text-sm font-medium text-green-600">
                                QR {(denom.value * denom.count).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <Separator className="my-4" />
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Miscellaneous Cash Amount</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={reconciliationData.cashMiscAmount}
                          onChange={(e) => updateMovementAmount('cashMiscAmount', parseFloat(e.target.value) || 0)}
                          placeholder="Additional cash amount"
                          className="text-center font-medium"
                        />
                      </div>
                      <div className="flex items-center justify-center lg:justify-end">
                        <div className="text-center lg:text-right p-4 border rounded-lg bg-green-50 dark:bg-green-950/30">
                          <p className="text-sm font-medium">Total Cash Count</p>
                          <p className="text-xl sm:text-2xl font-bold text-green-600">QR {actualCashCount.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Movements & Bank Tab - Combines Cash Movements + Bank Reconciliation */}
              <TabsContent value="movements-bank" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ArrowUpDown className="h-5 w-5" />
                      Cash Movements & Transactions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    
                    {/* Opening Balances - Editable */}
                    <div className="space-y-4">
                      <h4 className="font-medium flex items-center gap-2">
                        <PiggyBank className="h-4 w-4" />
                        Opening Balances (Editable)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Opening Cash Amount</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={reconciliationData.editableOpeningCash ?? ""}
                              onChange={(e) => updateMovementAmount('editableOpeningCash', parseFloat(e.target.value) || undefined)}
                              placeholder={`${parseFloat(currentDayOp?.openingCash || "0").toFixed(2)} (Auto)`}
                              className="text-center font-medium"
                            />
                            <div className="text-right">
                              <p className="text-sm font-medium">Current: QR {openingCash.toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground">Auto: QR {parseFloat(currentDayOp?.openingCash || "0").toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Opening Bank Balance</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={reconciliationData.editableOpeningBankBalance ?? ""}
                              onChange={(e) => updateMovementAmount('editableOpeningBankBalance', parseFloat(e.target.value) || undefined)}
                              placeholder={`${parseFloat(currentDayOp?.openingBankBalance || "0").toFixed(2)} (Auto)`}
                              className="text-center font-medium"
                            />
                            <div className="text-right">
                              <p className="text-sm font-medium">Current: QR {openingBankBalance.toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground">Auto: QR {parseFloat(currentDayOp?.openingBankBalance || "0").toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />
                    
                    {/* Owner Transactions */}
                    <div className="space-y-4">
                      <h4 className="font-medium flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Owner Transactions
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                        <div className="space-y-2">
                          <Label>Cash Deposits</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={reconciliationData.ownerDeposits}
                            onChange={(e) => updateMovementAmount('ownerDeposits', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Cash Withdrawals</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={reconciliationData.ownerWithdrawals}
                            onChange={(e) => updateMovementAmount('ownerWithdrawals', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Bank Deposits</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={reconciliationData.ownerBankDeposits}
                            onChange={(e) => updateMovementAmount('ownerBankDeposits', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Bank Withdrawals</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={reconciliationData.ownerBankWithdrawals}
                            onChange={(e) => updateMovementAmount('ownerBankWithdrawals', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Other Transactions */}
                    <div className="space-y-4">
                      <h4 className="font-medium flex items-center gap-2">
                        <Receipt className="h-4 w-4" />
                        Business Transactions
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        <div className="space-y-2">
                          <Label>Expense Payments (Cash)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={reconciliationData.expensePayments}
                            onChange={(e) => updateMovementAmount('expensePayments', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Supplier Payments (Cash)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={reconciliationData.supplierPayments}
                            onChange={(e) => updateMovementAmount('supplierPayments', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Bank Transfers (Cash ↔ Bank)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={reconciliationData.bankTransfers}
                            onChange={(e) => updateMovementAmount('bankTransfers', parseFloat(e.target.value) || 0)}
                            placeholder="0.00 (+ to bank, - from bank)"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Bank Reconciliation Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Building2 className="h-5 w-5" />
                      Bank Reconciliation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                      <div className="space-y-4">
                        <h4 className="font-medium">Expected Bank Balance Calculation</h4>
                        <div className="space-y-2 p-4 border rounded-lg bg-blue-50 text-sm">
                          <div className="flex justify-between">
                            <span>Opening Bank:</span>
                            <span>QR {openingBankBalance.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Card Sales:</span>
                            <span>QR {actualTotals.cardSales.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Credit Payments (Card):</span>
                            <span>QR {(reconciliationData.creditPaymentsCard || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Owner Bank Deposits:</span>
                            <span>QR {reconciliationData.ownerBankDeposits.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Owner Bank Withdrawals:</span>
                            <span className="text-red-600">-QR {reconciliationData.ownerBankWithdrawals.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Bank Transfers:</span>
                            <span>QR {reconciliationData.bankTransfers.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Bank Withdrawals:</span>
                            <span className="text-red-600">-QR {reconciliationData.bankWithdrawals.toFixed(2)}</span>
                          </div>
                          <Separator />
                          <div className="flex justify-between font-bold">
                            <span>Expected Bank Balance:</span>
                            <span>QR {expectedBankBalance.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Actual Bank Balance</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={reconciliationData.actualBankBalance}
                            onChange={(e) => updateMovementAmount('actualBankBalance', parseFloat(e.target.value) || 0)}
                            placeholder="Enter actual bank balance"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>POS Card Swipe Amount (Manual Entry)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={reconciliationData.posCardSwipeAmount}
                            onChange={(e) => updateMovementAmount('posCardSwipeAmount', parseFloat(e.target.value) || 0)}
                            placeholder="Enter card swipe amount from POS"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Bank Withdrawals</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={reconciliationData.bankWithdrawals}
                            onChange={(e) => updateMovementAmount('bankWithdrawals', parseFloat(e.target.value) || 0)}
                            placeholder="Enter bank withdrawals"
                          />
                        </div>
                        
                        <div className={cn(
                          "p-4 rounded-lg border",
                          Math.abs(bankVariance) < 0.01 ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"
                        )}>
                          <p className="font-medium">Bank Variance</p>
                          <p className={cn(
                            "text-lg font-bold",
                            Math.abs(bankVariance) < 0.01 ? "text-green-600" : "text-yellow-600"
                          )}>
                            QR {bankVariance.toFixed(2)}
                          </p>
                        </div>
                        
                        <div className={cn(
                          "p-4 rounded-lg border",
                          Math.abs(cardSwipeVariance) < 0.01 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                        )}>
                          <p className="font-medium">Card Swipe Variance</p>
                          <p className={cn(
                            "text-lg font-bold",
                            Math.abs(cardSwipeVariance) < 0.01 ? "text-green-600" : "text-red-600"
                          )}>
                            QR {cardSwipeVariance.toFixed(2)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Swipe: QR {reconciliationData.posCardSwipeAmount.toFixed(2)} | Reconciliation: QR {cardReconciliationTotal.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Product Monitoring Tab */}
              <TabsContent value="monitoring" className="space-y-4">
                <ProductMonitoringTab dayOperationId={dayOpForDate?.id} />
              </TabsContent>

              {/* Final Insights & Review Tab - Combines Smart Insights + Final Review */}
              <TabsContent value="final-insights" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                  
                  {/* Cash Reconciliation Summary */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Wallet className="h-5 w-5" />
                        Cash Reconciliation
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Opening Cash:</span>
                          <span>QR {openingCash.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cash Sales:</span>
                          <span>QR {actualTotals.cashSales.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Credit Payments (Cash):</span>
                          <span>QR {(reconciliationData.creditPaymentsCash || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Owner Deposits:</span>
                          <span>QR {reconciliationData.ownerDeposits.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Owner Withdrawals:</span>
                          <span className="text-red-600">-QR {reconciliationData.ownerWithdrawals.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Credit Refunds Given:</span>
                          <span className="text-red-600">-QR {(reconciliationData.creditRefundsGiven || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Expense Payments:</span>
                          <span className="text-red-600">-QR {reconciliationData.expensePayments.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Supplier Payments:</span>
                          <span className="text-red-600">-QR {reconciliationData.supplierPayments.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Bank Transfers:</span>
                          <span>QR {reconciliationData.bankTransfers.toFixed(2)} {reconciliationData.bankTransfers > 0 ? '(to bank)' : reconciliationData.bankTransfers < 0 ? '(from bank)' : ''}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold">
                          <span>Expected Cash:</span>
                          <span>QR {expectedCash.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span>Actual Cash Count:</span>
                          <span>QR {actualCashCount.toFixed(2)}</span>
                        </div>
                        <div className={cn(
                          "flex justify-between font-bold p-2 rounded",
                          Math.abs(cashVariance) < 0.01 ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                        )}>
                          <span>Cash Variance:</span>
                          <span>QR {cashVariance.toFixed(2)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Notes and Final Actions */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Final Notes
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Reconciliation Notes</Label>
                        <Textarea
                          value={reconciliationData.reconciliationNotes}
                          onChange={(e) => setReconciliationData(prev => ({ ...prev, reconciliationNotes: e.target.value }))}
                          placeholder="Any discrepancies, issues, or important notes about today's reconciliation..."
                          rows={4}
                        />
                      </div>
                      
                      {(Math.abs(cashVariance) > 0.01 || Math.abs(bankVariance) > 0.01) && (
                        <Alert>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            There are variances in your reconciliation. Please review all entries and add explanatory notes before closing the day.
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:justify-between pt-4 border-t px-1 sm:px-0">
            <Button variant="outline" onClick={onClose} className="w-full sm:w-auto order-2 sm:order-1">
              Cancel
            </Button>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto order-1 sm:order-2">
              {/* Show reopen button for admin users when day is closed */}
              {dayOpForDate?.status === 'closed' && currentUser?.role === 'admin' && (
                <Button 
                  variant="outline"
                  onClick={handleReopen}
                  disabled={reopenDayMutation.isPending}
                  className="flex items-center gap-2 w-full sm:w-auto"
                >
                  {reopenDayMutation.isPending ? (
                    <>
                      <Clock className="h-4 w-4 animate-spin" />
                      Reopening...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4" />
                      Reopen Day
                    </>
                  )}
                </Button>
              )}
              
              <Button 
                onClick={handleSubmit}
                disabled={isSubmitting || !dayOpForDate || dayOpForDate?.status === 'closed'}
                className="flex items-center gap-2 w-full sm:w-auto"
              >
                {isSubmitting ? (
                  <>
                    <Clock className="h-4 w-4 animate-spin" />
                    Closing Day...
                  </>
                ) : dayOpForDate?.status === 'closed' ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Day Already Closed
                  </>
                ) : !dayOpForDate ? (
                  <>
                    <AlertTriangle className="h-4 w-4" />
                    Day Not Opened
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Close Day
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Product Monitoring Tab Component
interface ProductMonitoringTabProps {
  dayOperationId?: number;
}

function ProductMonitoringTab({ dayOperationId }: ProductMonitoringTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [reconciliationNotes, setReconciliationNotes] = useState<{ [key: number]: string }>({});

  // Query for daily product monitoring data
  const { data: monitoringData = [], isLoading, error } = useQuery({
    queryKey: [`/api/day-operations/${dayOperationId}/product-monitoring`],
    enabled: !!dayOperationId,
  });

  // Initialize monitoring data
  const initializeMonitoringMutation = useMutation({
    mutationFn: () => apiRequest({
      url: `/api/day-operations/${dayOperationId}/initialize-monitoring`,
      method: 'POST',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/day-operations/${dayOperationId}/product-monitoring`] });
      toast({
        title: "Monitoring Initialized",
        description: "Daily product monitoring data has been initialized.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.response?.data?.message || "Failed to initialize monitoring data",
        variant: "destructive",
      });
    }
  });

  // Update monitoring data
  const updateMonitoringMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest({
      url: `/api/daily-monitoring/${id}`,
      method: 'PATCH',
      body: data,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/day-operations/${dayOperationId}/product-monitoring`] });
      setEditingItem(null);
    },
  });

  // Reconcile monitoring data
  const reconcileMutation = useMutation({
    mutationFn: ({ id, actualClosingStock, notes }: { id: number; actualClosingStock: number; notes?: string }) => 
      apiRequest({
        url: `/api/daily-monitoring/${id}/reconcile`,
        method: 'POST',
        body: { actualClosingStock, notes },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/day-operations/${dayOperationId}/product-monitoring`] });
      toast({
        title: "Reconciled",
        description: "Product monitoring has been reconciled successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.response?.data?.message || "Failed to reconcile monitoring data",
        variant: "destructive",
      });
    }
  });

  const handleReconcile = (item: DailyProductMonitoring) => {
    const actualClosingStock = parseFloat(item.actualClosingStock || item.systemClosingStock);
    const notes = reconciliationNotes[item.id] || '';
    
    reconcileMutation.mutate({
      id: item.id,
      actualClosingStock,
      notes,
    });
  };

  const updateActualStock = (itemId: number, value: string) => {
    updateMonitoringMutation.mutate({
      id: itemId,
      data: { actualClosingStock: value },
    });
  };

  if (!dayOperationId) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">No day operation selected</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Loading product monitoring data...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-red-500">Error loading product monitoring data</p>
        </CardContent>
      </Card>
    );
  }

  if (Array.isArray(monitoringData) && monitoringData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Daily Product Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            No products are configured for daily monitoring, or monitoring data hasn't been initialized for this day.
          </p>
          <Button 
            onClick={() => initializeMonitoringMutation.mutate()}
            disabled={initializeMonitoringMutation.isPending}
          >
            {initializeMonitoringMutation.isPending ? "Initializing..." : "Initialize Monitoring"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Daily Product Monitoring
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => initializeMonitoringMutation.mutate()}
            disabled={initializeMonitoringMutation.isPending}
          >
            {initializeMonitoringMutation.isPending ? "Refreshing..." : "Refresh Data"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {(monitoringData as DailyProductMonitoring[]).map((item: DailyProductMonitoring) => (
            <Card key={item.id} className={cn(
              "transition-all duration-200",
              item.isReconciled ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"
            )}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{item.product?.name || `Product ${item.productId}`}</h4>
                    <p className="text-sm text-muted-foreground">SKU: {item.product?.sku}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.isReconciled ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Reconciled
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div className="space-y-2">
                    <h5 className="font-medium text-blue-700">Opening Stock</h5>
                    <p>Quantity: {item.openingStock}</p>
                    <p>Value: QR {parseFloat(item.openingValue).toFixed(2)}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <h5 className="font-medium text-green-700">Sales Today</h5>
                    <p>Total Qty: {item.totalSalesQty}</p>
                    <p>Cash: {item.cashSalesQty} | Card: {item.cardSalesQty} | Credit: {item.creditSalesQty}</p>
                    <p>Total Value: QR {parseFloat(item.totalSalesValue).toFixed(2)}</p>
                  </div>

                  <div className="space-y-2">
                    <h5 className="font-medium text-purple-700">Purchases Today</h5>
                    <p>Quantity: {item.totalPurchaseQty}</p>
                    <p>Value: QR {parseFloat(item.totalPurchaseValue).toFixed(2)}</p>
                  </div>

                  <div className="space-y-2">
                    <h5 className="font-medium text-orange-700">Expected Closing</h5>
                    <p>System Stock: {item.systemClosingStock}</p>
                    <p>System Value: QR {parseFloat(item.totalSalesValue).toFixed(2)}</p>
                  </div>
                </div>
                
                <Separator className="my-4" />
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Actual Closing Stock Count</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.actualClosingStock || item.systemClosingStock}
                          onChange={(e) => updateActualStock(item.id, e.target.value)}
                          disabled={item.isReconciled}
                          className="flex-1"
                        />
                        {editingItem === item.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingItem(null)}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Reconciliation Notes</Label>
                      <Textarea
                        value={reconciliationNotes[item.id] || item.notes || ''}
                        onChange={(e) => setReconciliationNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder="Add notes for any discrepancies..."
                        rows={2}
                        disabled={item.isReconciled}
                      />
                    </div>
                    
                    {!item.isReconciled && (
                      <Button
                        size="sm"
                        onClick={() => handleReconcile(item)}
                        disabled={reconcileMutation.isPending}
                        className="w-full"
                      >
                        {reconcileMutation.isPending ? "Reconciling..." : "Reconcile"}
                      </Button>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    {item.isReconciled && (
                      <div className="p-3 border rounded-lg bg-gray-50">
                        <h5 className="font-medium text-gray-700 mb-2">Reconciliation Summary</h5>
                        <p className="text-sm">
                          <span className="font-medium">Actual Stock:</span> {item.actualClosingStock}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Actual Value:</span> QR {parseFloat(item.actualClosingStock || "0").toFixed(2)}
                        </p>
                        <p className={cn(
                          "text-sm font-medium",
                          parseFloat(item.variance) === 0 ? "text-green-600" : 
                          parseFloat(item.variance) > 0 ? "text-blue-600" : "text-red-600"
                        )}>
                          Variance: {item.variance} (QR {parseFloat(item.varianceValue).toFixed(2)})
                        </p>
                        {item.notes && (
                          <p className="text-sm text-muted-foreground">Note: {item.notes}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
