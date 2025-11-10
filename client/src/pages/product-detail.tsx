import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeft,
  Edit,
  Save,
  X,
  Link as LinkIcon,
  Unlink,
  Plus,
  TrendingUp,
  Package,
  Coins,
  BarChart3,
  History,
  AlertTriangle,
  Check,
  Trash2,
  Search,
  RefreshCw,
  ShoppingCart,
  Tag,
  Layers,
  Box,
  TrendingDown,
  Activity,
  Info,
  Store,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { usePOSStore } from "@/lib/pos-store";
import type { Product, ProductSibling } from "@shared/schema";
import MainLayout from "@/components/layout/main-layout";
import ProductModal from "@/components/inventory/product-modal";
import { getCategoryLabel, getProductTypeLabel } from "@/config/product-categories";

// Competitive Pricing Component
function CompetitivePricingSection({ productId, ourPrice }: { productId: number; ourPrice: number }) {
  const { toast } = useToast();
  const [isAddPriceOpen, setIsAddPriceOpen] = useState(false);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>("");
  const [competitorPrice, setCompetitorPrice] = useState("");
  const [competitorProductName, setCompetitorProductName] = useState("");
  const [competitorProductUrl, setCompetitorProductUrl] = useState("");
  const [priceNotes, setPriceNotes] = useState("");

  // Fetch competitors
  const { data: competitors = [] } = useQuery({
    queryKey: ["competitors"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/competitors?activeOnly=true");
      return await response.json();
    },
  });

  // Fetch price comparison
  const { data: priceComparison, refetch: refetchPrices } = useQuery({
    queryKey: [`competitors/prices/comparison/${productId}`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/competitors/prices/comparison/${productId}`);
      return await response.json();
    },
    enabled: !!productId,
  });

  // Add competitor price mutation
  const addPriceMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/competitors/prices", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`competitors/prices/comparison/${productId}`] });
      refetchPrices();
      setIsAddPriceOpen(false);
      resetPriceForm();
      toast({
        title: "Success",
        description: "Competitor price added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add competitor price",
        variant: "destructive",
      });
    },
  });

  // Delete competitor price mutation
  const deletePriceMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/competitors/prices/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      refetchPrices();
      toast({
        title: "Success",
        description: "Competitor price removed",
      });
    },
  });

  const resetPriceForm = () => {
    setSelectedCompetitorId("");
    setCompetitorPrice("");
    setCompetitorProductName("");
    setCompetitorProductUrl("");
    setPriceNotes("");
  };

  const handleAddPrice = () => {
    if (!selectedCompetitorId || !competitorPrice) {
      toast({
        title: "Validation Error",
        description: "Please select a competitor and enter a price",
        variant: "destructive",
      });
      return;
    }

    addPriceMutation.mutate({
      competitorId: parseInt(selectedCompetitorId),
      productId,
      price: competitorPrice,
      productName: competitorProductName || null,
      productUrl: competitorProductUrl || null,
      notes: priceNotes || null,
      priceDate: new Date().toISOString(),
    });
  };

  const getPriceDiffColor = (isLower: boolean, isHigher: boolean, isSame: boolean) => {
    if (isSame) return "text-gray-600";
    if (isLower) return "text-red-600";
    return "text-green-600";
  };

  const getPriceDiffIcon = (isLower: boolean, isHigher: boolean, isSame: boolean) => {
    if (isSame) return "→";
    if (isLower) return "↓";
    return "↑";
  };

  return (
    <Card className="shadow-sm border-gray-200">
      <CardHeader className="bg-gradient-to-r from-orange-50 to-white border-b border-orange-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-orange-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-gray-800">Competitive Pricing Analysis</CardTitle>
              <CardDescription className="text-gray-600">
                Track and compare prices from competitors
              </CardDescription>
            </div>
          </div>
          <Dialog open={isAddPriceOpen} onOpenChange={setIsAddPriceOpen}>
            <DialogTrigger asChild>
              <Button className="bg-orange-600 hover:bg-orange-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Add Competitor Price
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Competitor Price</DialogTitle>
                <DialogDescription>
                  Record a competitor's price for this product
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Competitor *</Label>
                  <Select value={selectedCompetitorId} onValueChange={setSelectedCompetitorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select competitor" />
                    </SelectTrigger>
                    <SelectContent>
                      {competitors.map((comp: any) => (
                        <SelectItem key={comp.id} value={comp.id.toString()}>
                          {comp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Price (QR) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={competitorPrice}
                    onChange={(e) => setCompetitorPrice(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Product Name (at competitor)</Label>
                  <Input
                    placeholder="How they label this product"
                    value={competitorProductName}
                    onChange={(e) => setCompetitorProductName(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Product URL</Label>
                  <Input
                    type="url"
                    placeholder="https://..."
                    value={competitorProductUrl}
                    onChange={(e) => setCompetitorProductUrl(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Additional notes..."
                    value={priceNotes}
                    onChange={(e) => setPriceNotes(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsAddPriceOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddPrice} disabled={addPriceMutation.isPending}>
                    Add Price
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Price Summary Stats */}
        {priceComparison && priceComparison.competitorPrices.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <div className="text-sm text-blue-700 font-medium">Our Price</div>
                <div className="text-2xl font-bold text-blue-900">
                  QR {ourPrice.toFixed(2)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-4">
                <div className="text-sm text-green-700 font-medium">Lowest Competitor</div>
                <div className="text-2xl font-bold text-green-900">
                  QR {priceComparison.lowestCompetitorPrice?.toFixed(2) || "N/A"}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-orange-50 border-orange-200">
              <CardContent className="pt-4">
                <div className="text-sm text-orange-700 font-medium">Highest Competitor</div>
                <div className="text-2xl font-bold text-orange-900">
                  QR {priceComparison.highestCompetitorPrice?.toFixed(2) || "N/A"}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="pt-4">
                <div className="text-sm text-purple-700 font-medium">Market Average</div>
                <div className="text-2xl font-bold text-purple-900">
                  QR {priceComparison.averageCompetitorPrice?.toFixed(2) || "N/A"}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Competitor Prices Table */}
        {priceComparison && priceComparison.competitorPrices.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competitor</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Difference</TableHead>
                <TableHead>% Diff</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {priceComparison.competitorPrices.map((cp: any) => (
                <TableRow key={cp.id}>
                  <TableCell className="font-medium">{cp.competitor?.name}</TableCell>
                  <TableCell className="font-mono">QR {parseFloat(cp.price).toFixed(2)}</TableCell>
                  <TableCell className={getPriceDiffColor(cp.isLower, cp.isHigher, cp.isSame)}>
                    <div className="flex items-center gap-1">
                      <span>{getPriceDiffIcon(cp.isLower, cp.isHigher, cp.isSame)}</span>
                      <span>QR {Math.abs(cp.difference).toFixed(2)}</span>
                    </div>
                  </TableCell>
                  <TableCell className={getPriceDiffColor(cp.isLower, cp.isHigher, cp.isSame)}>
                    {cp.percentageDiff > 0 ? "+" : ""}{cp.percentageDiff.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {cp.productName || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {new Date(cp.priceDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deletePriceMutation.mutate(cp.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-16 bg-gradient-to-b from-gray-50 to-white rounded-lg border-2 border-dashed border-gray-200">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-orange-100 rounded-full">
                <TrendingUp className="w-8 h-8 text-orange-600" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Competitor Prices Yet</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Start tracking competitor prices to analyze your pricing position in the market
            </p>
            {competitors.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-500">First add competitors in the Competitors page</p>
                <Button 
                  variant="outline"
                  onClick={() => window.location.href = "/competitors"}
                >
                  <Store className="w-4 h-4 mr-2" />
                  Manage Competitors
                </Button>
              </div>
            ) : (
              <Button 
                onClick={() => setIsAddPriceOpen(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add First Competitor Price
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ProductDetailPage() {
  const params = useParams();
  const [, navigate] = useLocation();
  const productId = parseInt(params.id || "0");
  const { toast } = useToast();
  const { addToCart } = usePOSStore();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddSiblingOpen, setIsAddSiblingOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRelationType, setSelectedRelationType] = useState<string>("similar");
  const [siblingNotes, setSiblingNotes] = useState("");

  const handleAddToCart = () => {
    if (!product) return;
    addToCart(product);
    toast({
      title: "Added to Cart",
      description: `${product.name} has been added to cart`,
    });
  };

  // Fetch product details with aggressive refetching to show latest stock
  const { data: product, isLoading, refetch: refetchProduct } = useQuery<Product>({
    queryKey: [`/api/products/${productId}`],
    enabled: !!productId,
    staleTime: 0, // Always consider data stale to ensure fresh stock data
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  // Listen for payment success events to refresh product stock
  useEffect(() => {
    const handlePaymentSuccess = async (event: Event) => {
      console.log("🔄 Payment success event received, refreshing product stock for product:", productId);
      
      // Wait for server to process stock update (increased delay for reliability)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Invalidate the query cache first
      queryClient.invalidateQueries({ queryKey: [`/api/products/${productId}`] });
      
      // Refetch product data immediately
      const refreshedProduct = await refetchProduct();
      console.log("📦 Refreshed product data:", refreshedProduct.data);
      
      // Force additional refetches to ensure we get the latest stock
      setTimeout(async () => {
        queryClient.invalidateQueries({ queryKey: [`/api/products/${productId}`] });
        await refetchProduct();
        console.log("✅ Product stock refreshed after sale - remaining stock:", refreshedProduct.data?.stock || 0);
      }, 800);
      
      // Final refetch after another delay to be absolutely sure
      setTimeout(async () => {
        queryClient.invalidateQueries({ queryKey: [`/api/products/${productId}`] });
        await refetchProduct();
      }, 1500);
      
      // Show toast notification with remaining stock
      const currentStock = refreshedProduct.data?.stock || product?.stock || 0;
      toast({
        title: "Stock Updated",
        description: `Remaining stock: ${currentStock} units`,
      });
    };

    window.addEventListener("paymentSuccess", handlePaymentSuccess);
    
    return () => {
      window.removeEventListener("paymentSuccess", handlePaymentSuccess);
    };
  }, [productId, refetchProduct, queryClient, toast, product]);

  // Fetch product siblings
  const { data: siblings = [], refetch: refetchSiblings } = useQuery<any[]>({
    queryKey: [`/api/products/${productId}/siblings`],
    enabled: !!productId,
  });

  // Fetch all products for sibling search
  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Filter products for sibling search
  const filteredProducts = allProducts.filter(
    (p) =>
      p.id !== productId &&
      !siblings.some((s: any) => s.siblingProduct?.id === p.id) &&
      (p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Add sibling mutation
  const addSiblingMutation = useMutation({
    mutationFn: async (data: { siblingId: number; relationshipType: string; notes?: string }) => {
      console.log("🔗 Adding sibling relationship:", data);
      
      try {
        const response = await apiRequest({
          url: `/api/products/${productId}/siblings`,
          method: "POST",
          body: data,
        });
        
        const result = await response.json();
        console.log("✅ Sibling relationship added:", result);
        return result;
      } catch (error) {
        console.error("❌ Failed to add sibling:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("✅ Sibling added successfully:", data);
      toast({
        title: "Success",
        description: "Related product added successfully",
      });
      refetchSiblings();
      setIsAddSiblingOpen(false);
      setSearchQuery("");
      setSiblingNotes("");
    },
    onError: (error: any) => {
      console.error("❌ Error adding sibling:", error);
      
      let errorMessage = "Failed to add related product";
      if (error.message) {
        if (error.message.includes("already exists")) {
          errorMessage = "This product relationship already exists";
        } else if (error.message.includes("Invalid product")) {
          errorMessage = "Invalid product selected";
        } else if (error.message.includes("Cannot add product as its own sibling")) {
          errorMessage = "Cannot add product as its own related product";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Remove sibling mutation
  const removeSiblingMutation = useMutation({
    mutationFn: async (siblingRelationId: number) => {
      const response = await apiRequest({
        url: `/api/products/${productId}/siblings/${siblingRelationId}`,
        method: "DELETE",
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Sibling product removed successfully",
      });
      refetchSiblings();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove sibling product",
        variant: "destructive",
      });
    },
  });

  const handleAddSibling = (siblingId: number) => {
    addSiblingMutation.mutate({
      siblingId,
      relationshipType: selectedRelationType,
      notes: siblingNotes || undefined,
    });
  };

  const handleRemoveSibling = (relationId: number) => {
    if (confirm("Are you sure you want to remove this sibling relationship?")) {
      removeSiblingMutation.mutate(relationId);
    }
  };

  const getRelationshipBadge = (type: string) => {
    const badges = {
      similar: { label: "Similar", variant: "default" as const, color: "bg-blue-100 text-blue-800" },
      alternative: { label: "Alternative", variant: "secondary" as const, color: "bg-purple-100 text-purple-800" },
      complementary: { label: "Complementary", variant: "outline" as const, color: "bg-green-100 text-green-800" },
      substitute: { label: "Substitute", variant: "destructive" as const, color: "bg-orange-100 text-orange-800" },
    };
    return badges[type as keyof typeof badges] || badges.similar;
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      </MainLayout>
    );
  }

  if (!product) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <AlertTriangle className="w-12 h-12 text-slate-400" />
          <h2 className="text-xl font-semibold text-slate-600">Product Not Found</h2>
          <Button onClick={() => navigate("/inventory")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Inventory
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6 bg-gradient-to-b from-blue-50/30 to-white min-h-screen">
        {/* Enhanced Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <Button 
                variant="outline" 
                onClick={() => navigate("/inventory")}
                className="h-10 hover:bg-blue-50 border-blue-200"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-800">{product.name}</h1>
                  <Badge 
                    variant={product.isActive ? "default" : "secondary"}
                    className={product.isActive ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}
                  >
                    {product.isActive ? (
                      <><Check className="w-3 h-3 mr-1" /> Active</>
                    ) : (
                      "Inactive"
                    )}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1.5">
                    <Tag className="w-4 h-4" />
                    <span className="font-mono font-medium">{product.sku}</span>
                  </span>
                  {product.barcode && (
                    <span className="flex items-center gap-1.5">
                      <Activity className="w-4 h-4" />
                      <span className="font-mono">{product.barcode}</span>
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  <Badge 
                    variant={(product.stock || 0) <= 5 && (product.stock || 0) > 0 ? "destructive" : "default"}
                    className={(product.stock || 0) > 5 ? "bg-purple-100 text-purple-700 hover:bg-purple-100" : ""}
                  >
                    Remaining Stock: {product.stock || 0}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline"
                onClick={handleAddToCart}
                className="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Add to Cart
              </Button>
              <Button 
                onClick={() => setIsEditModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Product
              </Button>
            </div>
          </div>
        </div>

        {/* Enhanced Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-50 to-white border-green-100 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-green-700">Selling Price</CardTitle>
                <div className="p-2 bg-green-100 rounded-lg">
                  <Coins className="w-4 h-4 text-green-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">
                QR {Number(product.price || 0).toFixed(2)}
              </div>
              <p className="text-xs text-green-600 mt-1">Current retail price</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-100 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-orange-700">Cost Price</CardTitle>
                <div className="p-2 bg-orange-100 rounded-lg">
                  <TrendingDown className="w-4 h-4 text-orange-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700">
                QR {Number(product.cost || 0).toFixed(2)}
              </div>
              <p className="text-xs text-orange-600 mt-1">Purchase cost per unit</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-blue-700">Remaining Stock</CardTitle>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Package className="w-4 h-4 text-blue-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                (product.stock || 0) > 5 ? 'text-blue-700' : 
                (product.stock || 0) > 0 ? 'text-red-600' : 'text-red-600'
              }`}>
                {product.stock || 0} units
              </div>
              <p className={`text-xs mt-1 ${
                (product.stock || 0) > 5 ? 'text-blue-600' : 
                (product.stock || 0) > 0 ? 'text-red-600' : 'text-red-600'
              }`}>
                {(product.stock || 0) > 5 ? 'Well stocked' : 
                 (product.stock || 0) > 0 ? 'Low stock - remaining' : 'Out of stock'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-purple-700">Profit Margin</CardTitle>
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-700">
                {((Number(product.price) - Number(product.cost)) / Number(product.price) * 100).toFixed(1)}%
              </div>
              <p className="text-xs text-purple-600 mt-1">
                QR {(Number(product.price) - Number(product.cost)).toFixed(2)} per unit
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Tabbed Content */}
        <Tabs defaultValue="details" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 bg-white border border-gray-200 p-1 rounded-lg shadow-sm">
            <TabsTrigger 
              value="details"
              className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"
            >
              <Info className="w-4 h-4 mr-2" />
              Details
            </TabsTrigger>
            <TabsTrigger 
              value="siblings"
              className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"
            >
              <LinkIcon className="w-4 h-4 mr-2" />
              Related ({siblings.length})
            </TabsTrigger>
            <TabsTrigger 
              value="pricing"
              className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Competitive Pricing
            </TabsTrigger>
            <TabsTrigger 
              value="analytics"
              className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger 
              value="history"
              className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"
            >
              <History className="w-4 h-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4">
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-white border-b border-blue-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Box className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-gray-800">Product Information</CardTitle>
                    <CardDescription className="text-gray-600">Detailed information about this product</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-600 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      Product Name
                    </Label>
                    <p className="text-lg font-semibold text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-200">{product.name}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-600 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5" />
                      SKU
                    </Label>
                    <p className="text-lg font-mono font-medium text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-200">{product.sku}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-600 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5" />
                      Barcode
                    </Label>
                    <p className="text-lg font-mono text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-200">{product.barcode || "N/A"}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-600 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      Product Type
                    </Label>
                    <p className="text-lg text-gray-800 bg-blue-50 p-3 rounded-lg border border-blue-200">
                      {(product as any).productType
                        ? getProductTypeLabel((product as any).productType)
                        : "Not Set"}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-600 flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5" />
                      Category
                    </Label>
                    <p className="text-lg text-gray-800 bg-purple-50 p-3 rounded-lg border border-purple-200">
                      {product.category ? getCategoryLabel(product.category) : "Not Set"}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-600 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5" />
                      Status
                    </Label>
                    <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <Badge variant={product.isActive ? "default" : "secondary"} className={product.isActive ? "bg-green-100 text-green-700" : ""}>
                        {product.isActive ? (
                          <><Check className="w-3 h-3 mr-1" /> Active</>
                        ) : (
                          "Inactive"
                        )}
                      </Badge>
                    </div>
                  </div>
                </div>

                {product.description && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-600 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5" />
                      Description
                    </Label>
                    <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-200 leading-relaxed">{product.description}</p>
                  </div>
                )}

                {product.imageUrl && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-600 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5" />
                      Product Image
                    </Label>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 inline-block">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-48 h-48 object-cover rounded-lg shadow-md"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-gray-200">
              <CardHeader className="bg-gradient-to-r from-green-50 to-white border-b border-green-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Coins className="w-5 h-5 text-green-600" />
                  </div>
                  <CardTitle className="text-gray-800">Pricing & Stock</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-green-50 to-white p-5 rounded-xl border border-green-200 shadow-sm">
                    <Label className="text-sm font-medium text-green-700 mb-2 block">Selling Price</Label>
                    <p className="text-3xl font-bold text-green-700">
                      QR {Number(product.price || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-orange-50 to-white p-5 rounded-xl border border-orange-200 shadow-sm">
                    <Label className="text-sm font-medium text-orange-700 mb-2 block">Cost Price</Label>
                    <p className="text-3xl font-bold text-orange-700">
                      QR {Number(product.cost || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-white p-5 rounded-xl border border-purple-200 shadow-sm">
                    <Label className="text-sm font-medium text-purple-700 mb-2 block">Profit per Unit</Label>
                    <p className="text-3xl font-bold text-purple-700">
                      QR {(Number(product.price) - Number(product.cost)).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-5 rounded-xl border border-blue-200">
                    <Label className="text-sm font-medium text-blue-700 mb-2 flex items-center gap-1.5">
                      <Package className="w-4 h-4" />
                      Remaining Stock
                    </Label>
                    <Badge 
                      variant={(product.stock || 0) <= 5 && (product.stock || 0) > 0 ? "destructive" : "default"}
                      className={(product.stock || 0) > 5 ? "bg-purple-100 text-purple-700 hover:bg-purple-100 text-base px-3 py-1" : "text-base px-3 py-1"}
                    >
                      {product.stock || 0} units remaining
                    </Badge>
                  </div>
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                    <Label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                      <Activity className="w-4 h-4" />
                      Remaining Qty
                    </Label>
                    <p className="text-2xl font-semibold text-gray-800">{product.stock || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Siblings Tab */}
          <TabsContent value="siblings" className="space-y-4">
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-white border-b border-purple-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <LinkIcon className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle className="text-gray-800">Similar & Related Products</CardTitle>
                      <CardDescription className="text-gray-600">
                        Link products that are similar, alternatives, complements, or substitutes
                      </CardDescription>
                    </div>
                  </div>
                  <Dialog open={isAddSiblingOpen} onOpenChange={setIsAddSiblingOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Related Product
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-xl flex items-center gap-2">
                          <LinkIcon className="w-5 h-5 text-purple-600" />
                          Add Related Product
                        </DialogTitle>
                        <DialogDescription>
                          Search and select a product to link as similar, alternative, complementary, or substitute
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4">
                        <div>
                          <Label className="font-medium">Relationship Type</Label>
                          <Select value={selectedRelationType} onValueChange={setSelectedRelationType}>
                            <SelectTrigger className="mt-1.5">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="similar">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                  Similar (same product, different size/brand)
                                </div>
                              </SelectItem>
                              <SelectItem value="alternative">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                  Alternative (can replace this product)
                                </div>
                              </SelectItem>
                              <SelectItem value="complementary">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                  Complementary (often bought together)
                                </div>
                              </SelectItem>
                              <SelectItem value="substitute">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                  Substitute (fallback option)
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="font-medium">Search Products</Label>
                          <div className="relative mt-1.5">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                              placeholder="Search by name, SKU, or barcode..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-10 border-gray-300"
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="font-medium">Notes (Optional)</Label>
                          <Textarea
                            placeholder="Add notes about this relationship..."
                            value={siblingNotes}
                            onChange={(e) => setSiblingNotes(e.target.value)}
                            rows={3}
                            className="mt-1.5 border-gray-300"
                          />
                        </div>

                        {searchQuery && (
                          <div className="border rounded-lg max-h-64 overflow-y-auto bg-gray-50">
                            {filteredProducts.length > 0 ? (
                              <div className="divide-y">
                                {filteredProducts.slice(0, 10).map((p) => (
                                  <div
                                    key={p.id}
                                    className="p-3 hover:bg-white cursor-pointer flex items-center justify-between transition-colors"
                                    onClick={() => handleAddSibling(p.id)}
                                  >
                                    <div className="flex-1">
                                      <p className="font-medium text-gray-800">{p.name}</p>
                                      <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                                        <span className="flex items-center gap-1">
                                          <Tag className="w-3 h-3" />
                                          {p.sku}
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <Coins className="w-3 h-3" />
                                          QR {Number(p.price).toFixed(2)}
                                        </span>
                                      </div>
                                    </div>
                                    <Button size="sm" variant="ghost" className="hover:bg-blue-50">
                                      <Plus className="w-4 h-4 text-blue-600" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="p-8 text-center text-gray-500">
                                <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                <p>No products found</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {siblings.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50 hover:bg-gray-50">
                          <TableHead className="font-semibold">Product</TableHead>
                          <TableHead className="font-semibold">SKU</TableHead>
                          <TableHead className="font-semibold">Price</TableHead>
                          <TableHead className="font-semibold">Relationship</TableHead>
                          <TableHead className="font-semibold">Notes</TableHead>
                          <TableHead className="font-semibold text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {siblings
                          .filter((relation: any) => relation.siblingProduct) // Filter out any invalid relations
                          .map((relation: any) => {
                          const badge = getRelationshipBadge(relation.relationshipType);
                          return (
                            <TableRow key={relation.id} className="hover:bg-blue-50/30">
                              <TableCell>
                                <Link href={`/products/${relation.siblingProduct.id}`}>
                                  <a className="font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5">
                                    <Package className="w-3.5 h-3.5" />
                                    {relation.siblingProduct.name}
                                  </a>
                                </Link>
                              </TableCell>
                              <TableCell className="font-mono text-sm text-gray-600">{relation.siblingProduct.sku}</TableCell>
                              <TableCell className="font-semibold text-green-700">QR {Number(relation.siblingProduct.price).toFixed(2)}</TableCell>
                              <TableCell>
                                <Badge className={badge.color}>{badge.label}</Badge>
                              </TableCell>
                              <TableCell className="max-w-xs truncate text-sm text-gray-600">
                                {relation.notes || "-"}
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveSibling(relation.id)}
                                  className="hover:bg-red-50 hover:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-16 bg-gradient-to-b from-gray-50 to-white rounded-lg border-2 border-dashed border-gray-200">
                    <div className="flex justify-center mb-4">
                      <div className="p-4 bg-purple-100 rounded-full">
                        <LinkIcon className="w-8 h-8 text-purple-600" />
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">No Related Products Yet</h3>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                      Link similar, alternative, or complementary products to help with recommendations and cross-selling
                    </p>
                    <Button 
                      onClick={() => setIsAddSiblingOpen(true)}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Related Product
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Competitive Pricing Tab */}
          <TabsContent value="pricing" className="space-y-4">
            <CompetitivePricingSection productId={productId} ourPrice={Number(product.price)} />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-green-50 to-white border-green-100 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-green-700">Profit Margin</CardTitle>
                    <div className="p-2 bg-green-100 rounded-lg">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-700">
                    {((Number(product.price) - Number(product.cost)) / Number(product.price) * 100).toFixed(1)}%
                  </div>
                  <p className="text-xs text-green-600 mt-2">
                    Based on current price and cost
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-blue-700">Remaining Stock</CardTitle>
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Package className="w-4 h-4 text-blue-600" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${
                    (product.stock || 0) > 5 ? 'text-blue-700' : 
                    (product.stock || 0) > 0 ? 'text-red-600' : 'text-red-600'
                  }`}>
                    {product.stock || 0} units
                  </div>
                  <p className={`text-xs mt-2 ${
                    (product.stock || 0) > 5 ? 'text-blue-600' : 
                    (product.stock || 0) > 0 ? 'text-red-600' : 'text-red-600'
                  }`}>
                    {(product.stock || 0) > 5 ? 'Well stocked ✓' : 
                     (product.stock || 0) > 0 ? 'Low stock - remaining' : 'Out of stock'}
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-purple-700">Related Products</CardTitle>
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <LinkIcon className="w-4 h-4 text-purple-600" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-700">
                    {siblings.length}
                  </div>
                  <p className="text-xs text-purple-600 mt-2">
                    Similar and related items
                  </p>
                </CardContent>
              </Card>
            </div>
            
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-white border-b border-blue-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Activity className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-gray-800">Quick Actions</CardTitle>
                    <CardDescription className="text-gray-600">Common actions for this product</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button 
                    variant="outline" 
                    className="flex flex-col h-24 gap-2 bg-gradient-to-br from-blue-50 to-white hover:from-blue-100 hover:to-blue-50 border-blue-200 shadow-sm"
                    onClick={handleAddToCart}
                  >
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <ShoppingCart className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-blue-700">Add to Cart</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="flex flex-col h-24 gap-2 bg-gradient-to-br from-green-50 to-white hover:from-green-100 hover:to-green-50 border-green-200 shadow-sm"
                    onClick={() => setIsEditModalOpen(true)}
                  >
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Edit className="w-5 h-5 text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-green-700">Edit Product</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="flex flex-col h-24 gap-2 bg-gradient-to-br from-purple-50 to-white hover:from-purple-100 hover:to-purple-50 border-purple-200 shadow-sm"
                    onClick={() => navigate("/inventory")}
                  >
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Package className="w-5 h-5 text-purple-600" />
                    </div>
                    <span className="text-sm font-medium text-purple-700">View Inventory</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="flex flex-col h-24 gap-2 bg-gradient-to-br from-orange-50 to-white hover:from-orange-100 hover:to-orange-50 border-orange-200 shadow-sm"
                    onClick={() => setIsAddSiblingOpen(true)}
                  >
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <LinkIcon className="w-5 h-5 text-orange-600" />
                    </div>
                    <span className="text-sm font-medium text-orange-700">Add Related</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <History className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <CardTitle className="text-gray-800">Product History</CardTitle>
                    <CardDescription className="text-gray-600">Price changes, stock movements, and updates</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center py-16 bg-gradient-to-b from-gray-50 to-white rounded-lg">
                  <div className="flex justify-center mb-4">
                    <div className="p-4 bg-gray-100 rounded-full">
                      <History className="w-8 h-8 text-gray-400" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">History Tracking Coming Soon</h3>
                  <p className="text-gray-500 mb-1">View all changes and transactions for this product</p>
                  <p className="text-sm text-gray-400">Track price updates, stock changes, and edit history</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Modal */}
      <ProductModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        product={product}
      />
    </MainLayout>
  );
}
