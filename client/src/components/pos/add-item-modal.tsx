import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePOSStore } from "@/lib/pos-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Store as StoreIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/hooks/useStore";
import type { Product, StoreProduct } from "@shared/schema";
import { Badge } from "@/components/ui/badge";

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddItemModal({ isOpen, onClose }: AddItemModalProps) {
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const { addToCart } = usePOSStore();
  const { toast } = useToast();
  const { currentStore } = useStore();

  // Fetch store-specific products with their stock and pricing
  const { data: storeProducts = [], isLoading: productsLoading, error: storeProductsError } = useQuery<StoreProduct[]>({
    queryKey: [`/api/stores/${currentStore?.id}/store-products`],
    enabled: !!currentStore,
  });

  // Fetch all products for fallback (in case store products not available)
  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Log for debugging
  console.log('[AddItemModal] Current store:', currentStore?.name, currentStore?.id);
  console.log('[AddItemModal] Store products:', storeProducts.length);
  console.log('[AddItemModal] All products:', allProducts.length);
  console.log('[AddItemModal] Products loading:', productsLoading);
  if (storeProductsError) {
    console.error('[AddItemModal] Store products error:', storeProductsError);
  }

  // Filter store products that are in stock and active, or fallback to all products
  const inStockProducts = useMemo(() => {
    // If we have store products, use them
    if (storeProducts.length > 0) {
      const filtered = storeProducts.filter((storeProduct) => {
        const quantity = storeProduct.stockQuantity ? parseFloat(storeProduct.stockQuantity) : 0;
        return quantity > 0 && storeProduct.isActive !== false;
      });
      console.log('[AddItemModal] Using store products:', filtered.length);
      return filtered;
    }
    
    // Fallback to all products if no store products available
    const filtered = allProducts.filter((product) => {
      const quantity = product.quantity ?? product.stock ?? 0;
      return quantity > 0 && product.isActive !== false;
    });
    console.log('[AddItemModal] Fallback to all products:', filtered.length);
    return filtered;
  }, [storeProducts, allProducts, currentStore]);

  // Handle product selection from dropdown
  const handleProductSelect = (productId: string) => {
    if (!productId || productId === "manual") {
      setSelectedProductId("");
      setItemName("");
      setItemPrice("");
      return;
    }

    // Try to find store product first
    const storeProduct = storeProducts.find((p) => p.productId.toString() === productId);
    if (storeProduct) {
      const currentStock = storeProduct.stockQuantity ? parseFloat(storeProduct.stockQuantity) : 0;
      if (currentStock <= 0) {
        const product = allProducts.find((p) => p.id === storeProduct.productId);
        toast({
          title: "Out of Stock",
          description: `${product?.name || 'Product'} is currently out of stock in ${currentStore?.name || 'this store'}.`,
          variant: "destructive",
        });
        setSelectedProductId("");
        setItemName("");
        setItemPrice("");
        return;
      }
      const product = allProducts.find((p) => p.id === storeProduct.productId);
      setSelectedProductId(productId);
      setItemName(product?.name || "");
      setItemPrice(storeProduct.price || "");
      return;
    }

    // Fallback to regular product if no store product found
    const product = allProducts.find((p) => p.id.toString() === productId);
    if (product) {
      const currentStock = product.stock ?? product.quantity ?? 0;
      if (currentStock <= 0) {
        toast({
          title: "Out of Stock",
          description: `${product.name} is currently out of stock.`,
          variant: "destructive",
        });
        setSelectedProductId("");
        setItemName("");
        setItemPrice("");
        return;
      }
      setSelectedProductId(productId);
      setItemName(product.name || "");
      setItemPrice(product.price?.toString() || "");
    }
  };

  // Handle manual name input - clear selected product if user types manually
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setItemName(e.target.value);
    // If user starts typing manually, clear the selected product
    if (selectedProductId) {
      setSelectedProductId("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!itemName.trim()) {
      toast({
        title: "Error",
        description: "Item name is required",
        variant: "destructive",
      });
      return;
    }

    if (!itemPrice || isNaN(Number(itemPrice)) || Number(itemPrice) <= 0) {
      toast({
        title: "Error", 
        description: "Please enter a valid price",
        variant: "destructive",
      });
      return;
    }

    if (!itemQuantity || isNaN(Number(itemQuantity)) || Number(itemQuantity) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid quantity",
        variant: "destructive",
      });
      return;
    }

    // If a product was selected, use it instead of creating a custom item
    if (selectedProductId) {
      // Try to find store product first
      const storeProduct = storeProducts.find((p) => p.productId.toString() === selectedProductId);
      if (storeProduct) {
        const currentStock = storeProduct.stockQuantity ? parseFloat(storeProduct.stockQuantity) : 0;
        if (currentStock < Number(itemQuantity)) {
          const product = allProducts.find((p) => p.id === storeProduct.productId);
          toast({
            title: "Insufficient Stock",
            description: `${product?.name || 'Product'} only has ${currentStock} units available in ${currentStore?.name || 'this store'}. Requested: ${itemQuantity}`,
            variant: "destructive",
          });
          return;
        }
        // Get full product details and use store-specific price
        const product = allProducts.find((p) => p.id === storeProduct.productId);
        if (product) {
          const productWithStorePrice: Product = {
            ...product,
            price: storeProduct.price, // Use store-specific price
            stock: currentStock, // Use store-specific stock
          };
          addToCart(productWithStorePrice, Number(itemQuantity), currentStore?.id);
        }
      } else {
        // Fallback to regular product
        const selectedProduct = allProducts.find((p) => p.id.toString() === selectedProductId);
        if (selectedProduct) {
          const currentStock = selectedProduct.stock ?? selectedProduct.quantity ?? 0;
          if (currentStock < Number(itemQuantity)) {
            toast({
              title: "Insufficient Stock",
              description: `${selectedProduct.name} only has ${currentStock} units available. Requested: ${itemQuantity}`,
              variant: "destructive",
            });
            return;
          }
          addToCart(selectedProduct, Number(itemQuantity), currentStore?.id);
        }
      }
    } else {
      // Create a custom product object for the cart
      // For custom items, use null as productId since they don't exist in the products table
      const customProduct: Product = {
        id: null as any, // Custom items don't have a product ID
        sku: `CUSTOM-${Date.now()}`,
        name: itemName.trim(),
        price: Number(itemPrice).toString(),
        stock: 999, // High stock for custom items
        quantity: 999,
        description: "Custom item",
        cost: "0",
        barcode: null,
        imageUrl: null,
        productType: null,
        category: null,
        supplierId: null,
        isActive: true,
        requiresDailyMonitoring: false,
        vatRate: null,
        vatExempt: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add to cart with specified quantity
      addToCart(customProduct, Number(itemQuantity), currentStore?.id);
    }

    toast({
      title: "Success",
      description: `Added ${itemQuantity} x ${itemName} to cart`,
    });

    // Reset form and close modal
    setItemName("");
    setItemPrice("");
    setItemQuantity("1");
    setSelectedProductId("");
    onClose();
  };

  const handleClose = () => {
    setItemName("");
    setItemPrice("");
    setItemQuantity("1");
    setSelectedProductId("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Plus className="w-5 h-5 mr-2 text-primary" />
            Add Custom Item
          </DialogTitle>
          <DialogDescription>
            Add a custom item to the current transaction
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="productSelect">Select from Stock (Optional)</Label>
            <Select
              value={selectedProductId || "manual"}
              onValueChange={handleProductSelect}
              disabled={productsLoading || !currentStore}
            >
              <SelectTrigger id="productSelect" className="mt-1">
                <SelectValue placeholder={currentStore ? "Select an item from stock or enter manually below" : "Please select a store first"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Enter manually</SelectItem>
                {inStockProducts.length > 0 ? (
                  inStockProducts.map((item) => {
                    // Check if it's a store product or regular product
                    const isStoreProduct = 'productId' in item;
                    
                    if (isStoreProduct) {
                      const storeProduct = item as StoreProduct;
                      const product = allProducts.find((p) => p.id === storeProduct.productId);
                      const currentQty = storeProduct.stockQuantity ? parseFloat(storeProduct.stockQuantity) : 0;
                      const price = storeProduct.price ? Number(storeProduct.price) : 0;
                      const isLowStock = currentQty > 0 && currentQty <= 10;
                      return (
                        <SelectItem key={storeProduct.productId} value={storeProduct.productId.toString()}>
                          <div className="flex items-center gap-2">
                            <span className={isLowStock ? "text-orange-600 font-medium" : ""}>
                              {product?.name || 'Unknown'} - QR {price.toFixed(2)}
                            </span>
                            <Badge variant={isLowStock ? "destructive" : "secondary"} className="text-xs">
                              {isLowStock ? `Low: ${currentQty}` : `${currentQty}`}
                            </Badge>
                          </div>
                        </SelectItem>
                      );
                    } else {
                      const product = item as Product;
                      const currentQty = product.stock ?? product.quantity ?? 0;
                      const price = product.price ? Number(product.price) : 0;
                      const isLowStock = currentQty > 0 && currentQty <= 10;
                      return (
                        <SelectItem key={product.id} value={product.id.toString()}>
                          <div className="flex items-center gap-2">
                            <span className={isLowStock ? "text-orange-600 font-medium" : ""}>
                              {product.name} - QR {price.toFixed(2)}
                            </span>
                            <Badge variant={isLowStock ? "destructive" : "secondary"} className="text-xs">
                              {isLowStock ? `Low: ${currentQty}` : `${currentQty}`}
                            </Badge>
                          </div>
                        </SelectItem>
                      );
                    }
                  })
                ) : (
                  <SelectItem value="no-stock" disabled>
                    {productsLoading ? "Loading products..." : (currentStore ? "No items in stock at this store" : "No store selected")}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="itemName">Item Name</Label>
            <Input
              id="itemName"
              type="text"
              placeholder="Enter item name..."
              value={itemName}
              onChange={handleNameChange}
              className="mt-1"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="itemPrice">Price ($)</Label>
              <Input
                id="itemPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={itemPrice}
                onChange={(e) => setItemPrice(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="itemQuantity">Quantity</Label>
              <Input
                id="itemQuantity"
                type="number"
                min="1"
                placeholder="1"
                value={itemQuantity}
                onChange={(e) => setItemQuantity(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Add to Cart
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}