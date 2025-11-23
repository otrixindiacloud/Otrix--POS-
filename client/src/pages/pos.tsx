import { useEffect, useState, useCallback, type ReactNode } from "react";
import { debugRender } from "@/lib/debug-infinite-loop";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePOSStore } from "@/lib/pos-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePrefetch } from "@/hooks/use-prefetch";
import { useLocation } from "wouter";
import { useStore } from "@/hooks/useStore";
import { apiRequest } from "@/lib/queryClient";

import CartSection from "@/components/pos/cart-section";
import ProductSearchBar from "@/components/pos/product-search-bar";
import PaymentModal from "@/components/pos/payment-modal";
import CustomerCreditModal from "@/components/pos/customer-credit-modal";
import PrinterConfigModal from "@/components/pos/printer-config-modal";
import QuickActionsSection from "@/components/pos/quick-actions-section";
import MainLayout from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ShoppingCart,
  CheckCircle,
  CreditCard,
  Coins,
  Settings,
  BarChart,
  Users,
  Package,
  Zap,
  Building2,
  X,
  Sun,
  Moon,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { StoreSelector } from "@/components/StoreSelector";
import CurrencySelector from "@/components/pos/currency-selector";
import PromotionIndicator from "@/components/pos/promotion-indicator";
import AIProductModal from "@/components/inventory/ai-product-modal";

