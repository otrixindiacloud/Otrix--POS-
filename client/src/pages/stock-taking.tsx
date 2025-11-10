import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TableSkeleton } from "@/components/ui/skeleton-loader";
import LoadingSpinner from "@/components/ui/loading-spinner";
import {
  Barcode,
  Plus,
  Minus,
  Trash2,
  Check,
  X,
  Edit2,
  Calendar as CalendarIcon,
  RefreshCw,
  Download,
  Eye,
  Settings,
  ArrowLeft,
  Camera,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import MainLayout from "@/components/layout/main-layout";
import { Link } from "wouter";
import { BarcodeScanner } from "@/components/ui/barcode-scanner";

interface StockTakingItem {
  id?: number;
  productId?: number;
  sku: string;
  barcode?: string;
  name: string;
  uom: string;
  systemQty: number;
  actualQty: number;
  costPrice: number;
  sellingPrice: number;
  notes?: string;
  variance: number;
  varianceValue: number;
  isNewProduct: boolean;
}

interface ComparisonItem {
  productId?: number;
  sku: string;
  barcode?: string;
  name: string;
  systemQty: number;
  countedQty: number;
  variance: number;
  varianceValue: number;
  costPrice: number;
  status: "counted" | "missing" | "extra";
}

export default function StockTaking() {
  const [activeTab, setActiveTab] = useState("count");
  const [items, setItems] = useState<StockTakingItem[]>([]);
  const [scanInput, setScanInput] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<StockTakingItem>>({});
  const [stockDate, setStockDate] = useState<Date>(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [comparisonDate, setComparisonDate] = useState<Date>(new Date());
  const [isComparisonDatePickerOpen, setIsComparisonDatePickerOpen] =
    useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get stock taking sessions for comparison
  const { data: sessions = [] } = useQuery({
    queryKey: ["/api/stock-taking/sessions"],
    enabled: activeTab === "compare",
  });

  // Get comparison data
  const {
    data: rawComparisonData = [],
    isLoading: isLoadingComparison,
    refetch: refetchComparison,
  } = useQuery({
    queryKey: [
      "/api/stock-taking/comparison",
      comparisonDate.toISOString().split("T")[0],
    ],
    enabled: activeTab === "compare",
    queryFn: async (): Promise<ComparisonItem[]> => {
      const response = await fetch(
        `/api/stock-taking/comparison?date=${comparisonDate.toISOString().split("T")[0]}`,
      );
      if (!response.ok) throw new Error("Failed to fetch comparison data");
      const data = (await response.json()) as ComparisonItem[];
      return data;
    },
  });

  const comparisonData: ComparisonItem[] = useMemo(
    () =>
      rawComparisonData.map((item) => ({
        ...item,
        systemQty: Number(item.systemQty ?? 0),
        countedQty: Number(item.countedQty ?? 0),
        variance: Number(item.variance ?? 0),
        varianceValue: Number(item.varianceValue ?? 0),
        costPrice: Number(item.costPrice ?? 0),
      })),
    [rawComparisonData],
  );

  // Submit stock taking mutation
  const submitMutation = useMutation({
    mutationFn: async (data: {
      items: StockTakingItem[];
      stockDate: string;
    }) => {
      const response = await fetch("/api/stock-taking/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to submit stock taking");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Stock Taking Completed",
        description: `Successfully processed ${data.session.totalItems} items. ${data.newProducts} new products created, ${data.updatedProducts} products updated.`,
      });
      setItems([]);
      setScanInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/stock-taking/sessions"],
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update stock to zero mutation
  const updateStockMutation = useMutation({
    mutationFn: async (productIds: number[]) => {
      const response = await fetch("/api/products/update-stock-zero", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds }),
      });
      if (!response.ok) throw new Error("Failed to update stock");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Stock Updated",
        description: "Missing items have been set to zero stock.",
      });
      refetchComparison();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const calculateVariance = (
    systemQty: number,
    actualQty: number,
    costPrice: number,
  ) => {
    const variance = actualQty - systemQty;
    const varianceValue = variance * costPrice;
    return { variance, varianceValue };
  };

  const handleScan = async () => {
    if (!scanInput.trim()) return;

    try {
      // First check if it's an exact barcode match
      let response = await fetch(
        `/api/products/barcode/${encodeURIComponent(scanInput)}`,
      );
      let product = null;

      if (!response.ok) {
        // If not found by barcode, try SKU
        response = await fetch(
          `/api/products/sku/${encodeURIComponent(scanInput)}`,
        );
        if (!response.ok) {
          // If still not found, search by general query
          response = await fetch(
            `/api/products/search?q=${encodeURIComponent(scanInput)}`,
          );
          if (response.ok) {
            const products = await response.json();
            if (products.length === 1) {
              product = products[0];
            } else if (products.length > 1) {
              toast({
                title: "Multiple Products Found",
                description: `Found ${products.length} products. Please be more specific.`,
                variant: "destructive",
              });
              return;
            }
          }
        } else {
          product = await response.json();
        }
      } else {
        product = await response.json();
      }

      if (product) {
        // Check if already added
        const existingIndex = items.findIndex(
          (item) => item.productId === product.id,
        );
        if (existingIndex >= 0) {
          toast({
            title: "Product Already Added",
            description: "This product is already in the stock taking list.",
            variant: "destructive",
          });
          return;
        }

        const newItem: StockTakingItem = {
          productId: product.id,
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
          uom: product.uom || "ea",
          systemQty: product.stock || 0,
          actualQty: product.stock || 1,
          costPrice: parseFloat(product.costPrice || product.cost || "0"),
          sellingPrice: parseFloat(product.price || "0"),
          notes: "",
          variance: 0,
          varianceValue: 0,
          isNewProduct: false,
        };

        setItems([...items, newItem]);
        setScanInput("");
        toast({
          title: "Product Added",
          description: `${product.name} added to stock taking.`,
        });
      } else {
        // Product not found - create new product entry
        const newItem: StockTakingItem = {
          sku: scanInput,
          barcode: scanInput,
          name: `New Product - ${scanInput}`,
          uom: "ea",
          systemQty: 0,
          actualQty: 0,
          costPrice: 0,
          sellingPrice: 0,
          notes: "",
          variance: 0,
          varianceValue: 0,
          isNewProduct: true,
        };

        setItems([...items, newItem]);
        setScanInput("");
        toast({
          title: "New Product Added",
          description: "Product not found in system. Added as new product.",
        });
      }
    } catch (error) {
      console.error("Scan error:", error);
      toast({
        title: "Scan Error",
        description: "Failed to process scan input.",
        variant: "destructive",
      });
    }
  };

  const handleEditStart = (index: number) => {
    setEditingIndex(index);
    setEditForm({ ...items[index] });
  };

  const handleEditSave = () => {
    if (editingIndex === null) return;

    // Validate mandatory fields
    if (!editForm.name?.trim()) {
      toast({
        title: "Validation Error",
        description: "Product name is required.",
        variant: "destructive",
      });
      return;
    }
    
    if (!editForm.actualQty || editForm.actualQty <= 0) {
      toast({
        title: "Validation Error", 
        description: "Actual quantity must be greater than 0.",
        variant: "destructive",
      });
      return;
    }
    
    if (!editForm.costPrice || editForm.costPrice <= 0) {
      toast({
        title: "Validation Error",
        description: "Cost price must be greater than 0.",
        variant: "destructive",
      });
      return;
    }
    
    if (!editForm.sellingPrice || editForm.sellingPrice <= 0) {
      toast({
        title: "Validation Error",
        description: "Selling price must be greater than 0.",
        variant: "destructive",
      });
      return;
    }

    const updatedItem = { ...items[editingIndex], ...editForm };
    const { variance, varianceValue } = calculateVariance(
      updatedItem.systemQty,
      updatedItem.actualQty,
      updatedItem.costPrice,
    );
    updatedItem.variance = variance;
    updatedItem.varianceValue = varianceValue;

    const newItems = [...items];
    newItems[editingIndex] = updatedItem;
    setItems(newItems);
    setEditingIndex(null);
    setEditForm({});
  };

  const handleEditCancel = () => {
    setEditingIndex(null);
    setEditForm({});
  };

  const handleActualQtyChange = (index: number, value: string) => {
    const actualQty = parseFloat(value) || 0;
    const item = items[index];
    const { variance, varianceValue } = calculateVariance(
      item.systemQty,
      actualQty,
      item.costPrice,
    );

    const newItems = [...items];
    newItems[index] = {
      ...item,
      actualQty,
      variance,
      varianceValue,
    };
    setItems(newItems);
  };

  const handleQtyIncrease = (index: number) => {
    const item = items[index];
    const newQty = item.actualQty + 1;
    handleActualQtyChange(index, newQty.toString());
  };

  const handleQtyDecrease = (index: number) => {
    const item = items[index];
    const newQty = Math.max(0, item.actualQty - 1);
    handleActualQtyChange(index, newQty.toString());
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast({
        title: "No Items",
        description: "Please add at least one item to submit.",
        variant: "destructive",
      });
      return;
    }

    submitMutation.mutate({
      items,
      stockDate: stockDate.toISOString().split("T")[0],
    });
  };

  const handleAddManual = () => {
    const newItem: StockTakingItem = {
      sku: `NEW-${Date.now()}`,
      name: "New Product",
      uom: "ea",
      systemQty: 0,
      actualQty: 1, // Default to 1 for manual products
      costPrice: 0,
      sellingPrice: 0,
      notes: "",
      variance: 0,
      varianceValue: 0,
      isNewProduct: true,
    };
    setItems([...items, newItem]);
    setEditingIndex(items.length);
    setEditForm(newItem);
  };

  const handleUpdateMissingStock = () => {
    const missingItems = comparisonData.filter(
      (item: ComparisonItem) => item.status === "missing",
    );
    const productIds = missingItems
      .map((item: ComparisonItem) => item.productId)
      .filter((id): id is number => typeof id === "number");

    if (productIds.length > 0) {
      updateStockMutation.mutate(productIds);
    }
  };

  const exportComparison = () => {
    const csvContent = [
      [
        "SKU",
        "Product Name",
        "System Qty",
        "Counted Qty",
        "Variance",
        "Variance Value",
        "Status",
      ].join(","),
      ...comparisonData.map((item: ComparisonItem) =>
        [
          item.sku,
          `"${item.name}"`,
          item.systemQty,
          item.countedQty,
          item.variance,
          item.varianceValue.toFixed(2),
          item.status,
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-comparison-${comparisonDate.toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleBarcodeScanned = async (barcode: string) => {
    setScanInput(barcode);
    setShowBarcodeScanner(false);

    // Automatically process the scanned barcode immediately
    try {
      // First check if it's an exact barcode match
      let response = await fetch(
        `/api/products/barcode/${encodeURIComponent(barcode)}`,
      );
      let product = null;

      if (!response.ok) {
        // If not found by barcode, try SKU
        response = await fetch(
          `/api/products/sku/${encodeURIComponent(barcode)}`,
        );
        if (!response.ok) {
          // If still not found, search by general query
          response = await fetch(
            `/api/products/search?q=${encodeURIComponent(barcode)}`,
          );
          if (response.ok) {
            const products = await response.json();
            if (products.length === 1) {
              product = products[0];
            } else if (products.length > 1) {
              toast({
                title: "Multiple Products Found",
                description: `Found ${products.length} products for barcode ${barcode}. Please check manually.`,
                variant: "destructive",
              });
              return;
            }
          }
        } else {
          product = await response.json();
        }
      } else {
        product = await response.json();
      }

      if (product) {
        // Check if already added
        const existingIndex = items.findIndex(
          (item) => item.productId === product.id,
        );
        if (existingIndex >= 0) {
          toast({
            title: "Product Already Added",
            description: "This product is already in the stock taking list.",
            variant: "destructive",
          });
          setScanInput("");
          return;
        }

        const newItem: StockTakingItem = {
          productId: product.id,
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
          uom: product.uom || "ea",
          systemQty: product.stock || 0,
          actualQty: 1, // Default to 1 for scanning
          costPrice: parseFloat(product.costPrice || product.cost || "0"),
          sellingPrice: parseFloat(product.price || "0"),
          notes: "",
          variance: 0,
          varianceValue: 0,
          isNewProduct: false,
        };

        setItems([...items, newItem]);
        setScanInput("");
        toast({
          title: "Product Scanned & Added",
          description: `${product.name} automatically added to stock taking.`,
        });
      } else {
        // Product not found - create new product entry
        const newItemIndex = items.length;
        const newItem: StockTakingItem = {
          sku: barcode,
          barcode: barcode,
          name: `New Product - ${barcode}`,
          uom: "ea",
          systemQty: 0,
          actualQty: 1, // Default to 1 for new products
          costPrice: 0,
          sellingPrice: 0,
          notes: "",
          variance: 0,
          varianceValue: 0,
          isNewProduct: true,
        };

        setItems([...items, newItem]);
        setScanInput("");
        
        // Auto-open edit mode for new products
        setEditingIndex(newItemIndex);
        setEditForm(newItem);
        
        toast({
          title: "New Product Scanned & Added",
          description: `Barcode ${barcode} not found in system. Added as new product. Please fill in the details.`,
        });
      }
    } catch (error) {
      console.error("Barcode processing error:", error);
      toast({
        title: "Scan Error",
        description: `Failed to process barcode ${barcode}.`,
        variant: "destructive",
      });
    }
  };

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Professional Header with Light Colors */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/inventory">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="p-2 hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors rounded-lg"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                </Link>
                <div>
                  <h1 className="text-3xl font-bold text-gray-800">
                    Stock Taking
                  </h1>
                  <p className="text-sm text-gray-500 mt-1 font-medium">
                    Professional inventory management system
                  </p>
                </div>
              </div>
              <div className="text-right bg-blue-50 px-4 py-3 rounded-lg border border-blue-200">
                <div className="text-sm font-semibold text-blue-700">
                  {format(new Date(), "MMM dd")}
                </div>
                <div className="text-xs text-gray-600 font-medium">
                  {format(new Date(), "yyyy")}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="bg-white shadow-sm border-b border-gray-200">
            <div className="px-6">
              <TabsList className="w-full grid grid-cols-2 bg-transparent rounded-none h-14 p-0 border-0">
                <TabsTrigger
                  value="count"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 font-semibold transition-all px-6 py-4"
                >
                  <Barcode className="w-5 h-5 mr-2" />
                  Physical Count
                </TabsTrigger>
                <TabsTrigger
                  value="compare"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 font-semibold transition-all px-6 py-4"
                >
                  <Eye className="w-5 h-5 mr-2" />
                  Compare & Report
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <TabsContent value="count" className="space-y-6 mt-0">
              {/* Enhanced Date Selection */}
              <Card className="border border-gray-200 shadow-sm bg-white">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-blue-600" />
                      Stock Taking Date
                    </Label>
                    <Popover
                      open={isDatePickerOpen}
                      onOpenChange={setIsDatePickerOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left bg-white hover:bg-blue-500 border-gray-300 hover:border-blue-400 transition-colors"
                        >
                          <CalendarIcon className="w-4 h-4 mr-2 text-blue-600" />
                          <span className="font-medium">{format(stockDate, "PPP")}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={stockDate}
                          onSelect={(date) => {
                            if (date) setStockDate(date);
                            setIsDatePickerOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardContent>
              </Card>

              {/* Enhanced Scanner Section */}
              <Card className="border border-gray-200 shadow-sm bg-white">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Barcode className="w-4 h-4 text-blue-600" />
                      Scan or Search Product
                    </Label>
                    <div className="flex gap-3">
                      <Input
                        placeholder="Scan barcode or enter SKU..."
                        value={scanInput}
                        onChange={(e) => setScanInput(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleScan()}
                        className="flex-1 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                      <Button
                        onClick={() => setShowBarcodeScanner(true)}
                        size="sm"
                        className="px-4 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
                      >
                        <Camera className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={handleScan}
                        disabled={!scanInput.trim()}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                      >
                        <Barcode className="w-4 h-4" />
                      </Button>
                    </div>
                    <Button
                      onClick={handleAddManual}
                      variant="outline"
                      className="w-full border-blue-300 hover:bg-blue-500 hover:border-blue-400 text-blue-700 font-medium transition-colors"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Manual Item
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Enhanced Items List */}
              <div className="space-y-4">
                {items.length === 0 ? (
                  <Card className="border border-gray-200 shadow-sm bg-white">
                    <CardContent className="p-12 text-center">
                      <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                        <Barcode className="w-10 h-10 text-blue-600" />
                      </div>
                      <p className="text-gray-700 font-medium text-lg mb-2">No items scanned yet</p>
                      <p className="text-sm text-gray-500">
                        Use the scanner above to add products to your inventory count
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  items.map((item, index) => (
                    <Card
                      key={index}
                      className={`border shadow-sm transition-all hover:shadow-md ${
                        item.isNewProduct 
                          ? "bg-blue-50 border-blue-200 border-l-4 border-l-blue-500" 
                          : "bg-white border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <CardContent className="p-6">
                        {editingIndex === index ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-xs font-medium text-gray-700">SKU</Label>
                                <Input
                                  value={editForm.sku || ""}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      sku: e.target.value,
                                    })
                                  }
                                  className="mt-1 border-gray-300 focus:border-blue-500"
                                />
                              </div>
                              <div>
                                <Label className="text-xs font-medium text-gray-700">UOM</Label>
                                <Input
                                  value={editForm.uom || ""}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      uom: e.target.value,
                                    })
                                  }
                                  className="mt-1 border-gray-300 focus:border-blue-500"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-700">Product Name</Label>
                              <Input
                                value={editForm.name || ""}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    name: e.target.value,
                                  })
                                }
                                className="mt-1 border-gray-300 focus:border-blue-500"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-xs font-medium text-gray-700">Cost Price</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editForm.costPrice || 0}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      costPrice:
                                        parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="mt-1 border-gray-300 focus:border-blue-500"
                                />
                              </div>
                              <div>
                                <Label className="text-xs font-medium text-gray-700">Selling Price</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editForm.sellingPrice || 0}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      sellingPrice:
                                        parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="mt-1 border-gray-300 focus:border-blue-500"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-700">Actual Quantity</Label>
                              <Input
                                type="number"
                                value={editForm.actualQty || 0}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    actualQty: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="mt-1 border-gray-300 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-700">Notes</Label>
                              <Textarea
                                value={editForm.notes || ""}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    notes: e.target.value,
                                  })
                                }
                                className="mt-1 border-gray-300 focus:border-blue-500"
                                rows={2}
                              />
                            </div>
                            <div className="flex gap-3">
                              <Button
                                onClick={handleEditSave}
                                size="sm"
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-md"
                              >
                                <Check className="w-4 h-4 mr-2" />
                                Save
                              </Button>
                              <Button
                                onClick={handleEditCancel}
                                variant="outline"
                                size="sm"
                                className="flex-1 border-gray-300 hover:bg-gray-100"
                              >
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3
                                    className={`font-semibold text-base ${item.isNewProduct ? "text-blue-700" : "text-gray-800"}`}
                                  >
                                    {item.name}
                                  </h3>
                                  {item.isNewProduct && (
                                    <Badge
                                      className="text-xs bg-blue-600 text-white"
                                    >
                                      NEW
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500 font-mono">
                                  SKU: {item.sku}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditStart(index)}
                                  className="p-2 hover:bg-blue-100 text-blue-600 rounded-full"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setItems(
                                      items.filter((_, i) => i !== index),
                                    )
                                  }
                                  className="p-2 hover:bg-red-100 text-red-600 rounded-full"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-lg">
                              <div>
                                <span className="text-gray-600 font-medium">
                                  System Qty:
                                </span>
                                <span className="ml-2 font-semibold text-gray-800">
                                  {item.systemQty}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600 font-medium">UOM:</span>
                                <span className="ml-2 text-gray-800">{item.uom}</span>
                              </div>
                            </div>

                            <div>
                              <Label className="text-xs font-semibold text-gray-700">Actual Quantity</Label>
                              <div className="flex items-center gap-3 mt-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleQtyDecrease(index)}
                                  className="h-10 w-10 p-0 rounded-full border-2 border-red-300 hover:bg-red-50 hover:border-red-400 text-red-600"
                                  disabled={item.actualQty <= 0}
                                >
                                  <Minus className="w-4 h-4" />
                                </Button>
                                <Input
                                  type="number"
                                  value={item.actualQty}
                                  onChange={(e) =>
                                    handleActualQtyChange(index, e.target.value)
                                  }
                                  className="text-center flex-1 h-10 font-semibold text-lg border-2 border-blue-300 focus:border-blue-500"
                                  min="0"
                                  step="1"
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleQtyIncrease(index)}
                                  className="h-10 w-10 p-0 rounded-full border-2 border-green-300 hover:bg-green-50 hover:border-green-400 text-green-600"
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                              <div>
                                <span className="text-xs text-gray-600 font-medium">
                                  Variance:
                                </span>
                                <span
                                  className={`ml-2 font-bold text-lg ${
                                    item.variance > 0
                                      ? "text-green-600"
                                      : item.variance < 0
                                        ? "text-red-600"
                                        : "text-gray-600"
                                  }`}
                                >
                                  {item.variance > 0 ? "+" : ""}
                                  {item.variance}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-xs text-gray-600 font-medium">
                                  Value:
                                </span>
                                <span
                                  className={`ml-2 font-bold text-lg ${
                                    (item.varianceValue || 0) > 0
                                      ? "text-green-600"
                                      : (item.varianceValue || 0) < 0
                                        ? "text-red-600"
                                        : "text-gray-600"
                                  }`}
                                >
                                  QR {(item.varianceValue || 0).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Enhanced Summary & Submit */}
              {items.length > 0 && (
                <Card className="border border-blue-200 shadow-sm bg-blue-50">
                  <CardContent className="p-6">
                    <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
                      <Settings className="w-5 h-5 text-blue-600" />
                      Stock Taking Summary
                    </h3>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <span className="text-gray-600 text-xs font-medium block mb-1">Total Items</span>
                        <span className="text-2xl font-bold text-gray-800">{items.length}</span>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <span className="text-gray-600 text-xs font-medium block mb-1">New Products</span>
                        <span className="text-2xl font-bold text-blue-600">
                          {items.filter((i) => i.isNewProduct).length}
                        </span>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <span className="text-gray-600 text-xs font-medium block mb-1">Variance Items</span>
                        <span className="text-2xl font-bold text-orange-600">
                          {items.filter((i) => i.variance !== 0).length}
                        </span>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <span className="text-gray-600 text-xs font-medium block mb-1">Total Variance</span>
                        <span
                          className={`text-2xl font-bold ${
                            items.reduce(
                              (sum, item) => sum + item.varianceValue,
                              0,
                            ) > 0
                              ? "text-green-600"
                              : items.reduce(
                                    (sum, item) => sum + item.varianceValue,
                                    0,
                                  ) < 0
                                ? "text-red-600"
                                : "text-gray-600"
                          }`}
                        >
                          QR
                          {items
                            .reduce((sum, item) => sum + item.varianceValue, 0)
                            .toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <Button
                      onClick={handleSubmit}
                      disabled={submitMutation.isPending}
                      className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all"
                    >
                      {submitMutation.isPending ? (
                        <>
                          <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                          Submitting Stock Taking...
                        </>
                      ) : (
                        <>
                          <Check className="w-5 h-5 mr-2" />
                          Submit Stock Taking
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="compare" className="space-y-6 mt-0">
              {/* Date Selection for Comparison */}
              <Card className="border border-gray-200 shadow-sm bg-white">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-blue-600" />
                      Select Date for Comparison
                    </Label>
                    <Popover
                      open={isComparisonDatePickerOpen}
                      onOpenChange={setIsComparisonDatePickerOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left bg-white hover:bg-blue-500 border-gray-300 hover:border-blue-400 transition-colors"
                        >
                          <CalendarIcon className="w-4 h-4 mr-2 text-blue-600" />
                          {format(comparisonDate, "PPP")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={comparisonDate}
                          onSelect={(date) => {
                            if (date) setComparisonDate(date);
                            setIsComparisonDatePickerOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => refetchComparison()}
                        variant="outline"
                        className="flex-1 border-gray-300 hover:bg-blue-500"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                      </Button>
                      <Button
                        onClick={exportComparison}
                        variant="outline"
                        className="flex-1 border-gray-300 hover:bg-blue-500"
                        disabled={comparisonData.length === 0}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Comparison Results */}
              {isLoadingComparison ? (
                <Card className="border border-gray-200 shadow-sm bg-white">
                  <CardContent className="p-12 text-center">
                    <RefreshCw className="w-8 h-8 text-gray-400 mx-auto mb-4 animate-spin" />
                    <p className="text-gray-500 font-medium">Loading comparison data...</p>
                  </CardContent>
                </Card>
              ) : comparisonData.length === 0 ? (
                <Card className="border border-gray-200 shadow-sm bg-white">
                  <CardContent className="p-12 text-center">
                    <Eye className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">No stock taking data found</p>
                    <p className="text-sm text-gray-400 mt-1">
                      for {format(comparisonDate, "PPP")}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-green-50 border-green-200 shadow-sm">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-green-700">
                          {
                            comparisonData.filter(
                              (item: ComparisonItem) =>
                                item.status === "counted",
                            ).length
                          }
                        </div>
                        <div className="text-sm text-green-600 font-medium">Counted</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-red-50 border-red-200 shadow-sm">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-red-700">
                          {
                            comparisonData.filter(
                              (item: ComparisonItem) =>
                                item.status === "missing",
                            ).length
                          }
                        </div>
                        <div className="text-sm text-red-600 font-medium">Missing</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-blue-50 border-blue-200 shadow-sm">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-blue-700">
                          {
                            comparisonData.filter(
                              (item: ComparisonItem) => item.status === "extra",
                            ).length
                          }
                        </div>
                        <div className="text-sm text-blue-600 font-medium">Extra</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Update Missing Items Button */}
                  {comparisonData.filter(
                    (item: ComparisonItem) => item.status === "missing",
                  ).length > 0 && (
                    <Button
                      onClick={handleUpdateMissingStock}
                      disabled={updateStockMutation.isPending}
                      className="w-full bg-red-600 hover:bg-red-700 text-white shadow-md"
                    >
                      {updateStockMutation.isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Settings className="w-4 h-4 mr-2" />
                          Set Missing Items to Zero Stock
                        </>
                      )}
                    </Button>
                  )}

                  {/* Comparison Items */}
                  <div className="space-y-4">
                    {comparisonData.map(
                      (item: ComparisonItem, index: number) => (
                        <Card
                          key={index}
                          className={`shadow-sm transition-all hover:shadow-md ${
                            item.status === "missing"
                              ? "border-red-200 bg-red-50"
                              : item.status === "extra"
                                ? "border-blue-200 bg-blue-50"
                                : item.variance !== 0
                                  ? "border-yellow-200 bg-yellow-50"
                                  : "border-gray-200 bg-white"
                          }`}
                        >
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 text-base">
                                  {item.name}
                                </h3>
                                <p className="text-sm text-gray-500 font-mono mt-1">
                                  {item.sku}
                                </p>
                              </div>
                              <Badge
                                variant={
                                  item.status === "missing"
                                    ? "destructive"
                                    : item.status === "extra"
                                      ? "default"
                                      : item.variance === 0
                                        ? "secondary"
                                        : "outline"
                                }
                                className="px-3 py-1"
                              >
                                {item.status === "missing"
                                  ? "MISSING"
                                  : item.status === "extra"
                                    ? "EXTRA"
                                    : item.variance === 0
                                      ? "OK"
                                      : "VARIANCE"}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-lg">
                              <div>
                                <span className="text-gray-600 font-medium">
                                  System Qty:
                                </span>
                                <span className="ml-2 font-semibold text-gray-800">
                                  {item.systemQty}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600 font-medium">
                                  Counted Qty:
                                </span>
                                <span className="ml-2 font-semibold text-gray-800">
                                  {item.countedQty}
                                </span>
                              </div>
                            </div>

                            {item.variance !== 0 && (
                              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mt-4 border border-gray-200">
                                <div>
                                  <span className="text-xs text-gray-600 font-medium">
                                    Variance:
                                  </span>
                                  <span
                                    className={`ml-2 font-bold text-lg ${
                                      item.variance > 0
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }`}
                                  >
                                    {item.variance > 0 ? "+" : ""}
                                    {item.variance}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-xs text-gray-600 font-medium">
                                    Value:
                                  </span>
                                  <span
                                    className={`ml-2 font-bold text-lg ${
                                      (item.varianceValue || 0) > 0
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }`}
                                  >
                                    QR {(item.varianceValue || 0).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ),
                    )}
                  </div>
                </>
              )}
            </TabsContent>
          </div>
        </Tabs>

        {/* Barcode Scanner Modal */}
        <BarcodeScanner
          isOpen={showBarcodeScanner}
          onClose={() => setShowBarcodeScanner(false)}
          onScan={handleBarcodeScanned}
        />
      </div>
    </MainLayout>
  );
}
