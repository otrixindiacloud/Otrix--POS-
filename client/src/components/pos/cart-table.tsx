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
  
  const { data: products = [] } = useQuery<any[]>({
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

  // Dynamically cap visible rows to 5 and enable scrolling for more
  const tableRef = useRef<HTMLTableElement | null>(null);
  const [maxHeightPx, setMaxHeightPx] = useState<number | undefined>(undefined);

  useEffect(() => {
    const recalc = () => {
      const table = tableRef.current;
      if (!table) return;
      const thead = table.querySelector("thead") as HTMLElement | null;
      const firstBodyRow = table.querySelector("tbody tr") as HTMLElement | null;
      if (!thead || !firstBodyRow) return;

      const headerH = thead.getBoundingClientRect().height || 0;
      const rowH = firstBodyRow.getBoundingClientRect().height || 0;
      if (!rowH) return;
      const rowsToShow = Math.min(5, Math.max(5, filteredCartItems.length));
      setMaxHeightPx(Math.ceil(headerH + rowH * rowsToShow + 2));
    };

    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [filteredCartItems.length]);

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
        const currentStock = stockMap.get(item.productId!);
        if (currentStock !== undefined && item.quantity > currentStock) {
          // Quantity exceeds available stock, adjust it
          updateCartItemQuantity(item.productId!, item.sku, currentStock!);
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
    // Always show the base total (price × quantity) without discount
    // Discount will only be reflected in the final total calculation
    const baseTotal = parseFloat(item.price) * item.quantity;
    return baseTotal;
  };

  return (
    <div className="w-full overflow-hidden border rounded-lg" style={{ minHeight: '250px' }}>
      <div className="overflow-y-auto" style={{ maxHeight: maxHeightPx ? `${maxHeightPx}px` : '300px', minHeight: '250px' }}>
        <table ref={tableRef} className="w-full text-sm border-collapse table-fixed">
          <colgroup>
            <col className="w-10" />
            <col className="min-w-[150px]" />
            <col className="w-16" />
            <col className="w-20" />
            <col className="w-32" />
            <col className="w-24" />
            <col className="w-12" />
          </colgroup>
          <thead className="bg-blue-700 text-white sticky top-0 z-10">
            <tr>
              <th className="py-2 px-5 text-center font-semibold text-xs">S.NO</th>
              <th className="py-2 px-5 text-left font-semibold text-xs">Item Name</th>
              <th className="py-2 px-5 text-center font-semibold text-xs">Unit</th>
              <th className="py-2 px-5 text-center font-semibold text-xs">Rate</th>
              <th className="py-2 px-5 text-center font-semibold text-xs">Qty.</th>
              <th className="py-2 px-5 text-center font-semibold text-xs">Amount</th>
              <th className="py-2 px-5 text-center font-semibold text-xs"></th>
            </tr>
          </thead>
          <tbody>
            {filteredCartItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-4 px-5 text-center text-gray-500 text-xs">
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
                    <td className="py-1.5 px-5 w-10 text-center text-black font-medium text-xs">{index + 1}</td>
                    <td className="py-1.5 px-5">
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
                    <td className="py-1.5 px-5 w-16 text-center text-black font-medium text-xs">PC</td>
                    <td className="py-1.5 px-5 w-20 text-center text-black font-medium text-xs">
                      {parseFloat(item.price).toFixed(1)}
                    </td>
                    <td className="py-1.5 px-5 w-32 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-8 h-8 p-0 hover:bg-blue-100 border-blue-300"
                          onClick={() => handleQuantityDecrease(item.productId ?? null, item.sku)}
                          disabled={(item.quantity || 1) <= 1}
                          title="Decrease quantity"
                        >
                          <Minus className="w-4 h-4 text-blue-600" />
                        </Button>
                        <span className={`w-12 text-center text-xs font-medium ${isOutOfStock ? 'text-red-600' : 'text-black'}`}>
                          {item.quantity || 1}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-8 h-8 p-0 hover:bg-blue-100 border-blue-300"
                          onClick={() => handleQuantityIncrease(item.productId ?? null, item.sku)}
                          disabled={currentStock !== undefined && item.quantity >= currentStock}
                          title={currentStock !== undefined && item.quantity >= currentStock ? "Out of stock" : "Increase quantity"}
                        >
                          <Plus className="w-4 h-4 text-blue-600" />
                        </Button>
                      </div>
                    </td>
                    <td className="py-1.5 px-5 w-24 text-center text-black font-medium text-xs">
                      {getItemAmount(item).toFixed(1)}
                    </td>
                    <td className="py-1.5 px-5 text-center">
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

