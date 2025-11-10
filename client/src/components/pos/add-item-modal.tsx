import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePOSStore } from "@/lib/pos-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@shared/schema";

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

  // Fetch all products
  const { data: allProducts = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Filter products that are in stock (quantity > 0)
  const inStockProducts = useMemo(() => {
    return allProducts.filter((product) => {
      const quantity = product.quantity ?? product.stock ?? 0;
      return quantity > 0 && product.isActive !== false;
    });
  }, [allProducts]);

  // Handle product selection from dropdown
  const handleProductSelect = (productId: string) => {
    if (!productId || productId === "manual") {
      setSelectedProductId("");
      setItemName("");
      setItemPrice("");
      return;
    }

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
        // Add the selected product to cart
        addToCart(selectedProduct, Number(itemQuantity));
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
      addToCart(customProduct, Number(itemQuantity));
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
      <DialogContent className="sm:max-w-md">
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
              disabled={productsLoading}
            >
              <SelectTrigger id="productSelect" className="mt-1">
                <SelectValue placeholder="Select an item from stock or enter manually below" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Enter manually</SelectItem>
                {inStockProducts.length > 0 ? (
                  inStockProducts.map((product) => {
                    const currentQty = product.stock ?? product.quantity ?? 0;
                    const price = product.price ? Number(product.price) : 0;
                    const isLowStock = currentQty > 0 && currentQty <= 10;
                    return (
                      <SelectItem key={product.id} value={product.id.toString()}>
                        <span className={isLowStock ? "text-orange-600" : ""}>
                          {product.name} - QR {price.toFixed(2)} {isLowStock ? `(Low: ${currentQty})` : `(Qty: ${currentQty})`}
                        </span>
                      </SelectItem>
                    );
                  })
                ) : (
                  <SelectItem value="no-stock" disabled>
                    No items in stock
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