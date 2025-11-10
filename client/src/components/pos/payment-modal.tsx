import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { usePOSStore } from "@/lib/pos-store";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/hooks/useStore";
import { 
  CreditCard, 
  Coins, 
  Tags, 
  Shuffle,
  Check,
  X,
  Receipt,
  Printer,
  MessageCircle,
  Download,
  Mail
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import ReceiptModal from "./receipt-modal";

export default function PaymentModal() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentStore } = useStore();
  const { user } = useAuth();
  const {
    isPaymentModalOpen,
    closePaymentModal,
    openPaymentModal,
    cartItems,
    currentCustomer,
    currentTransactionNumber,
    resumedHeldTransactionId,
    getCartSubtotal,
    getCartTax,
    getCartTotal,
    getTransactionDiscount,
    clearCart,
    clearTransactionDiscount,
    setResumedHeldTransactionId
  } = usePOSStore();
  const [, navigate] = useLocation();

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [cashTendered, setCashTendered] = useState<string>("");
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<any>(null);
  const [transactionItems, setTransactionItems] = useState<any[]>([]);
  const [generatedInvoice, setGeneratedInvoice] = useState<any>(null);
  const [whatsappLink, setWhatsappLink] = useState<string>("");
  const [shouldAutoPrint, setShouldAutoPrint] = useState(false);

  // Fetch fresh customer data when store credit is selected to ensure we have latest balance
  const { data: freshCustomerData, isLoading: isLoadingCustomer } = useQuery({
    queryKey: ["/api/customers", currentCustomer?.id],
    queryFn: async () => {
      if (!currentCustomer?.id) return null;
      const response = await apiRequest("GET", `/api/customers/${currentCustomer.id}`);
      return await response.json();
    },
    enabled: isPaymentModalOpen && selectedPaymentMethod === "credit" && !!currentCustomer?.id,
    refetchOnMount: true,
    staleTime: 0, // Always fetch fresh data
  });

  // Use fresh customer data if available, otherwise fall back to currentCustomer from store
  const displayCustomer = freshCustomerData || currentCustomer;

  // Refetch customer data when payment method changes to credit
  useEffect(() => {
    if (selectedPaymentMethod === "credit" && currentCustomer?.id) {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", currentCustomer.id] });
    }
  }, [selectedPaymentMethod, currentCustomer?.id, queryClient]);

  // Auto-close receipt modal when new items are added to cart
  useEffect(() => {
    if (showReceiptModal && cartItems.length > 0) {
      // User is starting a new order, close the receipt modal
      setShowReceiptModal(false);
      setShouldAutoPrint(false);
      setCompletedTransaction(null);
      setTransactionItems([]);
      setGeneratedInvoice(null);
      setWhatsappLink("");
    }
  }, [cartItems.length, showReceiptModal]);

  // Enhanced validation and calculations with better error handling
  const subtotal = getCartSubtotal();
  const tax = getCartTax();
  const transactionDiscount = getTransactionDiscount();
  const total = subtotal + tax - transactionDiscount;
  
  // Cash amount validation with numeric checks
  const parsedCash = parseFloat(cashTendered);
  const safeCashTendered = isNaN(parsedCash) || parsedCash < 0 ? 0 : parsedCash;
  const changeDue = safeCashTendered > 0 ? Math.max(0, safeCashTendered - total) : 0;

  // Enhanced payment validation rules
  const isCashNumeric = cashTendered === "" || (!isNaN(parsedCash) && parsedCash >= 0);
  const isValidCashAmount = selectedPaymentMethod !== "cash" || (isCashNumeric && safeCashTendered >= total);
  
  // Credit payment validation
  const creditBalance = displayCustomer ? parseFloat(String(displayCustomer.creditBalance || "0")) : 0;
  const creditLimit = displayCustomer ? parseFloat(String(displayCustomer.creditLimit || "0")) : 0;
  const availableCredit = creditLimit - creditBalance;
  const hasEnoughCredit = selectedPaymentMethod !== "credit" || (displayCustomer && availableCredit >= total);
  
  const canProcessPayment = cartItems.length > 0 && selectedPaymentMethod && 
    (selectedPaymentMethod !== "cash" || isValidCashAmount) && 
    (selectedPaymentMethod !== "cash" || isCashNumeric) &&
    hasEnoughCredit &&
    (selectedPaymentMethod !== "credit" || displayCustomer);

  // Helper function to process payment with retry logic for authentication errors
  const processPaymentWithRetry = async (paymentData: any, retryCount = 0): Promise<any> => {
    try {
      // For card payments, simulate POS terminal processing
      if (paymentData.method === "card") {
        // Simulate card processing delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // In real implementation, this would communicate with QNB POS terminal
      }

      if (!currentStore) {
        throw new Error("No store selected. Please select a store before processing payment.");
      }

      // Get transaction-level discount
      const totalDiscount = getTransactionDiscount();

      // Prepare transaction data
      const transactionPayload = {
        transactionNumber: currentTransactionNumber,
        customerId: currentCustomer?.id || null,
        cashierId: user?.id || null,
        storeId: currentStore.id,
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        vatAmount: tax.toFixed(2), // VAT amount same as tax
        discountAmount: totalDiscount.toFixed(2),
        promotionDiscountAmount: "0.00", // No promotion discounts
        total: total.toFixed(2),
        status: "completed",
        paymentMethod: paymentData.method,
        cashTendered: paymentData.cashTendered || null,
        cardType: paymentData.cardType || null,
        cardLast4: paymentData.cardLast4 || null,
        authCode: paymentData.authCode || null,
        currency: "QAR",
        exchangeRate: "1.000000",
        baseCurrencyTotal: total.toFixed(2),
        orderType: "pos",
        tipAmount: null,
        items: cartItems.filter(item => !item.sku?.startsWith('DISCOUNT-')).map(item => {
          const baseTotal = parseFloat(item.price) * item.quantity;
          const discountAmount = item.discountAmount ? parseFloat(item.discountAmount) : 0;
          let calculatedDiscount = 0;
          
          if (item.discountType === 'percentage' && discountAmount > 0) {
            calculatedDiscount = baseTotal * (discountAmount / 100);
          } else if (item.discountType === 'fixed' && discountAmount > 0) {
            calculatedDiscount = discountAmount;
          }
          
          return {
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.price,
            total: item.total,
            vatRate: "5.00",
            vatAmount: ((Number(item.total) * 0.05) / 1.05).toFixed(2),
            discountAmount: calculatedDiscount.toFixed(2),
            originalUnitPrice: item.price
          };
        })
      };

      console.log("Sending transaction payload:", JSON.stringify(transactionPayload, null, 2));

      // Create transaction with proper request format
      const transactionResponse = await apiRequest("POST", "/api/transactions", transactionPayload);

      return transactionResponse;
    } catch (error: any) {
      // If authentication error and we haven't retried yet, try once more
      if (retryCount === 0 && (
        error?.message?.includes("Session expired") || 
        error?.message?.includes("Unauthorized") ||
        error?.response?.status === 401
      )) {
        console.log("Authentication error detected, retrying payment...");
        
        // Wait a moment for any automatic session refresh to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Retry the payment once
        return processPaymentWithRetry(paymentData, retryCount + 1);
      }
      
      // If not an auth error or already retried, throw the error
      throw error;
    }
  };

  const processPaymentMutation = useMutation({
    mutationFn: processPaymentWithRetry,
    onSuccess: async (response: any) => {
      toast({
        title: "Payment Processed",
        description: "Transaction completed successfully",
      });
      
      const data = await response.json();
      // Store transaction data for receipt  
      setCompletedTransaction(data.transaction || data);
      setTransactionItems(data.transactionItems || []);
      if (data.generatedInvoice) {
        setGeneratedInvoice(data.generatedInvoice);
      }
      if (data.whatsappLink) {
        setWhatsappLink(data.whatsappLink);
      }
      
      // If this was a resumed held transaction, delete it
      if (resumedHeldTransactionId) {
        try {
          await apiRequest("DELETE", `/api/held-transactions/${resumedHeldTransactionId}`);
          
          // Clear the held transaction ID
          setResumedHeldTransactionId(null);
          
          // Invalidate held transactions cache
          queryClient.invalidateQueries({ queryKey: ["/api/held-transactions"] });
          
          toast({
            title: "Held Transaction Removed",
            description: "The held transaction has been automatically removed.",
          });
        } catch (error) {
          console.error("Failed to delete held transaction:", error);
          // Don't show error to user as payment was successful
        }
      }
      
      // Clear cart and transaction discount, then close payment modal
      clearCart();
      clearTransactionDiscount();
      closePaymentModal();
      
      // Invalidate customer data if it was a credit payment to refresh balance
      if (data.transaction?.paymentMethod === 'credit' && currentCustomer?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/customers", currentCustomer.id] });
      }
      
      // Dispatch event to clear search bar
      window.dispatchEvent(new CustomEvent("paymentSuccess"));
      
      // Check printer configuration for auto-print setting
      let autoPrintEnabled = true; // Default to true for automatic printing
      try {
        const savedConfig = localStorage.getItem('pos_printer_config');
        if (savedConfig) {
          const printerConfig = JSON.parse(savedConfig);
          autoPrintEnabled = printerConfig?.settings?.autoPrint !== false;
        }
        console.log("Auto-print setting:", autoPrintEnabled, "Config:", savedConfig ? "Found" : "Not found");
      } catch (e) {
        console.error("Error reading printer config:", e);
      }
      
      // Enable auto-print based on configuration and show receipt modal
      setShouldAutoPrint(autoPrintEnabled);
      setShowReceiptModal(true);
      
      console.log("Payment success - Setting up receipt modal with autoPrint:", autoPrintEnabled);
      
      // Invalidate transactions and products to refresh stock in real-time
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
    onError: (error: any) => {
      console.error("Payment error:", error);
      console.error("Error response:", error?.response);
      console.error("Error data:", error?.response?.data);
      
      // Enhanced error handling with specific error codes
      const errorCode = error?.response?.data?.code;
      const errorMessage = error?.response?.data?.message || error?.message;
      const errorDetails = error?.response?.data?.details;
      const receivedData = error?.response?.data?.receivedData;
      
      console.log("Payment failed with details:", {
        errorCode,
        errorMessage,
        errorDetails,
        receivedData
      });
      
      let title = "Payment Failed";
      let description = errorMessage || "Failed to process payment. Please try again.";
      
      // If we have validation details, show them
      if (errorDetails) {
        description = `${errorMessage}: ${errorDetails}`;
      }
      
      // Handle authentication errors specifically
      if (errorMessage?.includes("Session expired") || errorMessage?.includes("Unauthorized")) {
        title = "Session Expired";
        description = "Your session has expired. Please refresh the page and try again.";
        
        toast({
          title,
          description,
          variant: "destructive",
          action: (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </Button>
          ),
        });
        return;
      }
      
      // Handle specific error codes from backend
      if (errorCode === "DAY_NOT_OPEN") {
        title = "Day Not Open";
        description = "No day operation is currently open. Please open a day before creating transactions.";

        closePaymentModal();
        navigate("/till?intent=open");

        toast({
          title,
          description,
          variant: "destructive",
        });
        return;
      }
      
      if (errorCode === "DATE_MISMATCH") {
        title = "Date Mismatch - Day Operations Required";
        const openDayDate = error?.response?.data?.openDayDate;
        const transactionDate = error?.response?.data?.transactionDate;
        description = `The current open day is ${openDayDate}, but you're trying to create a transaction for ${transactionDate}. You need to close the old day (${openDayDate}) and open a new day for today (${transactionDate}).`;
        
        closePaymentModal();
        
        // Close the payment modal and show helpful toast with actions
        toast({
          title,
          description,
          variant: "destructive",
          duration: 10000, // Show for 10 seconds
          action: (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  navigate("/till?intent=close");
                }}
                className="whitespace-nowrap"
              >
                Close Day
              </Button>
            </div>
          ),
        });
        return;
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    },
  });

  const handlePayment = async (method: string) => {
    if (method === "cash") {
      if (!cashTendered || cashTendered.trim() === "") {
        toast({
          title: "Amount Required",
          description: "Please enter the amount tendered",
          variant: "destructive",
        });
        return;
      }
      if (safeCashTendered < total) {
        toast({
          title: "Insufficient Amount",
          description: `Amount tendered (QR ${safeCashTendered.toFixed(2)}) is less than the total (QR ${total.toFixed(2)})`,
          variant: "destructive",
        });
        return;
      }
    }

    // Validate credit payment
    if (method === "credit") {
      if (!displayCustomer) {
        toast({
          title: "No Customer Selected",
          description: "Please select a customer for credit payment",
          variant: "destructive",
        });
        return;
      }

      const creditBalance = parseFloat(String(displayCustomer.creditBalance || "0"));
      const creditLimit = parseFloat(String(displayCustomer.creditLimit || "0"));
      const availableCredit = creditLimit - creditBalance;

      if (availableCredit < total) {
        toast({
          title: "Insufficient Credit",
          description: `Customer has only QR ${availableCredit.toFixed(2)} available credit. Required: QR ${total.toFixed(2)}`,
          variant: "destructive",
        });
        return;
      }
    }

    let paymentData: any = { method };

    if (method === "cash") {
      paymentData.cashTendered = cashTendered;
    } else if (method === "card") {
      // For card payments, simulate getting data from QNB POS terminal
      toast({
        title: "Processing Card Payment",
        description: "Please wait while we process the payment through QNB terminal...",
      });
      
      // Simulate card processing - in real implementation, this would interface with QNB POS
      paymentData.cardType = "Visa"; // Would come from POS terminal
      paymentData.cardLast4 = "1234"; // Would come from POS terminal
      paymentData.authCode = Math.random().toString(36).substr(2, 6).toUpperCase(); // Would come from POS terminal
    }

    processPaymentMutation.mutate(paymentData);
  };

  // Add event listener for quick payments
  useEffect(() => {
    const handleQuickPayment = (event: CustomEvent) => {
      const { method } = event.detail;
      
      if (cartItems.length === 0) {
        toast({
          title: "Cart Empty",
          description: "Please add items to cart before processing payment",
          variant: "destructive",
        });
        return;
      }

      // IMPORTANT: Only auto-process if payment modal is NOT already open
      // This prevents accidental auto-payments when modal is visible
      if (isPaymentModalOpen) {
        console.log("Payment modal already open, ignoring quick payment event");
        return;
      }

      // Open payment modal first
      openPaymentModal();
      
      // Set payment method after a brief delay
      setTimeout(() => {
        if (method === "card") {
          setSelectedPaymentMethod("card");
          // Auto-process card payment
          handlePayment("card");
        } else if (method === "exact-cash") {
          setSelectedPaymentMethod("cash");
          setCashTendered(total.toFixed(2));
          // Auto-process exact cash payment
          setTimeout(() => handlePayment("cash"), 100);
        }
      }, 100);
    };

    window.addEventListener("quickPayment", handleQuickPayment as EventListener);
    
    return () => {
      window.removeEventListener("quickPayment", handleQuickPayment as EventListener);
    };
  }, [cartItems.length, total, openPaymentModal, handlePayment, toast, isPaymentModalOpen]);

  if (!isPaymentModalOpen) return null;

  return (
    <>
      <Dialog open={isPaymentModalOpen} onOpenChange={closePaymentModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span>Process Payment</span>
            <span className="text-2xl font-bold text-primary">
              QR   {total.toFixed(2)}
            </span>
          </DialogTitle>
          <DialogDescription>
            Select a payment method and complete the transaction for the current cart.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar"
             style={{ scrollbarWidth: 'thin', scrollbarColor: '#CBD5E1 transparent' }}>
          {/* Payment Methods */}
          <div className="grid grid-cols-3 gap-4">
            <Button
              variant={selectedPaymentMethod === "card" ? "default" : "outline"}
              onClick={() => setSelectedPaymentMethod("card")}
              className="p-4 h-auto flex-col space-y-2 touch-friendly"
            >
              <CreditCard className="w-8 h-8" />
              <div className="text-center">
                <p className="font-semibold">QNB Card Terminal</p>
                <p className="text-xs opacity-75">Tap, Insert, or Swipe</p>
              </div>
            </Button>

            <Button
              variant={selectedPaymentMethod === "cash" ? "default" : "outline"}
              onClick={() => setSelectedPaymentMethod("cash")}
              className="p-4 h-auto flex-col space-y-2 touch-friendly"
            >
              <Coins className="w-8 h-8" />
              <div className="text-center">
                <p className="font-semibold">Cash Payment</p>
                <p className="text-xs opacity-75">Manual Entry</p>
              </div>
            </Button>

            <Button
              variant={selectedPaymentMethod === "credit" ? "default" : "outline"}
              onClick={() => setSelectedPaymentMethod("credit")}
              className="p-4 h-auto flex-col space-y-2 touch-friendly"
              disabled={!currentCustomer}
            >
              <Tags className="w-8 h-8" />
              <div className="text-center">
                <p className="font-semibold">Store Credit</p>
                <p className="text-xs opacity-75">Customer Account</p>
              </div>
            </Button>

            {/* Split payment temporarily disabled - not fully implemented */}
            {/* <Button
              variant={selectedPaymentMethod === "split" ? "default" : "outline"}
              onClick={() => setSelectedPaymentMethod("split")}
              className="p-4 h-auto flex-col space-y-2 touch-friendly"
            >
              <Shuffle className="w-8 h-8" />
              <div className="text-center">
                <p className="font-semibold">Split Payment</p>
                <p className="text-xs opacity-75">Multiple Methods</p>
              </div>
            </Button> */}
          </div>

          {/* Cash Payment Fields */}
          {selectedPaymentMethod === "cash" && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
              <Label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                Amount Tendered
              </Label>
              <div className="relative mb-4">
                <Input
                  type="number"
                  placeholder="50"
                  step="0.01"
                  min="0"
                  value={cashTendered}
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    // Allow empty input or valid numeric values
                    if (inputValue === "" || (!isNaN(parseFloat(inputValue)) && parseFloat(inputValue) >= 0)) {
                      setCashTendered(inputValue);
                    }
                  }}
                  className={`text-xl font-bold h-14 touch-friendly ${!isCashNumeric || (!isValidCashAmount && cashTendered !== "") ? 'border-amber-400 dark:border-amber-600 focus:border-amber-500 dark:focus:border-amber-500' : 'border-slate-300 focus:border-primary'}`}
                />
                {!isCashNumeric && (
                  <div className="flex items-start gap-2 mt-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-800 dark:text-amber-200 font-medium">
                      Please enter a valid numeric amount
                    </p>
                  </div>
                )}
                {isCashNumeric && !isValidCashAmount && cashTendered !== "" && (
                  <div className="flex items-start gap-2 mt-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-800 dark:text-amber-200 font-medium">
                      Amount tendered must be at least QR {total.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex justify-between items-center mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Change Due:</span>
                <span className="text-2xl font-black text-green-600 dark:text-green-400">
                  QR {changeDue.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Credit Account Info */}
          {selectedPaymentMethod === "credit" && displayCustomer && (
            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">{displayCustomer.name}</h4>
              {isLoadingCustomer ? (
                <div className="flex items-center justify-center py-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-xs text-slate-600">Loading customer data...</span>
                </div>
              ) : (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Current Balance:</span>
                    <span className="font-medium">
                      QR {parseFloat(String(displayCustomer.creditBalance || "0")).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Credit Limit:</span>
                    <span className="font-medium">
                      QR {parseFloat(String(displayCustomer.creditLimit || "0")).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                    <span>Available Credit:</span>
                    <span className="text-green-600">
                      QR {(
                        parseFloat(String(displayCustomer.creditLimit || "0")) - 
                        parseFloat(String(displayCustomer.creditBalance || "0"))
                      ).toFixed(2)}
                    </span>
                  </div>
                  {total > 0 && (
                    <div className="flex justify-between font-semibold border-t pt-1 mt-1 text-xs">
                      <span>Transaction Total:</span>
                      <span className={total > (parseFloat(String(displayCustomer.creditLimit || "0")) - parseFloat(String(displayCustomer.creditBalance || "0"))) ? "text-red-600" : "text-slate-700"}>
                        QR {total.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Order Summary */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
            <h4 className="font-semibold mb-2">Order Summary</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>QR {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax:</span>
                <span>QR {tax.toFixed(2)}</span>
              </div>
              {transactionDiscount > 0 && (
                <div className="flex justify-between text-green-600 dark:text-green-400">
                  <span>Discount:</span>
                  <span>-QR {transactionDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-lg border-t pt-1">
                <span>Total:</span>
                <span>QR {total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>



        {/* Invoice Actions - Show after successful payment */}
        {generatedInvoice && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h4 className="font-semibold mb-3 flex items-center">
              <Receipt className="w-4 h-4 mr-2" />
              Invoice Generated
            </h4>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(generatedInvoice.pdfUrl, '_blank')}
                className="text-xs"
              >
                <Download className="w-3 h-3 mr-1" />
                Download PDF
              </Button>
              
              {whatsappLink && (
                <a 
                  href={whatsappLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    <MessageCircle className="w-3 h-3 mr-1" />
                    WhatsApp
                  </Button>
                </a>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.share?.({ 
                  title: `Invoice ${generatedInvoice.invoiceNumber}`,
                  url: generatedInvoice.pdfUrl 
                })}
                className="text-xs"
              >
                <Mail className="w-3 h-3 mr-1" />
                Share
              </Button>
            </div>
          </div>
        )}

        {/* Sticky Action Buttons Footer */}
        <div className="flex-shrink-0 border-t bg-white dark:bg-gray-900 pt-4 mt-4">
          <div className="flex space-x-3">
            <Button 
              variant="outline" 
              onClick={closePaymentModal}
              className="flex-1 touch-friendly h-12"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            
            <Button
              onClick={() => handlePayment(selectedPaymentMethod)}
              disabled={!canProcessPayment || processPaymentMutation.isPending}
              className="flex-1 bg-green-600 hover:bg-green-700 touch-friendly disabled:opacity-50 h-12"
            >
              <Check className="w-4 h-4 mr-2" />
              {processPaymentMutation.isPending ? "Processing..." : "Complete Sale"}
            </Button>
          </div>
          {!canProcessPayment && selectedPaymentMethod && (
            <div className="flex items-center justify-center mt-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-800 dark:text-amber-200 font-medium text-center">
                {cartItems.length === 0 ? "Cart is empty" :
                 !isCashNumeric ? "Cash amount must be numeric" :
                 !isValidCashAmount ? `Amount tendered must be at least QR ${total.toFixed(2)}` :
                 selectedPaymentMethod === "credit" && !displayCustomer ? "Please select a customer for credit payment" :
                 selectedPaymentMethod === "credit" && !hasEnoughCredit ? `Insufficient credit. Available: QR ${availableCredit.toFixed(2)}, Required: QR ${total.toFixed(2)}` :
                 "Please check payment details"}
              </p>
            </div>
          )}
        </div>
        </DialogContent>
      </Dialog>

      {showReceiptModal && (
        <ReceiptModal
          isOpen={showReceiptModal}
          onClose={() => {
            setShowReceiptModal(false);
            setShouldAutoPrint(false); // Reset auto-print flag
          }}
          transaction={completedTransaction}
          transactionItems={transactionItems}
          customer={currentCustomer}
          autoPrint={shouldAutoPrint}
        />
      )}
    </>
  );
}
