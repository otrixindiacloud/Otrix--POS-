import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePOSStore } from "@/lib/pos-store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BarcodeScanner } from "@/components/ui/barcode-scanner";
import CartTable from "@/components/pos/cart-table";
import ReduceItemModal from "@/components/pos/reduce-item-modal";
import { useStore } from "@/hooks/useStore";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { safePaymentMethod, safeCurrencyFormat } from "@/lib/error-handler";
import type { Transaction } from "@shared/schema";
import {
  Camera,
  Search,
  X,
  ScanLine,
  Clock,
  User,
  Coins,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Printer,
} from "lucide-react";

interface ProductSearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchCategory: string;
  setSearchCategory: (category: string) => void;
  sortBy: string;
  setSortBy: (sortBy: string) => void;
  onOpenScanner: () => void;
  onOpenAIModal: (query: string) => void;
}

export default function ProductSearchBar({
  searchQuery,
  setSearchQuery,
  searchCategory,
  setSearchCategory,
  sortBy,
  setSortBy,
  onOpenScanner,
  onOpenAIModal,
}: ProductSearchBarProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showReduceItemModal, setShowReduceItemModal] = useState(false);
  const { addToCart } = usePOSStore();
  const { toast } = useToast();
  const { currentStore } = useStore();
  const searchQueryRef = useRef(searchQuery);
  const processedBarcodeRef = useRef<string | null>(null);
  const [recentTransactionsPage, setRecentTransactionsPage] = useState(1);
  const itemsPerPage = 3;

  // Keep ref in sync with searchQuery
  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  // Listen for payment success to clear search
  useEffect(() => {
    const handlePaymentSuccess = () => {
      setSearchQuery("");
      setSearchCategory("all");
      setSortBy("recent");
    };

    window.addEventListener("paymentSuccess", handlePaymentSuccess);
    return () => {
      window.removeEventListener("paymentSuccess", handlePaymentSuccess);
    };
  }, []); // Remove state setters from dependencies - they are stable references

  // Listen for product added to cart to clear search
  useEffect(() => {
    const handleProductAdded = () => {
      // Clear search query when any product is added to cart
      if (searchQueryRef.current.trim()) {
        setSearchQuery("");
      }
    };

    window.addEventListener("productAddedToCart", handleProductAdded);
    return () => {
      window.removeEventListener("productAddedToCart", handleProductAdded);
    };
  }, []); // Remove setSearchQuery from dependencies - it's a stable reference

  // Helper function to detect if input looks like a barcode
  const isBarcode = (input: string) => {
    const cleaned = input.trim();
    return /^[0-9]{8}$|^[0-9]{12}$|^[0-9]{13}$|^[0-9]{14}$/.test(cleaned);
  };

  // Helper function to detect if input looks like a SKU
  const isSKU = (input: string) => {
    const cleaned = input.trim().toUpperCase();
    return /^[A-Z0-9\-_]{3,20}$/.test(cleaned) && /[A-Z]/.test(cleaned);
  };

  // Automatic barcode lookup
  const { data: barcodeProduct, isLoading: barcodeLoading } = useQuery({
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

  // Automatic SKU lookup
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


  // Auto-add barcode products
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

    // Product found - add to cart
    if (barcodeProduct) {
      processedBarcodeRef.current = searchQuery.trim();
      addToCart(barcodeProduct);
      toast({
        title: "Product Added",
        description: `${barcodeProduct.name} added to cart automatically`,
      });
      setSearchQuery("");
      return;
    }

    // Product not found and query is complete - open AI modal
    if (!barcodeLoading && !barcodeProduct) {
      processedBarcodeRef.current = searchQuery.trim();
      const timer = setTimeout(() => {
        // Double-check the query is still a barcode before opening AI modal
        if (isBarcode(searchQuery) && searchQuery.trim()) {
          onOpenAIModal(searchQuery);
          setSearchQuery("");
          toast({
            title: "Product Not Found",
            description: "Opening AI assistant to help add this product",
          });
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [barcodeProduct, barcodeLoading, searchQuery, addToCart, toast, onOpenAIModal]);


  // Auto-add SKU products
  useEffect(() => {
    // Only process if we have a valid SKU search query and product
    if (!skuProduct || !isSKU(searchQuery) || !searchQuery.trim()) {
      return;
    }

    addToCart(skuProduct);
    toast({
      title: "Product Added",
      description: `${skuProduct.name} added to cart automatically`,
    });
    setSearchQuery("");
  }, [skuProduct, searchQuery, addToCart, toast]);

  // Search products by name
  const { data: searchResults = [] } = useQuery({
    queryKey: ["/api/products/search", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim() || isBarcode(searchQuery) || isSKU(searchQuery)) return [];
      try {
        const params = new URLSearchParams({ q: searchQuery });
        const res = await fetch(`/api/products/search?${params}`);
        if (!res.ok) return [];
        return res.json();
      } catch (error) {
        return [];
      }
    },
    enabled: !!searchQuery.trim() && !isBarcode(searchQuery) && !isSKU(searchQuery),
  });

  // Auto-add if exactly one search result when user presses Enter or waits
  useEffect(() => {
    // Only auto-add if we have exactly one result and it's not a barcode/SKU
    if (
      searchResults.length !== 1 ||
      !searchQuery.trim() ||
      isBarcode(searchQuery) ||
      isSKU(searchQuery)
    ) {
      return;
    }

    const timer = setTimeout(() => {
      // Double-check conditions before adding
      if (
        searchResults.length === 1 &&
        searchQuery.trim() &&
        !isBarcode(searchQuery) &&
        !isSKU(searchQuery)
      ) {
        addToCart(searchResults[0]);
        toast({
          title: "Product Added",
          description: `${searchResults[0].name} added to cart`,
        });
        setSearchQuery("");
      }
    }, 800); // Wait 800ms for user to finish typing
    
    return () => clearTimeout(timer);
  }, [searchResults, searchQuery, addToCart, toast]);

  const clearSearch = () => {
    setSearchQuery("");
    setSearchCategory("all");
  };

  const handleQuickSearch = (term: string) => {
    setSearchQuery(term);
    setIsSearchFocused(false);
  };

  const handleBarcodeScanned = (barcode: string) => {
    setSearchQuery(barcode);
    setShowBarcodeScanner(false);
    toast({
      title: "Barcode Scanned",
      description: `Barcode ${barcode} detected`,
    });
  };

  const handleOpenCamera = () => {
    setShowBarcodeScanner(true);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    // If there's exactly one search result, add it to cart
    if (searchResults.length === 1) {
      addToCart(searchResults[0]);
      toast({
        title: "Product Added",
        description: `${searchResults[0].name} added to cart`,
      });
      setSearchQuery("");
    } else if (searchResults.length > 1) {
      toast({
        title: "Multiple Results",
        description: `Found ${searchResults.length} products. Please refine your search or click on a product.`,
        variant: "default",
      });
    } else if (searchQuery.trim() && !isBarcode(searchQuery) && !isSKU(searchQuery)) {
      toast({
        title: "No Results",
        description: "No products found matching your search.",
        variant: "destructive",
      });
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(e);
  };

  // Fetch recent transactions
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ["/api/transactions", currentStore?.id],
    queryFn: async () => {
      const storeQueryParam = currentStore?.id ? `?storeId=${currentStore.id}` : "";
      const response = await apiRequest("GET", `/api/transactions${storeQueryParam}`);
      return await response.json();
    },
    staleTime: 30 * 1000, // 30 seconds cache
  });

  // Get recent transactions and paginate
  const recentTransactions = (transactions as any[])
    .slice(0, 15)
    .sort((a: any, b: any) => {
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });

  const totalPages = Math.max(1, Math.ceil(recentTransactions.length / itemsPerPage));
  const safePage = Math.min(Math.max(recentTransactionsPage, 1), totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const currentTransactions = recentTransactions.slice(startIndex, startIndex + itemsPerPage);

  const formatDisplayDate = (dateValue: any) => {
    try {
      if (!dateValue) return 'N/A';
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return 'N/A';
      return format(date, 'MMM dd, HH:mm');
    } catch (error) {
      return 'N/A';
    }
  };

  const formatTransactionDate = (dateValue: any) => {
    try {
      if (!dateValue) return 'N/A';
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return 'N/A';
      return format(date, 'MMM dd, yyyy HH:mm');
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'N/A';
    }
  };

  const handlePrintBill = async (transaction: any) => {
    try {
      // Show loading toast
      toast({
        title: "Preparing Receipt",
        description: "Fetching transaction details...",
      });

      // Fetch transaction details including items and customer info
      const [transactionDetailsResponse, transactionItemsResponse] = await Promise.all([
        apiRequest({
          url: `/api/transactions/${transaction.id}`,
          method: "GET",
        }),
        apiRequest({
          url: `/api/transactions/${transaction.id}/items`,
          method: "GET",
        })
      ]);

      const transactionDetails = await transactionDetailsResponse.json();
      const transactionItems = await transactionItemsResponse.json();

      // Fetch customer details if customerId exists
      let customerDetails = null;
      const txDetails = transactionDetails as any;
      if (txDetails.customerId) {
        try {
          const customerResponse = await apiRequest({
            url: `/api/customers/${txDetails.customerId}`,
            method: "GET",
          });
          customerDetails = await customerResponse.json();
        } catch (error) {
          console.log("Could not fetch customer details:", error);
        }
      }

      // Validate transaction data
      if (!txDetails || !txDetails.id) {
        throw new Error("Invalid transaction data received");
      }

      // Generate enhanced receipt with customer info and better formatting
      const receiptHtml = generateEnhancedReceiptHTML(txDetails, transactionItems || [], customerDetails);
      
      // Get saved printer configuration for better printing
      const savedConfig = localStorage.getItem('pos_printer_config');
      let printerConfig = null;
      
      if (savedConfig) {
        try {
          printerConfig = JSON.parse(savedConfig);
        } catch (e) {
          console.log("Could not parse printer config:", e);
        }
      }

      // Determine paper size for optimal printing
      const paperSize = printerConfig?.settings?.paperSize || '80mm';
      const printWidth = paperSize === '58mm' ? '220px' : paperSize === '80mm' ? '300px' : '400px';
      
      // Open print window with optimal settings
      const printWindow = window.open('', '_blank', `width=400,height=600,scrollbars=yes,resizable=yes`);
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(receiptHtml.replace('max-width: 300px', `max-width: ${printWidth}`));
        printWindow.document.close();
        
        // Wait for content to load before printing
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.focus();
            printWindow.print();
            
            // Close window after printing delay
            printWindow.onafterprint = () => {
              setTimeout(() => {
                printWindow.close();
              }, 500);
            };
          }, 500);
        };
        
        toast({
          title: "Receipt Printed",
          description: `Receipt for ${txDetails.transactionNumber} sent to printer`,
        });
      } else {
        throw new Error("Unable to open print window. Please check popup blocker settings.");
      }
    } catch (error) {
      console.error("Print error:", error);
      toast({
        title: "Print Error",
        description: error instanceof Error ? error.message : "Failed to print receipt",
        variant: "destructive",
      });
    }
  };

  const generateEnhancedReceiptHTML = (transaction: any, items: any[], customer: any = null) => {
    const currentDate = new Date().toLocaleString();
    const safeItems = items || [];
    
    // Format payment method display
    const formatPaymentMethod = () => {
      const method = safePaymentMethod(transaction.paymentMethod);
      
      if (method === 'CARD' && transaction.cardType) {
        return `${transaction.cardType.toUpperCase()}${transaction.cardLast4 ? ` ****${transaction.cardLast4}` : ''}`;
      }
      
      return method;
    };
    
    // Safe number formatting function
    const safeFormatNumber = (value: any, defaultValue = 0) => {
      const num = parseFloat(String(value || defaultValue));
      return isNaN(num) ? defaultValue.toFixed(2) : num.toFixed(2);
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${transaction.transactionNumber || 'N/A'}</title>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: 'Courier New', monospace; 
            font-size: 12px; 
            margin: 0; 
            padding: 20px; 
            line-height: 1.4;
            color: #000;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .receipt { 
            max-width: 300px; 
            margin: 0 auto; 
            background: white;
            padding: 0;
            border: none;
          }
          .header { 
            text-align: center; 
            border-bottom: 2px dashed #000; 
            padding-bottom: 15px; 
            margin-bottom: 15px; 
          }
          .header h1 { 
            margin: 0 0 5px 0; 
            font-size: 20px; 
            font-weight: bold;
            letter-spacing: 2px;
          }
          .header .business-info { 
            margin: 5px 0; 
            font-size: 10px;
            font-weight: normal;
          }
          .header .receipt-title { 
            margin: 8px 0 0 0; 
            font-size: 14px;
            font-weight: bold;
            text-decoration: underline;
          }
          .transaction-info { 
            margin-bottom: 15px; 
          }
          .info-section {
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 1px dotted #666;
          }
          .items-section { 
            border-bottom: 2px dashed #000; 
            padding-bottom: 15px; 
            margin-bottom: 15px; 
          }
          .items-header {
            font-weight: bold; 
            margin-bottom: 8px; 
            font-size: 11px; 
            text-align: center;
            background: #f0f0f0;
            padding: 3px;
            border: 1px solid #000;
          }
          .item { 
            margin-bottom: 8px; 
            border-bottom: 1px dotted #ccc;
            padding-bottom: 5px;
          }
          .item:last-child {
            border-bottom: none;
          }
          .item-header {
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            font-size: 11px;
            margin-bottom: 2px;
          }
          .item-details {
            font-size: 9px;
            color: #666;
            margin-bottom: 3px;
          }
          .item-calculation {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            align-items: center;
          }
          .item-total {
            font-weight: bold;
            font-size: 11px;
          }
          .totals-section { 
            margin-bottom: 15px;
            background: #f9f9f9;
            padding: 10px;
            border: 1px solid #ddd;
          }
          .total-line { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 4px; 
            font-size: 11px;
            padding: 1px 0;
          }
          .total-line.final { 
            font-weight: bold; 
            border-top: 2px solid #000; 
            border-bottom: 1px solid #000;
            padding: 8px 0 5px 0; 
            font-size: 14px;
            background: #000;
            color: #fff;
            margin-top: 8px;
          }
          .payment-section {
            margin-bottom: 15px;
            padding: 8px;
            border: 1px solid #ccc;
            background: #f5f5f5;
          }
          .footer { 
            text-align: center; 
            font-size: 9px; 
            margin-top: 15px; 
            border-top: 2px dashed #000;
            padding-top: 15px;
          }
          .footer .thank-you {
            font-size: 12px;
            font-weight: bold;
            margin: 10px 0;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .barcode {
            text-align: center;
            font-family: 'Libre Barcode 39', monospace;
            font-size: 24px;
            margin: 10px 0;
            letter-spacing: 2px;
          }
          @media print {
            body { 
              padding: 10px; 
              margin: 0;
            }
            .receipt { 
              max-width: none; 
              width: 100%;
            }
            @page {
              margin: 0.2in;
              size: auto;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <h1>POS SYSTEM</h1>
            <div class="business-info">Professional Point of Sale</div>
            <div class="business-info">Phone: (555) 123-4567</div>
            <div class="receipt-title">TRANSACTION RECEIPT</div>
          </div>
          
          <div class="transaction-info">
            <div class="info-section">
              <div class="total-line">
                <span><strong>Transaction #:</strong></span>
                <span><strong>${transaction.transactionNumber || 'N/A'}</strong></span>
              </div>
              <div class="total-line">
                <span>Date & Time:</span>
                <span>${formatTransactionDate(transaction.createdAt)}</span>
              </div>
              <div class="total-line">
                <span>Cashier ID:</span>
                <span>${transaction.cashierId || 'N/A'}</span>
              </div>
              <div class="total-line">
                <span>Status:</span>
                <span>${(transaction.status || 'completed').toUpperCase()}</span>
              </div>
            </div>
            
            <div class="info-section">
              ${customer ? `
              <div class="total-line">
                <span><strong>Customer:</strong></span>
                <span><strong>${customer.name || 'N/A'}</strong></span>
              </div>
              ${customer.email ? `
              <div class="total-line">
                <span>Email:</span>
                <span>${customer.email}</span>
              </div>
              ` : ''}
              ${customer.phone ? `
              <div class="total-line">
                <span>Phone:</span>
                <span>${customer.phone}</span>
              </div>
              ` : ''}
              ` : `
              <div class="total-line">
                <span><strong>Customer:</strong></span>
                <span><strong>Walk-in Customer</strong></span>
              </div>
              `}
            </div>
          </div>
          
          <div class="items-section">
            <div class="items-header">
              PURCHASED ITEMS
            </div>
            ${safeItems.length > 0 ? safeItems.map((item, index) => {
              const unitPrice = parseFloat(String(item.unitPrice || item.price || 0));
              const quantity = parseInt(String(item.quantity || 1));
              const itemTotal = unitPrice * quantity;
              
              return `
                <div class="item">
                  <div class="item-header">
                    <span>${index + 1}. ${item.product?.name || item.productName || 'Product'}</span>
                    <span class="item-total">QR ${safeFormatNumber(itemTotal)}</span>
                  </div>
                  ${item.product?.sku ? `
                  <div class="item-details">
                    SKU: ${item.product.sku}
                    ${item.product?.barcode ? ` | Barcode: ${item.product.barcode}` : ''}
                  </div>
                  ` : ''}
                  <div class="item-calculation">
                    <span>${quantity} × QR ${safeFormatNumber(unitPrice)}</span>
                    <span>= QR ${safeFormatNumber(itemTotal)}</span>
                  </div>
                </div>
              `;
            }).join('') : `
              <div class="item">
                <div class="item-header">
                  <span>Transaction Items</span>
                  <span class="item-total">QR ${safeFormatNumber(transaction.total)}</span>
                </div>
                <div class="item-details">Items details not available</div>
                <div class="item-calculation">
                  <span>Total Amount</span>
                  <span>QR ${safeFormatNumber(transaction.total)}</span>
                </div>
              </div>
            `}
          </div>
          
          <div class="totals-section">
            <div class="total-line">
              <span>Subtotal:</span>
              <span>QR ${safeFormatNumber(transaction.subtotal)}</span>
            </div>
            ${transaction.tax && parseFloat(String(transaction.tax)) > 0 ? `
            <div class="total-line">
              <span>Tax:</span>
              <span>QR ${safeFormatNumber(transaction.tax)}</span>
            </div>
            ` : ''}
            ${transaction.discount && parseFloat(String(transaction.discount)) > 0 ? `
            <div class="total-line">
              <span>Discount:</span>
              <span>-QR ${safeFormatNumber(transaction.discount)}</span>
            </div>
            ` : ''}
            <div class="total-line final">
              <span>TOTAL AMOUNT</span>
              <span>QR ${safeFormatNumber(transaction.total)}</span>
            </div>
          </div>
          
          <div class="payment-section">
            <div class="total-line">
              <span><strong>Payment Method:</strong></span>
              <span><strong>${formatPaymentMethod()}</strong></span>
            </div>
            ${transaction.authCode ? `
            <div class="total-line">
              <span>Authorization Code:</span>
              <span>${transaction.authCode}</span>
            </div>
            ` : ''}
            ${safePaymentMethod(transaction.paymentMethod) === 'CASH' && transaction.cashTendered && parseFloat(String(transaction.cashTendered)) > 0 ? `
            <div class="total-line">
              <span>Cash Tendered:</span>
              <span>QR ${safeFormatNumber(transaction.cashTendered)}</span>
            </div>
            <div class="total-line">
              <span>Change Given:</span>
              <span>QR ${safeFormatNumber(Math.max(0, parseFloat(String(transaction.cashTendered)) - parseFloat(String(transaction.total || 0))))}</span>
            </div>
            ` : ''}
          </div>
          
          ${transaction.transactionNumber ? `
          <div class="barcode">
            *${transaction.transactionNumber}*
          </div>
          ` : ''}
          
          <div class="footer">
            <div class="thank-you">Thank You for Your Business!</div>
            <p>Please keep this receipt for your records</p>
            <p>Visit us again soon</p>
            <hr style="border: 1px dashed #666; margin: 10px 0;">
            <p>Receipt Generated: ${currentDate}</p>
            <p style="font-size: 8px;">Powered by POS System v2.0</p>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  return (
    <div className="border-b bg-card p-4 h-full flex flex-col">
      <form onSubmit={handleSearchSubmit} className="space-y-4 flex-shrink-0">
        {/* Main Search Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold text-foreground">
              Product Search
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowReduceItemModal(true)}
              className="text-xs"
            >
              <ScanLine className="w-3 h-3 mr-1" />
              Reduce Item
            </Button>
          </div>
          <div className="relative">
            <Input
              type="text"
              placeholder="please scan here"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              className="h-11 text-base pl-4 pr-24 rounded-none"
              autoComplete="off"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleOpenCamera}
                className="h-8 w-8 p-0 hover:bg-primary/10"
                title="Scan barcode with camera"
              >
                <Camera className="w-4 h-4 text-primary" />
              </Button>
              <Search className="text-muted-foreground w-5 h-5" />
            </div>
          </div>
        </div>
      </form>

      {/* Cart Table */}
      <div className="mt-4 flex-shrink-0">
        <CartTable />
      </div>

      {/* Recent Transactions Section */}
      <div className="mt-4 flex-1 overflow-auto border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-semibold text-foreground">
            Recent Transactions
          </Label>
          {recentTransactions.length > itemsPerPage && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRecentTransactionsPage(prev => Math.max(1, prev - 1))}
                disabled={safePage <= 1}
                className="h-7 w-7 p-0"
              >
                <ChevronLeft className="w-3 h-3" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {safePage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRecentTransactionsPage(prev => Math.min(totalPages, prev + 1))}
                disabled={safePage >= totalPages}
                className="h-7 w-7 p-0"
              >
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
        
        {transactionsLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse bg-slate-100 rounded p-3 h-16"></div>
            ))}
          </div>
        ) : recentTransactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No recent transactions</p>
          </div>
        ) : (
          <div className="space-y-2">
            {currentTransactions.map((transaction: any, index: number) => (
              <div
                key={transaction.id ?? transaction.transactionNumber ?? index}
                className="flex items-center justify-between p-2 border rounded hover:bg-slate-50 transition-colors text-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-xs truncate">
                      {transaction.transactionNumber}
                    </span>
                    <Badge 
                      variant={transaction.status === 'completed' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {transaction.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {transaction.customer?.name || 'Walk-in'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Coins className="w-3 h-3" />
                      QR {parseFloat(String(transaction.total || 0)).toFixed(2)}
                    </span>
                    <span className="flex items-center gap-1">
                      <CreditCard className="w-3 h-3" />
                      {safePaymentMethod(transaction.paymentMethod)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                    <Clock className="w-3 h-3" />
                    {formatDisplayDate(transaction.createdAt)}
                  </div>
                </div>
                <div className="flex gap-2 ml-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePrintBill(transaction)}
                    className="h-8 px-2"
                    title="Print receipt"
                  >
                    <Printer className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScanned}
      />

      {/* Reduce Item Modal */}
      <ReduceItemModal
        isOpen={showReduceItemModal}
        onClose={() => setShowReduceItemModal(false)}
      />
    </div>
  );
}
