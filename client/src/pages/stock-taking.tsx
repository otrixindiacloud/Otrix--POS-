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
  description?: string;
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
          description: product.description || "",
          variance: 0,
          varianceValue: 0,
          isNewProduct: product.isExternal || false,
        };

        setItems([...items, newItem]);
        setScanInput("");
        
        if (product.isExternal) {
          toast({
            title: "✅ Product Found Online!",
            description: `${product.name} - Auto-filled from barcode database. Please verify and set prices.`,
          });
        } else {
          toast({
            title: "Product Added",
            description: `${product.name} added to stock taking.`,
          });
        }
      } else {
        // Product not found in local system - try external barcode databases
        let externalProduct = null;
        let sourceName = "";
        try {
          toast({
            title: "🔍 Searching online...",
            description: "Looking up barcode in GO-UPC and other databases",
          });
          
          // Try GO-UPC API first (most comprehensive)
          try {
            const goUpcResponse = await fetch(`https://go-upc.com/api/v1/code/${scanInput}`);
            console.log("GO-UPC Response Status:", goUpcResponse.status);
            
            if (goUpcResponse.ok) {
              const goUpcData = await goUpcResponse.json();
              console.log("GO-UPC Data:", goUpcData);
              
              // Handle GO-UPC response format
              if (goUpcData && goUpcData.codeType && goUpcData.product) {
                sourceName = "GO-UPC";
                externalProduct = {
                  name: goUpcData.product.name || goUpcData.product.title || "",
                  description: goUpcData.product.description || goUpcData.product.category || "",
                  brand: goUpcData.product.brand || "",
                };
              }
            } else {
              console.log("GO-UPC returned non-OK status:", goUpcResponse.status);
            }
          } catch (goUpcError) {
            console.log("Could not fetch from GO-UPC:", goUpcError);
          }
          
          // If not found in GO-UPC, try Open Food Facts
          if (!externalProduct || !externalProduct.name) {
            const openFoodResponse = await fetch(`https://world.openfoodfacts.org/api/v0/product/${scanInput}.json`);
            if (openFoodResponse.ok) {
              const openFoodData = await openFoodResponse.json();
              if (openFoodData.status === 1 && openFoodData.product) {
                sourceName = "Open Food Facts";
                externalProduct = {
                  name: openFoodData.product.product_name || openFoodData.product.product_name_en || "",
                  description: openFoodData.product.generic_name || openFoodData.product.categories || "",
                  brand: openFoodData.product.brands || "",
                };
              }
            }
          }

          // If still not found, try UPC Item DB
          if (!externalProduct || !externalProduct.name) {
            try {
              const upcResponse = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${scanInput}`);
              if (upcResponse.ok) {
                const upcData = await upcResponse.json();
                if (upcData.code === "OK" && upcData.items && upcData.items.length > 0) {
                  const item = upcData.items[0];
                  sourceName = "UPC Item DB";
                  externalProduct = {
                    name: item.title || "",
                    description: item.description || item.category || "",
                    brand: item.brand || "",
                  };
                }
              }
            } catch (upcError) {
              console.log("Could not fetch from UPC Item DB:", upcError);
            }
          }
        } catch (error) {
          console.log("Could not fetch from external barcode databases:", error);
        }

        const newItem: StockTakingItem = {
          sku: scanInput,
          barcode: scanInput,
          name: externalProduct ? `${externalProduct.brand ? externalProduct.brand + ' - ' : ''}${externalProduct.name}` : `New Product - ${scanInput}`,
          uom: "ea",
          systemQty: 0,
          actualQty: 1,
          costPrice: 0,
          sellingPrice: 0,
          description: externalProduct?.description || "",
          variance: 0,
          varianceValue: 0,
          isNewProduct: true,
        };

        setItems([...items, newItem]);
        setScanInput("");
        toast({
          title: externalProduct ? `✅ Found on ${sourceName}!` : "⚠️ Product Not Found",
          description: externalProduct 
            ? `${newItem.name} - Auto-filled from ${sourceName}. Please verify and set prices.`
            : `Product not found. You can check https://go-upc.com/search?q=${scanInput} or enter details manually.`,
          variant: externalProduct ? "default" : "destructive",
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
      description: "",
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
          description: product.description || "",
          variance: 0,
          varianceValue: 0,
          isNewProduct: product.isExternal || false, // Mark external products as new
        };

        setItems([...items, newItem]);
        setScanInput("");
        
        if (product.isExternal) {
          toast({
            title: "✅ Product Found Online!",
            description: `${product.name} - Auto-filled from barcode database. Please verify and set prices.`,
          });
        } else {
          toast({
            title: "Product Scanned & Added",
            description: `${product.name} automatically added to stock taking.`,
          });
        }
      } else {
        // Product not found in system - try external barcode databases
        let externalProduct = null;
        let sourceName = "";
        try {
          // Try GO-UPC API first (most comprehensive)
          try {
            const goUpcResponse = await fetch(`https://go-upc.com/api/v1/code/${barcode}`);
            console.log("GO-UPC Response Status:", goUpcResponse.status);
            
            if (goUpcResponse.ok) {
              const goUpcData = await goUpcResponse.json();
              console.log("GO-UPC Data:", goUpcData);
              
              // Handle GO-UPC response format
              if (goUpcData && goUpcData.codeType && goUpcData.product) {
                sourceName = "GO-UPC";
                externalProduct = {
                  name: goUpcData.product.name || goUpcData.product.title || "",
                  description: goUpcData.product.description || goUpcData.product.category || "",
                  brand: goUpcData.product.brand || "",
                };
              }
            } else {
              console.log("GO-UPC returned non-OK status:", goUpcResponse.status);
            }
          } catch (goUpcError) {
            console.log("Could not fetch from GO-UPC:", goUpcError);
          }
          
          // If not found in GO-UPC, try Open Food Facts
          if (!externalProduct || !externalProduct.name) {
            const openFoodResponse = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
            if (openFoodResponse.ok) {
              const openFoodData = await openFoodResponse.json();
              if (openFoodData.status === 1 && openFoodData.product) {
                sourceName = "Open Food Facts";
                externalProduct = {
                  name: openFoodData.product.product_name || openFoodData.product.product_name_en || "",
                  description: openFoodData.product.generic_name || openFoodData.product.categories || "",
                  brand: openFoodData.product.brands || "",
                };
              }
            }
          }

          // If still not found, try UPC Item DB
          if (!externalProduct || !externalProduct.name) {
            try {
              const upcResponse = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`);
              if (upcResponse.ok) {
                const upcData = await upcResponse.json();
                if (upcData.code === "OK" && upcData.items && upcData.items.length > 0) {
                  const item = upcData.items[0];
                  sourceName = "UPC Item DB";
                  externalProduct = {
                    name: item.title || "",
                    description: item.description || item.category || "",
                    brand: item.brand || "",
                  };
                }
              }
            } catch (upcError) {
              console.log("Could not fetch from UPC Item DB:", upcError);
            }
          }
        } catch (error) {
          console.log("Could not fetch from external barcode databases:", error);
        }

        const newItemIndex = items.length;
        const newItem: StockTakingItem = {
          sku: barcode,
          barcode: barcode,
          name: externalProduct ? `${externalProduct.brand ? externalProduct.brand + ' - ' : ''}${externalProduct.name}` : `New Product - ${barcode}`,
          uom: "ea",
          systemQty: 0,
          actualQty: 1, // Default to 1 for new products
          costPrice: 0,
          sellingPrice: 0,
          description: externalProduct?.description || "",
          variance: 0,
          varianceValue: 0,
          isNewProduct: true,
        };

        const newItems = [...items, newItem];
        setItems(newItems);
        setScanInput("");
        
        // Auto-open edit mode for new products - use setTimeout to ensure state is updated
        setTimeout(() => {
          setEditingIndex(newItemIndex);
          setEditForm(newItem);
        }, 50);
        
        toast({
          title: externalProduct ? `✅ Found on ${sourceName}!` : "⚠️ Product Not Found",
          description: externalProduct 
            ? `${newItem.name} - Auto-filled from ${sourceName}. Please verify and set prices.`
            : `Barcode ${barcode} not found. You can check https://go-upc.com/search?q=${barcode} or enter details manually.`,
          variant: externalProduct ? "default" : "destructive",
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
      <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
        {/* Professional Header with Light Colors */}
        <div className="bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
          <div className="px-6 py-2">
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
              <div className="flex flex-col items-end gap-1">
                <div className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
                  Stock Taking Date
                </div>
                <Popover
                  open={isDatePickerOpen}
                  onOpenChange={setIsDatePickerOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="bg-white px-4 py-2 rounded-lg border border-blue-300 hover:bg-blue-50 hover:border-blue-400 transition-all cursor-pointer h-auto"
                    >
                      <div className="text-sm font-bold text-blue-700">
                        {format(stockDate, "MMM dd, yyyy")}
                      </div>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
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
            </div>
          </div>
        </div>

        {/* Enhanced Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-1 overflow-hidden">
          <div className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0">
            <div className="px-6">
              <TabsList className="w-full grid grid-cols-2 bg-transparent rounded-none h-12 p-0 border-0">
                <TabsTrigger
                  value="count"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 font-semibold transition-all px-5 py-3"
                >
                  <Barcode className="w-5 h-5 mr-2" />
                  Physical Count
                </TabsTrigger>
                <TabsTrigger
                  value="compare"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 font-semibold transition-all px-5 py-3"
                >
                  <Eye className="w-5 h-5 mr-2" />
                  Compare & Report
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <div className="p-4 space-y-4 flex-1 flex flex-col overflow-hidden">
            <TabsContent value="count" className="space-y-4 mt-0 flex flex-col flex-1 overflow-hidden">
              {/* Scanner Section */}
              <Card className="border border-gray-200 shadow-sm bg-white flex-shrink-0">
                <CardContent className="p-3">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Barcode className="w-4 h-4 text-blue-600" />
                        Scan or Search Product
                      </Label>
                      <Button
                        onClick={handleAddManual}
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs border-blue-200 hover:bg-blue-50 text-blue-600"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        Add Manual Item
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Scan barcode or enter SKU..."
                        value={scanInput}
                        onChange={(e) => setScanInput(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleScan()}
                        className="flex-1 h-10 text-sm"
                      />
                      <Button
                        onClick={() => setShowBarcodeScanner(true)}
                        size="sm"
                        className="h-10 w-10 p-0 bg-indigo-600 hover:bg-indigo-700"
                      >
                        <Camera className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={handleScan}
                        disabled={!scanInput.trim()}
                        size="sm"
                        className="h-10 w-10 p-0 bg-blue-600 hover:bg-blue-700"
                      >
                        <Barcode className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Enhanced Items List */}
              {/* Enhanced Items List */}
<div className="flex-1 overflow-hidden">
                {items.length === 0 ? (
                    <Card className="border border-gray-200 shadow-sm bg-white">
                      <CardContent className="p-6 text-center">
                      <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
                        <Barcode className="w-8 h-8 text-blue-600" />
                      </div>
                      <p className="text-gray-700 font-medium text-base mb-1">No items scanned yet</p>
                      <p className="text-xs text-gray-500">
                        Use the scanner above to add products to your inventory count
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  items.map((item, index) => (
                    <Card
                      key={index}
                      className={`border transition-all ${
                        item.isNewProduct 
                          ? "bg-blue-50/50 border-l-4 border-l-blue-500 border-t border-r border-b border-blue-200" 
                          : "bg-white border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <CardContent className="p-2">
                        {editingIndex === index ? (
                          <div className="space-y-4">
                            {item.isNewProduct && (
                              <div className="flex items-start gap-2 p-3 bg-amber-50 border-l-4 border-amber-500 rounded-r">
                                <Badge className="bg-amber-600 hover:bg-amber-600 text-white text-xs shrink-0">
                                  ⚠️ NEW
                                </Badge>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-amber-900 font-semibold mb-0.5">
                                    Product not found in inventory
                                  </p>
                                  <p className="text-xs text-amber-700">
                                    SKU: <span className="font-mono font-semibold">{editForm.sku || item.sku}</span>
                                  </p>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs font-semibold text-gray-700 mb-1 block">
                                  SKU {item.isNewProduct && <span className="text-gray-500 font-normal">(locked)</span>}
                                </Label>
                                <Input
                                  value={editForm.sku || ""}
                                  onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                                  className="h-9 text-sm"
                                  readOnly={item.isNewProduct}
                                  disabled={item.isNewProduct}
                                />
                              </div>
                              <div>
                                <Label className="text-xs font-semibold text-gray-700 mb-1 block">
                                  UOM <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  value={editForm.uom || ""}
                                  onChange={(e) => setEditForm({ ...editForm, uom: e.target.value })}
                                  placeholder="ea, kg, box"
                                  className="h-9 text-sm"
                                />
                              </div>
                            </div>

                            <div>
                              <Label className="text-xs font-semibold text-gray-700 mb-1 block">
                                Product Name <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                value={editForm.name || ""}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                placeholder="Enter product name"
                                autoFocus={editForm.isNewProduct}
                                className="h-9 text-sm"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs font-semibold text-gray-700 mb-1 block">
                                  Cost (QR) <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editForm.costPrice || 0}
                                  onChange={(e) => setEditForm({ ...editForm, costPrice: parseFloat(e.target.value) || 0 })}
                                  className="h-9 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs font-semibold text-gray-700 mb-1 block">
                                  Price (QR) <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editForm.sellingPrice || 0}
                                  onChange={(e) => setEditForm({ ...editForm, sellingPrice: parseFloat(e.target.value) || 0 })}
                                  className="h-9 text-sm"
                                />
                              </div>
                            </div>

                            <div>
                              <Label className="text-xs font-semibold text-gray-700 mb-1 block">
                                Actual Quantity <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={editForm.actualQty || 0}
                                onChange={(e) => setEditForm({ ...editForm, actualQty: parseFloat(e.target.value) || 0 })}
                                className="h-9 text-sm"
                              />
                            </div>

                            <div>
                              <Label className="text-xs font-semibold text-gray-700 mb-1 block">
                                Description
                              </Label>
                              <Textarea
                                value={editForm.description || ""}
                                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                placeholder="Add notes or description"
                                className="text-sm resize-none"
                                rows={2}
                              />
                            </div>

                            <div className="flex gap-2 pt-2 border-t">
                              <Button
                                onClick={handleEditSave}
                                className="flex-1 h-9 bg-green-600 hover:bg-green-700 text-sm"
                              >
                                <Check className="w-3.5 h-3.5 mr-1.5" />
                                Save
                              </Button>
                              <Button
                                onClick={handleEditCancel}
                                variant="outline"
                                className="flex-1 h-9 text-sm"
                              >
                                <X className="w-3.5 h-3.5 mr-1.5" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {/* Header */}
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <h3 className={`font-semibold text-sm truncate ${item.isNewProduct ? "text-blue-700" : "text-gray-900"}`}>
                                    {item.name}
                                  </h3>
                                  {item.isNewProduct && (
                                    <Badge className="text-[10px] bg-blue-600 hover:bg-blue-600 text-white px-1.5 py-0 h-4 shrink-0">
                                      NEW
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[11px] text-gray-500 font-mono">{item.sku}</p>
                              </div>
                              <div className="flex gap-1 ml-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditStart(index)}
                                  className="h-7 w-7 p-0 hover:bg-blue-50 text-blue-600 rounded"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setItems(items.filter((_, i) => i !== index))}
                                  className="h-7 w-7 p-0 hover:bg-red-50 text-red-600 rounded"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>

                            {/* Description */}
                            {item.description && (
                              <div className="bg-blue-50 border border-blue-200 rounded px-2 py-1.5">
                                <p className="text-[11px] text-blue-800 line-clamp-2 leading-relaxed">{item.description}</p>
                              </div>
                            )}

                            {/* Info Grid - 2x2 Layout */}
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div className="bg-gray-50 px-2 py-1.5 rounded border border-gray-200">
                                <div className="text-gray-500 mb-0.5">System</div>
                                <div className="font-semibold text-gray-900">{item.systemQty}</div>
                              </div>
                              <div className="bg-gray-50 px-2 py-1.5 rounded border border-gray-200">
                                <div className="text-gray-500 mb-0.5">UOM</div>
                                <div className="font-semibold text-gray-900">{item.uom}</div>
                              </div>
                              <div className={`px-2 py-1.5 rounded border ${
                                item.variance > 0 ? "bg-green-50 border-green-300" :
                                item.variance < 0 ? "bg-red-50 border-red-300" :
                                "bg-gray-50 border-gray-300"
                              }`}>
                                <div className={`mb-0.5 ${
                                  item.variance > 0 ? "text-green-700" :
                                  item.variance < 0 ? "text-red-700" :
                                  "text-gray-500"
                                }`}>Diff</div>
                                <div className={`font-semibold ${
                                  item.variance > 0 ? "text-green-700" :
                                  item.variance < 0 ? "text-red-700" :
                                  "text-gray-900"
                                }`}>
                                  {item.variance > 0 ? "+" : ""}{item.variance}
                                </div>
                              </div>
                              <div className="bg-blue-50 px-2 py-1.5 rounded border border-blue-200">
                                <div className="text-gray-500 mb-0.5">Actual Qty</div>
                                <div className="flex items-center justify-between gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleQtyDecrease(index)}
                                    disabled={item.actualQty <= 0}
                                    className="h-5 w-5 p-0 rounded-full hover:bg-red-100 disabled:opacity-30"
                                  >
                                    <Minus className="w-3 h-3 text-red-600" />
                                  </Button>
                                  <Input
                                    type="number"
                                    value={item.actualQty}
                                    onChange={(e) => handleActualQtyChange(index, e.target.value)}
                                    className="text-center h-5 font-bold text-sm border-0 bg-transparent focus:bg-white focus:border focus:border-blue-400 focus:ring-1 focus:ring-blue-200 rounded px-1 w-12"
                                    min="0"
                                    step="1"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleQtyIncrease(index)}
                                    className="h-5 w-5 p-0 rounded-full hover:bg-green-100"
                                  >
                                    <Plus className="w-3 h-3 text-green-600" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Summary & Submit */}
              {items.length > 0 && (
                <Card className="border border-gray-200 shadow-sm bg-gradient-to-br from-blue-50 to-white flex-shrink-0">
                  <CardContent className="p-2">
                    <h3 className="font-semibold text-sm text-gray-800 mb-2 flex items-center gap-2">
                      <Settings className="w-4 h-4 text-blue-600" />
                      Stock Taking Summary
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
                      <div className="bg-white p-2 rounded-md border border-gray-200">
                        <span className="text-gray-600 text-[10px] font-medium block mb-0.5">Total Items</span>
                        <span className="text-lg font-bold text-gray-800">{items.length}</span>
                      </div>
                      <div className="bg-white p-2 rounded-md border border-gray-200">
                        <span className="text-gray-600 text-[10px] font-medium block mb-0.5">New Products</span>
                        <span className="text-lg font-bold text-blue-600">
                          {items.filter((i) => i.isNewProduct).length}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-md border border-gray-200">
                        <span className="text-gray-600 text-[10px] font-medium block mb-0.5">Variance Items</span>
                        <span className="text-lg font-bold text-orange-600">
                          {items.filter((i) => i.variance !== 0).length}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-md border border-gray-200">
                        <span className="text-gray-600 text-[10px] font-medium block mb-0.5">Total Variance</span>
                        <span
                          className={`text-lg font-bold ${
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
                          QR{items
                            .reduce((sum, item) => sum + item.varianceValue, 0)
                            .toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-center pt-1">
                      <Button
                        onClick={handleSubmit}
                        disabled={submitMutation.isPending}
                        className="w-64 h-9 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all"
                      >
                        {submitMutation.isPending ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5 mr-2" />
                            Submit Stock Taking
                          </>
                        )}
                      </Button>
                    </div>
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
