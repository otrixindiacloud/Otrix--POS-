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
    getCartTax, 
    getCartTotal,
    setTransactionDiscount,
    updateCartItemDiscount,
    transactionDiscount,
    transactionDiscountType,
    transactionDiscountValue
  } = usePOSStore();
  const { toast } = useToast();

  // Calculate net total - this should match the Payment Options card
  // This is the current total (after any existing discount)
  const netTotal = getCartTotal();
  
  // Calculate original total before any discount for discount calculations
  const subtotal = getCartSubtotal();
  const tax = getCartTax();
  const originalNetTotal = subtotal + tax;

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
    } else {
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

    // Apply discount proportionally to each cart item
    const subtotal = getCartSubtotal();
    
    if (subtotal > 0 && cartItems.length > 0) {
      // Filter out discount items
      const validItems = cartItems.filter(item => !item.sku?.startsWith('DISCOUNT-'));
      
      if (discountType === "percentage") {
        // Apply percentage discount to each item
        validItems.forEach(item => {
          const itemSubtotal = parseFloat(item.price) * item.quantity;
          updateCartItemDiscount(item.productId ?? null, item.sku, value.toString(), 'percentage');
        });
      } else {
        // Apply fixed amount discount proportionally based on item value
        validItems.forEach(item => {
          const itemSubtotal = parseFloat(item.price) * item.quantity;
          const itemProportion = itemSubtotal / subtotal;
          const itemDiscountAmount = discountAmount * itemProportion;
          // Use fixed amount type for fixed discounts
          updateCartItemDiscount(item.productId ?? null, item.sku, itemDiscountAmount.toFixed(2), 'fixed');
        });
      }
    }

    // Set transaction-level discount for backward compatibility
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Percent className="w-5 h-5 mr-2 text-green-600" />
            Apply Discount
          </DialogTitle>
          <DialogDescription>
            Apply a percentage or fixed amount discount to the current transaction
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-sm text-slate-600 mb-1">Net Total:</div>
            <div className="text-lg font-bold">QR {netTotal.toFixed(2)}</div>
          </div>

          <div>
            <Label className="text-base font-medium">Discount Type</Label>
            <RadioGroup value={discountType} onValueChange={setDiscountType} className="mt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="percentage" id="percentage" />
                <Label htmlFor="percentage" className="flex items-center cursor-pointer">
                  <Percent className="w-4 h-4 mr-1" />
                  Percentage
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dollar" id="dollar" />
                <Label htmlFor="dollar" className="flex items-center cursor-pointer">
                  <Coins className="w-4 h-4 mr-1" />
                  Fixed Amount
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="discountValue">
              {discountType === "percentage" ? "Percentage (%)" : "Amount (QR)"}
            </Label>
            <Input
              id="discountValue"
              type="number"
              step={discountType === "percentage" ? "1" : "0.01"}
              min="0"
              max={discountType === "percentage" ? "100" : originalNetTotal.toString()}
              placeholder={discountType === "percentage" ? "10" : "5.00"}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              className="mt-1"
              autoFocus
            />
          </div>

          {discountValue && !isNaN(Number(discountValue)) && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="text-sm text-green-700 mb-1">Discount Preview:</div>
              <div className="text-lg font-bold text-green-800">
                -QR {previewDiscount().toFixed(2)}
              </div>
              <div className="text-sm text-green-600">
                New Total: QR {(originalNetTotal - previewDiscount()).toFixed(2)}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700">
              <Percent className="w-4 h-4 mr-2" />
              Apply Discount
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}