import React, { useState } from "react";
import { usePOSStore } from "@/lib/pos-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Percent, Coins, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DiscountModal({ isOpen, onClose }: DiscountModalProps) {
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const { 
    cartItems, 
    getCartSubtotal, 
    getCartVAT, 
    getCartTotal,
    setTransactionDiscount,
    transactionDiscount,
    transactionDiscountType,
    transactionDiscountValue,
    clearTransactionDiscount
  } = usePOSStore();
  const { toast } = useToast();

  // Calculate net total - this should match the Payment Options card
  // This is the current total (after any existing discount)
  const netTotal = getCartTotal();
  
  // Calculate original total before any discount for discount calculations
  const subtotal = getCartSubtotal();
  const vat = getCartVAT();
  const originalNetTotal = subtotal + vat;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!discountValue || isNaN(Number(discountValue)) || Number(discountValue) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid discount value",
        variant: "destructive",
      });
      return;
    }

    let discountAmount = 0;
    const value = Number(discountValue);

    if (discountType === "percentage") {
      if (value > 100) {
        toast({
          title: "Error",
          description: "Percentage discount cannot exceed 100%",
          variant: "destructive",
        });
        return;
      }
      // Calculate discount based on original total (before any existing discount)
      discountAmount = originalNetTotal * (value / 100);
    } else if (discountType === "fixed") {
      if (value > originalNetTotal) {
        toast({
          title: "Error",
          description: "Fixed amount discount cannot exceed net total",
          variant: "destructive",
        });
        return;
      }
      discountAmount = value;
    }

    // Set transaction-level discount only (not item-level)
    setTransactionDiscount(discountAmount, discountType as 'percentage' | 'fixed', value);

    toast({
      title: "Success",
      description: `Applied ${discountType === "percentage" ? `${value}%` : `QR ${value.toFixed(2)}`} discount`,
    });

    // Reset form and close modal
    setDiscountValue("");
    setDiscountType("percentage");
    onClose();
  };

  const handleRemoveDiscount = () => {
    clearTransactionDiscount();
    toast({
      title: "Success",
      description: "Discount has been removed",
    });
    setDiscountValue("");
    setDiscountType("percentage");
    onClose();
  };

  const handleClose = () => {
    setDiscountValue("");
    setDiscountType("percentage");
    onClose();
  };

  // Load existing discount if any
  React.useEffect(() => {
    if (isOpen && transactionDiscount > 0 && transactionDiscountType) {
      setDiscountType(transactionDiscountType);
      setDiscountValue(transactionDiscountValue.toString());
    }
  }, [isOpen, transactionDiscount, transactionDiscountType, transactionDiscountValue]);

  const previewDiscount = () => {
    if (!discountValue || isNaN(Number(discountValue))) return 0;
    
    const value = Number(discountValue);
    if (discountType === "percentage") {
      // Calculate discount based on original total (before any existing discount)
      return Math.min(originalNetTotal * (value / 100), originalNetTotal);
    } else {
      return Math.min(value, originalNetTotal);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl">
            <Percent className="w-6 h-6 mr-2 text-green-600" />
            Apply Discount
          </DialogTitle>
          <DialogDescription className="text-base">
            Apply a percentage or fixed amount discount to the current transaction
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          {transactionDiscount > 0 && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold text-amber-900 mb-2">Current Discount Applied</div>
                  <div className="text-sm text-amber-700 flex flex-wrap items-center gap-1">
                    <span>
                      {transactionDiscountType === 'percentage' 
                        ? `${transactionDiscountValue}% discount` 
                        : `QR ${transactionDiscountValue.toFixed(2)} discount`}
                    </span>
                    <span>=</span>
                    <span className="font-semibold text-amber-900">QR {transactionDiscount.toFixed(2)}</span>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleRemoveDiscount}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                  title="Remove current discount"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}

          <div className="bg-slate-100 border border-slate-300 rounded-lg p-4">
            <div className="text-sm font-medium text-slate-600 mb-2">Net Total:</div>
            <div className="text-3xl font-bold text-slate-900 tracking-tight">QR {netTotal.toFixed(2)}</div>
          </div>

          <div>
            <Label className="text-lg font-semibold mb-3 block">Discount Type</Label>
            <RadioGroup value={discountType} onValueChange={setDiscountType} className="mt-2">
              <div className="grid grid-cols-2 gap-3">
                <label 
                  htmlFor="percentage" 
                  className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    discountType === 'percentage' 
                      ? 'border-green-500 bg-green-50 shadow-sm' 
                      : 'border-slate-200 hover:border-green-400 hover:bg-green-50'
                  }`}
                >
                  <RadioGroupItem value="percentage" id="percentage" className="w-5 h-5 shrink-0" />
                  <div className="flex items-center flex-1 min-w-0">
                    <Percent className="w-5 h-5 mr-2 text-green-600 shrink-0" />
                    <span className="text-base font-medium">Percentage Discount</span>
                  </div>
                </label>
                <label 
                  htmlFor="fixed" 
                  className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    discountType === 'fixed' 
                      ? 'border-green-500 bg-green-50 shadow-sm' 
                      : 'border-slate-200 hover:border-green-400 hover:bg-green-50'
                  }`}
                >
                  <RadioGroupItem value="fixed" id="fixed" className="w-5 h-5 shrink-0" />
                  <div className="flex items-center flex-1 min-w-0">
                    <Coins className="w-5 h-5 mr-2 text-green-600 shrink-0" />
                    <span className="text-base font-medium">Fixed Amount</span>
                  </div>
                </label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="discountValue" className="text-base font-semibold mb-2 block">
              {discountType === "percentage" ? "Percentage (%)" : "Amount (QR)"}
            </Label>
            <Input
              id="discountValue"
              type="number"
              step={discountType === "percentage" ? "1" : "0.01"}
              min="0"
              max={discountType === "percentage" ? "100" : originalNetTotal.toString()}
              placeholder={discountType === "percentage" ? "Enter percentage (e.g., 10)" : "Enter amount (e.g., 5.00)"}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              className="mt-1 h-12 text-lg"
              autoFocus
            />
          </div>

          {discountValue && !isNaN(Number(discountValue)) && Number(discountValue) > 0 && (
            <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
              <div className="text-sm font-semibold text-green-700 uppercase tracking-wide mb-3">Discount Preview:</div>
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-green-600 font-medium">Discount Amount:</span>
                  <span className="text-2xl font-bold text-green-800">-QR {previewDiscount().toFixed(2)}</span>
                </div>
                <div className="flex items-baseline justify-between pt-2 border-t border-green-200">
                  <span className="text-sm text-green-600 font-medium">New Total:</span>
                  <span className="text-2xl font-bold text-green-900">QR {(originalNetTotal - previewDiscount()).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t-2 border-slate-200">
            <div className="flex-shrink-0">
              {transactionDiscount > 0 && (
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={handleRemoveDiscount}
                  className="bg-red-600 hover:bg-red-700 h-11 px-5 text-base"
                >
                  <X className="w-5 h-5 mr-2" />
                  Remove Discount
                </Button>
              )}
            </div>
            <div className="flex gap-3 ml-auto">
              <Button type="button" variant="outline" onClick={handleClose} className="h-11 px-5 text-base">
                <X className="w-5 h-5 mr-2" />
                Cancel
              </Button>
              <Button type="submit" className="bg-green-600 hover:bg-green-700 h-11 px-6 text-base font-semibold">
                <Percent className="w-5 h-5 mr-2" />
                Apply Discount
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}