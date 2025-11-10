import { useState, useRef, useEffect } from "react";
import QRCode from "qrcode";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Printer, 
  Download, 
  Mail, 
  Check,
  Receipt,
  PrinterIcon,
  MessageCircle,
  QrCode
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { safePaymentMethod, safeCurrencyFormat, safeDateOperation } from "@/lib/error-handler";
import type { Transaction, TransactionItem, Customer } from "@shared/schema";

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  transactionItems: TransactionItem[];
  customer: Customer | null;
  autoPrint?: boolean;
}

export default function ReceiptModal({ 
  isOpen, 
  onClose, 
  transaction, 
  transactionItems, 
  customer,
  autoPrint = false
}: ReceiptModalProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const receiptRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Debug log to verify props
  console.log("ReceiptModal rendered with:", { 
    isOpen, 
    autoPrint, 
    hasTransaction: !!transaction,
    transactionNumber: transaction?.transactionNumber 
  });

  if (!transaction) return null;

  // Generate QR code for receipt
  useEffect(() => {
    if (transaction?.id) {
      const receiptUrl = `${window.location.origin}/receipt/${transaction.id}`;
      QRCode.toDataURL(receiptUrl, { width: 80, margin: 1 })
        .then(setQrCodeUrl)
        .catch(() => setQrCodeUrl(""));
    }
  }, [transaction?.id]);

  // Safe parsing for financial calculations
  const safeCashTendered = parseFloat(transaction.cashTendered || "0") || 0;

  const generateWhatsAppLink = () => {
    const message = `🧾 *Receipt #${transaction.transactionNumber}*\n\n` +
      `💰 *Total: ${safeCurrencyFormat(transaction.total)}*\n` +
      `📅 Date: ${safeDateOperation(new Date(transaction.createdAt || Date.now()), (date: any) => format(date, "MMM dd, yyyy 'at' h:mm a"))}\n` +
      `🏪 Store: Main Store\n\n` +
      `📄 View full receipt: ${window.location.origin}/receipt/${transaction.id}\n\n` +
      `Thank you for your business! 🙏`;
    
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  const handleWhatsAppShare = () => {
    const whatsappUrl = generateWhatsAppLink();
    window.open(whatsappUrl, '_blank');
    toast({
      title: "WhatsApp Opened",
      description: "Receipt details ready to share",
    });
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      // Get saved printer configuration
      const savedConfig = localStorage.getItem('pos_printer_config');
      let printerConfig = null;
      
      if (savedConfig) {
        try {
          printerConfig = JSON.parse(savedConfig);
        } catch (e) {
          // Could not parse printer config
        }
      }

      const printerName = printerConfig?.selectedPrinter?.name || 'Default Printer';
      // Printing receipt to configured printer

      // Use configured printer settings or defaults
      const paperSize = printerConfig?.settings?.paperSize || '80mm';
      const fontSize = paperSize === '58mm' ? '10px' : paperSize === '80mm' ? '12px' : '14px';
      
      // Create optimized print window for the configured printer
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      if (!printWindow) {
        throw new Error('Popup blocked. Please allow popups to print receipts.');
      }

      const receiptContent = generateReceiptHTML();
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt - ${printerName}</title>
          <style>
            @media print {
              @page { 
                size: ${paperSize === '58mm' ? '58mm auto' : 
                        paperSize === '80mm' ? '80mm auto' : 
                        '112mm auto'};
                margin: 0;
              }
            }
            body { 
              font-family: 'Courier New', monospace; 
              font-size: ${fontSize}; 
              line-height: 1.2; 
              margin: 0; 
              padding: 10px;
            }
            .receipt { 
              width: 100%; 
              max-width: ${paperSize};
            }
          </style>
        </head>
        <body>
          <div class="receipt">${receiptContent}</div>
          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
                setTimeout(() => window.close(), 1000);
              }, 500);
            };
          </script>
        </body>
        </html>
      `);
      
      printWindow.document.close();
      
      // Mark receipt as printed in the database
      await apiRequest({
        url: `/api/transactions/${transaction.id}/mark-printed`,
        method: "PATCH"
      });
      
      toast({
        title: "Receipt Printed",
        description: `Receipt sent to ${printerName}`,
      });
    } catch (error) {
      toast({
        title: "Print Error", 
        description: `Failed to print receipt: ${error}`,
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleThermalPrint = async () => {
    setIsPrinting(true);
    try {
      // For thermal printer integration with QNB POS terminal
      // In real implementation, this would send ESC/POS commands to thermal printer
      // Sending receipt to thermal printer
      
      // Simulate thermal printing delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mark receipt as printed
      await apiRequest({
        url: `/api/transactions/${transaction.id}/mark-printed`,
        method: "PATCH"
      });
      
      toast({
        title: "Receipt Sent to Printer",
        description: "Receipt has been sent to thermal printer",
      });
      
      onClose();
    } catch (error) {
      toast({
        title: "Printer Error",
        description: "Failed to print to thermal printer",
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadPDF = () => {
    // Generate downloadable receipt
    const receiptContent = generateReceiptText();
    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${transaction.transactionNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleEmailReceipt = () => {
    const receiptContent = generateReceiptText();
    const subject = `Receipt for Transaction ${transaction.transactionNumber}`;
    const body = encodeURIComponent(receiptContent);
    window.open(`mailto:${customer?.email || ''}?subject=${subject}&body=${body}`);
  };

  const generateReceiptHTML = () => {
    const receiptText = generateReceiptText();
    return receiptText.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
  };

  const generateReceiptText = () => {
    // Safe date formatting
    const formatTransactionDate = () => {
      try {
        if (!transaction.createdAt) return new Date().toLocaleString();
        const date = new Date(transaction.createdAt);
        if (isNaN(date.getTime())) return new Date().toLocaleString();
        return format(date, 'MM/dd/yyyy hh:mm a');
      } catch (error) {
        console.error('Date formatting error:', error);
        return new Date().toLocaleString();
      }
    };

    const lines = [
      "Your Store Name",
      "123 Main Street", 
      "City, State 12345",
      "Phone: (555) 123-4567",
      "",
      "RECEIPT",
      "================================",
      `Transaction #: ${transaction.transactionNumber}`,
      `Date: ${formatTransactionDate()}`,
      customer ? `Customer: ${customer.name}` : "Customer: Walk-in",
      "================================",
      ""
    ];

    transactionItems.forEach(item => {
      const productName = (item as any).productName || (item as any).name || 'Unknown Product';
      const price = parseFloat((item as any).unitPrice || item.total) / item.quantity || 0;
      lines.push(`${productName}`);
      lines.push(`  Qty: ${item.quantity} x QR ${price.toFixed(2)} = QR ${(price * item.quantity).toFixed(2)}`);
    });

    lines.push("");
    lines.push("================================");
    lines.push(`Subtotal: QR ${subtotal.toFixed(2)}`);
    lines.push(`Tax: QR ${tax.toFixed(2)}`);
    lines.push(`Total: QR ${total.toFixed(2)}`);
    lines.push("");
    lines.push(`Payment: ${safePaymentMethod(transaction.paymentMethod)}`);
    
    if (safePaymentMethod(transaction.paymentMethod) === 'CASH' && transaction.cashTendered) {
      const safeCashTendered = parseFloat(transaction.cashTendered) || 0;
      lines.push(`Cash Tendered: QR ${safeCashTendered.toFixed(2)}`);
      lines.push(`Change: QR ${Math.max(0, safeCashTendered - total).toFixed(2)}`);
    } else if (safePaymentMethod(transaction.paymentMethod) === 'CARD') {
      if (transaction.cardType) lines.push(`Card Type: ${transaction.cardType}`);
      if (transaction.cardLast4) lines.push(`Card: ****${transaction.cardLast4}`);
      if (transaction.authCode) lines.push(`Auth Code: ${transaction.authCode}`);
    }

    lines.push("");
    lines.push("Thank you for your business!");
    lines.push("Please keep this receipt for your records");

    return lines.join('\n');
  };

  // Silent print function for auto-print without preview
  const handleSilentPrint = async () => {
    try {
      console.log("Starting silent print process...");
      
      // Get saved printer configuration
      const savedConfig = localStorage.getItem('pos_printer_config');
      let printerConfig = null;
      
      if (savedConfig) {
        try {
          printerConfig = JSON.parse(savedConfig);
          console.log("Printer config loaded:", printerConfig);
        } catch (e) {
          console.error("Could not parse printer config:", e);
        }
      } else {
        console.log("No printer config found, using defaults");
      }

      const printerName = printerConfig?.selectedPrinter?.name || 'Default Printer';
      console.log("Printing to:", printerName);

      // Use configured printer settings or defaults
      const paperSize = printerConfig?.settings?.paperSize || '80mm';
      const fontSize = paperSize === '58mm' ? '10px' : paperSize === '80mm' ? '12px' : '14px';
      
      // Create a hidden iframe for silent printing
      console.log("Creating iframe for printing...");
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
      console.log("Iframe created and added to body");

      const receiptContent = generateReceiptHTML();
      console.log("Receipt HTML generated, length:", receiptContent.length);
      
      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt - ${printerName}</title>
          <style>
            @media print {
              @page { 
                size: ${paperSize === '58mm' ? '58mm auto' : 
                        paperSize === '80mm' ? '80mm auto' : 
                        '112mm auto'};
                margin: 0;
              }
            }
            body { 
              font-family: 'Courier New', monospace; 
              font-size: ${fontSize}; 
              line-height: 1.2; 
              margin: 0; 
              padding: 10px;
            }
            .receipt { 
              width: 100%; 
              max-width: ${paperSize};
            }
          </style>
        </head>
        <body>
          <div class="receipt">${receiptContent}</div>
        </body>
        </html>
      `;

      // Write content to iframe
      console.log("Writing content to iframe...");
      iframe.contentDocument?.open();
      iframe.contentDocument?.write(printContent);
      iframe.contentDocument?.close();
      console.log("Content written to iframe");

      // Wait for content to load then print silently
      setTimeout(() => {
        try {
          console.log("Calling print on iframe...");
          iframe.contentWindow?.print();
          console.log("Print command executed successfully");
          
          toast({
            title: "Receipt Printed",
            description: `Receipt automatically sent to ${printerName}`,
          });

          // Mark receipt as printed
          apiRequest({
            url: `/api/transactions/${transaction.id}/mark-printed`,
            method: "PATCH"
          }).catch(console.error);

          // Don't auto-close modal - let user close it manually after verifying print
          // This ensures the modal stays open long enough for printing to complete
          // User can close it when ready

        } catch (printError) {
          console.error("Silent print failed:", printError);
          toast({
            title: "Auto-print Failed",
            description: "Falling back to manual print dialog",
            variant: "destructive"
          });
          // Fallback to regular print
          handlePrint();
        }

        // Clean up iframe after longer delay to ensure print completes
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 3000);
      }, 500);
      
    } catch (error) {
      console.error("Silent print error:", error);
      toast({
        title: "Auto-print Error",
        description: "Using manual print instead",
        variant: "destructive"
      });
      // Fallback to regular print
      handlePrint();
    }
  };

  // Auto-print functionality - placed after all function definitions
  useEffect(() => {
    console.log("Auto-print useEffect evaluated:", { 
      autoPrint, 
      isOpen, 
      hasTransaction: !!transaction,
      transactionId: transaction?.id,
      willTrigger: autoPrint && isOpen && transaction 
    });
    
    if (autoPrint && isOpen && transaction) {
      console.log("✅ Auto-print triggered:", { autoPrint, isOpen, transaction: !!transaction });
      
      // Show notification that printing is starting
      toast({
        title: "Printing Invoice",
        description: `Receipt #${transaction.transactionNumber} is being printed...`,
        duration: 3000,
      });
      
      // Wait a moment for the modal to fully load
      const timer = setTimeout(() => {
        // Directly trigger silent print for default printer
        console.log("⏰ Triggering silent print for default printer...");
        
        // Execute the print function
        (async () => {
          try {
            await handleSilentPrint();
          } catch (error) {
            console.error("❌ Auto-print execution error:", error);
          }
        })();
      }, 500);
      
      return () => clearTimeout(timer);
    } else {
      console.log("❌ Auto-print NOT triggered. Conditions not met.");
    }
  }, [autoPrint, isOpen, transaction, toast]);

  const subtotal = transactionItems.reduce((sum, item) => {
    const price = parseFloat((item as any).unitPrice || item.total) / item.quantity || 0;
    return sum + (price * item.quantity);
  }, 0);
  const tax = subtotal * 0.08; // 8% tax
  const total = subtotal + tax;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Receipt className="w-5 h-5 mr-2" />
            Receipt
          </DialogTitle>
          <DialogDescription>
            Transaction receipt for #{transaction.transactionNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Receipt Content */}
          <div 
            ref={receiptRef}
            className="receipt-content bg-white p-6 text-sm font-mono print:p-4 print:text-xs print:max-w-none"
            style={{ fontFamily: 'monospace' }}
          >
            {/* Store Header with Logo */}
            <div className="text-center mb-4">
              <div className="flex justify-center mb-2">
                <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xl">RP</span>
                </div>
              </div>
              <h2 className="text-lg font-bold">RetailPro Store</h2>
              <p className="text-xs">123 Business District</p>
              <p className="text-xs">Doha, Qatar 12345</p>
              <p className="text-xs">Phone: +974 4444 5555</p>
            </div>

            <Separator className="my-4" />

            {/* QR Code for Receipt */}
            <div className="text-center mb-4">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="Receipt QR Code" className="mx-auto" />
              ) : (
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded border-2 border-dashed border-gray-300">
                  <QrCode className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <p className="text-xs text-gray-600 mt-1">Receipt ID: #{transaction.id}</p>
            </div>

            <Separator className="my-4" />

            {/* Transaction Info */}
            <div className="space-y-1 mb-4">
              <div className="flex justify-between">
                <span>Transaction #:</span>
                <span>{transaction.transactionNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{(() => {
                  try {
                    if (!transaction.createdAt) return new Date().toLocaleDateString();
                    const date = new Date(transaction.createdAt);
                    if (isNaN(date.getTime())) return new Date().toLocaleDateString();
                    return format(date, 'MM/dd/yyyy');
                  } catch (error) {
                    return new Date().toLocaleDateString();
                  }
                })()}</span>
              </div>
              <div className="flex justify-between">
                <span>Time:</span>
                <span>{(() => {
                  try {
                    if (!transaction.createdAt) return new Date().toLocaleTimeString();
                    const date = new Date(transaction.createdAt);
                    if (isNaN(date.getTime())) return new Date().toLocaleTimeString();
                    return format(date, 'hh:mm a');
                  } catch (error) {
                    return new Date().toLocaleTimeString();
                  }
                })()}</span>
              </div>
              {customer && (
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span>{customer.name}</span>
                </div>
              )}
            </div>

            <Separator className="my-4" />

            {/* Items */}
            <div className="space-y-2 mb-4">
              {transactionItems.map((item) => {
                const productName = (item as any).productName || (item as any).name || 'Unknown Product';
                const price = parseFloat((item as any).unitPrice || item.total) / item.quantity || 0;
                return (
                  <div key={item.id}>
                    <div className="flex justify-between">
                      <span className="truncate flex-1">{productName}</span>
                      <span>QR {price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Qty: {item.quantity}</span>
                      <span>Total: QR {(price * item.quantity).toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <Separator className="my-4" />

            {/* Totals */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>QR {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax (8%):</span>
                <span>QR {tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span>QR {total.toFixed(2)}</span>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Payment Info */}
            <div className="space-y-1 mb-4">
              <div className="flex justify-between">
                <span>Payment Method:</span>
                <span className="capitalize">{transaction.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount Paid:</span>
                <span>QR {total.toFixed(2)}</span>
              </div>
              {transaction.paymentMethod === 'cash' && transaction.cashTendered && (
                <>
                  <div className="flex justify-between">
                    <span>Cash Tendered:</span>
                    <span>QR {safeCashTendered.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Change:</span>
                    <span>QR {Math.max(0, safeCashTendered - total).toFixed(2)}</span>
                  </div>
                </>
              )}
              {transaction.paymentMethod === 'card' && (
                <>
                  {transaction.cardType && (
                    <div className="flex justify-between">
                      <span>Card Type:</span>
                      <span>{transaction.cardType}</span>
                    </div>
                  )}
                  {transaction.cardLast4 && (
                    <div className="flex justify-between">
                      <span>Card Number:</span>
                      <span>****{transaction.cardLast4}</span>
                    </div>
                  )}
                  {transaction.authCode && (
                    <div className="flex justify-between">
                      <span>Authorization:</span>
                      <span>{transaction.authCode}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <Separator className="my-4" />

            {/* Footer */}
            <div className="text-center text-xs">
              <p>Thank you for your business!</p>
              <p>Please keep this receipt for your records</p>
              <div className="mt-2 pt-2 border-t border-dashed">
                <p className="text-xs text-gray-600">📱 Share on WhatsApp:</p>
                <p className="text-xs font-mono break-all">{generateWhatsAppLink().slice(0, 50)}...</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col space-y-2 pt-4 border-t print:hidden">
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={handleThermalPrint}
                disabled={isPrinting}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <PrinterIcon className="w-4 h-4 mr-2" />
                {isPrinting ? "Printing..." : "QNB Printer"}
              </Button>
              
              <Button
                onClick={handlePrint}
                disabled={isPrinting}
                variant="outline"
                className="w-full"
              >
                <Printer className="w-4 h-4 mr-2" />
                {isPrinting ? "Printing..." : "Browser Print"}
              </Button>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={handleWhatsAppShare}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                WhatsApp
              </Button>
              
              <Button
                variant="outline"
                onClick={handleDownloadPDF}
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
              
              <Button
                variant="outline"
                onClick={handleEmailReceipt}
                className="w-full"
                disabled={!customer?.email}
              >
                <Mail className="w-4 h-4 mr-2" />
                Email
              </Button>
            </div>
            
            <Button
              variant="outline"
              onClick={onClose}
              className="w-full"
            >
              <Check className="w-4 h-4 mr-2" />
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}