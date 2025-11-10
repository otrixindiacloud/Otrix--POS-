import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Package, Edit, Barcode, Sparkles, AlertTriangle, Upload, Grid3X3, List, Table as TableIcon, Filter, X, SortAsc, SortDesc, Clipboard } from "lucide-react";
import type { Product } from "@shared/schema";
import MainLayout from "@/components/layout/main-layout";
import { Link } from "wouter";
import ProductModal from "@/components/inventory/product-modal";
import AIProductModal from "@/components/inventory/ai-product-modal";
import StockUploadModal from "@/components/inventory/stock-upload-modal";
import { StockAlert } from "@/components/inventory/stock-alert";
import { ProductSkeleton, TableSkeleton } from "@/components/ui/skeleton-loader";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { getCategoryLabel, getProductTypeLabel } from "@/config/product-categories";

type ViewMode = 'cards' | 'table' | 'list';
type StockFilter = 'all' | 'in-stock' | 'out-of-stock' | 'low-stock';
type SortField = 'name' | 'price' | 'quantity' | 'category';
type SortOrder = 'asc' | 'desc';

const PAGE_SIZE = 25;

export default function Inventory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showProductModal, setShowProductModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showStockUploadModal, setShowStockUploadModal] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [aiSearchQuery, setAiSearchQuery] = useState("");
  const [aiSearchIsBarcode, setAiSearchIsBarcode] = useState(false);

  // Enhanced filtering and view state
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Read URL parameters for initial filter state
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filterParam = params.get("filter");
    if (filterParam === "low-stock") {
      setStockFilter("low-stock");
      setShowFilters(true);
      // Clean up URL
      params.delete("filter");
      const newSearch = params.toString();
      const newUrl = newSearch ? `/inventory?${newSearch}` : "/inventory";
      window.history.replaceState(null, "", newUrl);
    }
  }, []);

  const queryClient = useQueryClient();
  
  const { data: products = [], isLoading, refetch: refetchProducts } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Listen for payment success events to refresh product stock
  useEffect(() => {
    const handlePaymentSuccess = () => {
      // Refetch products to update stock after sale
      refetchProducts();
      // Also invalidate the query to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    };

    window.addEventListener("paymentSuccess", handlePaymentSuccess);
    
    return () => {
      window.removeEventListener("paymentSuccess", handlePaymentSuccess);
    };
  }, [refetchProducts, queryClient]);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p: Product) => p.category).filter((c): c is string => typeof c === "string" && c.length > 0))),
    [products],
  );

  const trimmedSearch = searchQuery.trim();
  const normalizedSearch = trimmedSearch.toLowerCase();

  const filteredProducts = useMemo(() => {
    const matches = (product: Product) => {
      const name = product.name?.toLowerCase() ?? "";
      const sku = product.sku?.toLowerCase() ?? "";
      const barcode = product.barcode ?? "";

      const matchesSearch =
        !normalizedSearch ||
        name.includes(normalizedSearch) ||
        sku.includes(normalizedSearch) ||
        (!!trimmedSearch && barcode.includes(trimmedSearch));

      const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;

      const stock = product.stock ?? 0;
      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "in-stock" && stock > 5) ||
        (stockFilter === "low-stock" && stock > 0 && stock <= 5) ||
        (stockFilter === "out-of-stock" && stock === 0);

      return matchesSearch && matchesCategory && matchesStock;
    };

    const sortValue = (product: Product) => {
      switch (sortField) {
        case "name":
          return (product.name ?? "").toLowerCase();
        case "price":
          return Number(product.price ?? 0);
        case "quantity":
          return product.stock ?? 0;
        case "category":
          return product.category ?? "";
        default:
          return "";
      }
    };

    const sorted = products
      .filter(matches)
      .sort((a, b) => {
        const aValue = sortValue(a);
        const bValue = sortValue(b);

        if (sortOrder === "asc") {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        }

        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      });

    return sorted;
  }, [products, normalizedSearch, trimmedSearch, categoryFilter, stockFilter, sortField, sortOrder]);

  const { totalProducts, totalPages, safeCurrentPage, startIndex, endIndex, paginatedProducts } = useMemo(() => {
    const total = filteredProducts.length;
    const pages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 0;
    const safePage = pages === 0 ? 1 : Math.min(currentPage, pages);
    const start = pages === 0 ? 0 : (safePage - 1) * PAGE_SIZE;
    const end = pages === 0 ? 0 : Math.min(start + PAGE_SIZE, total);

    return {
      totalProducts: total,
      totalPages: pages,
      safeCurrentPage: safePage,
      startIndex: start,
      endIndex: end,
      paginatedProducts: pages === 0 ? [] : filteredProducts.slice(start, end),
    };
  }, [filteredProducts, currentPage]);

  const showingFrom = totalProducts === 0 ? 0 : startIndex + 1;
  const showingTo = totalProducts === 0 ? 0 : endIndex;

  const paginationRange = useMemo<(number | "ellipsis-left" | "ellipsis-right")[]>(() => {
    if (totalPages <= 1) return [];
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (safeCurrentPage <= 4) {
      return [1, 2, 3, 4, 5, "ellipsis-right", totalPages];
    }

    if (safeCurrentPage >= totalPages - 3) {
      return [1, "ellipsis-left", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [
      1,
      "ellipsis-left",
      safeCurrentPage - 1,
      safeCurrentPage,
      safeCurrentPage + 1,
      "ellipsis-right",
      totalPages,
    ];
  }, [safeCurrentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, stockFilter, sortField, sortOrder]);

  useEffect(() => {
    if (totalPages === 0 && currentPage !== 1) {
      setCurrentPage(1);
    } else if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { label: "Out of Stock", variant: "destructive" as const };
    if (stock <= 5) return { label: "Low Stock", variant: "destructive" as const };
    return { label: "In Stock", variant: "default" as const };
  };

  // Calculate low stock products for alert
  const lowStockProducts = useMemo(() => {
    return products.filter((product) => {
      const stock = product.stock || 0;
      return stock <= 5; // Low stock threshold: 5 or less
    });
  }, [products]);

  const clearFilters = () => {
    setCategoryFilter('all');
    setStockFilter('all');
    setSortField('name');
    setSortOrder('asc');
    setSearchQuery('');
  };

  const hasActiveFilters = () => {
    return categoryFilter !== 'all' || stockFilter !== 'all' || searchQuery !== '';
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleAddProduct = () => {
    setSelectedProduct(null);
    setShowProductModal(true);
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setShowProductModal(true);
  };

  const handleSearchWithAI = () => {
    if (!searchQuery.trim()) return;

    // Check if it looks like a barcode (numeric, 8+ digits)
    const isBarcode = /^\d{8,}$/.test(searchQuery.trim());

    setAiSearchQuery(searchQuery);
    setAiSearchIsBarcode(isBarcode);
    setShowAIModal(true);
  };

  const shouldShowAIButton = !!trimmedSearch && filteredProducts.length === 0;

  // Header actions for desktop
  const headerActions = (
    <div className="flex items-center gap-3">
      <Button onClick={handleAddProduct} size="sm">
        <Plus className="w-4 h-4 mr-2" />
        Add Product
      </Button>
      <Button 
        onClick={() => setShowStockUploadModal(true)}
        variant="outline"
        size="sm"
      >
        <Upload className="w-4 h-4 mr-2" />
        Upload Stock
      </Button>
      <Badge variant="outline" className="text-xs">
        {filteredProducts.length} Products
      </Badge>
    </div>
  );

  // Header actions for mobile
  const mobileHeaderActions = (
    <div className="flex items-center gap-2">
      <Button onClick={handleAddProduct} size="sm" variant="ghost">
        <Plus className="w-5 h-5" />
      </Button>
    </div>
  );

  return (
    <MainLayout 
      headerActions={headerActions}
      mobileHeaderActions={mobileHeaderActions}
    >
      <div className="container-responsive py-4 sm:py-6 pb-8">
        {/* Professional Header Section */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 rounded-xl border border-purple-100 dark:border-purple-900 p-6 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="bg-purple-600 dark:bg-purple-500 rounded-lg p-3 shadow-md">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Inventory Management
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm sm:text-base">
                  Manage products, stock levels, and pricing
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs sm:text-sm px-3 py-1.5 bg-white dark:bg-slate-800 border-purple-200 dark:border-purple-800">
                <Package className="w-3 h-3 mr-1.5" />
                {filteredProducts.length} Products
              </Badge>
            </div>
          </div>
        </div>

        {/* Stock Alert Banner */}
        <StockAlert lowStockProducts={lowStockProducts} />

        {/* Enhanced Search and Action Bar */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 mb-6 shadow-sm">
          <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none z-10" />
              <Input
                placeholder="Search products, SKU, or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="!pl-10 pr-3 touch-target"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddProduct} className="touch-target flex-1 sm:flex-none">
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Product</span>
                <span className="sm:hidden">Add</span>
              </Button>
              <Button 
                onClick={() => setShowStockUploadModal(true)}
                variant="outline"
                className="bg-blue-50 hover:bg-blue-500 text-blue-700 border-blue-300 touch-target flex-1 sm:flex-none"
              >
                <Upload className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Upload Stock</span>
                <span className="sm:hidden">Upload</span>
              </Button>
              <Link href="/stock-taking">
                <Button 
                  variant="outline"
                  className="bg-green-50 hover:bg-green-500 text-green-700 border-green-300 touch-target flex-1 sm:flex-none w-full"
                >
                  <Clipboard className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Stock Taking</span>
                  <span className="sm:hidden">Count</span>
                </Button>
              </Link>
              {shouldShowAIButton && (
                <Button 
                  onClick={handleSearchWithAI}
                  className="bg-purple-600 hover:bg-purple-700 text-white touch-target flex-1 sm:flex-none"
                >
                  <Sparkles className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Find with AI</span>
                  <span className="sm:hidden">AI</span>
                </Button>
              )}
            </div>
          </div>

          {/* View Mode and Filter Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            {/* View Mode Tabs */}
            <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)} className="w-auto">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="cards" className="flex items-center gap-2">
                  <Grid3X3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Cards</span>
                </TabsTrigger>
                <TabsTrigger value="table" className="flex items-center gap-2">
                  <TableIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Table</span>
                </TabsTrigger>
                <TabsTrigger value="list" className="flex items-center gap-2">
                  <List className="w-4 h-4" />
                  <span className="hidden sm:inline">List</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Filter Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Filters
                {hasActiveFilters() && <Badge variant="secondary" className="ml-1 h-4 w-4 p-0 text-xs">!</Badge>}
              </Button>

              {hasActiveFilters() && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
                >
                  <X className="w-4 h-4" />
                  Clear
                </Button>
              )}

              <div className="text-sm text-slate-600">
                {totalProducts > 0
                  ? `Showing ${totalProducts} products`
                  : `0 of ${products.length} products`}
              </div>
            </div>
          </div>

          {/* Expandable Filters */}
          {showFilters && (
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">Category</label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">Stock Status</label>
                    <Select value={stockFilter} onValueChange={(value) => setStockFilter(value as StockFilter)}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Stock" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Stock</SelectItem>
                        <SelectItem value="in-stock">In Stock</SelectItem>
                        <SelectItem value="low-stock">Low Stock</SelectItem>
                        <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">Sort By</label>
                    <Select value={sortField} onValueChange={(value) => setSortField(value as SortField)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="price">Price</SelectItem>
                        <SelectItem value="quantity">Stock Quantity</SelectItem>
                        <SelectItem value="category">Category</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">Sort Order</label>
                    <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Order" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">
                          <div className="flex items-center gap-2">
                            <SortAsc className="w-4 h-4" />
                            Ascending
                          </div>
                        </SelectItem>
                        <SelectItem value="desc">
                          <div className="flex items-center gap-2">
                            <SortDesc className="w-4 h-4" />
                            Descending
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        </div>

        {/* Content Based on View Mode */}
        {isLoading ? (
          <div className={viewMode === 'cards' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" : "space-y-4"}>
            {[...Array(8)].map((_, i) => (
              viewMode === 'cards' ? <ProductSkeleton key={i} /> : <TableSkeleton key={i} rows={1} cols={4} />
            ))}
          </div>
        ) : (
          <>
            {/* Cards View */}
            {viewMode === 'cards' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {filteredProducts.map((product: Product) => {
                  const stockStatus = getStockStatus(product.stock || 0);
                  return (
                    <Card key={product.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base sm:text-lg flex items-center mb-1">
                              <Package className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-slate-500 flex-shrink-0" />
                              <span className="truncate">{product.name}</span>
                            </CardTitle>
                            <p className="text-xs sm:text-sm text-slate-500 font-mono truncate">{product.sku}</p>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="p-1 touch-target flex-shrink-0"
                            onClick={() => handleEditProduct(product)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge variant={stockStatus.variant}>
                            {stockStatus.label}
                          </Badge>
                          <span className="text-lg font-bold text-slate-700">
                            QR {Number(product.price || 0).toFixed(2)}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent>
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

                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-slate-600">Price:</span>
                            <span className="font-semibold">QR {Number(product.price || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Stock:</span>
                            <Badge variant={stockStatus.variant} className="text-xs">
                              {product.stock || 0} {stockStatus.label}
                            </Badge>
                          </div>
                          {product.barcode && (
                            <div className="flex justify-between">
                              <span className="text-slate-600">Barcode:</span>
                              <span className="font-mono text-xs">{product.barcode}</span>
                            </div>
                          )}
                          {(product as any).productType && (
                            <div className="flex justify-between">
                              <span className="text-slate-600">Type:</span>
                              <Badge variant="outline" className="text-xs">
                                {getProductTypeLabel((product as any).productType)}
                              </Badge>
                            </div>
                          )}
                          {product.category && (
                            <div className="flex justify-between">
                              <span className="text-slate-600">Category:</span>
                              <span className="text-xs">{getCategoryLabel(product.category)}</span>
                            </div>
                          )}
                          {product.description && (
                            <p className="text-slate-600 text-xs mt-2 line-clamp-2">
                              {product.description}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Table View */}
            {viewMode === 'table' && (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer" onClick={() => toggleSort('name')}>
                        <div className="flex items-center gap-2">
                          Product Name
                          {sortField === 'name' && (
                            sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => toggleSort('category')}>
                        <div className="flex items-center gap-2">
                          Category
                          {sortField === 'category' && (
                            sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => toggleSort('price')}>
                        <div className="flex items-center gap-2">
                          Price
                          {sortField === 'price' && (
                            sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => toggleSort('quantity')}>
                        <div className="flex items-center gap-2">
                          Stock
                          {sortField === 'quantity' && (
                            sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product: Product) => {
                      const stockStatus = getStockStatus(product.stock || 0);
                      return (
                        <TableRow key={product.id} className="hover:bg-slate-50">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-slate-400" />
                              <div>
                                <Link href={`/products/${product.id}`}>
                                  <div className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer">
                                    {product.name}
                                  </div>
                                </Link>
                                {product.description && (
                                  <div className="text-sm text-slate-500 max-w-xs truncate">
                                    {product.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                          <TableCell>
                            {product.category ? (
                              <div className="text-sm">
                                {(product as any).productType && (
                                  <div className="text-xs text-slate-500">
                                    {getProductTypeLabel((product as any).productType)}
                                  </div>
                                )}
                                <div>{getCategoryLabel(product.category)}</div>
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="font-medium">QR {Number(product.price || 0).toFixed(2)}</TableCell>
                          <TableCell>{product.stock || 0} units</TableCell>
                          <TableCell>
                            <Badge variant={stockStatus.variant}>
                              {stockStatus.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEditProduct(product)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className="space-y-2">
                {filteredProducts.map((product: Product) => {
                  const stockStatus = getStockStatus(product.stock || 0);
                  return (
                    <Card key={product.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <Package className="w-8 h-8 text-slate-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-1">
                                <Link href={`/products/${product.id}`}>
                                  <h3 className="font-medium text-lg truncate text-blue-600 hover:text-blue-800 cursor-pointer">
                                    {product.name}
                                  </h3>
                                </Link>
                                <Badge variant={stockStatus.variant}>
                                  {stockStatus.label}
                                </Badge>
                                {(product as any).productType && (
                                  <Badge variant="outline" className="text-xs">
                                    {getProductTypeLabel((product as any).productType)}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-slate-600">
                                <span className="font-mono">{product.sku}</span>
                                {product.category && (
                                  <span>{getCategoryLabel(product.category)}</span>
                                )}
                                <span>{product.stock || 0} units</span>
                                {product.barcode && (
                                  <div className="flex items-center gap-1">
                                    <Barcode className="w-3 h-3" />
                                    <span className="font-mono">{product.barcode}</span>
                                  </div>
                                )}
                              </div>
                              {product.description && (
                                <p className="text-slate-600 text-sm mt-1 line-clamp-1">
                                  {product.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-xl font-bold text-slate-700">
                              QR {Number(product.price || 0).toFixed(2)}
                            </span>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEditProduct(product)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

      {!isLoading && filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-600 mb-2">
            {searchQuery ? "No products found" : "No products in inventory"}
          </h3>
          <p className="text-slate-500 mb-4">
            {searchQuery 
              ? "Try adjusting your search terms" 
              : "Start by adding your first product"
            }
          </p>
          {!searchQuery && (
            <Button onClick={handleAddProduct}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Product
            </Button>
          )}
        </div>
      )}

      {/* Show AI suggestion when no products found */}
      {!isLoading && searchQuery && filteredProducts.length === 0 && (
        <div className="text-center py-8 bg-purple-50 rounded-lg border-2 border-dashed border-purple-200">
          <Sparkles className="w-12 h-12 text-purple-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-purple-800 mb-2">
            Product not found in inventory
          </h3>
          <p className="text-purple-600 mb-4">
            Let AI help you find details for "{searchQuery}"
          </p>
          <Button 
            onClick={handleSearchWithAI}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Search with AI
          </Button>
        </div>
      )}
      </div> {/* Close container-responsive */}

      {/* Product Modal */}
      <ProductModal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        product={selectedProduct}
      />

      {/* AI Product Modal */}
      <AIProductModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        searchQuery={aiSearchQuery}
        isBarcode={aiSearchIsBarcode}
      />

      {/* Stock Upload Modal */}
      <StockUploadModal
        isOpen={showStockUploadModal}
        onClose={() => setShowStockUploadModal(false)}
      />
    </MainLayout>
  );
}