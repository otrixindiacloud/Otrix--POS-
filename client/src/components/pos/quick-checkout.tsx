import { useState } from "react";
import { usePOSStore } from "@/lib/pos-store";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/hooks/useStore";
import { 
  CreditCard, 
  Coins, 
  Tags, 
  Zap,
  Calculator,
  Check,
  X,
  Receipt,
  Timer
} from "lucide-react";
import ReceiptModal from "./receipt-modal";

export default function QuickCheckout() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentStore } = useStore();
  const {
    cartItems,
    currentCustomer,
    currentTransactionNumber,
    resumedHeldTransactionId,
    getCartSubtotal,
    getCartVAT,
    getCartTotal,
    clearCart,
    setResumedHeldTransactionId
  } = usePOSStore();

  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<any>(null);
  const [transactionItems, setTransactionItems] = useState<any[]>([]);
  const [cashAmount, setCashAmount] = useState<string>("");
  const [processingPayment, setProcessingPayment] = useState<string>("");

  const total = getCartTotal();
  const safeCashAmount = Math.max(0, parseFloat(cashAmount) || 0);
  const changeDue = safeCashAmount > 0 ? Math.max(0, safeCashAmount - total) : 0;

  // Common cash amounts for quick selection
  const suggestedCashAmounts = [
    Math.ceil(total), // Rounded up to nearest dollar
    Math.ceil(total / 5) * 5, // Rounded up to nearest $5
    Math.ceil(total / 10) * 10, // Rounded up to nearest $10
    Math.ceil(total / 20) * 20, // Rounded up to nearest $20
  ].filter((amount, index, arr) => arr.indexOf(amount) === index && amount > total);

  const processPaymentMutation = useMutation({
    mutationFn: async (paymentData: any) => {
      // For card payments, simulate POS terminal processing
      if (paymentData.method === "card") {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      if (!currentStore) {
        throw new Error("No store selected. Please select a store before processing payment.");
      }

      // Create transaction with proper request format
      const transactionResponse = await apiRequest("POST", "/api/transactions", {
        transactionNumber: currentTransactionNumber,
        storeId: currentStore.id,
        customerId: currentCustomer?.id || null,
        cashierId: 1, // Default cashier
        subtotal: getCartSubtotal().toFixed(2),
        tax: getCartVAT().toFixed(2),
        total: total.toFixed(2),
        status: "completed",
        paymentMethod: paymentData.method,
        cashTendered: paymentData.cashTendered || null,
        cardType: paymentData.cardType || null,
        cardLast4: paymentData.cardLast4 || null,
        authCode: paymentData.authCode || null,
        items: cartItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.price,
          total: item.total
        }))
      });

      return transactionResponse;
    },
    onSuccess: async (response: any) => {
      setProcessingPayment("");
      toast({
        title: "Payment Processed",
        description: `Transaction completed successfully`,
      });
      
      const data = await response.json();
      setCompletedTransaction(data.transaction || data);
      setTransactionItems(data.transactionItems || []);
      
      // If this was a resumed held transaction, delete it
      if (resumedHeldTransactionId) {
        try {
          await apiRequest("DELETE", `/api/held-transactions/${resumedHeldTransactionId}`);
          setResumedHeldTransactionId(null);
          queryClient.invalidateQueries({ queryKey: ["/api/held-transactions"] });
        } catch (error) {
          console.error("Failed to delete held transaction:", error);
        }
      }
      
      // Clear cart and show receipt
      clearCart();
      setCashAmount("");
      setShowReceiptModal(true);
      
      // Invalidate queries to refresh stock and transactions
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      // Invalidate all product queries (including specific product detail pages)
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return typeof key === 'string' && key.startsWith('/api/products');
        }
      });
      if (currentStore?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/stores", currentStore.id, "products"] });
      }
      
      // Also invalidate specific product queries for items in the transaction
      if (data.transactionItems && Array.isArray(data.transactionItems)) {
        const productIds = data.transactionItems
          .filter((item: any) => item.productId !== null)
          .map((item: any) => item.productId as number);
        productIds.forEach((productId: number) => {
          queryClient.invalidateQueries({ queryKey: [`/api/products/${productId}`] });
        });
      }
    },
    onError: (error) => {
      setProcessingPayment("");
      toast({
        title: "Payment Failed",
        description: "Failed to process payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleQuickPayment = async (method: string, amount?: number) => {
    if (cartItems.length === 0) return;
    
    // Check for store selection first
    if (!currentStore) {
      toast({
        title: "No Store Selected",
        description: "Please select a store from the header before processing payment",
        variant: "destructive",
      });
      return;
    }
    
    setProcessingPayment(method);
    
    let paymentData: any = { method };

    if (method === "exact-cash") {
      paymentData.method = "cash";
      paymentData.cashTendered = total.toFixed(2);
    } else if (method === "cash") {
      if (!amount) {
        setProcessingPayment("");
        toast({
          title: "Amount Required",
          description: "Please select a cash amount",
          variant: "destructive",
        });
        return;
      }
      if (amount < total) {
        setProcessingPayment("");
        toast({
          title: "Insufficient Amount",
          description: `Amount (QR ${amount.toFixed(2)}) is less than the total (QR ${total.toFixed(2)})`,
          variant: "destructive",
        });
        return;
      }
      paymentData.cashTendered = amount.toFixed(2);
    } else if (method === "card") {
      // Simulate card processing
      toast({
        title: "Processing Card Payment",
        description: "Please wait for card terminal...",
      });
      
      paymentData.cardType = "Visa";
      paymentData.cardLast4 = "1234";
      paymentData.authCode = Math.random().toString(36).substr(2, 6).toUpperCase();
    } else if (method === "credit") {
      if (!currentCustomer) {
        setProcessingPayment("");
        toast({
          title: "No Customer Selected",
          description: "Please select a customer for credit payment",
          variant: "destructive",
        });
        return;
      }
      
      const availableCredit = parseFloat(String(currentCustomer.creditLimit || "0")) - 
                             parseFloat(String(currentCustomer.creditBalance || "0"));
      
      if (availableCredit < total) {
        setProcessingPayment("");
        toast({
          title: "Insufficient Credit",
          description: `Customer has only QR ${availableCredit.toFixed(2)} available credit`,
          variant: "destructive",
        });
        return;
      }
    }

    processPaymentMutation.mutate(paymentData);
  };

  const handleCustomCash = () => {
    const amount = parseFloat(cashAmount);
    if (amount >= total) {
      handleQuickPayment("cash", amount);
    } else {
      toast({
        title: "Insufficient Amount",
        description: "Cash amount must be at least the total",
        variant: "destructive",
      });
    }
  };

  if (cartItems.length === 0) {
    return (
      <Card className="bg-slate-50">
        <CardContent className="p-6 text-center">
          <CreditCard className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600">Add items to cart to checkout</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-card border-2 border-primary/20">
        <CardContent className="p-4 space-y-4">
          {/* Total Display */}
          <div className="text-center space-y-1">
            <p className="text-sm text-slate-600">Total Amount</p>
            <p className="text-3xl font-bold text-primary">QR {total.toFixed(2)}</p>
            <Badge variant="outline" className="text-xs">
              {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}
            </Badge>
          </div>

          {/* Quick Payment Buttons */}
          <div className="space-y-3">
            {/* Card Payment - Most Common */}
            <Button
              onClick={() => handleQuickPayment("card")}
              disabled={processingPayment !== "" || !currentStore}
              className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 relative disabled:opacity-50"
            >
              {processingPayment === "card" ? (
                <div className="flex items-center space-x-2">
                  <Timer className="w-5 h-5 animate-pulse" />
                  <span>Processing...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <CreditCard className="w-5 h-5" />
                  <span>Card Payment</span>
                  <Badge variant="secondary" className="ml-auto bg-white/20">
                    Quick
                  </Badge>
                </div>
              )}
            </Button>

            {/* Exact Cash */}
            <Button
              onClick={() => handleQuickPayment("exact-cash")}
              disabled={processingPayment !== "" || !currentStore}
              variant="outline"
              className="w-full h-12 text-base font-semibold border-2 hover:bg-muted disabled:opacity-50"
            >
              {processingPayment === "exact-cash" ? (
                <div className="flex items-center space-x-2">
                  <Timer className="w-5 h-5 animate-pulse" />
                  <span>Processing...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Coins className="w-5 h-5 text-green-600" />
                  <span>Exact Cash</span>
                  <span className="ml-auto text-green-600 font-bold">QR {total.toFixed(2)}</span>
                </div>
              )}
            </Button>

            {/* Customer Credit */}
            {currentCustomer && (
              <Button
                onClick={() => handleQuickPayment("credit")}
                disabled={processingPayment !== "" || !currentStore}
                variant="outline"
                className="w-full h-12 text-base font-semibold border-2 border-blue-200 hover:bg-blue-50 disabled:opacity-50"
              >
                {processingPayment === "credit" ? (
                  <div className="flex items-center space-x-2">
                    <Timer className="w-5 h-5 animate-pulse" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Tags className="w-5 h-5 text-blue-600" />
                    <span>Store Credit</span>
                    <Badge variant="secondary" className="ml-auto bg-blue-100 text-blue-700">
                      {currentCustomer.name?.split(' ')[0] || 'Customer'}
                    </Badge>
                  </div>
                )}
              </Button>
            )}

            {/* Quick Cash Amounts */}
            {suggestedCashAmounts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600 flex items-center">
                  <Calculator className="w-3 h-3 mr-1" />
                  Quick Cash Amounts
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {suggestedCashAmounts.slice(0, 4).map((amount) => (
                    <Button
                      key={amount}
                      onClick={() => handleQuickPayment("cash", amount)}
                      disabled={processingPayment !== "" || !currentStore}
                      variant="outline"
                      size="sm"
                      className="h-10 text-sm font-medium border border-orange-200 hover:bg-orange-50 disabled:opacity-50"
                    >
                      {processingPayment === "cash" ? (
                        <Timer className="w-4 h-4 animate-pulse" />
                      ) : (
                        <div className="flex flex-col">
                          <span>QR {amount}</span>
                          <span className="text-xs text-orange-600">
                            Change: QR {(amount - total).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Cash Amount */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-600">Custom Cash Amount</p>
              <div className="flex space-x-2">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">
                    QR
                  </span>
                  <Input
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    min={total.toFixed(2)}
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    className="pl-10 h-10 text-base"
                  />
                </div>
                <Button
                  onClick={handleCustomCash}
                  disabled={processingPayment !== "" || !cashAmount || parseFloat(cashAmount) < total || !currentStore}
                  size="sm"
                  className="h-10 px-4 disabled:opacity-50"
                >
                  {processingPayment === "cash" ? (
                    <Timer className="w-4 h-4 animate-pulse" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                </Button>
              </div>
              {cashAmount && parseFloat(cashAmount) >= total && (
                <p className="text-xs text-green-600 flex items-center">
                  <Calculator className="w-3 h-3 mr-1" />
                  Change: QR {changeDue.toFixed(2)}
                </p>
              )}
            </div>
          </div>

          {/* Processing Indicator */}
          {processingPayment && (
            <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-center space-x-2 text-blue-700">
                <Timer className="w-5 h-5 animate-pulse" />
                <span className="font-medium">Processing payment...</span>
              </div>
              <p className="text-xs text-blue-600 mt-1">Please wait</p>
            </div>
          )}
        </CardContent>
      </Card>

      <ReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        transaction={completedTransaction}
        transactionItems={transactionItems}
        customer={currentCustomer}
      />
    </>
  );
}