// Quick Navigation Menu Component
function QuickNavigationMenu({ onClose }: { onClose?: () => void }) {
  const [location, setLocation] = useLocation();
  
  const navigationItems = [
    { path: "/inventory", icon: Package, label: "Inventory" },
    { path: "/customers", icon: Users, label: "Customers" },
    { path: "/reports", icon: BarChart, label: "Reports" },
    { path: "/administration", icon: Zap, label: "Administration" },
    { path: "/suppliers", icon: Building2, label: "Suppliers" },
    { path: "/stores", icon: Building2, label: "Stores" },
  ];

  // Check if we came from holds page and show back button
  const urlParams = new URLSearchParams(window.location.search);
  const fromHolds = urlParams.get('from') === 'holds';

  const handleNavigation = (path: string) => {
    setLocation(path);
    // Close the overlay after navigation
    onClose?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Quick Navigation</h3>
        {fromHolds && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleNavigation("/holds")}
            className="text-xs"
          >
            ← Back to Holds
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Access different modules quickly. Available actions adapt to your role permissions.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {navigationItems.map((item) => (
          <Button
            key={item.path}
            variant="outline"
            className="h-16 flex flex-col space-y-1 hover:bg-primary/10 hover:border-primary/30 transition-colors"
            onClick={() => handleNavigation(item.path)}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-xs">{item.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

export default function POS() {
  const {
    setCurrentDay,
    setCurrentTransactionNumber,
    cartItems,
    getCartItemCount,
    getCartTotal,
    openPaymentModal,
    selectedDate,
  } = usePOSStore();
  const { currentStore } = useStore();
  
  // Debug infinite loop detection
  debugRender('POS', { cartItemsLength: cartItems.length, currentStore: currentStore?.id });
  const [, navigate] = useLocation();
  const isMobile = useIsMobile();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isQuickNavOpen, setIsQuickNavOpen] = useState(false);
  const [showPrinterConfig, setShowPrinterConfig] = useState(false);
  const [currentCurrency, setCurrentCurrency] = useState("QAR");
  
  // Search states for product search bar
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCategory, setSearchCategory] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [showAIProductModal, setShowAIProductModal] = useState(false);
  const [aiSearchQuery, setAISearchQuery] = useState("");

  // Memoize onOpenAIModal to prevent infinite loops
  const onOpenAIModal = useCallback((query: string) => {
    setAISearchQuery(query);
    setShowAIProductModal(true);
  }, []);

  // Memoize currency change handler to prevent infinite loops
  const handleCurrencyChange = useCallback((currency: string) => {
    setCurrentCurrency(currency);
  }, []);

  const storeQueryParam = currentStore?.id ? `?storeId=${currentStore.id}` : "";

  // Check current day operation
  const { data: currentDay } = useQuery({
    queryKey: [`/api/day-operations/current${storeQueryParam}`],
    staleTime: 2 * 60 * 1000, // 2 minutes cache
    enabled: Boolean(currentStore?.id),
  });

  // Check any open day operation
  const { data: openDay } = useQuery({
    queryKey: [`/api/day-operations/open${storeQueryParam}`],
    staleTime: 2 * 60 * 1000, // 2 minutes cache
    enabled: Boolean(currentStore?.id),
  });

  // Generate transaction number
  const queryClient = useQueryClient();
  const { data: transactionData } = useQuery<{ transactionNumber: string }>({
    queryKey: ["/api/transactions/number"],
    staleTime: 30 * 1000, // 30 seconds cache
  });

  // Set transaction number in store when fetched
  useEffect(() => {
    if (transactionData?.transactionNumber) {
      setCurrentTransactionNumber(transactionData.transactionNumber);
    }
  }, [transactionData, setCurrentTransactionNumber]);

  // Listen for transaction number requests (when first item is added to cart)
  useEffect(() => {
    const handleRequestTransactionNumber = async () => {
      try {
        // Invalidate cache and fetch a new transaction number
        const response = await apiRequest("GET", "/api/transactions/number");
        const data = await response.json();
        if (data.transactionNumber) {
          setCurrentTransactionNumber(data.transactionNumber);
          // Update the query cache
          queryClient.setQueryData(["/api/transactions/number"], data);
        }
      } catch (error) {
        console.error("Failed to generate transaction number:", error);
      }
    };

    window.addEventListener("requestTransactionNumber", handleRequestTransactionNumber);
    return () => {
      window.removeEventListener("requestTransactionNumber", handleRequestTransactionNumber);
    };
  }, [setCurrentTransactionNumber, queryClient]);

  const openDayRecord =
    openDay && typeof openDay === "object" && openDay !== null && "date" in openDay ? (openDay as any) : null;
  const openDayDate = openDayRecord?.date ? String(openDayRecord.date) : null;
  const todayDate = format(new Date(), "yyyy-MM-dd");
  const isDateMismatch = Boolean(openDayDate && openDayDate !== todayDate);
  const dayMatchesSelectedDate = Boolean(openDayDate && openDayDate === selectedDate);
  const dayActionIntent = !openDayDate ? "open" : dayMatchesSelectedDate ? "close" : undefined;
  const dayActionLabel = !openDayDate
    ? "Open Day in Till"
    : dayMatchesSelectedDate
    ? "Close Day in Till"
    : "Till Management";
  const dayActionButtonClass = !openDayDate
    ? "h-8 bg-green-600 text-white hover:bg-green-700"
    : dayMatchesSelectedDate
    ? "h-8 bg-orange-600 text-white hover:bg-orange-700"
    : "h-8 bg-primary/10 text-primary hover:bg-primary/20";
  const TillIcon = !openDayDate ? Sun : dayMatchesSelectedDate ? Moon : Building2;
  const desktopDayActionClass = dayActionButtonClass.replace("h-8", "").trim();

  const goToTill = () => {
    const target = dayActionIntent ? `/till?intent=${dayActionIntent}` : "/till";
    navigate(target);
  };

  const mobileHeaderActions = isMobile ? (
    <div className="flex items-center gap-2">
      {currentStore ? (
        <Button onClick={goToTill} size="sm" className={dayActionButtonClass}>
          <TillIcon className="mr-1 h-3 w-3" />
          {dayActionLabel}
        </Button>
      ) : null}

      {/* Cart Button */}
      <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="relative h-10 w-10 rounded-xl border border-border"
            aria-label="Open cart"
          >
            <ShoppingCart className="h-5 w-5" />
            {cartItems.length > 0 && (
              <Badge className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {getCartItemCount()}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full p-0 mobile-modal sm:w-80">
          <CartSection />
        </SheetContent>
      </Sheet>
    </div>
  ) : undefined;

  const desktopHeaderActions = !isMobile ? (
    <div className="flex items-center gap-3">
      {currentStore ? (
        <Button
          onClick={goToTill}
          size="sm"
          className={desktopDayActionClass}
        >
          <TillIcon className="mr-2 h-4 w-4" />
          {dayActionLabel}
        </Button>
      ) : null}

      <PromotionIndicator />
      <Badge variant="outline" className="hidden text-xs lg:inline-flex">
        Enhanced Features Active
      </Badge>
    </div>
  ) : undefined;

  const sharedOverlays = (
    <>
      <PaymentModal />
      <CustomerCreditModal />
      <AIProductModal
        isOpen={showAIProductModal}
        onClose={() => {
          setShowAIProductModal(false);
          setSearchQuery("");
        }}
        searchQuery={aiSearchQuery}
        isBarcode={true}
      />
    </>
  );

  // Prefetch commonly used data
  usePrefetch([
    { queryKey: ["/api/products/recent"], delay: 200 },
    // Do not keep held-transactions prefetched as 'fresh' to ensure Holds page fetches live data on open
    { queryKey: ["/api/held-transactions"], delay: 500, staleTime: 0 },
    { queryKey: ["/api/customers"], delay: 1000 },
    { queryKey: ["/api/transactions"], delay: 1500 },
  ]);

  // No need for useEffect to sync currentDay to store since query data is source of truth
  // The isDayOpen state can be derived directly from the currentDay query data
  const isDayOpenFromQuery = currentDay && typeof currentDay === 'object' && 'status' in currentDay 
    ? (currentDay as any).status === "open" 
    : false;

  useEffect(() => {
    if (transactionData && typeof transactionData === 'object' && 'transactionNumber' in transactionData) {
      setCurrentTransactionNumber(transactionData.transactionNumber as string);
    }
  }, [transactionData]); // setCurrentTransactionNumber is a stable Zustand setter, no need in deps

  // Listen for store changes to recalculate VAT
  useEffect(() => {
    const handleStoreChange = (event: CustomEvent) => {
      console.log('Store changed, VAT recalculation may be needed:', event.detail);
      // VAT recalculation will be handled by cart components through hooks
    };

    const handleCartChange = () => {
      console.log('Cart changed, considering VAT updates');
      // Cart-related VAT updates will be handled by individual components
    };

    window.addEventListener('storeChanged', handleStoreChange as EventListener);
    window.addEventListener('cartChanged', handleCartChange);

    return () => {
      window.removeEventListener('storeChanged', handleStoreChange as EventListener);
      window.removeEventListener('cartChanged', handleCartChange);
    };
  }, []);

  // Keyboard shortcuts for faster checkout
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only trigger if not typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (event.key) {
        case "F1": // Quick payment
          event.preventDefault();
          if (cartItems.length > 0) {
            openPaymentModal();
          }
          break;
        case "F2": // Quick card payment
          event.preventDefault();
          if (cartItems.length > 0) {
            const customEvent = new CustomEvent("quickPayment", {
              detail: { method: "card" },
            });
            window.dispatchEvent(customEvent);
          }
          break;
        case "F3": // Quick cash payment
          event.preventDefault();
          if (cartItems.length > 0) {
            const customEvent = new CustomEvent("quickPayment", {
              detail: { method: "exact-cash" },
            });
            window.dispatchEvent(customEvent);
          }
          break;
        case "F12": // Scanner
          event.preventDefault();
          // Open simple input prompt for barcode/SKU
          const input = prompt("Enter barcode, SKU, or product name:");
          if (input && input.trim()) {
            setSearchQuery(input.trim());
          }
          break;
      }
    };

    // Add printer config event listener
    const handlePrinterConfig = () => {
      setShowPrinterConfig(true);
    };

    // Add event listeners
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("openPrinterConfig", handlePrinterConfig);

    // Cleanup
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("openPrinterConfig", handlePrinterConfig);
    };
  }, [cartItems.length]); // openPaymentModal is stable from Zustand store, no need in deps

  // Show loading state while store is being selected
  if (!currentStore) {
    return (
      <MainLayout title="Point of Sale" headerActions={undefined}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
          <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-semibold mb-2">No Store Selected</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            Please select a store to start using the POS system. Use the store selector in the navigation bar.
          </p>
          <StoreSelector variant="default" className="max-w-md" />
        </div>
      </MainLayout>
    );
  }

  let pageContent: ReactNode;

  if (isMobile) {
    pageContent = (
      <>
        <div className="flex flex-col min-h-full bg-background">
          <div className="space-y-3 border-b bg-card px-4 py-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-lg font-semibold text-foreground">Point of Sale</h1>
              <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <CheckCircle className="h-3 w-3 text-green-500" />
                RetailPro POS
              </p>
            </div>
            
            {/* Date Mismatch Warning - Mobile */}
            {isDateMismatch && currentStore && (
              <Alert variant="destructive" className="bg-rose-50 border-rose-200">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                <AlertTitle className="text-sm font-bold text-rose-900">Date Mismatch!</AlertTitle>
                <AlertDescription className="text-xs space-y-2 text-rose-700">
                  <p>
                    Open day: <strong>{openDayDate}</strong><br />
                    Today: <strong>{format(new Date(), "MMM dd, yyyy")}</strong>
                  </p>
                  <Button
                    onClick={goToTill}
                    size="sm"
                    variant="outline"
                    className="w-full bg-white border-rose-300 text-rose-700 hover:bg-rose-50"
                  >
                    Close Old Day & Open New
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            
            {openDay ? (
              <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <CheckCircle className="h-3 w-3 text-emerald-600" />
                <span>
                  Day Open:{" "}
                  {typeof openDay === "object" && openDay && "date" in openDay && openDay.date
                    ? format(new Date(openDay.date as string), "MMM dd")
                    : "Unknown"}
                </span>
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              <StoreSelector variant="compact" className="w-full" />
              <div className="flex flex-wrap items-center gap-2">
                <CurrencySelector
                  onCurrencyChange={handleCurrencyChange}
                  currentCurrency={currentCurrency}
                />
                <PromotionIndicator />
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col px-2 py-2 gap-2">
            {/* Product Search Bar - Mobile */}
            <div className="overflow-hidden rounded-lg border shadow-sm bg-card flex-shrink-0">
              <ProductSearchBar
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchCategory={searchCategory}
                setSearchCategory={setSearchCategory}
                sortBy={sortBy}
                setSortBy={setSortBy}
                onOpenScanner={() => {
                  const input = prompt("Enter barcode, SKU, or product name:");
                  if (input && input.trim()) {
                    setSearchQuery(input.trim());
                  }
                }}
                onOpenAIModal={onOpenAIModal}
              />
            </div>
          </div>

        </div>

        {cartItems.length > 0 && (
          <div className="bg-white border-t border-slate-200 p-3 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex flex-col">
                <p className="text-sm font-semibold text-slate-600">
                  {getCartItemCount()} {getCartItemCount() === 1 ? "item" : "items"}
                </p>
                <p className="text-xl font-bold text-slate-900">
                  {currentCurrency === "QAR" ? "QR" : currentCurrency} {getCartTotal().toFixed(2)}
                </p>
              </div>
              <Button
                onClick={() => setIsCartOpen(true)}
                variant="outline"
                size="sm"
                className="rounded-lg border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                View Cart
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={() => {
                  const event = new CustomEvent("quickPayment", {
                    detail: { method: "card" },
                  });
                  window.dispatchEvent(event);
                }}
                className="h-12 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-sm"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Card
              </Button>
              <Button
                onClick={() => {
                  const event = new CustomEvent("quickPayment", {
                    detail: { method: "exact-cash" },
                  });
                  window.dispatchEvent(event);
                }}
                className="h-12 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 shadow-sm"
              >
                <Coins className="mr-2 h-4 w-4" />
                Cash
              </Button>
              <Button
                onClick={() => usePOSStore.getState().openPaymentModal()}
                variant="outline"
                className="h-12 rounded-lg border-slate-300 font-semibold text-sm text-slate-700 hover:bg-slate-50"
              >
                More
              </Button>
            </div>
          </div>
        )}

        {sharedOverlays}
      </>
    );
  } else {
    pageContent = (
      <>
        <div className="flex flex-col h-full">
          {/* Date Mismatch Warning */}
          {isDateMismatch && currentStore && (
            <div className="p-2 pb-0">
              <Alert variant="destructive" className="bg-rose-50 border-rose-200">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
                <AlertTitle className="font-bold text-rose-900">Day Operations Date Mismatch</AlertTitle>
                <AlertDescription className="flex items-center justify-between gap-4">
                  <span className="text-sm text-rose-700">
                    The open day is <strong>{openDayDate}</strong>, but today is <strong>{format(new Date(), "MMM dd, yyyy")}</strong>. 
                    You must close the old day and open a new day before processing transactions.
                  </span>
                  <Button
                    onClick={goToTill}
                    size="sm"
                    variant="outline"
                    className="whitespace-nowrap bg-white border-rose-300 text-rose-700 hover:bg-rose-50"
                  >
                    Fix Now
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          )}
          
          <div className="relative flex flex-1 gap-2 bg-background p-2 overflow-hidden justify-center">
            <div className="flex flex-[3] flex-col gap-2 max-w-[1800px] h-full">
              {/* Product Search Bar - Expanded to fill available space */}
              <div className="flex-1 overflow-hidden rounded-lg border shadow-sm bg-card min-h-0">
                <ProductSearchBar
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  searchCategory={searchCategory}
                  setSearchCategory={setSearchCategory}
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                  onOpenScanner={() => {
                    const input = prompt("Enter barcode, SKU, or product name:");
                    if (input && input.trim()) {
                      setSearchQuery(input.trim());
                    }
                  }}
                  onOpenAIModal={onOpenAIModal}
                />
              </div>
            </div>
            <div className="w-[380px] flex-shrink-0 flex flex-col">
              <QuickActionsSection />
            </div>

            <div className="fixed bottom-6 left-6 z-50">
              <Sheet open={isQuickNavOpen} onOpenChange={setIsQuickNavOpen}>
                <SheetTrigger asChild>
                  <Button
                    size="sm"
                    className="h-12 w-12 rounded-full bg-primary shadow-lg hover:bg-primary/90"
                    title="Quick Navigation Menu"
                  >
                    <Settings className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="relative w-80 p-6">
                  <div className="py-6">
                    <QuickNavigationMenu onClose={() => setIsQuickNavOpen(false)} />
                  </div>
                  <button
                    onClick={() => setIsQuickNavOpen(false)}
                    className="absolute right-4 top-4 rounded-full p-2 transition-colors hover:bg-slate-100"
                    aria-label="Close navigation"
                  >
                    <X className="h-5 w-5 text-slate-600" />
                  </button>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>

        {sharedOverlays}
        <PrinterConfigModal
          isOpen={showPrinterConfig}
          onClose={() => setShowPrinterConfig(false)}
        />
      </>
    );
  }

  return (
    <MainLayout
      pageTitle="Point of Sale"
      headerActions={desktopHeaderActions}
      mobileHeaderActions={mobileHeaderActions}
    >
      {pageContent}
    </MainLayout>
  );
}
