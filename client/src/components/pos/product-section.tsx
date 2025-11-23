import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePOSStore } from "@/lib/pos-store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Camera,
  Search,
  Barcode,
  QrCode,
  Plus,
  Percent,
  Undo,
  Pause,
  History,
  Package,
  Filter,
  SortAsc,
  SortDesc,
  Grid,
  List,
  X,
  Tag,
  Star,
  Clock,
  TrendingUp,
  Zap,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import AddItemModal from "./add-item-modal";
import DiscountModal from "./discount-modal";
import HoldModal from "./hold-modal";
import ReceiptModal from "./receipt-modal";
import AIProductModal from "@/components/inventory/ai-product-modal";
import { BarcodeScanner } from "@/components/ui/barcode-scanner";
import { ProductSkeleton } from "@/components/ui/skeleton-loader";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useStore } from "@/hooks/useStore";

interface ProductSectionProps {
  searchQuery?: string;
  searchCategory?: string;
  sortBy?: string;
  showBarcodeScanner?: boolean;
  setShowBarcodeScanner?: (show: boolean) => void;
  showAIProductModal?: boolean;
  setShowAIProductModal?: (show: boolean) => void;
  aiSearchQuery?: string;
  setSearchQuery?: (query: string) => void;
  setSearchCategory?: (category: string) => void;
  setSortBy?: (sortBy: string) => void;
  setAISearchQuery?: (query: string) => void;
}

