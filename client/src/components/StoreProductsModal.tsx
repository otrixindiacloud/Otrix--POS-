import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Store, Product, StoreProduct, type InsertStoreProduct } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Plus, Edit, Save, X, Search, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StoreProductsModalProps {
  store?: Store | null;
  isOpen: boolean;
  onClose: () => void;
}

interface ProductWithStorePrice extends Product {
  storePrice?: string;
  hasStorePrice?: boolean;
}

export function StoreProductsModal({ store, isOpen, onClose }: StoreProductsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingProduct, setEditingProduct] = useState<number | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allProducts = [], isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: isOpen && !!store,
  });

  const { data: storeProducts = [], isLoading: loadingStoreProducts } = useQuery<StoreProduct[]>({
    queryKey: ["/api/stores", store?.id, "store-products"],
    queryFn: async () => {
      if (!store) return [];
      const response = await fetch(`/api/stores/${store.id}/store-products`);
      if (!response.ok) throw new Error('Failed to fetch store products');
      return response.json();
    },
    enabled: isOpen && !!store,
  });

  const createStoreProductMutation = useMutation({
    mutationFn: async (data: InsertStoreProduct) => {
      const response = await fetch(`/api/stores/${store!.id}/store-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create store product');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores", store?.id, "store-products"] });
      setEditingProduct(null);
      setNewPrice("");
      toast({ title: "Store-specific price added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add store-specific price", variant: "destructive" });
    },
  });

  const updateStoreProductMutation = useMutation({
    mutationFn: async ({ productId, data }: { productId: number; data: Partial<InsertStoreProduct> }) => {
      const response = await fetch(`/api/stores/${store!.id}/store-products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update store product');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores", store?.id, "store-products"] });
      setEditingProduct(null);
      setNewPrice("");
      toast({ title: "Store-specific price updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update store-specific price", variant: "destructive" });
    },
  });

  // Create a map of store products for quick lookup
  const storeProductMap = new Map(storeProducts.map(sp => [sp.productId, sp]));

  // Enhance products with store-specific pricing info
  const enhancedProducts: ProductWithStorePrice[] = allProducts.map(product => {
    const storeProduct = storeProductMap.get(product.id);
    return {
      ...product,
      storePrice: storeProduct?.price,
      hasStorePrice: !!storeProduct,
    };
  });

  // Filter products based on search query
  const filteredProducts = enhancedProducts.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (product.barcode && product.barcode.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const productsWithStorePrice = filteredProducts.filter(p => p.hasStorePrice);
  const productsWithoutStorePrice = filteredProducts.filter(p => !p.hasStorePrice);

  const handleSavePrice = (productId: number) => {
    if (!newPrice || parseFloat(newPrice) <= 0) {
      toast({ title: "Please enter a valid price", variant: "destructive" });
      return;
    }

    const existingStoreProduct = storeProductMap.get(productId);

    if (existingStoreProduct) {
      updateStoreProductMutation.mutate({
        productId,
        data: { price: newPrice },
      });
    } else {
      createStoreProductMutation.mutate({
        storeId: store!.id,
        productId,
        price: newPrice,
      });
    }
  };

  const handleEditPrice = (product: ProductWithStorePrice) => {
    setEditingProduct(product.id);
    setNewPrice(product.storePrice || product.price);
  };

  const handleCancelEdit = () => {
    setEditingProduct(null);
    setNewPrice("");
  };

  if (!store) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Store Products - {store.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search products by name, SKU, or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Tabs defaultValue="store-products" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="store-products">
                Store Pricing ({productsWithStorePrice.length})
              </TabsTrigger>
              <TabsTrigger value="all-products">
                All Products ({productsWithoutStorePrice.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="store-products" className="flex-1 overflow-y-auto">
              {loadingStoreProducts ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardHeader>
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </CardHeader>
                      <CardContent>
                        <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : productsWithStorePrice.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <Coins className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No store-specific pricing set</h3>
                    <p className="text-gray-600">Products will use their default pricing in this store.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {productsWithStorePrice.map((product) => (
                    <Card key={product.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        {/* Product Image */}
                        <div className="w-full h-32 rounded-lg mb-3 overflow-hidden">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-full h-full object-cover hover:scale-105 transition-transform"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                if (e.currentTarget.nextElementSibling) {
                                  (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                                }
                              }}
                            />
                          ) : null}
                          <div 
                            className={`w-full h-full bg-muted flex items-center justify-center hover:bg-primary/10 transition-all ${product.imageUrl ? 'hidden' : 'flex'}`}
                          >
                            <div className="text-center">
                              <Package className="w-8 h-8 text-muted-foreground hover:text-primary transition-colors mx-auto mb-1" />
                              <span className="text-xs text-muted-foreground font-medium">No Image</span>
                            </div>
                          </div>
                        </div>

                        <CardTitle className="text-sm font-medium">{product.name}</CardTitle>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <span>SKU: {product.sku}</span>
                          {product.barcode && <span>• {product.barcode}</span>}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              Default: QR {product.price}
                            </Badge>
                            <Badge className="text-xs">
                              Store: QR {product.storePrice}
                            </Badge>
                          </div>

                          {editingProduct === product.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                value={newPrice}
                                onChange={(e) => setNewPrice(e.target.value)}
                                className="w-20 h-8 text-sm"
                                placeholder="0.00"
                              />
                              <Button
                                size="sm"
                                onClick={() => handleSavePrice(product.id)}
                                disabled={createStoreProductMutation.isPending || updateStoreProductMutation.isPending}
                              >
                                <Save className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEdit}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditPrice(product)}
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="all-products" className="flex-1 overflow-y-auto">
              {loadingProducts ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardHeader>
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </CardHeader>
                      <CardContent>
                        <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : productsWithoutStorePrice.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">All products have store pricing</h3>
                    <p className="text-gray-600">
                      {searchQuery 
                        ? "No products match your search criteria." 
                        : "All products in your catalog have store-specific pricing set."}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {productsWithoutStorePrice.map((product) => (
                    <Card key={product.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        {/* Product Image */}
                        <div className="w-full h-32 rounded-lg mb-3 overflow-hidden">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-full h-full object-cover hover:scale-105 transition-transform"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                if (e.currentTarget.nextElementSibling) {
                                  (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                                }
                              }}
                            />
                          ) : null}
                          <div 
                            className={`w-full h-full bg-muted flex items-center justify-center hover:bg-primary/10 transition-all ${product.imageUrl ? 'hidden' : 'flex'}`}
                          >
                            <div className="text-center">
                              <Package className="w-8 h-8 text-muted-foreground hover:text-primary transition-colors mx-auto mb-1" />
                              <span className="text-xs text-muted-foreground font-medium">No Image</span>
                            </div>
                          </div>
                        </div>
                        <CardTitle className="text-sm font-medium">{product.name}</CardTitle>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <span>SKU: {product.sku}</span>
                          {product.barcode && <span>• {product.barcode}</span>}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="text-xs">
                            Default: QR {product.price}
                          </Badge>

                          {editingProduct === product.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                value={newPrice}
                                onChange={(e) => setNewPrice(e.target.value)}
                                className="w-20 h-8 text-sm"
                                placeholder="0.00"
                              />
                              <Button
                                size="sm"
                                onClick={() => handleSavePrice(product.id)}
                                disabled={createStoreProductMutation.isPending || updateStoreProductMutation.isPending}
                              >
                                <Save className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEdit}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleEditPrice(product)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Set Price
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}