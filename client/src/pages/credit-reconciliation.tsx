import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
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
  Package,
  ArrowLeft,
  Search,
  User
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Customer, CreditTransaction } from "@shared/schema";
import MainLayout from "@/components/layout/main-layout";

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

export default function CreditReconciliationPage() {
  const params = useParams<{ customerId?: string }>();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [expandedTransactions, setExpandedTransactions] = useState<Set<number>>(new Set());
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const customerId = useMemo(() => {
    if (params?.customerId) {
      const id = parseInt(params.customerId, 10);
      return isNaN(id) ? null : id;
    }
    return null;
  }, [params?.customerId]);

  // Fetch all customers for selection
  const { data: allCustomers = [], isLoading: loadingCustomers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    refetchOnMount: true,
    staleTime: 0,
  });

  // Fetch selected customer data
  const { data: customer, isLoading: loadingCustomer } = useQuery<Customer>({
    queryKey: ["/api/customers", customerId],
    queryFn: async () => {
      if (!customerId) return null;
      const response = await apiRequest("GET", `/api/customers/${customerId}`);
      return await response.json();
    },
    enabled: !!customerId,
    refetchOnMount: true,
    staleTime: 0,
  });

  // Fetch credit transactions
  const { data: creditTransactionsResponse, isLoading: loadingHistory, error: historyError, refetch: refetchHistory } = useQuery({
    queryKey: ["/api/credit-transactions", customerId],
    queryFn: async () => {
      if (!customerId) {
        return [];
      }
      try {
        const response = await apiRequest("GET", `/api/credit-transactions?customerId=${customerId}`);
        const data = await response.json();
        const transactions = Array.isArray(data) ? data : (data ? [data] : []);
        return transactions;
      } catch (error) {
        console.error("Error fetching credit transactions:", error);
        return [];
      }
    },
    enabled: !!customerId,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 0,
    retry: 1,
  });

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
      if (!customer) throw new Error("No customer selected");
      
      const currentBalance = parseFloat(customer.creditBalance || "0");
      const amount = parseFloat(data.amount);
      
      let newBalance: number;
      if (data.type === "charge") {
        newBalance = currentBalance + amount;
      } else if (data.type === "payment" || data.type === "refund") {
        newBalance = currentBalance - amount;
      } else if (data.type === "adjustment") {
        newBalance = amount;
      } else {
        newBalance = currentBalance;
      }

      const creditTransactionData = {
        customerId: customer.id,
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
      await queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/credit-transactions"] });
      if (customerId) {
        await queryClient.refetchQueries({ queryKey: ["/api/customers", customerId] });
        await queryClient.invalidateQueries({ queryKey: ["/api/credit-transactions", customerId] });
      }
      form.reset();
      setActiveTab("history");
      if (customerId) {
        setTimeout(async () => {
          await refetchHistory();
        }, 100);
      }
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

  const handleCustomerSelect = (selectedCustomerId: number) => {
    setLocation(`/credit-reconciliation/${selectedCustomerId}`);
  };

  const filteredCustomers = allCustomers.filter((customer: Customer) =>
    customer.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
    customer.email?.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
    customer.phone?.toLowerCase().includes(customerSearchQuery.toLowerCase())
  );

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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
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

  // Customer Selection View
  if (!customerId) {
    return (
      <MainLayout pageTitle="Credit Reconciliation">
        <div className="container mx-auto p-6 max-w-4xl">
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => setLocation("/customers")}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Customers
            </Button>
            <div className="flex items-center gap-3 mb-2">
              <CreditCard className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold">Credit Reconciliation</h1>
            </div>
            <p className="text-slate-600">Select a customer to manage their credit transactions</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Select Customer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search customers by name, email, or phone..."
                    value={customerSearchQuery}
                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {loadingCustomers ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-slate-600 mt-2">Loading customers...</p>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <User className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p>No customers found</p>
                  {customerSearchQuery && (
                    <p className="text-sm mt-2">Try a different search term</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {filteredCustomers.map((customer: Customer) => (
                    <div
                      key={customer.id}
                      onClick={() => handleCustomerSelect(customer.id)}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-blue-700 font-semibold">
                            {customer.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{customer.name}</p>
                          {customer.email && (
                            <p className="text-sm text-slate-500">{customer.email}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-700">
                          {formatCurrency(customer.creditBalance || "0")}
                        </p>
                        <p className="text-xs text-slate-500">Credit Balance</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  // Main Reconciliation View
  return (
    <MainLayout pageTitle={`Credit Reconciliation - ${customer?.name || "Loading..."}`}>
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => setLocation("/credit-reconciliation")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Customer Selection
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <CreditCard className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold">Credit Reconciliation</h1>
          </div>
          {customer && (
            <p className="text-slate-600">
              Managing credit for <span className="font-semibold">{customer.name}</span>
            </p>
          )}
        </div>

        {/* Customer Credit Summary */}
        <Card className="mb-6">
          <CardContent className="p-6">
            {loadingCustomer ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-sm text-slate-600">Loading customer data...</span>
              </div>
            ) : customer ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Current Credit Balance</p>
                  <p className="text-3xl font-bold text-slate-800">
                    {formatCurrency(customer.creditBalance || "0")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-1">Credit Limit</p>
                  <p className="text-2xl font-semibold text-slate-700">
                    {formatCurrency(customer.creditLimit || "0")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-1">Available Credit</p>
                  <p className="text-2xl font-semibold text-green-600">
                    {formatCurrency(
                      parseFloat(customer.creditLimit || "0") - parseFloat(customer.creditBalance || "0")
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-slate-500">
                Customer not found
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 mb-6">
          <button
            onClick={() => setActiveTab("new")}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "new"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            New Transaction
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
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
        {activeTab === "new" && customer && (
          <Card>
            <CardHeader>
              <CardTitle>Record New Credit Transaction</CardTitle>
            </CardHeader>
            <CardContent>
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
                  <Button 
                    type="submit" 
                    disabled={createCreditTransactionMutation.isPending}
                    size="lg"
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
            </CardContent>
          </Card>
        )}

        {/* Transaction History Tab */}
        {activeTab === "history" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Transaction History</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await queryClient.invalidateQueries({ queryKey: ["/api/credit-transactions", customerId] });
                    await refetchHistory();
                  }}
                  disabled={loadingHistory}
                >
                  <History className="w-4 h-4 mr-2" />
                  {loadingHistory ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
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
                  <div className="max-h-[600px] overflow-y-auto space-y-3 pr-2">
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
                                        if (transaction.type === "charge") return "+";
                                        if (transaction.type === "payment" || transaction.type === "refund") return "-";
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
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}

