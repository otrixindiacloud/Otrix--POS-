import { useState, useEffect } from "react";
import { usePOSStore } from "@/lib/pos-store";
import { useStore } from "@/hooks/useStore";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
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
    <div className="w-full bg-card flex flex-col shadow-sm">
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

      {/* Current Sale Information */}
      <div className="flex-shrink-0 p-2 pb-2 bg-slate-50">
        <h4 className="text-sm font-bold text-slate-900 mb-2">Sale Information</h4>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center gap-2">
            <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Bill No:</span>
            <span className="text-xs font-mono text-slate-900 truncate">{billNumber}</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Bill Date:</span>
            <span className="text-xs text-slate-900 truncate">{billDate}</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Bill Time:</span>
            <span className="text-xs font-mono text-slate-900 truncate">{billTime}</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Cashier:</span>
            <span className="text-xs text-slate-900 truncate">{displayCashierName}</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Cashier Code:</span>
            <span className="text-xs font-mono text-slate-900 truncate">{displayCashierCode}</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Counter:</span>
            <span className="text-xs text-slate-900 truncate">{displayCounter}</span>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ShiftManagementModal
        isOpen={showShiftModal}
        onClose={() => setShowShiftModal(false)}
      />
    </div>
  );
}
