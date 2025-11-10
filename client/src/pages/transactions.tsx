import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Search, 
  Filter, 
  Calendar as CalendarIcon,
  Coins,
  CreditCard,
  User,
  Clock,
  AlertTriangle,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Eye,
  Download,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import MainLayout from "@/components/layout/main-layout";
import { RiskBadge } from "@/components/pos/risk-indicator";
import { apiRequest } from "@/lib/queryClient";
import { TableSkeleton } from "@/components/ui/skeleton-loader";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useStore } from "@/hooks/useStore";

interface Transaction {
  id: number;
  transactionNumber: string;
  customerId?: number;
  subtotal: string;
  tax: string;
  total: string;
  status: string;
  paymentMethod: string;
  cashTendered?: string;
  cardType?: string;
  cardLast4?: string;
  receiptPrinted: boolean;
  createdAt: string;
  customer?: {
    id: number;
    name: string;
    email?: string;
    phone?: string;
  };
}

interface TransactionWithRisk extends Transaction {
  riskAssessment?: {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskScore: number;
    color: string;
    badge: string;
    riskReasons: string[];
    recommendations: string[];
  };
}

interface DailyRiskSummary {
  totalTransactions: number;
  lowRisk: number;
  mediumRisk: number;
  highRisk: number;
  criticalRisk: number;
  totalRiskScore: number;
  flaggedTransactions: TransactionWithRisk[];
}

const RISK_ASSESSMENT_CONCURRENCY = 5;

interface TransactionItem {
  id: number;
  productId: number;
  productName?: string;
  productSku?: string;
  quantity: number;
  unitPrice: string;
  total: string;
  vatRate?: string;
  vatAmount?: string;
  discountAmount?: string;
}

