import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, X, Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertProductSchema } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { getProductTypes, getCategoriesByType, type ProductType, type Category } from "@/config/product-categories";
import { useStore } from "@/hooks/useStore";

interface AIProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  isBarcode?: boolean;
}

interface AIProductResult {
  name: string;
  description: string;
  category: string;
  suggestedPrice: number;
  sku: string;
  barcode: string;
  confidence: number;
}

export default function AIProductModal({ isOpen, onClose, searchQuery, isBarcode = false }: AIProductModalProps) {
  const [aiResult, setAiResult] = useState<AIProductResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedProductType, setSelectedProductType] = useState<string>("");
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const { toast } = useToast();
  const { currentStore } = useStore();

  const productTypes = getProductTypes();

  const form = useForm({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      name: "",
      description: "",
      productType: "",
      category: "",
      price: "0.00",
      cost: "0.00",
      sku: "",
      barcode: "",
      stock: 0,
      quantity: 0,
      lowStockThreshold: 5,
    },
  });

  // Update available categories when product type changes
  useEffect(() => {
    if (selectedProductType) {
      const categories = getCategoriesByType(selectedProductType);
      setAvailableCategories(categories);
      
      // Reset category if it doesn't belong to the new type
      const currentCategory = form.getValues("category");
      if (currentCategory && !categories.some(cat => cat.value === currentCategory)) {
        form.setValue("category", "");
      }
    } else {
      setAvailableCategories([]);
      form.setValue("category", "");
    }
  }, [selectedProductType, form]);

  const searchWithAI = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await apiRequest<AIProductResult>({
        url: "/api/products/ai-search",
        method: "POST",
        body: {
          query: searchQuery,
          isBarcode: isBarcode,
        },
      });

      const result = await response.json();
      setAiResult(result);
      
      // Populate form with AI results
      form.reset({
        name: result.name || "",
        description: result.description || "",
        productType: "", // AI doesn't determine product type, user must select
        category: result.category || "",
        price: result.suggestedPrice?.toString() || "0.00",
        cost: "0.00", // AI doesn't provide cost, user must enter
        sku: result.sku || "",
        barcode: result.barcode || "",
        stock: 0,
        quantity: 0,
        lowStockThreshold: 5,
      });
      
      setSelectedProductType(""); // Reset product type selection

      toast({
        title: "AI Search Complete",
        description: `Found product details with ${Math.round((result.confidence || 0) * 100)}% confidence`,
      });
    } catch (error) {
      console.error("AI search error:", error);
      toast({
        title: "AI Search Failed",
        description: "Could not find product details. Please enter manually.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (data: any) => {
    // Validate required fields
    const errors: string[] = [];
    
    if (!data.name?.trim()) {
      errors.push("Product Name is required");
    }
    if (!data.description?.trim()) {
      errors.push("Description is required");
    }
    if (!data.sku?.trim()) {
      errors.push("SKU is required");
    }
    if (!data.barcode?.trim()) {
      errors.push("Barcode is required");
    }
    if (!data.price || parseFloat(data.price) <= 0) {
      errors.push("Price must be greater than 0");
    }
    if (!data.cost || parseFloat(data.cost) < 0) {
      errors.push("Cost is required and must be 0 or greater");
    }
    
    if (errors.length > 0) {
      toast({
        title: "Validation Error",
        description: (
          <div className="space-y-1">
            <p className="font-semibold">Please fill in all required fields:</p>
            <ul className="list-disc list-inside">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        ),
        variant: "destructive",
      });
      return;
    }

    // Ensure a store is selected
    if (!currentStore?.id) {
      toast({
        title: "Error",
        description: "Please select a store before adding a product.",
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    try {
      await apiRequest({
        url: "/api/products",
        method: "POST",
        body: {
          ...data,
          storeId: currentStore.id,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["/api/products"] });

      toast({
        title: "Success",
        description: "Product added successfully!",
      });

      handleClose();
    } catch (error) {
      console.error("Error adding product:", error);
      toast({
        title: "Error",
        description: "Failed to add product. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleClose = () => {
    setAiResult(null);
    form.reset();
    onClose();
  };

  const handleOpenChange = (open: boolean) => {
    if (open && !aiResult && searchQuery) {
      searchWithAI();
    } else if (!open) {
      handleClose();
    }
  };

  const confidenceColor = aiResult 
    ? aiResult.confidence >= 0.8 
      ? "bg-green-100 text-green-800" 
      : aiResult.confidence >= 0.6 
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-800"
    : "";

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Sparkles className="w-5 h-5 mr-2 text-purple-600" />
            AI Product Search
          </DialogTitle>
          <DialogDescription>
            Use AI to find product details and add them to your inventory
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Required Fields Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Required fields are marked with </span>
              <span className="text-red-600 font-bold">*</span>
              <span className="font-semibold"> (Name, Description, SKU, Barcode, Price, and Cost)</span>
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Review and modify AI suggestions below before saving
            </p>
          </div>

          {/* Search Query Display */}
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-800">
                    Searching for: <span className="font-bold">{searchQuery}</span>
                  </p>
                  <p className="text-xs text-purple-600">
                    {isBarcode ? "Barcode search" : "Product name search"}
                  </p>
                </div>
                {isSearching && <Loader2 className="w-5 h-5 animate-spin text-purple-600" />}
              </div>
            </CardContent>
          </Card>

          {/* AI Results */}
          {aiResult && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-green-800 flex items-center">
                    <Check className="w-4 h-4 mr-2" />
                    AI Found Product Details
                  </h3>
                  <Badge className={confidenceColor}>
                    {Math.round((aiResult.confidence || 0) * 100)}% confidence
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm bg-white p-3 rounded border border-green-200">
                  <div><strong>Name:</strong> {aiResult.name || "Unknown"}</div>
                  <div><strong>Category:</strong> {aiResult.category || "General"}</div>
                  <div><strong>Suggested Price:</strong> QR {(aiResult.suggestedPrice || 0).toFixed(2)}</div>
                  <div><strong>SKU:</strong> {aiResult.sku || "N/A"}</div>
                  <div className="col-span-2"><strong>Barcode:</strong> {aiResult.barcode || "N/A"}</div>
                </div>
                <div className="mt-2 text-sm bg-white p-3 rounded border border-green-200">
                  <strong>Description:</strong> {aiResult.description || "No description available"}
                </div>
                <p className="text-xs text-green-700 mt-2 italic">
                  ✓ Form fields below have been pre-filled with AI suggestions. You can edit them before saving.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Product Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Product Name <span className="text-red-600">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Enter product name" 
                        className={form.formState.errors.name ? "border-red-400" : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="productType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Type</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedProductType(value);
                        }} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select product type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {productTypes.map((type: ProductType) => (
                            <SelectItem key={type.value} value={type.value}>
                              <span className="flex items-center gap-2">
                                <span>{type.icon}</span>
                                <span>{type.label}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                        disabled={!selectedProductType}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={selectedProductType ? "Select category" : "Select type first"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableCategories.map((category: Category) => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Description <span className="text-red-600">*</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Enter detailed product description" 
                        rows={3}
                        className={form.formState.errors.description ? "border-red-400" : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Price (QR) <span className="text-red-600">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01" 
                          min="0"
                          placeholder="0.00"
                          onChange={(e) => field.onChange(e.target.value)}
                          className={form.formState.errors.price ? "border-red-400" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Cost (QR) <span className="text-red-600">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01" 
                          min="0"
                          placeholder="0.00"
                          onChange={(e) => field.onChange(e.target.value)}
                          className={form.formState.errors.cost ? "border-red-400" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          min="0"
                          placeholder="0"
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          min="0"
                          placeholder="0"
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        SKU <span className="text-red-600">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Product SKU (must be unique)" 
                          className={form.formState.errors.sku ? "border-red-400" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="barcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Barcode <span className="text-red-600">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Product barcode" 
                          className={form.formState.errors.barcode ? "border-red-400" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={handleClose} disabled={isAdding}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                {!aiResult && !isSearching && (
                  <Button type="button" onClick={searchWithAI} className="bg-purple-600 hover:bg-purple-700">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Search with AI
                  </Button>
                )}
                <Button type="submit" disabled={isAdding}>
                  {isAdding ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  {isAdding ? "Adding..." : "Add Product"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}