import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Clock, 
  User, 
  Coins, 
  CreditCard, 
  ChevronLeft, 
  ChevronRight,
  Printer,
  Receipt,
  AlertCircle,
  MessageCircle,
  Mail,
  Share2,
  X
} from "lucide-react";
import { format } from "date-fns";
import type { Transaction } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton-loader";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { safePaymentMethod, safeCurrencyFormat, safeDateOperation, errorHandler } from "@/lib/error-handler";
import { useStore } from "@/hooks/useStore";

interface RecentTransactionsProps {
  className?: string;
}

export default function RecentTransactions({ className = "" }: RecentTransactionsProps) {
  const { toast } = useToast();
  const { currentStore } = useStore();
  const itemsPerPage = 3;
  const [currentPage, setCurrentPage] = useState(1);
  const [showAllDialog, setShowAllDialog] = useState(false);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["/api/transactions", currentStore?.id],
    queryFn: async () => {
      const storeQueryParam = currentStore?.id ? `?storeId=${currentStore.id}` : "";
      const response = await apiRequest("GET", `/api/transactions${storeQueryParam}`);
      return await response.json();
    },
    staleTime: 30 * 1000, // 30 seconds cache
  });

  // Get recent 15 transactions and paginate
  const recentTransactions = (transactions as Transaction[])
    .slice(0, 15)
    .sort((a: Transaction, b: Transaction) => {
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });

  const computedTotalPages = Math.ceil(recentTransactions.length / itemsPerPage);
  const totalPages = Math.max(1, computedTotalPages);
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const currentTransactions = recentTransactions.slice(startIndex, startIndex + itemsPerPage);
  const isFirstPage = safePage <= 1;
  const isLastPage = computedTotalPages === 0 ? true : safePage >= totalPages;

  const handlePrintBill = async (transaction: Transaction) => {
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

      console.log("Transaction details:", txDetails);
      console.log("Transaction items:", transactionItems);
      console.log("Customer details:", customerDetails);

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

  const handleShareWhatsApp = async (transaction: Transaction) => {
    try {
      toast({
        title: "Generating Invoice",
        description: "Creating WhatsApp shareable invoice...",
      });

      // Generate invoice and get WhatsApp link
      const response = await apiRequest({
        url: `/api/transactions/${transaction.id}/generate-invoice`,
        method: "POST",
        body: {
          shareVia: "whatsapp"
        }
      });

      const data = await response.json();
      const { whatsappLink } = data;
      
      if (whatsappLink) {
        // Open WhatsApp sharing link
        window.open(whatsappLink, '_blank');
        
        toast({
          title: "WhatsApp Share",
          description: "Invoice shared via WhatsApp successfully",
        });
      } else {
        throw new Error("Failed to generate WhatsApp sharing link");
      }
    } catch (error) {
      console.error("WhatsApp share error:", error);
      toast({
        title: "Share Error",
        description: error instanceof Error ? error.message : "Failed to share via WhatsApp",
        variant: "destructive",
      });
    }
  };

  const handleShareEmail = async (transaction: Transaction) => {
    try {
      toast({
        title: "Generating Invoice",
        description: "Creating email shareable invoice...",
      });

      // Generate invoice and get download link
      const response = await apiRequest({
        url: `/api/transactions/${transaction.id}/generate-invoice`,
        method: "POST",
        body: {
          shareVia: "email"
        }
      });

      const data = await response.json();
      const { invoiceUrl, generatedInvoice } = data;
      
      if (invoiceUrl && generatedInvoice) {
        // Create full URL for invoice
        const fullInvoiceUrl = `${window.location.origin}${invoiceUrl}`;
        
        // Create email mailto link with invoice attachment details
        const subject = `Invoice ${generatedInvoice.invoiceNumber} - POS System`;
        const body = `Dear Customer,\n\nPlease find your invoice for transaction ${transaction.transactionNumber}.\n\nInvoice Details:\n- Invoice Number: ${generatedInvoice.invoiceNumber}\n- Transaction Date: ${formatTransactionDate(transaction.createdAt)}\n- Total Amount: QR ${safeCurrencyFormat(transaction.total)}\n\nView Invoice: ${fullInvoiceUrl}\n\nThank you for your business!\n\nBest regards,\nPOS System`;
        
        const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        
        // Open email client
        window.open(mailtoLink, '_blank');
        
        toast({
          title: "Email Share",
          description: "Invoice email template opened successfully",
        });
      } else {
        throw new Error("Failed to generate email sharing link");
      }
    } catch (error) {
      console.error("Email share error:", error);
      toast({
        title: "Share Error",
        description: error instanceof Error ? error.message : "Failed to share via email",
        variant: "destructive",
      });
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

  const formatDisplayDate = (dateValue: any) => {
    try {
      if (!dateValue) return 'N/A';
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return 'N/A';
      return format(date, 'MMM dd, HH:mm');
    } catch (error) {
      console.error('Display date formatting error:', error);
      return 'N/A';
    }
  };

  const generateEnhancedReceiptHTML = (transaction: Transaction, items: any[], customer: any = null) => {
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
    
    // Calculate totals for verification
    const calculatedSubtotal = safeItems.reduce((sum, item) => 
      sum + (parseFloat(String(item.unitPrice || item.price || 0)) * parseInt(String(item.quantity || 1))), 0
    );
    
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
                <span><strong>${(customer as any).name || 'N/A'}</strong></span>
              </div>
              ${(customer as any).email ? `
              <div class="total-line">
                <span>Email:</span>
                <span>${(customer as any).email}</span>
              </div>
              ` : ''}
              ${(customer as any).phone ? `
              <div class="total-line">
                <span>Phone:</span>
                <span>${(customer as any).phone}</span>
              </div>
              ` : ''}
              ${(customer as any).creditLimit ? `
              <div class="total-line">
                <span>Credit Limit:</span>
                <span>QR {safeFormatNumber((customer as any).creditLimit)}</span>
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
                    <span class="item-total">$${safeFormatNumber(itemTotal)}</span>
                  </div>
                  ${item.product?.sku ? `
                  <div class="item-details">
                    SKU: ${item.product.sku}
                    ${item.product?.barcode ? ` | Barcode: ${item.product.barcode}` : ''}
                  </div>
                  ` : ''}
                  <div class="item-calculation">
                    <span>${quantity} × $${safeFormatNumber(unitPrice)}</span>
                    <span>= $${safeFormatNumber(itemTotal)}</span>
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
            ${(transaction as any).discount && parseFloat(String((transaction as any).discount)) > 0 ? `
            <div class="total-line">
              <span>Discount:</span>
              <span>-QR ${safeFormatNumber((transaction as any).discount)}</span>
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

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [recentTransactions.length]);

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center justify-between p-3 border rounded">
                  <div className="flex-1">
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                  </div>
                  <div className="h-8 w-16 bg-slate-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Recent Transactions</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {recentTransactions.length} total
            </Badge>
            {recentTransactions.length > itemsPerPage && (
              <Button
                size="sm"
                variant="default"
                onClick={() => setShowAllDialog(true)}
                className="h-7 px-3 text-xs"
              >
                View All
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex h-full flex-col">
        {recentTransactions.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-sm">No recent transactions</p>
            <p className="text-xs">Completed transactions will appear here</p>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {currentTransactions.map((transaction: Transaction, index) => (
                <div 
                  key={transaction.id ?? transaction.transactionNumber ?? index}
                  className="flex items-center justify-between p-3 border rounded hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">
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
                        {(transaction as any).customer?.name || 'Walk-in'}
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
                    >
                      <Printer className="w-3 h-3 mr-1" />
                      Print
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleShareWhatsApp(transaction)}
                      className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                      <MessageCircle className="w-3 h-3 mr-1" />
                      WhatsApp
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleShareEmail(transaction)}
                      className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    >
                      <Mail className="w-3 h-3 mr-1" />
                      Email
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t mt-4">
                <div className="text-xs text-slate-500">
                  Page {safePage} of {totalPages}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handlePreviousPage}
                    disabled={isFirstPage}
                    className="h-7 px-2"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleNextPage}
                    disabled={isLastPage}
                    className="h-7 px-2"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* View All Dialog */}
      <Dialog open={showAllDialog} onOpenChange={setShowAllDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="text-xl font-bold">
                All Recent Transactions
              </DialogTitle>
              <Badge variant="outline" className="text-sm">
                {recentTransactions.length} total
              </Badge>
            </div>
            <DialogDescription>
              Complete list of your recent transactions
            </DialogDescription>
          </DialogHeader>
          
          <div className="overflow-y-auto max-h-[calc(85vh-180px)] pr-2">
            <div className="space-y-3">
              {recentTransactions.map((transaction: Transaction, index) => (
                <div 
                  key={transaction.id ?? transaction.transactionNumber ?? index}
                  className="flex items-center justify-between p-3 border rounded hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">
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
                        {(transaction as any).customer?.name || 'Walk-in'}
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
                    >
                      <Printer className="w-3 h-3 mr-1" />
                      Print
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleShareWhatsApp(transaction)}
                      className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                      <MessageCircle className="w-3 h-3 mr-1" />
                      WhatsApp
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleShareEmail(transaction)}
                      className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    >
                      <Mail className="w-3 h-3 mr-1" />
                      Email
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}