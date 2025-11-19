import { useState, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Camera, 
  Upload, 
  Check, 
  X, 
  AlertTriangle, 
  FileText, 
  Loader2,
  Plus,
  Edit,
  Save,
  Scan
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Supplier, Product } from "@shared/schema";

interface InvoiceScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'receipt' | 'return';
}

interface ExtractedData {
  invoiceNumber: string;
  supplierName: string;
  invoiceDate: string;
  dueDate?: string;
  subtotal: number;
  tax: number;
  total: number;
  items: {
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    sku?: string;
    barcode?: string;
  }[];
  confidence: number;
}

interface ProductMatch {
  invoiceItem: any;
  matchedProduct: Product | null;
  matchConfidence: number;
  suggestedProduct: {
    name: string;
    description: string;
    category: string;
    sku: string;
    barcode?: string;
  };
  action: 'match' | 'create_new';
}

export default function InvoiceScanModal({ isOpen, onClose, type }: InvoiceScanModalProps) {
  const [step, setStep] = useState<'upload' | 'review' | 'confirm'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [productMatches, setProductMatches] = useState<ProductMatch[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingItems, setEditingItems] = useState<any[]>([]);
  const [invoiceImageUrl, setInvoiceImageUrl] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const scanMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/supplier-invoices/scan', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error('Failed to process invoice');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setExtractedData(data.extractedData);
      setProductMatches(data.productMatches);
      setEditingItems(data.extractedData.items);
      setInvoiceImageUrl(data.imageUrl); // Capture the image URL
      
      // Try to match supplier
      const matchedSupplier = suppliers.find((s: Supplier) => 
        s.name.toLowerCase().includes(data.extractedData.supplierName.toLowerCase())
      );
      if (matchedSupplier) {
        setSelectedSupplier(matchedSupplier.id);
      }
      
      setStep('review');
      setIsProcessing(false);
    },
    onError: (error: any) => {
      console.error('Scan error:', error);
      toast({
        title: "Processing Failed", 
        description: error?.message || "Failed to process the invoice. Please check your image quality and try again.",
        variant: "destructive",
      });
      setIsProcessing(false);
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (invoiceData: any) => {
      const response = await apiRequest("POST", '/api/supplier-invoices', invoiceData);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invoice Processed",
        description: `${type === 'receipt' ? 'Receipt' : 'Return'} has been successfully processed and saved.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      handleClose();
    },
    onError: (error: any) => {
      let errorMessage = "Failed to save the invoice. Please try again.";
      
      if (error.message?.includes("Invoice number already exists") || error.message?.includes("already exists")) {
        errorMessage = "Invoice already added. This invoice number already exists in the system.";
      }
      
      toast({
        title: "Save Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const createSupplierMutation = useMutation({
    mutationFn: async (supplierData: any) => {
      const response = await apiRequest("POST", '/api/suppliers', supplierData);
      return await response.json();
    },
    onSuccess: (newSupplier) => {
      setSelectedSupplier(newSupplier.id);
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({
        title: "Supplier Created",
        description: "New supplier has been added successfully.",
      });
    },
  });

  const handleClose = () => {
    setStep('upload');
    setSelectedFile(null);
    setImagePreview(null);
    setExtractedData(null);
    setProductMatches([]);
    setSelectedSupplier(null);
    setEditingItems([]);
    setInvoiceImageUrl(null);
    setIsProcessing(false);
    onClose();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScanInvoice = async () => {
    if (!selectedFile) return;
    
    setIsProcessing(true);
    const formData = new FormData();
    formData.append('invoice', selectedFile);
    formData.append('isReturn', type === 'return' ? 'true' : 'false');
    
    scanMutation.mutate(formData);
  };

  const handleCreateSupplier = () => {
    if (!extractedData) return;
    
    createSupplierMutation.mutate({
      name: extractedData.supplierName,
      isActive: true,
    });
  };

  const updateItemValue = (index: number, field: string, value: any) => {
    const updatedItems = [...editingItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setEditingItems(updatedItems);
    
    // Recalculate totals from items
    if (extractedData) {
      const calculatedSubtotal = updatedItems.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
      const calculatedTax = calculatedSubtotal * 0; // 0% VAT
      const calculatedTotal = calculatedSubtotal + calculatedTax;
      
      setExtractedData({
        ...extractedData,
        subtotal: Number(calculatedSubtotal.toFixed(2)),
        tax: Number(calculatedTax.toFixed(2)),
        total: Number(calculatedTotal.toFixed(2)),
      });
    }
  };

  const handleConfirmInvoice = async () => {
    if (!extractedData || !selectedSupplier) return;

    // Calculate totals from items to ensure consistency
    const calculatedSubtotal = editingItems.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
    const calculatedTax = calculatedSubtotal * 0; // 0% VAT
    const calculatedTotal = calculatedSubtotal + calculatedTax;

    // Prepare invoice data
    const invoiceData = {
      supplierId: selectedSupplier,
      invoiceNumber: extractedData.invoiceNumber,
      invoiceDate: new Date(extractedData.invoiceDate).toISOString(),
      dueDate: extractedData.dueDate ? new Date(extractedData.dueDate).toISOString() : null,
      subtotal: calculatedSubtotal.toFixed(2),
      tax: calculatedTax.toFixed(2),
      total: calculatedTotal.toFixed(2),
      status: 'pending',
      type: type,
      invoiceImageUrl: invoiceImageUrl, // Include the scanned image URL
      extractedText: JSON.stringify(extractedData),
      processedAt: new Date().toISOString(),
    };

    // Prepare invoice items and stock adjustments
    const items = [];
    const stockAdjustments = [];

    for (let i = 0; i < editingItems.length; i++) {
      const item = editingItems[i];
      const match = productMatches[i];
      
      let productId = match?.matchedProduct?.id;
      
      // Create new product if needed
      if (match?.action === 'create_new' && !productId) {
        try {
          const response = await apiRequest("POST", '/api/products', {
            name: match.suggestedProduct.name,
            description: match.suggestedProduct.description,
            sku: match.suggestedProduct.sku,
            barcode: match.suggestedProduct.barcode,
            price: item.unitPrice.toString(),
            cost: item.unitPrice.toString(),
            category: match.suggestedProduct.category,
            supplierId: selectedSupplier,
            stock: 0,
            quantity: 0,
            isActive: true,
          });
          const newProduct = await response.json();
          productId = newProduct.id;
        } catch (error) {
          console.error('Failed to create product:', error);
        }
      }

      // Add invoice item
      items.push({
        productId,
        productName: item.productName,
        quantity: item.quantity,
        unitCost: item.unitPrice.toString(),
        totalCost: item.totalPrice.toString(),
        sku: item.sku,
        barcode: item.barcode,
        isNewProduct: match?.action === 'create_new',
      });

      // Add stock adjustment if it's a receipt (positive) or return (negative)
      if (productId) {
        const product = products.find((p: Product) => p.id === productId);
        const currentStock = product?.stock || 0;
        const quantityChange = type === 'receipt' ? item.quantity : -item.quantity;
        
        stockAdjustments.push({
          productId,
          adjustmentType: type,
          quantityChange,
          previousStock: currentStock,
          newStock: currentStock + quantityChange,
          reason: `${type === 'receipt' ? 'Receipt' : 'Return'} from ${extractedData.supplierName}`,
        });
      }
    }

    createInvoiceMutation.mutate({
      invoiceData,
      items,
      stockAdjustments,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="invoice-scan-description">
        <DialogHeader>
          <DialogTitle>
            {type === 'receipt' ? 'Scan Receipt' : 'Scan Return Invoice'}
          </DialogTitle>
          <div id="invoice-scan-description" className="sr-only">
            Upload and process {type === 'receipt' ? 'receipt' : 'return invoice'} images using AI to extract invoice data automatically
          </div>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center">
              {imagePreview ? (
                <div className="space-y-4">
                  <img 
                    src={imagePreview} 
                    alt="Invoice preview" 
                    className="max-h-64 mx-auto rounded-lg border"
                  />
                  <div className="flex gap-2 justify-center">
                    <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                      <Upload className="w-4 h-4 mr-2" />
                      Choose Different Image
                    </Button>
                    <Button 
                      onClick={handleScanInvoice} 
                      disabled={isProcessing}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Camera className="w-4 h-4 mr-2" />
                      )}
                      {isProcessing ? 'Processing...' : 'Process Invoice'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Camera className="w-12 h-12 text-slate-400 mx-auto" />
                  <div>
                    <h3 className="text-lg font-medium">Upload Invoice Image</h3>
                    <p className="text-slate-500">
                      Take a photo or upload an image of your {type === 'receipt' ? 'receipt' : 'return invoice'}
                    </p>
                  </div>
                  <Button onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" />
                    Choose Image
                  </Button>
                </div>
              )}
            </div>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              className="hidden"
            />
          </div>
        )}

        {step === 'review' && extractedData && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-green-500" />
              <span className="font-medium">Invoice processed successfully!</span>
              <Badge variant="outline">
                {Math.round(extractedData.confidence * 100)}% confidence
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Invoice Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Invoice Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Invoice Number</Label>
                    <Input 
                      value={extractedData.invoiceNumber} 
                      onChange={(e) => setExtractedData({
                        ...extractedData,
                        invoiceNumber: e.target.value
                      })}
                    />
                  </div>
                  
                  <div>
                    <Label>Supplier</Label>
                    <div className="flex gap-2">
                      <Select 
                        value={selectedSupplier?.toString()} 
                        onValueChange={(value) => setSelectedSupplier(parseInt(value))}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((supplier: Supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id.toString()}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="outline" 
                        onClick={handleCreateSupplier}
                        disabled={createSupplierMutation.isPending}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    {!selectedSupplier && (
                      <p className="text-sm text-slate-500 mt-1">
                        Detected: {extractedData.supplierName}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Invoice Date</Label>
                      <Input 
                        type="date"
                        value={extractedData.invoiceDate} 
                        onChange={(e) => setExtractedData({
                          ...extractedData,
                          invoiceDate: e.target.value
                        })}
                      />
                    </div>
                    <div>
                      <Label>Due Date</Label>
                      <Input 
                        type="date"
                        value={extractedData.dueDate || ''} 
                        onChange={(e) => setExtractedData({
                          ...extractedData,
                          dueDate: e.target.value
                        })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Subtotal</Label>
                      <Input 
                        type="number"
                        step="0.01"
                        value={extractedData.subtotal} 
                        onChange={(e) => setExtractedData({
                          ...extractedData,
                          subtotal: parseFloat(e.target.value) || 0
                        })}
                      />
                    </div>
                    <div>
                      <Label>Tax</Label>
                      <Input 
                        type="number"
                        step="0.01"
                        value={extractedData.tax} 
                        onChange={(e) => setExtractedData({
                          ...extractedData,
                          tax: parseFloat(e.target.value) || 0
                        })}
                      />
                    </div>
                    <div>
                      <Label>Total</Label>
                      <Input 
                        type="number"
                        step="0.01"
                        value={extractedData.total} 
                        onChange={(e) => setExtractedData({
                          ...extractedData,
                          total: parseFloat(e.target.value) || 0
                        })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Image Preview */}
              <Card>
                <CardHeader>
                  <CardTitle>Scanned Image</CardTitle>
                </CardHeader>
                <CardContent>
                  {imagePreview && (
                    <img 
                      src={imagePreview} 
                      alt="Invoice" 
                      className="w-full rounded-lg border"
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Invoice Items */}
            <Card>
              <CardHeader>
                <CardTitle>Invoice Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {editingItems.map((item, index) => {
                    const match = productMatches[index];
                    return (
                      <div key={index} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          {match?.action === 'match' ? (
                            <Badge variant="outline" className="text-green-600">
                              <Check className="w-3 h-3 mr-1" />
                              Matched ({Math.round(match.matchConfidence * 100)}%)
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-blue-600">
                              <Scan className="w-3 h-3 mr-1" />
                              Scanned Item
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <Label className="text-xs">Product Name</Label>
                            <Input 
                              value={item.productName}
                              onChange={(e) => updateItemValue(index, 'productName', e.target.value)}
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Quantity</Label>
                            <Input 
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItemValue(index, 'quantity', parseInt(e.target.value) || 0)}
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Unit Price</Label>
                            <Input 
                              type="number"
                              step="0.01"
                              value={Number(item.unitPrice).toFixed(2)}
                              onBlur={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                updateItemValue(index, 'unitPrice', value);
                              }}
                              onChange={(e) => updateItemValue(index, 'unitPrice', e.target.value)}
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Total</Label>
                            <Input 
                              type="number"
                              step="0.01"
                              value={item.totalPrice}
                              onChange={(e) => updateItemValue(index, 'totalPrice', parseFloat(e.target.value) || 0)}
                              className="text-sm"
                            />
                          </div>
                        </div>
                        
                        {match?.matchedProduct && (
                          <div className="text-sm text-slate-600 bg-slate-50 p-2 rounded">
                            Matched to: <strong>{match.matchedProduct.name}</strong> (SKU: {match.matchedProduct.sku})
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button 
                onClick={handleConfirmInvoice}
                disabled={!selectedSupplier || createInvoiceMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {createInvoiceMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Invoice
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}