function TransactionDetailsModal({ transaction }: { transaction: TransactionWithRisk }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const { data: transactionItems = [], isLoading: isLoadingItems } = useQuery<TransactionItem[]>({
    queryKey: [`/api/transactions/${transaction.id}/items`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/transactions/${transaction.id}/items`);
      return await response.json();
    },
    enabled: isOpen,
  });

  const subtotal = parseFloat(transaction.subtotal || "0");
  const tax = parseFloat(transaction.tax || "0");
  const total = parseFloat(transaction.total);
  const formattedDate = format(new Date(transaction.createdAt), "MMM d, yyyy 'at' h:mm a");

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Transaction Details - {transaction.transactionNumber}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            View detailed transaction information including items, payment details, and risk assessment.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 mt-4">
          {/* Transaction Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-gray-200">
              <CardContent className="p-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</label>
                  <p className="text-sm font-medium mt-1">{transaction.customer?.name || 'Walk-in Customer'}</p>
                  {transaction.customer?.email && (
                    <p className="text-xs text-gray-500 mt-0.5">{transaction.customer.email}</p>
                  )}
                  {transaction.customer?.phone && (
                    <p className="text-xs text-gray-500">{transaction.customer.phone}</p>
                  )}
                </div>
                <Separator />
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date & Time</label>
                  <p className="text-sm font-medium mt-1">{formattedDate}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200">
              <CardContent className="p-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Method</label>
                  <div className="mt-1">
                    <Badge 
                      variant="outline" 
                      className={`text-sm font-semibold ${
                        transaction.paymentMethod?.toLowerCase() === 'card' ? 'bg-purple-50 text-purple-700 border-purple-300' :
                        transaction.paymentMethod?.toLowerCase() === 'cash' ? 'bg-green-50 text-green-700 border-green-300' :
                        transaction.paymentMethod?.toLowerCase() === 'credit' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                        'bg-gray-50 text-gray-700 border-gray-300'
                      }`}
                    >
                      {transaction.paymentMethod}
                    </Badge>
                  </div>
                  {transaction.cardType && (
                    <p className="text-xs text-gray-500 mt-1">Card Type: {transaction.cardType}</p>
                  )}
                  {transaction.cardLast4 && (
                    <p className="text-xs text-gray-500">Card: ****{transaction.cardLast4}</p>
                  )}
                </div>
                <Separator />
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</label>
                  <div className="mt-1">
                    <Badge 
                      variant="outline"
                      className={`text-sm font-semibold ${
                        transaction.status === 'completed' ? 'border-green-500 text-green-700 bg-green-50' : 
                        transaction.status === 'voided' ? 'border-red-500 text-red-700 bg-red-50' : 
                        'border-gray-500 text-gray-700 bg-gray-50'
                      }`}
                    >
                      {transaction.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Transaction Items */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Transaction Items</h3>
            {isLoadingItems ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse h-16 bg-gray-100 rounded-lg"></div>
                ))}
              </div>
            ) : transactionItems.length > 0 ? (
              <Card className="border-gray-200">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Item</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Qty</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Unit Price</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {transactionItems.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{item.productName || `Product #${item.productId}`}</p>
                                {item.productSku && (
                                  <p className="text-xs text-gray-500">SKU: {item.productSku}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-900">{item.quantity}</td>
                            <td className="px-4 py-3 text-right text-sm text-gray-900">QR {parseFloat(item.unitPrice).toFixed(2)}</td>
                            <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">QR {parseFloat(item.total).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-gray-200">
                <CardContent className="p-6 text-center text-gray-500">
                  <p className="text-sm">No items found for this transaction</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Payment Summary */}
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Payment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium text-gray-900">QR {subtotal.toFixed(2)}</span>
              </div>
              {tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-medium text-gray-900">QR {tax.toFixed(2)}</span>
                </div>
              )}
              {transaction.cashTendered && parseFloat(transaction.cashTendered) > total && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Cash Tendered</span>
                    <span className="font-medium text-gray-900">QR {parseFloat(transaction.cashTendered).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Change</span>
                    <span className="font-medium text-gray-900">QR {(parseFloat(transaction.cashTendered) - total).toFixed(2)}</span>
                  </div>
                </>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between">
                <span className="text-base font-bold text-gray-900">Total</span>
                <span className="text-lg font-bold text-gray-900">QR {total.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Risk Assessment */}
          {transaction.riskAssessment && (
            <Card className="border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Risk Assessment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <RiskBadge 
                    riskLevel={transaction.riskAssessment.riskLevel}
                    riskScore={transaction.riskAssessment.riskScore}
                    color={transaction.riskAssessment.color}
                    badge={transaction.riskAssessment.badge}
                  />
                </div>
                
                {transaction.riskAssessment.riskReasons.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Risk Factors</label>
                    <ul className="space-y-1">
                      {transaction.riskAssessment.riskReasons.map((reason, index) => (
                        <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-orange-500 mt-0.5">•</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {transaction.riskAssessment.recommendations.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Recommendations</label>
                    <ul className="space-y-1">
                      {transaction.riskAssessment.recommendations.map((rec, index) => (
                        <li key={index} className="text-sm text-blue-600 flex items-start gap-2">
                          <span className="text-blue-500 mt-0.5">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Transactions() {
  const { currentStore } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [showRiskSummary, setShowRiskSummary] = useState(false);
  const [riskFilter, setRiskFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');

  const { data: transactions = [], isLoading, refetch } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions", currentStore?.id],
    queryFn: async () => {
      const storeQueryParam = currentStore?.id ? `?storeId=${currentStore.id}` : "";
      const response = await apiRequest("GET", `/api/transactions${storeQueryParam}`);
      return await response.json();
    },
  });

  const { data: riskSummary, isLoading: loadingRiskSummary } = useQuery<DailyRiskSummary | null>({
    queryKey: ["/api/risk/daily", selectedDate ? format(selectedDate, 'yyyy-MM-dd') : 'all'],
    enabled: showRiskSummary && !!selectedDate,
  });

  const [transactionsWithRisk, setTransactionsWithRisk] = useState<TransactionWithRisk[]>([]);
  const [isAssessingRisk, setIsAssessingRisk] = useState(false);

  // Initialize transactionsWithRisk with raw transactions when they're loaded
  useEffect(() => {
    if (transactions.length > 0) {
      setTransactionsWithRisk(prev => {
        // If we have existing risk assessments, preserve them
        if (prev.length > 0) {
          const existingMap = new Map(prev.map(t => [t.id, t]));
          return transactions.map(t => {
            const existing = existingMap.get(t.id);
            // Preserve existing risk assessment if it exists
            return existing || (t as TransactionWithRisk);
          });
        } else {
          // First time loading, just map transactions
          return transactions.map(t => t as TransactionWithRisk);
        }
      });
    } else if (transactions.length === 0) {
      // Clear if no transactions
      setTransactionsWithRisk([]);
    }
  }, [transactions]);

  const fetchTransactionRisk = async (transaction: Transaction): Promise<TransactionWithRisk> => {
    try {
      const itemsResponse = await apiRequest({
        url: `/api/transactions/${transaction.id}/items`,
        method: "GET",
      });
      const itemsJson: Array<{
        productId: number;
        quantity: number;
        unitPrice: string;
        total: string;
      }> = await itemsResponse.json();

      const transactionData = {
        customerId: transaction.customerId,
        total: parseFloat(transaction.total),
        items: itemsJson.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: parseFloat(item.unitPrice),
          total: parseFloat(item.total),
        })),
        paymentMethod: transaction.paymentMethod || "cash",
        cashTendered: transaction.cashTendered ? parseFloat(transaction.cashTendered) : undefined,
        createdAt: new Date(transaction.createdAt),
      };

      const riskAssessmentResponse = await apiRequest({
        url: "/api/risk/assess",
        method: "POST",
        body: transactionData,
      });
      const riskAssessment = await riskAssessmentResponse.json();

      return {
        ...transaction,
        riskAssessment,
      };
    } catch (error) {
      console.error(`Error assessing risk for transaction ${transaction.id}:`, error);
      return transaction;
    }
  };

  const assessAllTransactionsRisk = async () => {
    if (transactions.length === 0) return;
    
    setIsAssessingRisk(true);
    try {
      const results: TransactionWithRisk[] = new Array(transactions.length);
      let pointer = 0;

      const nextIndex = () => {
        if (pointer >= transactions.length) return null;
        const current = pointer;
        pointer += 1;
        return current;
      };

  // Process risk assessments with a bounded number of concurrent workers to avoid long sequential waits.
  const worker = async () => {
        while (true) {
          const index = nextIndex();
          if (index === null) break;
          results[index] = await fetchTransactionRisk(transactions[index]);
        }
      };

      const workerCount = Math.min(RISK_ASSESSMENT_CONCURRENCY, transactions.length);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));
      setTransactionsWithRisk(results);
    } catch (error) {
      console.error("Error assessing transactions risk:", error);
    } finally {
      setIsAssessingRisk(false);
    }
  };

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const filteredTransactions = useMemo(() => {
    // Use transactionsWithRisk if available, otherwise fall back to raw transactions
    const transactionsToFilter = transactionsWithRisk.length > 0 
      ? transactionsWithRisk 
      : transactions.map(t => t as TransactionWithRisk);

    if (transactionsToFilter.length === 0) return [];

    return transactionsToFilter.filter((transaction) => {
      // Search filter
      const matchesSearch =
        !normalizedSearchTerm ||
        transaction.transactionNumber.toLowerCase().includes(normalizedSearchTerm) ||
        transaction.customer?.name?.toLowerCase().includes(normalizedSearchTerm) ||
        transaction.paymentMethod.toLowerCase().includes(normalizedSearchTerm);

      // Risk level filter
      const matchesRiskFilter =
        riskFilter === "all" || transaction.riskAssessment?.riskLevel === riskFilter;

      // Date filter - if a date is selected, only show transactions from that date
      const matchesDateFilter = !selectedDate || 
        format(new Date(transaction.createdAt), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');

      return matchesSearch && matchesRiskFilter && matchesDateFilter;
    });
  }, [transactionsWithRisk, transactions, normalizedSearchTerm, riskFilter, selectedDate]);

  const riskStats = useMemo(() => {
    const transactionsToCheck = transactionsWithRisk.length > 0 
      ? transactionsWithRisk 
      : transactions.map(t => t as TransactionWithRisk);

    if (transactionsToCheck.length === 0) {
      return { low: 0, medium: 0, high: 0, critical: 0 };
    }

    return transactionsToCheck.reduce(
      (stats, transaction) => {
        if (transaction.riskAssessment) {
          stats[transaction.riskAssessment.riskLevel] += 1;
        }
        return stats;
      },
      { low: 0, medium: 0, high: 0, critical: 0 },
    );
  }, [transactionsWithRisk, transactions]);

  const exportToCSV = () => {
    const csvData = filteredTransactions.map(transaction => ({
      'Transaction Number': transaction.transactionNumber,
      'Customer': transaction.customer?.name || 'Walk-in',
      'Total': transaction.total,
      'Payment Method': transaction.paymentMethod,
      'Status': transaction.status,
      'Risk Level': transaction.riskAssessment?.riskLevel || 'N/A',
      'Risk Score': transaction.riskAssessment?.riskScore || 'N/A',
      'Risk Reasons': transaction.riskAssessment?.riskReasons?.join('; ') || 'N/A',
      'Date': format(new Date(transaction.createdAt), 'yyyy-MM-dd HH:mm:ss')
    }));

    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => `"${row[header as keyof typeof row] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `transactions_with_risk_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Professional Header */}
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl shadow-lg border border-blue-100 p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left Section - Title and Description */}
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-md">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-gray-800">
                    Transaction Analytics
                  </h1>
                  <p className="text-gray-600 text-sm lg:text-base font-medium mt-1">
                    Real-time risk assessment and transaction monitoring
                  </p>
                </div>
              </div>
              
              {/* Quick Stats */}
              <div className="flex flex-wrap gap-4 mt-6">
                <div className="bg-white rounded-xl px-4 py-2 border border-blue-200 shadow-sm">
                  <div className="text-xs text-gray-600 font-medium">Total Transactions</div>
                  <div className="text-2xl font-black text-gray-800">{transactions.length}</div>
                </div>
                {transactionsWithRisk.length > 0 && (
                  <>
                    <div className="bg-white rounded-xl px-4 py-2 border border-indigo-200 shadow-sm">
                      <div className="text-xs text-gray-600 font-medium">Analyzed</div>
                      <div className="text-2xl font-black text-gray-800">{transactionsWithRisk.length}</div>
                    </div>
                    <div className="bg-red-50 rounded-xl px-4 py-2 border border-red-200 shadow-sm">
                      <div className="text-xs text-red-700 font-medium">High Risk</div>
                      <div className="text-2xl font-black text-red-700">{riskStats.high + riskStats.critical}</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Right Section - Action Buttons */}
            <div className="flex flex-col gap-3">
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2 bg-white border-gray-300 text-gray-700 hover:bg-blue-500 hover:border-blue-400 font-semibold shadow-sm"
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {selectedDate ? format(selectedDate, "MMM d, yyyy") : "All Dates"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <div className="p-2 border-b">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setSelectedDate(undefined);
                        setIsCalendarOpen(false);
                      }}
                      className="w-full justify-start text-sm"
                    >
                      Clear Filter (Show All)
                    </Button>
                  </div>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      setIsCalendarOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Button
                onClick={() => setShowRiskSummary(!showRiskSummary)}
                variant="outline"
                className="flex items-center gap-2 bg-white border-gray-300 text-gray-700 hover:bg-blue-500 hover:border-blue-400 font-semibold shadow-sm"
              >
                <TrendingUp className="h-4 w-4" />
                {showRiskSummary ? 'Hide' : 'Show'} Risk Summary
              </Button>

              <Button
                onClick={assessAllTransactionsRisk}
                disabled={isAssessingRisk || transactions.length === 0}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 font-bold shadow-md disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isAssessingRisk ? 'animate-spin' : ''}`} />
                {isAssessingRisk ? 'Analyzing...' : 'Analyze All'}
              </Button>
            </div>
          </div>
        </div>

        {/* Risk Summary */}
        {showRiskSummary && riskSummary && selectedDate && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Daily Risk Summary - {format(selectedDate, "MMM d, yyyy")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{riskSummary.totalTransactions}</div>
                  <div className="text-sm text-gray-500">Total Transactions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{riskSummary.lowRisk}</div>
                  <div className="text-sm text-gray-500">Low Risk</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{riskSummary.mediumRisk}</div>
                  <div className="text-sm text-gray-500">Medium Risk</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{riskSummary.highRisk}</div>
                  <div className="text-sm text-gray-500">High Risk</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{riskSummary.criticalRisk}</div>
                  <div className="text-sm text-gray-500">Critical Risk</div>
                </div>
              </div>

              {riskSummary.flaggedTransactions.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-2">Flagged Transactions</h4>
                  <div className="space-y-2">
                    {riskSummary.flaggedTransactions.slice(0, 5).map((transaction: TransactionWithRisk) => (
                      <div key={transaction.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{transaction.transactionNumber}</span>
                          <RiskBadge 
                            riskLevel={transaction.riskAssessment!.riskLevel}
                            riskScore={transaction.riskAssessment!.riskScore}
                            color={transaction.riskAssessment!.color}
                            badge={transaction.riskAssessment!.badge}
                            compact={true}
                          />
                        </div>
                        <span className="text-sm text-gray-600">QR {parseFloat(transaction.total).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Controls */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as any)}
              className="border rounded px-3 py-2 h-10 text-sm"
            >
              <option value="all">All Risk Levels</option>
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
              <option value="critical">Critical Risk</option>
            </select>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                className="flex items-center gap-2"
              >
                <CalendarIcon className="h-4 w-4" />
                {selectedDate ? format(selectedDate, "MMM d, yyyy") : "All Dates"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <div className="p-2 border-b">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedDate(undefined)}
                  className="w-full justify-start text-sm"
                >
                  Clear Filter (Show All)
                </Button>
              </div>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {(searchTerm || riskFilter !== 'all' || selectedDate) && (
            <Button
              onClick={() => {
                setSearchTerm("");
                setRiskFilter("all");
                setSelectedDate(undefined);
              }}
              variant="ghost"
              size="sm"
              className="text-gray-600 hover:text-gray-900"
            >
              Clear All Filters
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2">
          <Button
            onClick={assessAllTransactionsRisk}
            disabled={isAssessingRisk || transactions.length === 0}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isAssessingRisk ? 'animate-spin' : ''}`} />
            {isAssessingRisk ? 'Assessing...' : 'Assess Risk'}
          </Button>

          <Button
            onClick={exportToCSV}
            variant="outline"
            disabled={filteredTransactions.length === 0}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          </div>
        </div>

        {/* Risk Statistics */}
        {transactionsWithRisk.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-green-500" />
                  <div>
                    <div className="text-2xl font-bold text-green-600">{riskStats.low}</div>
                    <div className="text-sm text-gray-500">Low Risk</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-yellow-500" />
                  <div>
                    <div className="text-2xl font-bold text-yellow-600">{riskStats.medium}</div>
                    <div className="text-sm text-gray-500">Medium Risk</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <div>
                    <div className="text-2xl font-bold text-orange-600">{riskStats.high}</div>
                    <div className="text-sm text-gray-500">High Risk</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-red-500" />
                  <div>
                    <div className="text-2xl font-bold text-red-600">{riskStats.critical}</div>
                    <div className="text-sm text-gray-500">Critical Risk</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Transactions List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Transactions</CardTitle>
              {transactions.length > 0 && (
                <div className="text-sm text-gray-600">
                  Showing {filteredTransactions.length} of {transactions.length} transactions
                  {selectedDate && ` for ${format(selectedDate, "MMM d, yyyy")}`}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-lg font-medium mb-2">No transactions found</p>
                <p className="text-sm">
                  {transactions.length === 0 
                    ? "No transactions have been created yet" 
                    : "Try adjusting your search or filter criteria"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTransactions.map((transaction) => {
                  const paymentMethod = transaction.paymentMethod?.toLowerCase() || '';
                  const getPaymentMethodStyle = (method: string) => {
                    switch (method) {
                      case 'credit':
                        return 'bg-blue-100 text-blue-800 border-blue-300 font-semibold';
                      case 'card':
                        return 'bg-purple-100 text-purple-800 border-purple-300 font-semibold';
                      case 'cash':
                        return 'bg-green-100 text-green-800 border-green-300 font-semibold';
                      case 'debit':
                        return 'bg-indigo-100 text-indigo-800 border-indigo-300 font-semibold';
                      default:
                        return 'bg-gray-100 text-gray-800 border-gray-300 font-semibold';
                    }
                  };
                  return (
                  <div 
                    key={transaction.id}
                    className="flex items-center justify-between p-4 border rounded-lg transition-colors hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-medium">{transaction.transactionNumber}</span>
                        {transaction.riskAssessment && (
                          <RiskBadge 
                            riskLevel={transaction.riskAssessment.riskLevel}
                            riskScore={transaction.riskAssessment.riskScore}
                            color={transaction.riskAssessment.color}
                            badge={transaction.riskAssessment.badge}
                            compact={true}
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {transaction.customer?.name || 'Walk-in'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Coins className="h-3 w-3" />
                          QR {parseFloat(transaction.total).toFixed(2)}
                        </span>
                        <span className="flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          <Badge 
                            variant="outline" 
                            className={`text-xs px-2 py-0.5 ${getPaymentMethodStyle(paymentMethod)}`}
                          >
                            {transaction.paymentMethod}
                          </Badge>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(transaction.createdAt), 'MMM d, HH:mm')}
                        </span>
                      </div>
                      {transaction.riskAssessment?.riskReasons && transaction.riskAssessment.riskReasons.length > 0 && (
                        <div className="mt-2 text-xs text-orange-600 max-w-md">
                          {transaction.riskAssessment.riskReasons.slice(0, 2).join(', ')}
                          {transaction.riskAssessment.riskReasons.length > 2 && '...'}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline"
                        className={`text-xs ${
                          transaction.status === 'completed' ? 'border-green-500 text-green-700 bg-green-50' : 
                          transaction.status === 'voided' ? 'border-red-500 text-red-700 bg-red-50' : 
                          'border-gray-500 text-gray-700 bg-gray-50'
                        }`}
                      >
                        {transaction.status}
                      </Badge>
                      <TransactionDetailsModal transaction={transaction} />
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}