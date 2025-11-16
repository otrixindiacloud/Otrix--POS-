import { useState } from "react";
import { usePOSStore } from "@/lib/pos-store";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/hooks/useStore";
import { 
  CreditCard, 
  Coins, 
  Tags, 
  ShoppingCart,
  Zap,
  Timer,
  Check,
  AlertTriangle
} from "lucide-react";
import ReceiptModal from "./receipt-modal";

export default function CheckoutBar() {
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
    setResumedHeldTransactionId,
    openPaymentModal
  } = usePOSStore();

  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<any>(null);
  const [transactionItems, setTransactionItems] = useState<any[]>([]);
  const [processingPayment, setProcessingPayment] = useState<string>("");

  const total = getCartTotal();
  const itemCount = cartItems.length;

  const processPaymentMutation = useMutation({
    mutationFn: async (paymentData: any) => {
      if (paymentData.method === "card") {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      if (!currentStore) {
        throw new Error("No store selected. Please select a store before processing payment.");
      }

      const transactionData = {
        transactionNumber: currentTransactionNumber,
        storeId: currentStore.id,
        customerId: currentCustomer?.id || null,
        cashierId: 1,
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
      };

      const transactionResponse = await apiRequest("POST", "/api/transactions", transactionData);

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
      
      if (resumedHeldTransactionId) {
        try {
          await apiRequest("DELETE", `/api/held-transactions/${resumedHeldTransactionId}`);
          setResumedHeldTransactionId(null);
          queryClient.invalidateQueries({ queryKey: ["/api/held-transactions"] });
        } catch (error) {
          console.error("Failed to delete held transaction:", error);
        }
      }
      
      clearCart();
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
      
      // Also invalidate specific product queries for items in the cart
      // Note: cartItems are cleared before this point, so we use transactionItems if available
      if (data.transactionItems && Array.isArray(data.transactionItems)) {
        const productIds = data.transactionItems
          .filter((item: any) => item.productId !== null)
          .map((item: any) => item.productId as number);
        productIds.forEach((productId: number) => {
          queryClient.invalidateQueries({ queryKey: [`/api/products/${productId}`] });
        });
      }
    },
    onError: (error: any) => {
      setProcessingPayment("");
      
      // Check if it's a store selection error
      if (error.message?.includes("No store selected")) {
        toast({
          title: "Store Required",
          description: "Please select a store from the header dropdown before completing checkout",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Payment Failed",
          description: error.message || "Failed to process payment. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const handleQuickPayment = async (method: string) => {
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
    } else if (method === "card") {
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

  if (itemCount === 0) return null;

  return (
    <>
      {/* Store selection warning */}
      {!currentStore && (
        <div className="fixed bottom-16 left-0 right-0 z-50 bg-orange-100 border-t border-orange-200">
          <div className="max-w-7xl mx-auto px-4 py-2">
            <div className="flex items-center justify-center gap-2 text-orange-800">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">
                Please select a store from the header to complete checkout
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Fixed bottom checkout bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-slate-200 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Cart Summary */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <ShoppingCart className="w-5 h-5 text-slate-600" />
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 w-5 h-5 p-0 flex items-center justify-center text-xs font-bold"
                  >
                    {itemCount}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    QR {total.toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {itemCount} {itemCount === 1 ? 'item' : 'items'}
                  </p>
                </div>
              </div>

              {currentCustomer && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {currentCustomer.name?.split(' ')[0] || 'Customer'}
                </Badge>
              )}
            </div>

            {/* Quick Payment Actions */}
            <div className="flex items-center space-x-2">
              {/* Card Payment - Primary */}
              <Button
                onClick={() => handleQuickPayment("card")}
                disabled={processingPayment !== "" || !currentStore}
                className="h-12 px-6 bg-primary hover:bg-primary/90 text-white font-semibold disabled:opacity-50"
              >
                {processingPayment === "card" ? (
                  <div className="flex items-center space-x-2">
                    <Timer className="w-4 h-4 animate-pulse" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <CreditCard className="w-4 h-4" />
                    <span>Card</span>
                  </div>
                )}
              </Button>

              {/* Exact Cash */}
              <Button
                onClick={() => handleQuickPayment("exact-cash")}
                disabled={processingPayment !== "" || !currentStore}
                variant="outline"
                className="h-12 px-4 border-2 border-green-200 hover:bg-green-50 text-green-700 font-semibold disabled:opacity-50"
              >
                {processingPayment === "exact-cash" ? (
                  <Timer className="w-4 h-4 animate-pulse" />
                ) : (
                  <div className="flex items-center space-x-2">
                    <Coins className="w-4 h-4" />
                    <span className="hidden sm:inline">Exact</span>
                  </div>
                )}
              </Button>

              {/* Store Credit (if customer selected) */}
              {currentCustomer && (
                <Button
                  onClick={() => handleQuickPayment("credit")}
                  disabled={processingPayment !== "" || !currentStore}
                  variant="outline"
                  className="h-12 px-4 border-2 border-blue-200 hover:bg-blue-50 text-blue-700 font-semibold disabled:opacity-50"
                >
                  {processingPayment === "credit" ? (
                    <Timer className="w-4 h-4 animate-pulse" />
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Tags className="w-4 h-4" />
                      <span className="hidden sm:inline">Credit</span>
                    </div>
                  )}
                </Button>
              )}

              {/* More Options */}
              <Button
                onClick={openPaymentModal}
                disabled={processingPayment !== "" || !currentStore}
                variant="outline"
                className="h-12 px-4 border-2 border-slate-200 hover:bg-blue-500 font-semibold disabled:opacity-50"
              >
                <div className="flex items-center space-x-1">
                  <span className="text-xs">More</span>
                </div>
              </Button>
            </div>
          </div>

          {/* Processing indicator */}
          {processingPayment && (
            <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-center space-x-2 text-blue-700">
                <Timer className="w-4 h-4 animate-pulse" />
                <span className="text-sm font-medium">Processing {processingPayment} payment...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add bottom padding to main content to prevent overlap */}
      <div className="h-20 md:h-0" />

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