export default function ProductSection({
  searchQuery: externalSearchQuery,
  searchCategory: externalSearchCategory,
  sortBy: externalSortBy,
  showBarcodeScanner: externalShowBarcodeScanner,
  setShowBarcodeScanner: externalSetShowBarcodeScanner,
  showAIProductModal: externalShowAIProductModal,
  setShowAIProductModal: externalSetShowAIProductModal,
  aiSearchQuery: externalAISearchQuery,
  setSearchQuery: externalSetSearchQuery,
  setSearchCategory: externalSetSearchCategory,
  setSortBy: externalSetSortBy,
  setAISearchQuery: externalSetAISearchQuery,
}: ProductSectionProps = {}) {
  // Use external props if provided, otherwise use internal state
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const [internalSearchCategory, setInternalSearchCategory] = useState("all");
  const [internalSortBy, setInternalSortBy] = useState("name");
  const [internalShowBarcodeScanner, setInternalShowBarcodeScanner] = useState(false);
  const [internalShowAIProductModal, setInternalShowAIProductModal] = useState(false);
  const [internalAISearchQuery, setInternalAISearchQuery] = useState("");
  
  const searchQuery = externalSearchQuery ?? internalSearchQuery;
  const searchCategory = externalSearchCategory ?? internalSearchCategory;
  const sortBy = externalSortBy ?? internalSortBy;
  const showBarcodeScanner = externalShowBarcodeScanner ?? internalShowBarcodeScanner;
  const setShowBarcodeScanner = externalSetShowBarcodeScanner ?? setInternalShowBarcodeScanner;
  const showAIProductModal = externalShowAIProductModal ?? internalShowAIProductModal;
  const setShowAIProductModal = externalSetShowAIProductModal ?? setInternalShowAIProductModal;
  const aiSearchQuery = externalAISearchQuery ?? internalAISearchQuery;
  const setSearchQuery = externalSetSearchQuery ?? setInternalSearchQuery;
  const setSearchCategory = externalSetSearchCategory ?? setInternalSearchCategory;
  const setSortBy = externalSetSortBy ?? setInternalSortBy;
  const setAISearchQuery = externalSetAISearchQuery ?? setInternalAISearchQuery;
  
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [showRecentSales, setShowRecentSales] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [selectedTransactionItems, setSelectedTransactionItems] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const { addToCart, openScanner, cartItems } = usePOSStore();
  const { currentStore } = useStore();
  const { toast } = useToast();
  const processedBarcodeRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  // Get store-specific products with pricing
  const { data: allProducts = [], isLoading: allProductsLoading, refetch: refetchStoreProducts } = useQuery({
    queryKey: ["/api/stores", currentStore?.id, "products"],
    queryFn: async () => {
      if (!currentStore) {
        console.log('[POS] No store selected, returning empty products');
        return [];
      }
      console.log('[POS] Fetching products for store:', currentStore.id, currentStore.name);
      const response = await fetch(`/api/stores/${currentStore.id}/products`);
      if (!response.ok) throw new Error('Failed to fetch store products');
      const data = await response.json();
      console.log('[POS] Received', data.length, 'products for store', currentStore.id);
      return data;
    },
    enabled: !!currentStore,
  });

  // Listen for payment success events to refresh product stock
  useEffect(() => {
    const handlePaymentSuccess = () => {
      console.log('[POS] Payment success - refreshing products');
      // Refetch store products to update stock after sale
      refetchStoreProducts();
      // Also invalidate the query to ensure fresh data
      if (currentStore?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/stores", currentStore.id, "products"] });
      }
      // Also invalidate general products query
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return typeof key === 'string' && key.startsWith('/api/products');
        }
      });
    };

    window.addEventListener("paymentSuccess", handlePaymentSuccess);
    
    return () => {
      window.removeEventListener("paymentSuccess", handlePaymentSuccess);
    };
  }, [refetchStoreProducts, queryClient, currentStore?.id]);

  // Listen for store change events to refresh products in POS
  useEffect(() => {
    const handleStoreChanged = (event: CustomEvent) => {
      const { storeId, storeName } = event.detail;
      console.log('[POS] Store changed to:', storeName, '(id:', storeId, ') - refreshing products');
      // Invalidate all store product queries to force a refresh
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return typeof key === 'string' && (
            key.startsWith('/api/stores') || 
            key.startsWith('/api/products')
          );
        }
      });
    };

    const handleClearStoreCache = () => {
      console.log('[POS] Clear store cache event - invalidating queries');
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return typeof key === 'string' && (
            key.startsWith('/api/stores') || 
            key.startsWith('/api/products')
          );
        }
      });
    };

    window.addEventListener("storeChanged", handleStoreChanged as EventListener);
    window.addEventListener("clearStoreCache", handleClearStoreCache as EventListener);
    
    return () => {
      window.removeEventListener("storeChanged", handleStoreChanged as EventListener);
      window.removeEventListener("clearStoreCache", handleClearStoreCache as EventListener);
    };
  }, [queryClient]);

  // Force refetch when currentStore changes
  useEffect(() => {
    if (currentStore?.id) {
      console.log('[POS] Current store changed in state to:', currentStore.id, currentStore.name, '- refetching products');
      refetchStoreProducts();
    }
  }, [currentStore?.id]);

  // Get product categories for filtering
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["/api/products/categories"],
    queryFn: async () => {
      const res = await fetch("/api/products/categories");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Get recent products
  const { data: recentProducts = [], isLoading: recentLoading } = useQuery({
    queryKey: ["/api/products/recent"],
  });

  // Get recent sales transactions
  const { data: recentSales = [], isLoading: recentSalesLoading } = useQuery({
    queryKey: ["/api/transactions", currentStore?.id],
    queryFn: async () => {
      if (!currentStore) return [];
      const response = await fetch(`/api/transactions?storeId=${currentStore.id}`);
      if (!response.ok) throw new Error('Failed to fetch recent sales');
      const transactions = await response.json();
      // Sort by most recent and limit to 10
      return transactions
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);
    },
    enabled: showRecentSales && !!currentStore, // Only fetch when modal is open and store is selected
  });

  // Enhanced search with better filtering logic
  const { data: searchResults = [], isLoading: searchLoading } = useQuery({
    queryKey: ["/api/products/search", searchQuery, searchCategory, sortBy],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];

      const params = new URLSearchParams({
        q: searchQuery,
        category: searchCategory !== "all" ? searchCategory : "",
        sort: sortBy,
      });

      const res = await fetch(`/api/products/search?${params}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: !!searchQuery.trim(),
  });

  // Smart product filtering and sorting with improved fuzzy search
  const getFilteredProducts = () => {
    let products = searchQuery.trim() ? searchResults : allProducts.slice(0, 20);

    // Enhanced local fuzzy search as fallback if API search fails or for immediate feedback
    if (searchQuery.trim() && searchResults.length === 0) {
      const query = searchQuery.trim().toLowerCase();
      products = allProducts.filter((product: any) => {
        // Check name, description, SKU, barcode, and category
        const searchFields = [
          product.name?.toLowerCase() || '',
          product.description?.toLowerCase() || '',
          product.sku?.toLowerCase() || '',
          product.barcode?.toLowerCase() || '',
          product.category?.toLowerCase() || ''
        ];
        
        return searchFields.some(field => {
          // Exact match
          if (field.includes(query)) return true;
          
          // Partial word matching
          const words = query.split(' ');
          return words.every(word => field.includes(word));
        });
      }).slice(0, 20); // Limit results
    }

    // Apply category filter if not searching
    if (!searchQuery.trim() && searchCategory !== "all") {
      products = allProducts.filter(
        (p: any) => p.category?.toLowerCase() === searchCategory.toLowerCase(),
      );
    }

    // Apply sorting if not searching (search results come pre-sorted)
    if (!searchQuery.trim()) {
      products = [...products].sort((a: any, b: any) => {
        switch (sortBy) {
          case "name":
            return a.name.localeCompare(b.name);
          case "price_low":
            return parseFloat(a.price) - parseFloat(b.price);
          case "price_high":
            return parseFloat(b.price) - parseFloat(a.price);
          case "stock_low":
            return (a.stock || 0) - (b.stock || 0);
          case "recent":
          default:
            return (
              new Date(b.updatedAt || b.createdAt).getTime() -
              new Date(a.updatedAt || a.createdAt).getTime()
            );
        }
      });
    }

    return products;
  };

  const displayedProducts = getFilteredProducts();
  
  // Pagination for products
  const productsPerPage = 4;
  const totalPages = Math.ceil(displayedProducts.length / productsPerPage);
  const startIndex = currentPage * productsPerPage;
  const paginatedProducts = displayedProducts.slice(startIndex, startIndex + productsPerPage);

  // Helper function to detect if input looks like a barcode
  const isBarcode = (input: string) => {
    const cleaned = input.trim();
    // Check for common barcode formats (8, 12, 13, 14 digits)
    return /^[0-9]{8}$|^[0-9]{12}$|^[0-9]{13}$|^[0-9]{14}$/.test(cleaned);
  };

  // Helper function to detect if input looks like a SKU
  const isSKU = (input: string) => {
    const cleaned = input.trim().toUpperCase();
    // Check for common SKU patterns (letters and numbers, dashes, underscores)
    return /^[A-Z0-9\-_]{3,20}$/.test(cleaned) && /[A-Z]/.test(cleaned);
  };

  // Automatic barcode lookup for exact matches
  const {
    data: barcodeProduct,
    error: barcodeError,
    isLoading: barcodeLoading,
  } = useQuery({
    queryKey: ["/api/products/barcode", searchQuery],
    queryFn: async () => {
      if (!isBarcode(searchQuery)) return null;
      try {
        const res = await fetch(
          `/api/products/barcode/${encodeURIComponent(searchQuery)}`,
        );
        if (!res.ok) return null;
        return res.json();
      } catch (error) {
        return null;
      }
    },
    enabled: !!searchQuery.trim() && isBarcode(searchQuery),
  });

  // Automatic SKU lookup for exact matches
  const { data: skuProduct } = useQuery({
    queryKey: ["/api/products/sku", searchQuery],
    queryFn: async () => {
      if (!isSKU(searchQuery)) return null;
      try {
        const res = await fetch(
          `/api/products/sku/${encodeURIComponent(searchQuery)}`,
        );
        if (!res.ok) return null;
        return res.json();
      } catch (error) {
        return null;
      }
    },
    enabled: !!searchQuery.trim() && isSKU(searchQuery),
  });

  // Effect to automatically add barcode products to cart or open AI modal if not found
  useEffect(() => {
    // Only process if we have a valid barcode search query
    if (!isBarcode(searchQuery) || !searchQuery.trim()) {
      processedBarcodeRef.current = null;
      return;
    }

    // Prevent re-processing the same barcode
    if (processedBarcodeRef.current === searchQuery.trim()) {
      return;
    }

    // Product found - check stock and add to cart
    if (barcodeProduct) {
      processedBarcodeRef.current = searchQuery.trim();
      const currentStock = barcodeProduct.stock ?? barcodeProduct.quantity ?? 0;
      if (currentStock <= 0) {
        toast({
          title: "Out of Stock",
          description: `${barcodeProduct.name} is currently out of stock.`,
          variant: "destructive",
        });
        setSearchQuery(""); // Clear search
        return;
      }
      addToCart(barcodeProduct);
      toast({
        title: "Product Added",
        description: `${barcodeProduct.name} added to cart automatically`,
      });
      setSearchQuery(""); // Clear search after adding
      return;
    }

    // Product not found and query is complete - open AI modal
    if (!barcodeLoading && !barcodeProduct) {
      processedBarcodeRef.current = searchQuery.trim();
      const timer = setTimeout(() => {
        // Double-check the query is still a barcode before opening AI modal
        if (isBarcode(searchQuery) && searchQuery.trim()) {
          setAISearchQuery(searchQuery);
          setShowAIProductModal(true);
          setSearchQuery(""); // Clear search query
          toast({
            title: "Product Not Found",
            description: "Opening AI assistant to help add this product",
          });
        }
      }, 1000); // Wait 1 second for query to complete

      return () => clearTimeout(timer);
    }
  }, [barcodeProduct, barcodeLoading, searchQuery, addToCart, toast, setSearchQuery, setAISearchQuery, setShowAIProductModal]);

  // Effect to automatically add SKU products to cart
  useEffect(() => {
    // Only process if we have a valid SKU search query and product
    if (!skuProduct || !isSKU(searchQuery) || !searchQuery.trim()) {
      return;
    }

    // Check stock before adding
    const currentStock = skuProduct.stock ?? skuProduct.quantity ?? 0;
    if (currentStock <= 0) {
      toast({
        title: "Out of Stock",
        description: `${skuProduct.name} is currently out of stock.`,
        variant: "destructive",
      });
      setSearchQuery(""); // Clear search
      return;
    }

    addToCart(skuProduct);
    toast({
      title: "Product Added",
      description: `${skuProduct.name} added to cart automatically`,
    });
    setSearchQuery(""); // Clear search after adding
  }, [skuProduct, searchQuery, addToCart, toast, setSearchQuery]);

  // Event listeners for cart section quick actions
  useEffect(() => {
    const handleOpenAddItemModal = () => {
      setShowAddItemModal(true);
    };

    const handleOpenDiscountModal = () => {
      if (cartItems.length === 0) {
        toast({
          title: "No Items in Cart",
          description: "Please add items to cart before applying discount",
          variant: "destructive",
        });
        return;
      }
      setShowDiscountModal(true);
    };

    window.addEventListener('openAddItemModal', handleOpenAddItemModal);
    window.addEventListener('openDiscountModal', handleOpenDiscountModal);

    return () => {
      window.removeEventListener('openAddItemModal', handleOpenAddItemModal);
      window.removeEventListener('openDiscountModal', handleOpenDiscountModal);
    };
  }, [cartItems.length, toast]);

  const handleProductClick = (product: any) => {
    // Check stock before adding
    const currentStock = product.stock ?? product.quantity ?? 0;
    if (currentStock <= 0) {
      toast({
        title: "Out of Stock",
        description: `${product.name} is currently out of stock.`,
        variant: "destructive",
      });
      return;
    }
    addToCart(product);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is handled by the useQuery effect
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchCategory("all");
    setSortBy("recent");
    setCurrentPage(0);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleQuickSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Enhanced search suggestions with dynamic categories and popular items
  const searchSuggestions = [
    ...categories.slice(0, 4), // Show top 4 categories
    "Water", "Bread", "Coffee", "Tea", "Snacks", "Milk", "Chips"
  ];

  const handleAddItem = () => {
    setShowAddItemModal(true);
  };

  const handleDiscount = () => {
    if (cartItems.length === 0) {
      alert("Please add items to cart before applying discount");
      return;
    }
    setShowDiscountModal(true);
  };

  const handleHold = () => {
    if (cartItems.length === 0) {
      alert("Please add items to cart before holding transaction");
      return;
    }
    setShowHoldModal(true);
  };

  const handleBarcodeScanned = (barcode: string) => {
    setSearchQuery(barcode);
    setShowBarcodeScanner(false);
    toast({
      title: "Barcode Scanned",
      description: `Barcode ${barcode} entered in search field`,
    });
  };

  // Function to add items from a previous transaction to current cart
  const handleQuickAddFromSale = async (transactionId: number) => {
    try {
      const response = await fetch(`/api/transactions/${transactionId}/items`);
      if (!response.ok) throw new Error('Failed to fetch transaction items');
      
      const transactionItems = await response.json();
      
      if (transactionItems.length === 0) {
        toast({
          title: "No Items Found",
          description: "This transaction has no items to add",
          variant: "destructive",
        });
        return;
      }

      // Fetch product details for each item and add to cart
      let addedCount = 0;
      for (const item of transactionItems) {
        try {
          const productResponse = await fetch(`/api/products/${item.productId}`);
          if (productResponse.ok) {
            const product = await productResponse.json();
            addToCart(product, item.quantity);
            addedCount++;
          }
        } catch (error) {
          console.error(`Failed to add product ${item.productId}:`, error);
        }
      }

      if (addedCount > 0) {
        toast({
          title: "Items Added",
          description: `${addedCount} items from the previous sale added to cart`,
        });
        setShowRecentSales(false); // Close the modal
      } else {
        toast({
          title: "Failed to Add Items",
          description: "Could not add items from this sale",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load items from this sale",
        variant: "destructive",
      });
    }
  };

  // Function to handle viewing receipt for a transaction
  const handleViewReceipt = async (transaction: any) => {
    try {
      console.log('🧾 Requesting receipt for transaction:', transaction.id);
      // Generate receipt PDF
      const response = await fetch(`/api/transactions/${transaction.id}/receipt`, {
        credentials: 'include'
      });
      
      console.log('📡 Receipt response status:', response.status);
      console.log('📡 Receipt response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) throw new Error('Failed to generate receipt');
      
      const responseText = await response.text();
      console.log('📄 Receipt response (first 200 chars):', responseText.substring(0, 200));
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ Failed to parse JSON response:', parseError);
        throw new Error('Server returned invalid response format');
      }
      
      if (result.success && result.receiptUrl) {
        // Open the receipt PDF in a new tab
        window.open(result.receiptUrl, '_blank');
      } else {
        throw new Error(result.message || 'Failed to generate receipt');
      }
    } catch (error) {
      console.error('Error viewing receipt:', error);
      toast({
        title: "Error",
        description: "Failed to view receipt. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="flex-1 min-h-0 flex flex-col bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">

      {/* Compact Products Grid for Sidebar */}
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-3">
        {recentLoading || searchLoading || allProductsLoading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden animate-pulse p-3">
                <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
        ) : displayedProducts.length > 0 ? (
          <>
            {/* Pagination Controls */}
            {displayedProducts.length > productsPerPage && (
              <div className="flex items-center justify-between mb-3 bg-white dark:bg-gray-800 rounded-lg p-2">
                <Button
                  onClick={handlePrevPage}
                  disabled={currentPage === 0}
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="text-sm font-medium">
                  {currentPage + 1} / {totalPages}
                </div>
                <Button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages - 1}
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
            
            {/* Compact Product List */}
            <div className="space-y-2">
              {paginatedProducts.map((product: any) => {
                const currentStock = product.stock ?? product.quantity ?? 0;
                const isOutOfStock = currentStock <= 0;
                const isLowStock = currentStock > 0 && currentStock <= 10;
                
                return (
                  <div
                    key={product.id}
                    onClick={() => !isOutOfStock && handleProductClick(product)}
                    className={`group bg-white dark:bg-gray-900 rounded-lg shadow border transition-all p-3 ${
                      isOutOfStock 
                        ? 'border-red-300 opacity-60 cursor-not-allowed' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:shadow-lg cursor-pointer'
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Product Image */}
                      <div className="w-16 h-16 flex-shrink-0 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-8 h-8 text-gray-400" />
                        )}
                      </div>
                      
                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-semibold text-sm line-clamp-2 ${
                          isOutOfStock 
                            ? 'text-gray-500 dark:text-gray-400' 
                            : 'text-gray-900 dark:text-white group-hover:text-blue-600'
                        }`}>
                          {product.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {product.sku}
                          </Badge>
                          {product.stock !== undefined && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                isOutOfStock
                                  ? "bg-red-50 text-red-700 border-red-300"
                                  : isLowStock
                                    ? "bg-orange-50 text-orange-700 border-orange-300"
                                    : "bg-green-50 text-green-700 border-green-300"
                              }`}
                            >
                              {isOutOfStock ? "Out of Stock" : `${currentStock} in stock`}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1">
                          <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                            QR {parseFloat(product.price || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      
                      {/* Add Button */}
                      <div className="flex-shrink-0 self-center">
                        <Button
                          size="sm"
                          className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isOutOfStock) {
                              handleProductClick(product);
                            }
                          }}
                          disabled={isOutOfStock}
                          title={isOutOfStock ? "Out of stock" : "Add to cart"}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
      </div>

      {/* Professional Modals */}
      <AddItemModal
        isOpen={showAddItemModal}
        onClose={() => setShowAddItemModal(false)}
      />
      <DiscountModal
        isOpen={showDiscountModal}
        onClose={() => setShowDiscountModal(false)}
      />
      <HoldModal
        isOpen={showHoldModal}
        onClose={() => setShowHoldModal(false)}
      />
      <AIProductModal
        isOpen={showAIProductModal}
        onClose={() => {
          setShowAIProductModal(false);
          setSearchQuery("");
        }}
        searchQuery={aiSearchQuery}
        isBarcode={true}
      />
      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScanned}
      />

      {/* Recent Sales Modal */}
      <Dialog open={showRecentSales} onOpenChange={setShowRecentSales}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <History className="w-5 h-5 text-blue-600" />
              Recent Sales
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {recentSalesLoading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner />
                <span className="ml-2 text-gray-600">Loading recent sales...</span>
              </div>
            ) : recentSales.length > 0 ? (
              <div className="space-y-3">
                {recentSales.map((sale: any) => (
                  <Card key={sale.id} className="border border-gray-200 hover:border-blue-300 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              #{sale.transactionNumber}
                            </Badge>
                            <Badge 
                              className={`text-xs ${
                                sale.status === 'completed' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {sale.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {new Date(sale.createdAt).toLocaleString()}
                          </div>
                          {sale.itemCount && (
                            <div className="text-xs text-blue-600 font-medium">
                              {sale.itemCount} items
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-blue-600">
                            QR {parseFloat(sale.total || 0).toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {sale.paymentMethod?.toUpperCase() || 'CASH'}
                          </div>
                        </div>
                      </div>
                      
                      {sale.customerName && (
                        <div className="text-sm text-gray-600 mb-2">
                          Customer: {sale.customerName}
                        </div>
                      )}
                      
                      {/* Quick action to add popular items from this sale */}
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleQuickAddFromSale(sale.id)}
                          className="text-xs h-7"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Quick Add Items
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewReceipt(sale)}
                          className="text-xs h-7"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View Receipt
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Recent Sales</h3>
                <p className="text-gray-500">
                  Recent sales transactions will appear here once you start processing orders.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={showReceiptModal}
        onClose={() => {
          setShowReceiptModal(false);
          setSelectedTransaction(null);
          setSelectedTransactionItems([]);
          setSelectedCustomer(null);
        }}
        transaction={selectedTransaction}
        transactionItems={selectedTransactionItems}
        customer={selectedCustomer}
        autoPrint={false}
      />
    </>
  );
}
