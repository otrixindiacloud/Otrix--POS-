import { Plus, Percent, RotateCcw, Pause, CreditCard, Coins, Tags, Printer, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePOSStore } from "@/lib/pos-store";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import HoldModal from "./hold-modal";
import ReturnsModal from "./returns-modal";
import CustomerSearchModal from "./customer-search-modal";
import CustomerRiskHistory from "./customer-risk-history";
import CartSection from "./cart-section";
import AddItemModal from "./add-item-modal";
import DiscountModal from "./discount-modal";
import { useToast } from "@/hooks/use-toast";

export default function QuickActionsSection() {
  const {

    openPaymentModal, 
    cartItems, 
    currentCustomer, 
    setCurrentCustomer, 
    getCartTotal, 
    getCartSubtotal,
    getCartVAT,
    getTransactionDiscount,
    transactionDiscountType,
    transactionDiscountValue,
    clearTransactionDiscount
  } = usePOSStore();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [showReturnsModal, setShowReturnsModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);

  const hasItems = cartItems.filter(item => !item.sku?.startsWith('DISCOUNT-')).length > 0;
  const subtotal = getCartSubtotal();
  const vat = getCartVAT();
  const totalDiscountAmount = getTransactionDiscount();
  const grandTotal = subtotal + vat; // Total before discount
  const total = grandTotal - totalDiscountAmount; // Final total after discount
  
  // Calculate discount percentage
  const discountPercent = transactionDiscountType === 'percentage' && transactionDiscountValue > 0 
    ? transactionDiscountValue 
    : (() => {
        // Calculate percentage from discount amount if type is fixed
        if (totalDiscountAmount > 0 && grandTotal > 0) {
          return (totalDiscountAmount / grandTotal) * 100;
        }
        return 0;
      })();

  const handleReturns = () => {
    setShowReturnsModal(true);
  };

  const handleHold = () => {
    setShowHoldModal(true);
  };

  const handleAddCustomer = () => {
    setShowCustomerModal(true);
  };

  const handleRemoveCustomer = () => {
    setCurrentCustomer(null);
  };

  const handleRemoveDiscount = () => {
    clearTransactionDiscount();
    toast({
      title: "Discount Removed",
      description: "Transaction discount has been cleared",
    });
  };

  // Event listeners for Quick Actions buttons
  useEffect(() => {
    const handleOpenAddItemModal = () => {
      setShowAddItemModal(true);
    };

    const handleOpenDiscountModal = () => {
      if (cartItems.length === 0) {
        toast({
          title: "No Items in Cart",
          description: "Please add items to cart before applying discount",
          variant: "destructive",
        });
        return;
      }
      setShowDiscountModal(true);
    };

    window.addEventListener('openAddItemModal', handleOpenAddItemModal);
    window.addEventListener('openDiscountModal', handleOpenDiscountModal);

    return () => {
      window.removeEventListener('openAddItemModal', handleOpenAddItemModal);
      window.removeEventListener('openDiscountModal', handleOpenDiscountModal);
    };
  }, [cartItems.length, toast]);

  return (
    <div className="flex flex-col h-full max-h-full bg-card rounded-lg border shadow-sm overflow-hidden max-w-sm">
      <div className="flex-1 p-2 overflow-y-auto min-h-0">
        {/* Customer Section */}
        <div className="mb-1 pb-1 border-b border-slate-200">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-sm font-bold text-slate-600 uppercase tracking-wide">Customer</h4>
          </div>

          {currentCustomer ? (
            <div className="bg-white border border-slate-200 rounded p-1 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 flex-1 min-w-0">
                  <Avatar className="w-7 h-7 flex-shrink-0">
                    <AvatarImage src={currentCustomer.profileImage || ""} />
                    <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold text-[10px]">
                      {currentCustomer.name
                        ? currentCustomer.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                        : "C"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-[11px] truncate leading-tight">
                      {currentCustomer.name || `Customer #${currentCustomer.id}`}
                    </p>
                    <p className="text-[9px] text-slate-600 truncate leading-tight">
                      Credit: QR{" "}
                      {(
                        parseFloat(String(currentCustomer.creditLimit || "0")) -
                        parseFloat(String(currentCustomer.creditBalance || "0"))
                      ).toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-0.5 flex-shrink-0">
                  <CustomerRiskHistory
                    customerId={currentCustomer.id}
                    customerName={
                      currentCustomer.name ||
                      `Customer #${currentCustomer.id}`
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 hover:bg-red-50"
                    onClick={handleRemoveCustomer}
                  >
                    <X className="w-2.5 h-2.5 text-slate-600 hover:text-red-600" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded p-1 text-center">
              <p className="text-[10px] text-slate-500 mb-1">No customer selected</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddCustomer}
                className="text-[10px] h-6 px-2"
              >
                <UserPlus className="w-2.5 h-2.5 mr-1" />
                Select Credit Customer
              </Button>
            </div>
          )}
        </div>

        {/* Current Sale Section */}
        <div className="mb-2 pb-2 border-b border-slate-200">
          <div className="overflow-hidden rounded-lg border">
            <CartSection />
          </div>
        </div>

        {/* Primary Actions */}
        <div className="mb-2 pb-2 border-b border-slate-200">
          <h4 className="text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
            Quick Actions
          </h4>
          <div className="grid grid-cols-2 gap-1">
            <Button
              variant="outline"
              onClick={() => setShowAddItemModal(true)}
              className="h-14 flex-col space-y-0 border-slate-300 hover:bg-blue-50 hover:border-blue-400 transition-all group"
            >
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <Plus className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-xs font-semibold text-slate-700">Add Item</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                if (cartItems.length === 0) {
                  toast({
                    title: "No Items in Cart",
                    description: "Please add items to cart before applying discount",
                    variant: "destructive",
                  });
                  return;
                }
                setShowDiscountModal(true);
              }}
              className="h-14 flex-col space-y-1 border-slate-300 hover:bg-emerald-50 hover:border-emerald-400 transition-all group"
            >
              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                <Percent className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-xs font-semibold text-slate-700">Discount</span>
            </Button>

            <Button
              variant="outline"
              onClick={handleReturns}
              className="h-14 flex-col space-y-1 border-slate-300 hover:bg-orange-50 hover:border-orange-400 transition-all group"
            >
              <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                <RotateCcw className="w-4 h-4 text-orange-600" />
              </div>
              <span className="text-xs font-semibold text-slate-700">Returns</span>
            </Button>

            <Button
              variant="outline"
              onClick={handleHold}
              className="h-14 flex-col space-y-1 border-slate-300 hover:bg-amber-50 hover:border-amber-400 transition-all group"
            >
              <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                <Pause className="w-4 h-4 text-amber-600" />
              </div>
              <span className="text-xs font-semibold text-slate-700">Hold</span>
            </Button>
          </div>
        </div>

        {/* Payment Options Section */}
        {hasItems && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
              Payment Options
            </h4>
            <div className="space-y-1.5">
              {/* Subtotal and Total Display */}
              <div className="bg-slate-50 rounded-lg p-2 mb-1.5 border border-slate-200">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-slate-600">Subtotal:</span>
                  <span className="text-sm font-semibold text-slate-900">QR {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-slate-600">VAT:</span>
                  <span className="text-sm font-semibold text-slate-900">QR {vat.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mb-1 pb-1 border-b border-slate-300">
                  <span className="text-sm font-semibold text-slate-700">Grand total:</span>
                  <span className="text-sm font-semibold text-slate-900">QR {grandTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-slate-600">Discount{totalDiscountAmount > 0 ? ` (${discountPercent.toFixed(1)}%)` : ''}:</span>
                    {totalDiscountAmount > 0 && (
                      <button
                        onClick={handleRemoveDiscount}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded p-0.5 transition-colors"
                        title="Remove discount"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <span className={`text-sm font-semibold ${totalDiscountAmount > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                    {totalDiscountAmount > 0 ? `-QR ${totalDiscountAmount.toFixed(2)}` : 'QR 0.00'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-300">
                  <span className="text-base font-bold text-slate-900">Total Amount:</span>
                  <span className="text-xl font-bold text-slate-900">QR {total.toFixed(2)}</span>
                </div>
              </div>

              {/* Primary Payment Buttons */}
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  onClick={() => {
                    const event = new CustomEvent('quickPayment', { detail: { method: 'card' } });
                    window.dispatchEvent(event);
                  }}
                  className="h-9 bg-blue-600 hover:bg-blue-700 font-semibold text-white shadow-sm text-xs"
                >
                  <CreditCard className="w-4 h-4 mr-1 flex-shrink-0" />
                  <span>Card Pay</span>
                </Button>

                <Button
                  onClick={() => {
                    const event = new CustomEvent('quickPayment', { detail: { method: 'exact-cash' } });
                    window.dispatchEvent(event);
                  }}
                  className="h-9 bg-emerald-600 hover:bg-emerald-700 font-semibold text-white shadow-sm text-xs"
                >
                  <Coins className="w-4 h-4 mr-1 flex-shrink-0" />
                  <span>Cash Pay</span>
                </Button>

                {/* Setup Printer */}
                <Button
                  onClick={() => {
                    const event = new CustomEvent('openPrinterConfig');
                    window.dispatchEvent(event);
                  }}
                  className="h-9 bg-purple-600 hover:bg-purple-700 font-semibold text-white shadow-sm text-xs"
                >
                  <Printer className="w-4 h-4 mr-1 flex-shrink-0" />
                  <span>Printer Setup</span>
                </Button>

                {/* More Payment Options */}
                <Button
                  onClick={openPaymentModal}
                  className="h-9 bg-slate-600 hover:bg-slate-700 font-semibold text-white shadow-sm text-xs"
                >
                  <span>More Options</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <HoldModal
        isOpen={showHoldModal}
        onClose={() => setShowHoldModal(false)}
      />

      <ReturnsModal
        isOpen={showReturnsModal}
        onClose={() => setShowReturnsModal(false)}
      />

      <CustomerSearchModal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
      />

      <AddItemModal
        isOpen={showAddItemModal}
        onClose={() => setShowAddItemModal(false)}
      />

      <DiscountModal
        isOpen={showDiscountModal}
        onClose={() => setShowDiscountModal(false)}
      />
    </div>
  );
}
