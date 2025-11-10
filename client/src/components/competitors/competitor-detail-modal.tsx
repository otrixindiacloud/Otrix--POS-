import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  Globe,
  User,
  Package,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  Edit,
  Trash2,
  Search,
  ExternalLink,
  Calendar,
} from "lucide-react";
import type { Competitor, CompetitorPrice, Product } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface CompetitorDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  competitor: Competitor;
}

interface CompetitorPriceWithProduct extends CompetitorPrice {
  product?: {
    id: number;
    sku: string;
    name: string;
    price: string;
    imageUrl: string | null;
  };
}

interface AddPriceFormData {
  productId: string;
  price: string;
  originalPrice?: string;
  productName?: string;
  productSku?: string;
  productBarcode?: string;
  productUrl?: string;
  notes?: string;
  availability?: string;
}

export default function CompetitorDetailModal({
  isOpen,
  onClose,
  competitor,
}: CompetitorDetailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddingPrice, setIsAddingPrice] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [priceFormData, setPriceFormData] = useState<AddPriceFormData>({
    productId: "",
    price: "",
    originalPrice: "",
    productName: "",
    productSku: "",
    productBarcode: "",
    productUrl: "",
    notes: "",
    availability: "",
  });

  // Fetch competitor prices
  const { data: prices = [], isLoading: pricesLoading } = useQuery<CompetitorPriceWithProduct[]>({
    queryKey: ["competitor-prices", competitor.id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/competitors/${competitor.id}/prices`);
      return await response.json();
    },
    enabled: isOpen,
  });

  // Fetch products for search
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/products");
      return await response.json();
    },
  });

  // Search products
  const { data: searchResults = [] } = useQuery<Product[]>({
    queryKey: ["products", "search", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const response = await apiRequest("GET", `/api/products/search?q=${encodeURIComponent(searchQuery)}`);
      return await response.json();
    },
    enabled: searchQuery.trim().length > 0,
  });

  // Add price mutation
  const addPriceMutation = useMutation({
    mutationFn: async (data: AddPriceFormData) => {
      const response = await apiRequest("POST", "/api/competitors/prices", {
        competitorId: competitor.id,
        productId: parseInt(data.productId),
        price: parseFloat(data.price),
        originalPrice: data.originalPrice ? parseFloat(data.originalPrice) : undefined,
        currency: "QAR",
        productName: data.productName || undefined,
        productSku: data.productSku || undefined,
        productBarcode: data.productBarcode || undefined,
        productUrl: data.productUrl || undefined,
        notes: data.notes || undefined,
        availability: data.availability || undefined,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitor-prices", competitor.id] });
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
      setIsAddingPrice(false);
      setPriceFormData({
        productId: "",
        price: "",
        originalPrice: "",
        productName: "",
        productSku: "",
        productBarcode: "",
        productUrl: "",
        notes: "",
        availability: "",
      });
      toast({
        title: "Success",
        description: "Price added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add price",
        variant: "destructive",
      });
    },
  });

  // Update price mutation
  const updatePriceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<AddPriceFormData> }) => {
      const response = await apiRequest("PUT", `/api/competitors/prices/${id}`, {
        price: data.price ? parseFloat(data.price) : undefined,
        originalPrice: data.originalPrice ? parseFloat(data.originalPrice) : undefined,
        productName: data.productName || undefined,
        productSku: data.productSku || undefined,
        productBarcode: data.productBarcode || undefined,
        productUrl: data.productUrl || undefined,
        notes: data.notes || undefined,
        availability: data.availability || undefined,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitor-prices", competitor.id] });
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
      setEditingPriceId(null);
      toast({
        title: "Success",
        description: "Price updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update price",
        variant: "destructive",
      });
    },
  });

  // Delete price mutation
  const deletePriceMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/competitors/prices/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitor-prices", competitor.id] });
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
      toast({
        title: "Success",
        description: "Price removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove price",
        variant: "destructive",
      });
    },
  });

  const handleProductSelect = (productId: string) => {
    const product = products.find((p) => p.id.toString() === productId);
    if (product) {
      setPriceFormData({
        ...priceFormData,
        productId: productId,
        productName: product.name || "",
        productSku: product.sku || "",
        productBarcode: product.barcode || "",
      });
    }
  };

  const handleAddPrice = () => {
    if (!priceFormData.productId || !priceFormData.price) {
      toast({
        title: "Validation Error",
        description: "Product and price are required",
        variant: "destructive",
      });
      return;
    }
    addPriceMutation.mutate(priceFormData);
  };

  const handleEditPrice = (price: CompetitorPriceWithProduct) => {
    setEditingPriceId(price.id);
    setPriceFormData({
      productId: price.productId.toString(),
      price: price.price.toString(),
      originalPrice: price.originalPrice?.toString() || "",
      productName: price.productName || "",
      productSku: price.productSku || "",
      productBarcode: price.productBarcode || "",
      productUrl: price.productUrl || "",
      notes: price.notes || "",
      availability: price.availability || "",
    });
    setIsAddingPrice(true);
  };

  const handleUpdatePrice = () => {
    if (!editingPriceId) return;
    if (!priceFormData.price) {
      toast({
        title: "Validation Error",
        description: "Price is required",
        variant: "destructive",
      });
      return;
    }
    updatePriceMutation.mutate({ id: editingPriceId, data: priceFormData });
  };

  const handleDeletePrice = (id: number, productName: string) => {
    if (confirm(`Are you sure you want to remove the price for ${productName}?`)) {
      deletePriceMutation.mutate(id);
    }
  };

  const handleCancelAdd = () => {
    setIsAddingPrice(false);
    setEditingPriceId(null);
    setPriceFormData({
      productId: "",
      price: "",
      originalPrice: "",
      productName: "",
      productSku: "",
      productBarcode: "",
      productUrl: "",
      notes: "",
      availability: "",
    });
    setSearchQuery("");
  };

  const getPriceComparison = (competitorPrice: number, ourPrice: number) => {
    const difference = competitorPrice - ourPrice;
    const percentage = ourPrice > 0 ? ((difference / ourPrice) * 100).toFixed(1) : "0";
    
    if (Math.abs(difference) < 0.01) {
      return { text: "Same", icon: Minus, color: "text-gray-600", bg: "bg-gray-100" };
    } else if (difference < 0) {
      return { text: `${Math.abs(difference).toFixed(2)} QR lower (${percentage}%)`, icon: TrendingDown, color: "text-green-600", bg: "bg-green-100" };
    } else {
      return { text: `${difference.toFixed(2)} QR higher (${percentage}%)`, icon: TrendingUp, color: "text-red-600", bg: "bg-red-100" };
    }
  };

  const getBusinessTypeColor = (type: string | null) => {
    switch (type) {
      case "retail":
        return "bg-blue-100 text-blue-800";
      case "wholesale":
        return "bg-purple-100 text-purple-800";
      case "online":
        return "bg-green-100 text-green-800";
      case "mixed":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const displayProducts = searchQuery.trim() ? searchResults : products;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {competitor.name}
          </DialogTitle>
          <DialogDescription>
            View competitor details and track pricing for products
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="items">
              Tracked Items ({prices.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Company Name</Label>
                    <p className="text-sm font-medium mt-1">{competitor.name}</p>
                  </div>
                  {competitor.description && (
                    <div>
                      <Label>Description</Label>
                      <p className="text-sm mt-1">{competitor.description}</p>
                    </div>
                  )}
                  <div>
                    <Label>Business Type</Label>
                    <Badge className={getBusinessTypeColor(competitor.businessType)}>
                      {competitor.businessType || "N/A"}
                    </Badge>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Badge variant={competitor.isActive ? "default" : "secondary"}>
                      {competitor.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {competitor.contactPerson && (
                    <div>
                      <Label>Contact Person</Label>
                      <p className="text-sm mt-1 flex items-center gap-2">
                        <User className="h-3 w-3" />
                        {competitor.contactPerson}
                      </p>
                    </div>
                  )}
                  {competitor.email && (
                    <div>
                      <Label>Email</Label>
                      <p className="text-sm mt-1 flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        {competitor.email}
                      </p>
                    </div>
                  )}
                  {competitor.phone && (
                    <div>
                      <Label>Phone</Label>
                      <p className="text-sm mt-1 flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        {competitor.phone}
                      </p>
                    </div>
                  )}
                  {competitor.website && (
                    <div>
                      <Label>Website</Label>
                      <a
                        href={competitor.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm mt-1 flex items-center gap-2 text-blue-600 hover:underline"
                      >
                        <Globe className="h-3 w-3" />
                        {competitor.website}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Location */}
              {(competitor.address || competitor.city || competitor.country) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Location
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {competitor.address && (
                      <div>
                        <Label>Address</Label>
                        <p className="text-sm mt-1">{competitor.address}</p>
                      </div>
                    )}
                    {(competitor.city || competitor.country) && (
                      <div>
                        <Label>City / Country</Label>
                        <p className="text-sm mt-1">
                          {competitor.city}
                          {competitor.city && competitor.country && ", "}
                          {competitor.country}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Notes */}
              {competitor.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{competitor.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="items" className="space-y-6">
            {/* Add Price Section */}
            {isAddingPrice && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {editingPriceId ? "Edit Tracked Item" : "Add Tracked Item"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!editingPriceId && (
                    <div>
                      <Label>Search Product</Label>
                      <div className="relative mt-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          placeholder="Search products by name, SKU, or barcode..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      {searchQuery.trim() && (
                        <div className="mt-2 max-h-40 overflow-y-auto border rounded-md">
                          {productsLoading ? (
                            <div className="p-4 text-center text-sm text-gray-500">Loading...</div>
                          ) : displayProducts.length === 0 ? (
                            <div className="p-4 text-center text-sm text-gray-500">No products found</div>
                          ) : (
                            displayProducts.slice(0, 10).map((product) => (
                              <div
                                key={product.id}
                                className="p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                                onClick={() => {
                                  handleProductSelect(product.id.toString());
                                  setSearchQuery("");
                                }}
                              >
                                <div className="font-medium text-sm">{product.name}</div>
                                <div className="text-xs text-gray-500">
                                  SKU: {product.sku} | Price: QR {product.price}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Product *</Label>
                      {editingPriceId ? (
                        <Input
                          value={prices.find((p) => p.id === editingPriceId)?.product?.name || ""}
                          disabled
                          className="mt-1"
                        />
                      ) : (
                        <Select
                          value={priceFormData.productId}
                          onValueChange={handleProductSelect}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id.toString()}>
                                {product.name} ({product.sku})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div>
                      <Label>Competitor Price (QR) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={priceFormData.price}
                        onChange={(e) => setPriceFormData({ ...priceFormData, price: e.target.value })}
                        placeholder="0.00"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Original Price (QR)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={priceFormData.originalPrice}
                        onChange={(e) => setPriceFormData({ ...priceFormData, originalPrice: e.target.value })}
                        placeholder="If on sale"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Availability</Label>
                      <Select
                        value={priceFormData.availability}
                        onValueChange={(value) => setPriceFormData({ ...priceFormData, availability: value })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select availability" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in_stock">In Stock</SelectItem>
                          <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                          <SelectItem value="limited">Limited Stock</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Competitor Product Name</Label>
                      <Input
                        value={priceFormData.productName}
                        onChange={(e) => setPriceFormData({ ...priceFormData, productName: e.target.value })}
                        placeholder="How competitor names this product"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Competitor SKU</Label>
                      <Input
                        value={priceFormData.productSku}
                        onChange={(e) => setPriceFormData({ ...priceFormData, productSku: e.target.value })}
                        placeholder="Competitor's SKU"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Product URL</Label>
                      <Input
                        value={priceFormData.productUrl}
                        onChange={(e) => setPriceFormData({ ...priceFormData, productUrl: e.target.value })}
                        placeholder="https://..."
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Competitor Barcode</Label>
                      <Input
                        value={priceFormData.productBarcode}
                        onChange={(e) => setPriceFormData({ ...priceFormData, productBarcode: e.target.value })}
                        placeholder="Barcode"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={priceFormData.notes}
                      onChange={(e) => setPriceFormData({ ...priceFormData, notes: e.target.value })}
                      placeholder="Additional notes..."
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={editingPriceId ? handleUpdatePrice : handleAddPrice}
                      disabled={addPriceMutation.isPending || updatePriceMutation.isPending}
                    >
                      {editingPriceId ? "Update" : "Add"} Price
                    </Button>
                    <Button variant="outline" onClick={handleCancelAdd}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tracked Items Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Tracked Items
                  </CardTitle>
                  {!isAddingPrice && (
                    <Button onClick={() => setIsAddingPrice(true)} size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Item
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {pricesLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading prices...</div>
                ) : prices.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-lg font-medium">No tracked items</p>
                    <p className="text-sm">Add items to track competitor pricing</p>
                    {!isAddingPrice && (
                      <Button onClick={() => setIsAddingPrice(true)} className="mt-4">
                        <Plus className="w-4 h-4 mr-2" />
                        Add First Item
                      </Button>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Our Price</TableHead>
                        <TableHead>Competitor Price</TableHead>
                        <TableHead>Difference</TableHead>
                        <TableHead>Availability</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {prices.map((price) => {
                        const ourPrice = price.product ? parseFloat(price.product.price) : 0;
                        const competitorPrice = parseFloat(price.price);
                        const comparison = ourPrice > 0 ? getPriceComparison(competitorPrice, ourPrice) : null;
                        const ComparisonIcon = comparison?.icon || Minus;

                        return (
                          <TableRow key={price.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">
                                  {price.product?.name || price.productName || "Unknown Product"}
                                </div>
                                {price.product?.sku && (
                                  <div className="text-xs text-gray-500">SKU: {price.product.sku}</div>
                                )}
                                {price.productSku && price.productSku !== price.product?.sku && (
                                  <div className="text-xs text-gray-500">Competitor SKU: {price.productSku}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {price.product ? (
                                <span className="font-medium">QR {ourPrice.toFixed(2)}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div>
                                <span className="font-medium">QR {competitorPrice.toFixed(2)}</span>
                                {price.originalPrice && parseFloat(price.originalPrice) > competitorPrice && (
                                  <div className="text-xs text-gray-500 line-through">
                                    QR {parseFloat(price.originalPrice).toFixed(2)}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {comparison ? (
                                <Badge className={`${comparison.bg} ${comparison.color}`}>
                                  <ComparisonIcon className="w-3 h-3 mr-1" />
                                  {comparison.text}
                                </Badge>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {price.availability ? (
                                <Badge
                                  variant={
                                    price.availability === "in_stock"
                                      ? "default"
                                      : price.availability === "out_of_stock"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                >
                                  {price.availability.replace("_", " ")}
                                </Badge>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Calendar className="w-3 h-3" />
                                {price.priceDate
                                  ? format(new Date(price.priceDate), "MMM d, yyyy")
                                  : "-"}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {price.productUrl && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => window.open(price.productUrl, "_blank")}
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditPrice(price)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleDeletePrice(
                                      price.id,
                                      price.product?.name || price.productName || "this item"
                                    )
                                  }
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

