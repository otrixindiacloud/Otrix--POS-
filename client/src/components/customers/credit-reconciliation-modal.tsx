import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  CreditCard, 
  Coins, 
  PlusCircle, 
  MinusCircle, 
  History, 
  Receipt, 
  Calendar,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Package
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Customer, CreditTransaction } from "@shared/schema";

interface CreditReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  initialTab?: "new" | "history";
}

const creditTransactionSchema = z.object({
  type: z.enum(["charge", "payment", "adjustment", "refund"]),
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Amount must be a positive number",
  }),
  paymentMethod: z.string().optional(),
  reference: z.string().optional(),
  description: z.string().optional(),
});

type CreditTransactionForm = z.infer<typeof creditTransactionSchema>;

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

export default function CreditReconciliationModal({ 
  isOpen, 
  onClose, 
  customer,
  initialTab = "new"
}: CreditReconciliationModalProps) {
  const [activeTab, setActiveTab] = useState<"new" | "history">(initialTab);
  const [expandedTransactions, setExpandedTransactions] = useState<Set<number>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Use customer.id from props as it's always available - use useMemo to ensure stable reference
  const customerId = useMemo(() => customer?.id, [customer]);

  // Update active tab when initialTab changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      // Invalidate and refetch credit transactions when modal opens
      if (customerId) {
        queryClient.invalidateQueries({ queryKey: ["/api/credit-transactions", customerId] });
      }
    }
  }, [isOpen, initialTab, customerId, queryClient]);

  // Fetch fresh customer data to ensure we have the latest balance
  const { data: freshCustomer, isLoading: loadingCustomer } = useQuery({
    queryKey: ["/api/customers", customer.id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/customers/${customer.id}`);
      return await response.json();
    },
    enabled: isOpen,
    refetchOnMount: true,
    staleTime: 0,
  });

  // Use fresh customer data if available, otherwise fall back to prop
  const currentCustomer = (freshCustomer as typeof customer) || customer;

  const { data: creditTransactionsResponse, isLoading: loadingHistory, error: historyError, refetch: refetchHistory } = useQuery({
    queryKey: ["/api/credit-transactions", customerId],
    queryFn: async () => {
      if (!customerId) {
        console.warn("No customer ID available for fetching credit transactions");
        return [];
      }
      console.log("Fetching credit transactions for customer:", customerId);
      try {
        const response = await apiRequest("GET", `/api/credit-transactions?customerId=${customerId}`);
        const data = await response.json();
        console.log("Credit transactions response:", data);
        // Ensure we always return an array
        const transactions = Array.isArray(data) ? data : (data ? [data] : []);
        console.log(`Found ${transactions.length} credit transactions for customer ${customerId}`);
        return transactions;
      } catch (error) {
        console.error("Error fetching credit transactions:", error);
        // Return empty array on error instead of throwing, so UI can still render
        return [];
      }
    },
    enabled: isOpen && !!customerId, // Always fetch when modal is open and we have customerId
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 0,
    retry: 1,
  });

  // Refetch history when switching to history tab
  useEffect(() => {
    if (isOpen && activeTab === "history" && customerId) {
      console.log("History tab active, refetching credit transactions for customer:", customerId);
      // Refetch when history tab becomes active
      refetchHistory();
    }
  }, [isOpen, activeTab, customerId, refetchHistory]);

  // Debug: Log when transactions are received
  useEffect(() => {
    if (creditTransactionsResponse !== undefined) {
      console.log("Credit transactions received:", {
        response: creditTransactionsResponse,
        isArray: Array.isArray(creditTransactionsResponse),
        length: Array.isArray(creditTransactionsResponse) ? creditTransactionsResponse.length : "not array",
        customerId
      });
    }
  }, [creditTransactionsResponse, customerId]);

  // Ensure creditTransactions is always an array
  const creditTransactions = Array.isArray(creditTransactionsResponse) 
    ? creditTransactionsResponse 
    : (creditTransactionsResponse ? [creditTransactionsResponse] : []);

  const form = useForm<CreditTransactionForm>({
    resolver: zodResolver(creditTransactionSchema),
    defaultValues: {
      type: "payment",
      amount: "",
      paymentMethod: "",
      reference: "",
      description: "",
    },
  });

  const createCreditTransactionMutation = useMutation({
    mutationFn: async (data: CreditTransactionForm) => {
      const currentBalance = parseFloat(currentCustomer.creditBalance || "0");
      const amount = parseFloat(data.amount);
      
      let newBalance: number;
      if (data.type === "charge") {
        newBalance = currentBalance + amount;
      } else if (data.type === "payment" || data.type === "refund") {
        newBalance = currentBalance - amount;
      } else if (data.type === "adjustment") {
        // For adjustment, the amount represents the new balance directly
        // This allows setting balance to a specific value
        newBalance = amount;
      } else {
        newBalance = currentBalance;
      }

      const creditTransactionData = {
        customerId: currentCustomer.id,
        type: data.type,
        amount: data.amount,
        paymentMethod: data.paymentMethod || null,
        reference: data.reference || null,
        description: data.description || null,
        previousBalance: currentBalance.toFixed(2),
        newBalance: newBalance.toFixed(2),
      };

      const response = await apiRequest("POST", "/api/credit-transactions", creditTransactionData);
      return await response.json();
    },
    onSuccess: async () => {
      toast({
        title: "Credit transaction recorded",
        description: "Customer credit balance has been updated successfully.",
      });
      // Invalidate and refetch all customer-related queries
      await queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/credit-transactions"] });
      // Refetch the specific customer to get updated data
      if (customerId) {
        await queryClient.refetchQueries({ queryKey: ["/api/customers", customerId] });
        // Invalidate and refetch credit transactions for this customer
        await queryClient.invalidateQueries({ queryKey: ["/api/credit-transactions", customerId] });
      }
      form.reset();
      // Switch to history tab to show the new transaction
      setActiveTab("history");
      // Refetch history immediately after tab switch
      if (customerId) {
        // Use a small delay to ensure tab switch completes
        setTimeout(async () => {
          await refetchHistory();
        }, 100);
      }
      // Don't close immediately - let user see the transaction in history
      // User can close manually when done
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record credit transaction",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreditTransactionForm) => {
    createCreditTransactionMutation.mutate(data);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "charge":
        return <PlusCircle className="w-4 h-4 text-red-500" />;
      case "payment":
        return <MinusCircle className="w-4 h-4 text-green-500" />;
      case "adjustment":
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      case "refund":
        return <Receipt className="w-4 h-4 text-orange-500" />;
      default:
        return <Coins className="w-4 h-4" />;
    }
  };

  const getTransactionBadgeColor = (type: string) => {
    switch (type) {
      case "charge":
        return "bg-red-100 text-red-800";
      case "payment":
        return "bg-green-100 text-green-800";
      case "adjustment":
        return "bg-blue-100 text-blue-800";
      case "refund":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatCurrency = (amount: string | number) => {
    return `QR ${(typeof amount === 'string' ? parseFloat(amount) : amount).toFixed(2)}`;
  };

  const toggleTransactionExpansion = (transactionId: number) => {
    setExpandedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  };

  // Component to fetch and display transaction items
  const TransactionItemsDisplay = ({ creditTransactionId, transactionId }: { creditTransactionId: number; transactionId: number }) => {
    const { data: items = [], isLoading } = useQuery<TransactionItem[]>({
      queryKey: [`/api/transactions/${transactionId}/items`],
      queryFn: async () => {
        const response = await apiRequest("GET", `/api/transactions/${transactionId}/items`);
        return await response.json();
      },
      enabled: expandedTransactions.has(creditTransactionId) && !!transactionId,
    });

    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-xs text-slate-600">Loading items...</span>
        </div>
      );
    }

    if (!items || items.length === 0) {
      return (
        <div className="text-center py-4 text-sm text-slate-500">
          No items found for this transaction
        </div>
      );
    }

    return (
      <div className="mt-3 pt-3 border-t border-slate-200">
        <div className="mb-2 flex items-center gap-2">
          <Package className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Transaction Items</span>
          <span className="text-xs text-slate-500">({items.length} item{items.length !== 1 ? 's' : ''})</span>
        </div>
        <div className="max-h-[300px] overflow-y-auto overflow-x-auto border border-slate-200 rounded-md">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-2 font-medium text-slate-700">Product</th>
                <th className="text-right py-2 px-2 font-medium text-slate-700">Quantity</th>
                <th className="text-right py-2 px-2 font-medium text-slate-700">Unit Price</th>
                <th className="text-right py-2 px-2 font-medium text-slate-700">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 px-2">
                    <div>
                      <p className="font-medium text-slate-900">{item.productName || `Product #${item.productId}`}</p>
                      {item.productSku && (
                        <p className="text-xs text-slate-500">SKU: {item.productSku}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right text-slate-700">{item.quantity}</td>
                  <td className="py-2 px-2 text-right text-slate-700">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-2 px-2 text-right font-medium text-slate-900">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <CreditCard className="w-5 h-5 mr-2" />
            Credit Reconciliation - {currentCustomer.name}
          </DialogTitle>
          <DialogDescription>
            Manage customer credit payments, charges, and adjustments
          </DialogDescription>
        </DialogHeader>

        {/* Customer Credit Summary */}
        <Card className="mb-6">
          <CardContent className="p-4">
            {loadingCustomer ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-sm text-slate-600">Loading customer data...</span>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Current Credit Balance</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {formatCurrency(currentCustomer.creditBalance || "0")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Credit Limit</p>
                  <p className="text-lg font-semibold text-slate-700">
                    {formatCurrency(currentCustomer.creditLimit || "0")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-600">Available Credit</p>
                  <p className="text-lg font-semibold text-green-600">
                    {formatCurrency(
                      parseFloat(currentCustomer.creditLimit || "0") - parseFloat(currentCustomer.creditBalance || "0")
                    )}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 mb-6">
          <button
            onClick={() => setActiveTab("new")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "new"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            New Transaction
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "history"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <History className="w-4 h-4 mr-1 inline" />
            Transaction History
          </button>
        </div>

        {/* New Transaction Tab */}
        {activeTab === "new" && (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="type">Transaction Type</Label>
                  <Select
                    value={form.watch("type")}
                    onValueChange={(value) => form.setValue("type", value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select transaction type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="payment">Payment (Reduce Balance)</SelectItem>
                      <SelectItem value="charge">Charge (Increase Balance)</SelectItem>
                      <SelectItem value="adjustment">Balance Adjustment</SelectItem>
                      <SelectItem value="refund">Refund (Reduce Balance)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <div className="relative">
                    <Coins className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-10"
                      {...form.register("amount")}
                    />
                  </div>
                  {form.formState.errors.amount && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.amount.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Select
                    value={form.watch("paymentMethod")}
                    onValueChange={(value) => form.setValue("paymentMethod", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Credit/Debit Card</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="adjustment">Manual Adjustment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="reference">Reference Number</Label>
                  <Input
                    id="reference"
                    placeholder="Check #, Transfer ID, etc."
                    {...form.register("reference")}
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Optional description or notes"
                    rows={3}
                    {...form.register("description")}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createCreditTransactionMutation.isPending}
              >
                {createCreditTransactionMutation.isPending ? (
                  "Processing..."
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Record Transaction
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* Transaction History Tab */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Transaction History</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  // Invalidate cache and refetch
                  await queryClient.invalidateQueries({ queryKey: ["/api/credit-transactions", customerId] });
                  await refetchHistory();
                }}
                disabled={loadingHistory}
              >
                <History className="w-4 h-4 mr-2" />
                {loadingHistory ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
            {loadingHistory ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-slate-600 mt-2">Loading transaction history...</p>
              </div>
            ) : historyError ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
                <p className="text-red-600 font-medium">Error loading transaction history</p>
                <p className="text-sm text-slate-600 mt-1">{historyError?.message || "Please try again later"}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchHistory()}
                  className="mt-4"
                >
                  Try Again
                </Button>
              </div>
            ) : !creditTransactionsResponse && !loadingHistory ? (
              <div className="text-center py-8 text-slate-500">
                <History className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>Unable to load transactions</p>
                <p className="text-sm mb-4">Please try refreshing</p>
                <Button
                  variant="outline"
                  onClick={async () => {
                    await queryClient.invalidateQueries({ queryKey: ["/api/credit-transactions", customerId] });
                    await refetchHistory();
                  }}
                >
                  Refresh
                </Button>
              </div>
            ) : creditTransactions.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <History className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>No credit transactions found</p>
                <p className="text-sm mb-4">Start by recording a new transaction</p>
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("new")}
                >
                  Record New Transaction
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-slate-600 mb-2">
                  Showing {creditTransactions.length} transaction{creditTransactions.length !== 1 ? 's' : ''}
                </div>
                <div className="max-h-[500px] overflow-y-auto space-y-3 pr-2">
                  {creditTransactions.map((transaction: CreditTransaction) => {
                    const isExpanded = expandedTransactions.has(transaction.id);
                    const hasTransactionId = !!transaction.transactionId;
                    
                    return (
                      <Card key={transaction.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            {/* Header Row */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3 flex-1">
                                {getTransactionIcon(transaction.type)}
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 flex-wrap">
                                    <Badge className={getTransactionBadgeColor(transaction.type)}>
                                      {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                                    </Badge>
                                    {transaction.paymentMethod && (
                                      <span className="text-sm text-slate-600">
                                        via {transaction.paymentMethod.replace('_', ' ')}
                                      </span>
                                    )}
                                    {transaction.transactionId && (
                                      <span className="text-xs text-slate-500">
                                        Transaction ID: {transaction.transactionId}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 mt-1">
                                    ID: {transaction.id}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="font-semibold text-lg">
                                    {(() => {
                                      // Determine sign based on transaction type and balance change
                                      if (transaction.type === "charge") return "+";
                                      if (transaction.type === "payment" || transaction.type === "refund") return "-";
                                      // For adjustment, check if balance increased or decreased
                                      if (transaction.type === "adjustment") {
                                        const prev = parseFloat(transaction.previousBalance.toString());
                                        const newBal = parseFloat(transaction.newBalance.toString());
                                        return newBal > prev ? "+" : "-";
                                      }
                                      return "";
                                    })()}
                                    {formatCurrency(transaction.amount)}
                                  </p>
                                </div>
                                {hasTransactionId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleTransactionExpansion(transaction.id)}
                                    className="h-8 w-8 p-0"
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>

                          {/* Details Row */}
                          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500">Previous Balance:</span>
                                <span className="text-sm font-medium text-slate-700">
                                  {formatCurrency(transaction.previousBalance)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500">New Balance:</span>
                                <span className="text-sm font-semibold text-slate-800">
                                  {formatCurrency(transaction.newBalance)}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              {transaction.reference && (
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-slate-500">Reference:</span>
                                  <span className="text-sm text-slate-700">{transaction.reference}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500">Date & Time:</span>
                                <span className="text-xs text-slate-600 flex items-center">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {transaction.createdAt 
                                    ? new Date(transaction.createdAt).toLocaleString(undefined, {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit'
                                      })
                                    : 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Description */}
                          {transaction.description && (
                            <div className="pt-2 border-t border-slate-100">
                              <p className="text-sm text-slate-600">
                                <span className="font-medium">Description:</span> {transaction.description}
                              </p>
                            </div>
                          )}

                          {/* Transaction Items - Expandable */}
                          {hasTransactionId && isExpanded && transaction.transactionId && (
                            <TransactionItemsDisplay 
                              creditTransactionId={transaction.id} 
                              transactionId={transaction.transactionId} 
                            />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}