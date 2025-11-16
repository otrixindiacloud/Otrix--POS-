import { useState } from "react";
import { usePOSStore } from "@/lib/pos-store";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Pause, X, ShoppingCart, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface HoldModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HoldModal({ isOpen, onClose }: HoldModalProps) {
  const [holdReason, setHoldReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { 
    cartItems, 
    currentCustomer, 
    currentTransactionNumber, 
    clearCart,
    getCartSubtotal,
    getCartVAT,
    getCartTotal 
  } = usePOSStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cartItems.length === 0) {
      toast({
        title: "Error",
        description: "Cannot hold empty transaction",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const transactionData = {
        transactionNumber: currentTransactionNumber,
        customerId: currentCustomer?.id || null,
        customer: currentCustomer ? {
          id: currentCustomer.id,
          name: currentCustomer.name,
          phone: currentCustomer.phone,
          email: currentCustomer.email,
        } : null,
        items: cartItems,
        subtotal: getCartSubtotal(),
        tax: getCartVAT(),
        total: getCartTotal(),
        timestamp: new Date().toISOString(),
      };

      await apiRequest({
        url: "/api/held-transactions",
        method: "POST",
        body: {
          transactionData: JSON.stringify(transactionData),
          customerId: currentCustomer?.id || null,
          holdReason: holdReason.trim() || "Customer request",
        },
      });

      // Invalidate held-transactions query so holds page updates immediately
      try {
        queryClient.invalidateQueries({ queryKey: ["/api/held-transactions"] });
      } catch (err) {
        console.warn('Failed to invalidate held-transactions query:', err);
      }

      toast({
        title: "Success",
        description: "Transaction held successfully",
      });

      // Clear the cart and close modal
      clearCart();
      handleClose();
    } catch (error) {
      console.error("Error holding transaction:", error);
      toast({
        title: "Error",
        description: "Failed to hold transaction. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setHoldReason("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Pause className="w-5 h-5 mr-2 text-warning" />
            Hold Transaction
          </DialogTitle>
          <DialogDescription>
            Temporarily save this transaction to resume later
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="text-sm text-slate-600 mb-2">Transaction Summary:</div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Items:</span>
                <span>{cartItems.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total:</span>
                <span className="font-bold">QR {getCartTotal().toFixed(2)}</span>
              </div>
              {currentCustomer && (
                <div className="flex justify-between text-sm">
                  <span>Customer:</span>
                  <span>{currentCustomer.name}</span>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="holdReason">Reason for Hold (Optional)</Label>
              <Textarea
                id="holdReason"
                placeholder="Enter reason for holding this transaction..."
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-yellow-500 hover:bg-yellow-600 text-white"
                disabled={isLoading || cartItems.length === 0}
              > 
                <Pause className="w-4 h-4 mr-2" />
                {isLoading ? "Holding..." : "Hold Transaction"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}