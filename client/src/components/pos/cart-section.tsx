import { useState, useEffect } from "react";
import { usePOSStore } from "@/lib/pos-store";
import { useStore } from "@/hooks/useStore";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Trash2,
  CreditCard,
  User,
} from "lucide-react";
import { format } from "date-fns";
import ShiftManagementModal from "./shift-management-modal";

export default function CartSection() {
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const {
    cartItems,
    currentTransactionNumber,
    clearCart,
    getCartSubtotal,
    getCartTax,
    getCartTotal,
  } = usePOSStore();
  const { currentStore } = useStore();
  const { user } = useAuth();

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Get current date and time
  const billDate = format(currentTime, "dd/MMM/yyyy");
  const billTime = format(currentTime, "HH:mm:ss");
  
  // Cashier name - prioritize full name, fallback to username
  const cashierName = user?.firstName && user?.lastName 
    ? `${user.firstName} ${user.lastName}`.trim().toUpperCase()
    : user?.username?.trim().toUpperCase() || "N/A";
  
  // Cashier code - use user ID
  const cashierCode = user?.id ? user.id.toString() : "N/A";
  
  // Counter - show store name or code, fallback to ID
  const counter = currentStore?.name 
    ? currentStore.name
    : currentStore?.code 
    ? currentStore.code
    : currentStore?.id?.toString() || "N/A";
  
  // Bill number - show actual transaction number or "NEW" if not yet generated
  // Show "NA" if cart is empty
  const billNumber = cartItems.length === 0 
    ? "NA"
    : (currentTransactionNumber && currentTransactionNumber.trim() 
      ? currentTransactionNumber 
      : "NEW");

  // Show "NA" for cashier info when cart is empty
  const displayCashierName = cartItems.length === 0 ? "NA" : cashierName;
  const displayCashierCode = cartItems.length === 0 ? "NA" : cashierCode;
  const displayCounter = cartItems.length === 0 ? "NA" : counter;

  return (
    <div className="w-full bg-card flex flex-col h-full shadow-sm">
      {/* Modern Cart Header */}
      <div className="border-b flex-shrink-0 p-3 bg-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Current Sale</h3>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowShiftModal(true)}
              className="h-7 px-2.5 text-xs hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700"
              title="Manage Shifts"
            >
              <User className="w-3.5 h-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Shifts</span>
            </Button>
            {cartItems.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  if (window.confirm("Are you sure you want to clear all items from the cart?")) {
                    clearCart();
                  }
                }}
                className="h-7 px-2.5 text-xs hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700"
                title="Clear Cart"
              >
                <Trash2 className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Clear</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Current Sale Information Card */}
      <div className="flex-shrink-0 p-3 border-b bg-slate-50">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-900">Sale Information</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-700">Bill No:</span>
                <span className="text-sm font-mono text-slate-900">{billNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-700">Bill Date:</span>
                <span className="text-sm text-slate-900">{billDate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-700">Bill Time:</span>
                <span className="text-sm font-mono text-slate-900">{billTime}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-700">Cashier:</span>
                <span className="text-sm text-slate-900">{displayCashierName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-700">Cashier Code:</span>
                <span className="text-sm font-mono text-slate-900">{displayCashierCode}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-700">Counter:</span>
                <span className="text-sm text-slate-900">{displayCounter}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cart Items Table */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {cartItems.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-2">
            <div className="text-center text-slate-500">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-1">
                <CreditCard className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-xs font-medium mb-0.5">Cart is empty</p>
              <p className="text-xs text-slate-400">
                Scan or search for products to add them to the cart
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Modals */}
      <ShiftManagementModal
        isOpen={showShiftModal}
        onClose={() => setShowShiftModal(false)}
      />
    </div>
  );
}
