import { useState, useCallback, useEffect } from "react";
import { usePOSStore } from "@/lib/pos-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BarcodeScanner } from "@/components/ui/barcode-scanner";
import { Camera, Keyboard, X, Minus, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReduceItemModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReduceItemModal({ isOpen, onClose }: ReduceItemModalProps) {
  const [barcodeInput, setBarcodeInput] = useState("");
  const [reduceQuantity, setReduceQuantity] = useState("1");
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const { cartItems, updateCartItemQuantity, removeFromCart } = usePOSStore();
  const { toast } = useToast();

  // Helper function to detect if input looks like a barcode
  const isBarcode = (input: string) => {
    const cleaned = input.trim();
    return /^[0-9]{8}$|^[0-9]{12}$|^[0-9]{13}$|^[0-9]{14}$/.test(cleaned);
  };

  // Helper function to detect if input looks like a SKU
  const isSKU = (input: string) => {
    const cleaned = input.trim().toUpperCase();
    return /^[A-Z0-9\-_]{3,20}$/.test(cleaned) && /[A-Z]/.test(cleaned);
  };

  // Handle reducing item quantity
  const handleReduceItem = useCallback(async (barcode: string) => {
    if (!barcode.trim()) return;

    // Validate reduce quantity
    const qtyToReduce = parseInt(reduceQuantity, 10);
    if (isNaN(qtyToReduce) || qtyToReduce <= 0) {
      toast({
        title: "Invalid Quantity",
        description: "Please enter a valid quantity to reduce (must be greater than 0)",
        variant: "destructive",
      });
      return;
    }

    try {
      // Try to find product by barcode
      let product = null;
      let response = await fetch(`/api/products/barcode/${encodeURIComponent(barcode)}`);
      
      if (!response.ok) {
        // Try SKU
        response = await fetch(`/api/products/sku/${encodeURIComponent(barcode)}`);
        if (response.ok) {
          product = await response.json();
        }
      } else {
        product = await response.json();
      }

      if (!product) {
        toast({
          title: "Product Not Found",
          description: `No product found with barcode/SKU: ${barcode}`,
          variant: "destructive",
        });
        setBarcodeInput("");
        return;
      }

      // Find the product in cart
      const cartItem = cartItems.find((item) => {
        if (product.id !== null && item.productId !== null) {
          return item.productId === product.id;
        }
        return item.sku === product.sku;
      });

      if (!cartItem) {
        toast({
          title: "Item Not in Cart",
          description: `${product.name} is not in the cart`,
          variant: "destructive",
        });
        setBarcodeInput("");
        return;
      }

      // Check if quantity to reduce is valid
      const currentQuantity = cartItem.quantity || 1;
      if (qtyToReduce > currentQuantity) {
        toast({
          title: "Invalid Quantity",
          description: `Cannot reduce ${qtyToReduce} units. Only ${currentQuantity} ${currentQuantity === 1 ? 'unit is' : 'units are'} in cart.`,
          variant: "destructive",
        });
        return;
      }

      // Calculate new quantity
      const newQuantity = currentQuantity - qtyToReduce;
      
      // If reducing would remove all items, remove the item from cart completely
      if (newQuantity <= 0) {
        removeFromCart(
          cartItem.productId ?? null,
          cartItem.sku
        );
        
        toast({
          title: "Item Removed",
          description: `${product.name} has been removed from cart`,
        });
      } else {
        // Update quantity
        updateCartItemQuantity(
          cartItem.productId ?? null,
          cartItem.sku,
          newQuantity
        );
        
        toast({
          title: "Quantity Reduced",
          description: `${product.name} quantity reduced by ${qtyToReduce} to ${newQuantity}`,
        });
      }
      
      // Reset form and close modal after successful reduction
      setBarcodeInput("");
      setReduceQuantity("1");
      onClose();
    } catch (error) {
      console.error("Error reducing item:", error);
      toast({
        title: "Error",
        description: "Failed to process barcode. Please try again.",
        variant: "destructive",
      });
      setBarcodeInput("");
    }
  }, [cartItems, updateCartItemQuantity, removeFromCart, toast, onClose, reduceQuantity]);

  const handleBarcodeScanned = (barcode: string) => {
    setBarcodeInput(barcode);
    setShowBarcodeScanner(false);
    // Don't auto-submit, let user specify quantity first
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      handleReduceItem(barcodeInput.trim());
    }
  };

  const handleClose = () => {
    setBarcodeInput("");
    setReduceQuantity("1");
    setShowBarcodeScanner(false);
    onClose();
  };

  // Handle dialog open change - prevent closing when scanner is open
  const handleDialogOpenChange = (open: boolean) => {
    // If trying to close but scanner is open, don't close the dialog
    if (!open && showBarcodeScanner) {
      return;
    }
    // Otherwise, handle close normally
    if (!open) {
      handleClose();
    }
  };

  // Check if cart is empty
  const hasItems = cartItems.filter(item => !item.sku?.startsWith('DISCOUNT-')).length > 0;

  // Disable pointer events on Dialog overlay when scanner is open
  useEffect(() => {
    if (!isOpen) return;
    
    const updatePointerEvents = () => {
      // Find dialog overlays by checking for fixed positioned elements with black background
      const allElements = document.querySelectorAll('div[class*="fixed"][class*="inset-0"]');
      allElements.forEach(element => {
        const htmlElement = element as HTMLElement;
        const styles = window.getComputedStyle(htmlElement);
        // Check if it's likely a dialog overlay (fixed, full screen, with background)
        if (
          styles.position === 'fixed' &&
          styles.top === '0px' &&
          styles.left === '0px' &&
          (styles.backgroundColor.includes('0, 0, 0') || styles.backgroundColor.includes('rgb(0, 0, 0)'))
        ) {
          // Only disable if it's not the scanner itself (z-index check)
          const zIndex = parseInt(styles.zIndex);
          if (zIndex <= 50) {
            htmlElement.style.pointerEvents = showBarcodeScanner ? 'none' : '';
          }
        }
      });
    };

    if (showBarcodeScanner) {
      // Use a small delay to ensure DOM is ready
      const timer = setTimeout(updatePointerEvents, 50);
      return () => clearTimeout(timer);
    } else {
      updatePointerEvents();
    }
  }, [showBarcodeScanner, isOpen]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent 
          className={`sm:max-w-md ${showBarcodeScanner ? 'pointer-events-none' : ''}`}
          style={showBarcodeScanner ? { pointerEvents: 'none', zIndex: 50 } : { zIndex: 50 }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Minus className="w-5 h-5 mr-2 text-orange-600" />
              Reduce Item from Cart
            </DialogTitle>
            <DialogDescription>
              Scan barcode or enter manually to reduce item quantity in cart
            </DialogDescription>
          </DialogHeader>

          {!hasItems ? (
            <div className="py-8 text-center">
              <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">
                Your cart is empty. Add items to cart before reducing quantities.
              </p>
              <Button onClick={handleClose} className="mt-4">
                Close
              </Button>
            </div>
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <Label htmlFor="barcodeInput">Barcode or SKU</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="barcodeInput"
                    type="text"
                    placeholder="Scan or enter barcode/SKU..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className="flex-1"
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowBarcodeScanner(true)}
                    className="px-4"
                    title="Scan barcode with camera"
                  >
                    <Camera className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter barcode/SKU manually or use camera to scan
                </p>
              </div>

              <div>
                <Label htmlFor="reduceQuantity">Quantity to Reduce</Label>
                <Input
                  id="reduceQuantity"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="1"
                  value={reduceQuantity}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Only allow positive integers
                    if (value === "" || /^\d+$/.test(value)) {
                      setReduceQuantity(value);
                    }
                  }}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the number of units to reduce from cart
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={handleClose}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-orange-600 hover:bg-orange-700"
                  disabled={!barcodeInput.trim() || !reduceQuantity || parseInt(reduceQuantity, 10) <= 0}
                >
                  <Minus className="w-4 h-4 mr-2" />
                  Reduce Quantity
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScanned}
      />
    </>
  );
}

