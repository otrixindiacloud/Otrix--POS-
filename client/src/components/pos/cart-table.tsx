import { useState, useEffect, useRef } from "react";
import { usePOSStore } from "@/lib/pos-store";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Minus, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

export default function CartTable() {
  const {
    cartItems,
    removeFromCart,
    updateCartItemQuantity,
    updateCartItemDiscount,
  } = usePOSStore();

  const { toast } = useToast();

  // Filter out discount items (items with SKU starting with "DISCOUNT-")
  const filteredCartItems = cartItems.filter(item => !item.sku?.startsWith('DISCOUNT-'));

  const [editingDiscount, setEditingDiscount] = useState<{ [key: string]: string }>({});

  // Listen for out-of-stock events
  useEffect(() => {
    const handleOutOfStock = (event: CustomEvent) => {
      const { product, availableStock, requestedQuantity, currentCartQuantity } = event.detail;
      toast({
        title: "Out of Stock",
        description: `${product} is out of stock. Available: ${availableStock} units. Requested: ${requestedQuantity}${currentCartQuantity ? ` (${currentCartQuantity} already in cart)` : ''}`,
        variant: "destructive",
      });
    };

    window.addEventListener('outOfStock', handleOutOfStock as EventListener);
    return () => {
      window.removeEventListener('outOfStock', handleOutOfStock as EventListener);
    };
  }, [toast]);

  // Fetch real-time stock for items in cart
  const productIds = filteredCartItems
    .filter(item => item.productId !== null)
    .map(item => item.productId!);
  
  const { data: products = [] } = useQuery({
    queryKey: ["/api/products"],
    enabled: productIds.length > 0,
  });

  // Create a map of productId to current stock
  const stockMap = new Map<number, number>();
  products.forEach((product: any) => {
    if (product.id) {
      stockMap.set(product.id, product.stock ?? product.quantity ?? 0);
    }
  });

  // Track last adjustment to prevent infinite loops
  const lastAdjustmentRef = useRef<string>("");

  // Validate and adjust quantities that exceed available stock
  useEffect(() => {
    if (products.length === 0 || cartItems.length === 0) return;
    
    // Create a signature for this check to avoid duplicate adjustments
    const cartSignature = cartItems.map(item => `${item.productId}-${item.quantity}`).join("|");
    const productsSignature = products.map((p: any) => `${p.id}-${p.stock ?? p.quantity}`).join("|");
    const signature = `${cartSignature}|${productsSignature}`;
    
    // Skip if we've already processed this exact state
    if (lastAdjustmentRef.current === signature) return;
    
    // Check each cart item and adjust if quantity exceeds stock
    let hasAdjustments = false;
    cartItems.forEach(item => {
      if (item.productId !== null) {
        const currentStock = stockMap.get(item.productId);
        if (currentStock !== undefined && item.quantity > currentStock) {
          // Quantity exceeds available stock, adjust it
          updateCartItemQuantity(item.productId, item.sku, currentStock);
          toast({
            title: "Quantity Adjusted",
            description: `${item.name} quantity adjusted to ${currentStock} (available stock: ${currentStock})`,
            variant: "destructive",
          });
          hasAdjustments = true;
        }
      }
    });
    
    // Update signature only if we made adjustments (to allow re-checking after adjustment)
    if (!hasAdjustments) {
      lastAdjustmentRef.current = signature;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, cartItems]);

  const handleQuantityIncrease = (productId: number | null, sku: string) => {
    const item = cartItems.find((item) => 
      productId !== null && item.productId !== null
        ? item.productId === productId
        : item.sku === sku
    );
    if (!item) return;
    const currentQuantity = item.quantity || 1;
    const newQuantity = currentQuantity + 1;
    
    // Check real-time stock availability for non-custom items
    if (productId !== null) {
      const currentStock = stockMap.get(productId);
      if (currentStock !== undefined && newQuantity > currentStock) {
        toast({
          title: "Insufficient Stock",
          description: `Only ${currentStock} units available for ${item.name}. Cannot increase quantity to ${newQuantity}.`,
          variant: "destructive",
        });
        return; // Don't increase quantity if it exceeds available stock
      }
    }
    
    updateCartItemQuantity(productId, sku, newQuantity);
  };

  const handleQuantityDecrease = (productId: number | null, sku: string) => {
    const item = cartItems.find((item) => 
      productId !== null && item.productId !== null
        ? item.productId === productId
        : item.sku === sku
    );
    if (!item) return;
    const currentQuantity = item.quantity || 1;
    if (currentQuantity > 1) {
      updateCartItemQuantity(productId, sku, currentQuantity - 1);
    }
  };

  const handleDiscountInputChange = (productId: number | null, sku: string, value: string) => {
    const key = `${productId || 'null'}-${sku}`;
    setEditingDiscount((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleDiscountInputBlur = (productId: number | null, sku: string) => {
    const item = cartItems.find((item) => 
      productId !== null && item.productId !== null
        ? item.productId === productId
        : item.sku === sku
    );
    if (!item) return;

    const key = `${productId || 'null'}-${sku}`;
    const inputValue = editingDiscount[key];
    let discountValue = "";
    let discountType: 'percentage' | 'fixed' = 'percentage';

    if (inputValue !== undefined && inputValue !== "") {
      const parsed = parseFloat(inputValue);
      if (!isNaN(parsed) && parsed >= 0) {
        discountValue = parsed.toString();
        // If value is > 100, assume it's a fixed amount, otherwise percentage
        discountType = parsed > 100 ? 'fixed' : 'percentage';
      }
    }

    updateCartItemDiscount(productId, sku, discountValue, discountType);
    setEditingDiscount((prev) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  const handleDiscountInputKeyDown = (productId: number | null, sku: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      handleDiscountInputBlur(productId, sku);
      e.currentTarget.blur();
    }
  };

  const getItemAmount = (item: any) => {
    const baseTotal = parseFloat(item.price) * item.quantity;
    
    // If currently editing discount, show real-time preview
    const discountKey = `${item.productId || 'null'}-${item.sku}`;
    if (editingDiscount[discountKey] !== undefined) {
      const discountValue = editingDiscount[discountKey];
      if (discountValue !== "" && !isNaN(parseFloat(discountValue))) {
        const discount = parseFloat(discountValue);
        const discountType = discount > 100 ? 'fixed' : 'percentage';
        
        if (discountType === 'percentage') {
          const discountAmount = baseTotal * (discount / 100);
          return baseTotal - discountAmount;
        } else {
          return Math.max(0, baseTotal - discount);
        }
      }
    }
    
    // Otherwise use the stored total (which includes discount if applied)
    if (item.total) {
      return parseFloat(item.total);
    }
    
    // Fallback calculation
    const discount = item.discountAmount ? parseFloat(item.discountAmount) : 0;
    if (item.discountType === 'percentage') {
      const discountAmount = baseTotal * (discount / 100);
      return baseTotal - discountAmount;
    } else {
      return Math.max(0, baseTotal - discount);
    }
  };

  return (
    <div className="w-full overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-blue-700 text-white">
            <tr>
              <th className="py-2 px-3 text-center font-semibold text-xs w-10">S.NO</th>
              <th className="py-2 px-3 text-left font-semibold text-xs min-w-[150px]">Item Name</th>
              <th className="py-2 px-3 text-center font-semibold text-xs w-16">Unit</th>
              <th className="py-2 px-3 text-center font-semibold text-xs w-20">Rate</th>
              <th className="py-2 px-3 text-center font-semibold text-xs w-28">Qty.</th>
              <th className="py-2 px-3 text-center font-semibold text-xs w-24">Amount</th>
              <th className="py-2 px-3 text-center font-semibold text-xs w-12"></th>
            </tr>
          </thead>
          <tbody>
            {filteredCartItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-4 px-3 text-center text-gray-500 text-xs">
                  No items in cart
                </td>
              </tr>
            ) : (
              filteredCartItems.map((item, index) => {
                // Get current stock for this item
                const currentStock = item.productId !== null 
                  ? (stockMap.get(item.productId!) ?? item.stock ?? undefined)
                  : undefined;
                const isOutOfStock = currentStock !== undefined && item.quantity > currentStock;
                const isLowStock = currentStock !== undefined && currentStock > 0 && currentStock < item.quantity;
                
                return (
                  <tr
                    key={`${item.productId || 'null'}-${item.sku}-${index}`}
                    className={`border-b border-slate-200 hover:bg-slate-50 transition-colors ${isOutOfStock ? 'bg-red-50' : ''}`}
                  >
                    <td className="py-2.5 px-3 text-center text-black font-medium text-xs">{index + 1}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-black text-xs uppercase truncate max-w-[200px]" title={item.name}>
                        {item.name}
                      </div>
                      {isOutOfStock && (
                        <div className="flex items-center gap-1 mt-1 text-red-600 text-xs">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Out of stock (Available: {currentStock})</span>
                        </div>
                      )}
                      {isLowStock && !isOutOfStock && (
                        <div className="flex items-center gap-1 mt-1 text-orange-600 text-xs">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Low stock (Available: {currentStock})</span>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center text-black font-medium text-xs">PC</td>
                    <td className="py-2.5 px-3 text-center text-black font-medium text-xs">
                      {parseFloat(item.price).toFixed(1)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-7 h-7 p-0 hover:bg-blue-100 border-blue-300"
                          onClick={() => handleQuantityDecrease(item.productId ?? null, item.sku)}
                          disabled={(item.quantity || 1) <= 1}
                          title="Decrease quantity"
                        >
                          <Minus className="w-3 h-3 text-blue-600" />
                        </Button>
                        <span className={`w-10 text-center text-xs font-medium ${isOutOfStock ? 'text-red-600' : 'text-black'}`}>
                          {item.quantity || 1}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-7 h-7 p-0 hover:bg-blue-100 border-blue-300"
                          onClick={() => handleQuantityIncrease(item.productId ?? null, item.sku)}
                          disabled={currentStock !== undefined && item.quantity >= currentStock}
                          title={currentStock !== undefined && item.quantity >= currentStock ? "Out of stock" : "Increase quantity"}
                        >
                          <Plus className="w-3 h-3 text-blue-600" />
                        </Button>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center text-black font-medium text-xs">
                      {getItemAmount(item).toFixed(1)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-6 h-6 p-0 hover:bg-red-100 rounded"
                        onClick={() => removeFromCart(item.productId ?? null, item.sku)}
                        title="Remove item"
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

