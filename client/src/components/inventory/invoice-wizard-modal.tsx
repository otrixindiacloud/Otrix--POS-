import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Upload, Check, Plus, ArrowLeft, ArrowRight, Receipt, RotateCcw, FileText, X, ShoppingCart, Coins, AlertCircle, CreditCard } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';


interface InvoiceWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ExtractedData {
  invoiceNumber: string;
  supplierName: string;
  invoiceDate: string;
  dueDate?: string;
  subtotal: number;
  tax: number;
  total: number;
  items: any[];
  confidence: number;
}

interface ProductMatch {
  matchedProduct?: any;
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

type InvoiceType = 'receipt' | 'return';
type PaymentStatus = 'paid' | 'not_paid' | 'credit' | 'paid_by_card';

interface InvoiceWizardStep {
  number: number;
  title: string;
  completed: boolean;
}

export default function InvoiceWizardModal({ isOpen, onClose }: InvoiceWizardModalProps) {
  // Wizard steps
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  
  // Step 1: Type Selection
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('receipt');
  
  // Step 2: Scan/Upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [productMatches, setProductMatches] = useState<ProductMatch[]>([]);
  const [invoiceImageUrl, setInvoiceImageUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Step 3: Header Details
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
  const [headerDetails, setHeaderDetails] = useState({
    invoiceNumber: '',
    invoiceDate: '',
    dueDate: '',
    subtotal: 0,
    tax: 0,
    total: 0,
  });
  
  // Step 4: Items
  const [editingItems, setEditingItems] = useState<any[]>([]);
  
  // Step 5: Payment Status
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('not_paid');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
  });

  const wizardSteps: InvoiceWizardStep[] = [
    { number: 1, title: 'Select Type', completed: completedSteps.includes(1) },
    { number: 2, title: 'Scan/Upload', completed: completedSteps.includes(2) },
    { number: 3, title: 'Header Details', completed: completedSteps.includes(3) },
    { number: 4, title: 'Items', completed: completedSteps.includes(4) },
    { number: 5, title: 'Payment Status', completed: completedSteps.includes(5) },
    { number: 6, title: 'Review & Submit', completed: completedSteps.includes(6) },
  ];

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
      setInvoiceImageUrl(data.imageUrl);
      
      // Auto-populate header details from extracted data
      setHeaderDetails({
        invoiceNumber: data.extractedData.invoiceNumber,
        invoiceDate: data.extractedData.invoiceDate,
        dueDate: data.extractedData.dueDate || '',
        subtotal: data.extractedData.subtotal,
        tax: data.extractedData.tax,
        total: data.extractedData.total,
      });
      
      // Try to match supplier
      const matchedSupplier = suppliers.find((s: any) => 
        s.name.toLowerCase().includes(data.extractedData.supplierName.toLowerCase())
      );
      if (matchedSupplier) {
        setSelectedSupplier(matchedSupplier.id);
      }
      
      markStepCompleted(2);
      setCurrentStep(3);
      setIsProcessing(false);
    },
    onError: (error: any) => {
      console.error('Scan error:', error);
      toast({
        title: "Processing Failed", 
        description: error?.message || "Failed to process the invoice. Please try again.",
        variant: "destructive",
      });
      setIsProcessing(false);
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (invoiceData: any) => {
      return apiRequest({
        url: '/api/supplier-invoices',
        method: 'POST',
        body: invoiceData,
      });
    },
    onSuccess: () => {
      toast({
        title: "Invoice Created Successfully",
        description: `${invoiceType === 'receipt' ? 'Receipt' : 'Return'} has been successfully processed and saved.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: "Failed to save the invoice. Please try again.",
        variant: "destructive",
      });
    },
  });

  const markStepCompleted = (stepNumber: number) => {
    if (!completedSteps.includes(stepNumber)) {
      setCompletedSteps([...completedSteps, stepNumber]);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    setCompletedSteps([]);
    setInvoiceType('receipt');
    setSelectedFile(null);
    setImagePreview(null);
    setExtractedData(null);
    setProductMatches([]);
    setInvoiceImageUrl(null);
    setSelectedSupplier(null);
    setHeaderDetails({
      invoiceNumber: '',
      invoiceDate: '',
      dueDate: '',
      subtotal: 0,
      tax: 0,
      total: 0,
    });
    setEditingItems([]);
    setPaymentStatus('not_paid');
    setIsProcessing(false);
    onClose();
  };

  const handleNext = () => {
    // Validate current step before proceeding
    if (currentStep === 1) {
      markStepCompleted(1);
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!extractedData) {
        toast({
          title: "Invoice Scan Required",
          description: "Please upload and process an invoice image before proceeding.",
          variant: "destructive",
        });
        return;
      }
      markStepCompleted(2);
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!selectedSupplier || !headerDetails.invoiceNumber) {
        toast({
          title: "Required Fields Missing",
          description: "Please select a supplier and enter invoice number.",
          variant: "destructive",
        });
        return;
      }
      markStepCompleted(3);
      setCurrentStep(4);
    } else if (currentStep === 4) {
      if (editingItems.length === 0) {
        toast({
          title: "Items Required",
          description: "Please add at least one item to the invoice.",
          variant: "destructive",
        });
        return;
      }
      
      // Validate that each item has required fields
      const invalidItems = editingItems.filter(item => 
        !item.productName?.trim() || 
        !item.quantity || 
        item.quantity <= 0 || 
        !item.unitPrice || 
        item.unitPrice <= 0
      );
      
      if (invalidItems.length > 0) {
        toast({
          title: "Invalid Items",
          description: "Please ensure all items have a product name, quantity > 0, and unit price > 0.",
          variant: "destructive",
        });
        return;
      }
      
      markStepCompleted(4);
      setCurrentStep(5);
    } else if (currentStep === 5) {
      markStepCompleted(5);
      setCurrentStep(6);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
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
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select an invoice image first.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    const formData = new FormData();
    formData.append('invoice', selectedFile);
    formData.append('isReturn', invoiceType === 'return' ? 'true' : 'false');
    
    scanMutation.mutate(formData);
  };

  const updateItemValue = (index: number, field: string, value: any) => {
    const updatedItems = [...editingItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setEditingItems(updatedItems);
  };

  const addNewItem = () => {
    setEditingItems([...editingItems, {
      productName: '',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      sku: '',
      barcode: '',
    }]);
  };

  const removeItem = (index: number) => {
    setEditingItems(editingItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const invoiceData = {
      supplierId: selectedSupplier,
      invoiceNumber: headerDetails.invoiceNumber,
      invoiceDate: new Date(headerDetails.invoiceDate).toISOString(),
      dueDate: headerDetails.dueDate ? new Date(headerDetails.dueDate).toISOString() : null,
      subtotal: headerDetails.subtotal.toString(),
      tax: headerDetails.tax.toString(),
      total: headerDetails.total.toString(),
      status: paymentStatus === 'paid' || paymentStatus === 'paid_by_card' ? 'paid' : 'pending',
      type: invoiceType,
      invoiceImageUrl: invoiceImageUrl,
      extractedText: extractedData ? JSON.stringify(extractedData) : null,
      processedAt: new Date().toISOString(),
    };

    const stockAdjustments = editingItems.map(item => ({
      productId: item.productId || null,
      productName: item.productName,
      quantityChange: invoiceType === 'receipt' ? item.quantity : -item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      sku: item.sku,
      barcode: item.barcode,
    }));

    createInvoiceMutation.mutate({
      invoiceData,
      items: editingItems,
      stockAdjustments,
    });
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-8 max-w-3xl mx-auto">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Select Invoice Type</h3>
              <p className="text-sm text-slate-600">Choose the type of invoice you want to create</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card 
                className={`cursor-pointer transition-all border-2 ${
                  invoiceType === 'receipt' 
                    ? 'border-blue-500 bg-blue-50 shadow-lg' 
                    : 'border-slate-200 hover:border-blue-300 hover:shadow-md bg-white'
                }`}
                onClick={() => setInvoiceType('receipt')}
              >
                <CardContent className="flex flex-col items-center p-8">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <Receipt className="w-8 h-8 text-blue-600" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 mb-2">Receipt</h4>
                  <p className="text-sm text-slate-600 text-center">
                    Incoming goods from supplier
                  </p>
                  {invoiceType === 'receipt' && (
                    <div className="mt-4">
                      <Badge className="bg-blue-600">Selected</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card 
                className={`cursor-pointer transition-all border-2 ${
                  invoiceType === 'return' 
                    ? 'border-orange-500 bg-orange-50 shadow-lg' 
                    : 'border-slate-200 hover:border-orange-300 hover:shadow-md bg-white'
                }`}
                onClick={() => setInvoiceType('return')}
              >
                <CardContent className="flex flex-col items-center p-8">
                  <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                    <RotateCcw className="w-8 h-8 text-orange-600" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 mb-2">Return</h4>
                  <p className="text-sm text-slate-600 text-center">
                    Returning goods to supplier
                  </p>
                  {invoiceType === 'return' && (
                    <div className="mt-4">
                      <Badge className="bg-orange-600">Selected</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6 max-w-3xl mx-auto">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Scan or Upload Invoice</h3>
              <p className="text-sm text-slate-600">Upload an image of your {invoiceType} for automatic data extraction</p>
            </div>

            <Card className="border-2 border-dashed border-slate-300 bg-slate-50 shadow-sm">
              <CardContent className="p-8">
                {imagePreview ? (
                  <div className="space-y-4">
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                      <img 
                        src={imagePreview} 
                        alt="Invoice preview" 
                        className="max-w-full h-64 object-contain mx-auto rounded" 
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button 
                        variant="outline" 
                        onClick={() => setImagePreview(null)}
                        className="border-slate-300"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Choose Different File
                      </Button>
                      <Button 
                        onClick={handleScanInvoice} 
                        disabled={isProcessing}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isProcessing ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Processing...
                          </>
                        ) : (
                          <>
                            <Camera className="w-4 h-4 mr-2" />
                            Process Invoice
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 text-center">
                    <div className="flex justify-center">
                      <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                        <Upload className="w-10 h-10 text-blue-600" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 mb-2">Upload Invoice Image</h4>
                      <p className="text-sm text-slate-600 mb-6">
                        Drag and drop or click to browse your files
                      </p>
                      <Button 
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Choose File
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      Supports JPG, PNG, and other image formats
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Processing Result */}
            {extractedData && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm sm:text-base text-green-600">✓ Invoice Processed Successfully</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
                    <div><strong>Invoice #:</strong> {extractedData.invoiceNumber}</div>
                    <div><strong>Supplier:</strong> {extractedData.supplierName}</div>
                    <div><strong>Date:</strong> {extractedData.invoiceDate}</div>
                    <div><strong>Total:</strong> QR {extractedData.total}</div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 3:
        return (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 mb-4">
                <FileText className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Header Details</h3>
              <p className="text-sm text-slate-600">Review and edit the invoice header information</p>
            </div>

            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-6 space-y-6">
                {/* Supplier Selection */}
                <div>
                  <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Supplier *
                  </Label>
                  <Select value={selectedSupplier?.toString()} onValueChange={(value) => setSelectedSupplier(parseInt(value))}>
                    <SelectTrigger className="border-slate-300 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select a supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier: any) => (
                        <SelectItem key={supplier.id} value={supplier.id.toString()}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Invoice Number & Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                      Invoice Number *
                    </Label>
                    <Input 
                      value={headerDetails.invoiceNumber}
                      onChange={(e) => setHeaderDetails({...headerDetails, invoiceNumber: e.target.value})}
                      placeholder="Enter invoice number"
                      className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                      Invoice Date *
                    </Label>
                    <Input 
                      type="date"
                      value={headerDetails.invoiceDate}
                      onChange={(e) => setHeaderDetails({...headerDetails, invoiceDate: e.target.value})}
                      className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Due Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                      Due Date
                    </Label>
                    <Input 
                      type="date"
                      value={headerDetails.dueDate}
                      onChange={(e) => setHeaderDetails({...headerDetails, dueDate: e.target.value})}
                      className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div></div>
                </div>

                {/* Financial Totals */}
                <div className="pt-4 border-t border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-900 mb-4">Financial Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                        Subtotal (QR)
                      </Label>
                      <Input 
                        type="number"
                        step="0.01"
                        value={headerDetails.subtotal}
                        onChange={(e) => setHeaderDetails({...headerDetails, subtotal: parseFloat(e.target.value) || 0})}
                        className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                        Tax (QR)
                      </Label>
                      <Input 
                        type="number"
                        step="0.01"
                        value={headerDetails.tax}
                        onChange={(e) => setHeaderDetails({...headerDetails, tax: parseFloat(e.target.value) || 0})}
                        className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                        Total (QR)
                      </Label>
                      <Input 
                        type="number"
                        step="0.01"
                        value={headerDetails.total}
                        onChange={(e) => setHeaderDetails({...headerDetails, total: parseFloat(e.target.value) || 0})}
                        className="border-slate-300 focus:border-blue-500 focus:ring-blue-500 font-semibold"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 4:
        return (
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-4">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Invoice Items</h3>
              <p className="text-sm text-slate-600">Add and edit the items on this {invoiceType}</p>
            </div>

            <div className="space-y-4">
              {editingItems.map((item, index) => {
                const match = productMatches[index];
                return (
                  <Card key={index} className="border-slate-200 shadow-sm">
                    <CardContent className="p-6">
                      {/* Item Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100">
                            <span className="text-sm font-semibold text-slate-700">{index + 1}</span>
                          </div>
                          {match?.action === 'match' && (
                            <Badge className="bg-green-50 text-green-700 border-green-200">
                              <Check className="w-3 h-3 mr-1" />
                              Matched ({Math.round(match.matchConfidence * 100)}%)
                            </Badge>
                          )}
                          {match?.action !== 'match' && (
                            <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                              <Plus className="w-3 h-3 mr-1" />
                              New Product
                            </Badge>
                          )}
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => removeItem(index)}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          Remove
                        </Button>
                      </div>
                      
                      {/* Product Name */}
                      <div className="mb-4">
                        <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                          Product Name *
                        </Label>
                        <Input 
                          value={item.productName}
                          onChange={(e) => updateItemValue(index, 'productName', e.target.value)}
                          placeholder="Enter product name"
                          className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>

                      {/* SKU and Barcode */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                            SKU
                          </Label>
                          <Input 
                            value={item.sku || ''}
                            onChange={(e) => updateItemValue(index, 'sku', e.target.value)}
                            placeholder="Enter SKU"
                            className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                            Barcode
                          </Label>
                          <Input 
                            value={item.barcode || ''}
                            onChange={(e) => updateItemValue(index, 'barcode', e.target.value)}
                            placeholder="Enter barcode"
                            className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {/* Quantity, Unit Price, Total Price */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                            Quantity *
                          </Label>
                          <Input 
                            type="number"
                            value={item.quantity}
                            onChange={(e) => {
                              const qty = parseInt(e.target.value) || 0;
                              updateItemValue(index, 'quantity', qty);
                              if (item.unitPrice > 0) {
                                updateItemValue(index, 'totalPrice', qty * item.unitPrice);
                              }
                            }}
                            placeholder="0"
                            min="1"
                            className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                            Unit Price (QR) *
                          </Label>
                          <Input 
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => {
                              const price = parseFloat(e.target.value) || 0;
                              updateItemValue(index, 'unitPrice', price);
                              updateItemValue(index, 'totalPrice', item.quantity * price);
                            }}
                            placeholder="0.00"
                            min="0"
                            className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                            Total Price (QR)
                          </Label>
                          <Input 
                            type="number"
                            step="0.01"
                            value={item.totalPrice}
                            onChange={(e) => updateItemValue(index, 'totalPrice', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            readOnly
                            className="bg-slate-50 border-slate-300 font-semibold"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              
              <Button 
                variant="outline" 
                onClick={addNewItem} 
                className="w-full border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 text-slate-700 hover:text-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Item
              </Button>
              
              {/* Items Summary */}
              {editingItems.length > 0 && (
                <Card className="bg-gradient-to-br from-blue-50 to-slate-50 border-blue-200 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-slate-700">Items Total:</span>
                      <span className="text-2xl font-bold text-blue-600">
                        QR {editingItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600">
                      {editingItems.length} item{editingItems.length !== 1 ? 's' : ''} • 
                      Total quantity: {editingItems.reduce((sum, item) => sum + (item.quantity || 0), 0)}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
                <Coins className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Payment Status</h3>
              <p className="text-sm text-slate-600">Select the payment status for this {invoiceType}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { 
                  value: 'paid', 
                  label: 'Paid', 
                  description: 'Invoice has been fully paid', 
                  icon: Check,
                  color: 'green',
                  bgColor: 'bg-green-50',
                  borderColor: 'border-green-500',
                  textColor: 'text-green-700',
                  hoverBg: 'hover:bg-green-50'
                },
                { 
                  value: 'not_paid', 
                  label: 'Not Paid', 
                  description: 'Invoice payment is pending', 
                  icon: AlertCircle,
                  color: 'red',
                  bgColor: 'bg-red-50',
                  borderColor: 'border-red-500',
                  textColor: 'text-red-700',
                  hoverBg: 'hover:bg-red-50'
                },
                { 
                  value: 'credit', 
                  label: 'Credit', 
                  description: 'Invoice on credit terms', 
                  icon: Coins,
                  color: 'blue',
                  bgColor: 'bg-blue-50',
                  borderColor: 'border-blue-500',
                  textColor: 'text-blue-700',
                  hoverBg: 'hover:bg-blue-50'
                },
                { 
                  value: 'paid_by_card', 
                  label: 'Paid by Card', 
                  description: 'Invoice paid using card', 
                  icon: CreditCard,
                  color: 'purple',
                  bgColor: 'bg-purple-50',
                  borderColor: 'border-purple-500',
                  textColor: 'text-purple-700',
                  hoverBg: 'hover:bg-purple-50'
                },
              ].map((status) => {
                const Icon = status.icon;
                const isSelected = paymentStatus === status.value;
                return (
                  <Card 
                    key={status.value}
                    className={`cursor-pointer transition-all border-2 ${
                      isSelected 
                        ? `${status.borderColor} ${status.bgColor} shadow-md` 
                        : `border-slate-200 ${status.hoverBg} hover:shadow-sm`
                    }`}
                    onClick={() => setPaymentStatus(status.value as PaymentStatus)}
                  >
                    <CardContent className="p-6 text-center">
                      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${status.bgColor} mb-3`}>
                        <Icon className={`w-6 h-6 ${status.textColor}`} />
                      </div>
                      <h4 className="text-base font-bold text-slate-900 mb-1">{status.label}</h4>
                      <p className="text-sm text-slate-600">{status.description}</p>
                      {isSelected && (
                        <Badge className={`mt-3 ${status.bgColor} ${status.textColor} border-${status.color}-200`}>
                          <Check className="w-3 h-3 mr-1" />
                          Selected
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );

      case 6:
        const itemsTotal = editingItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
        return (
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-teal-100 mb-4">
                <Check className="w-6 h-6 text-teal-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Review & Submit</h3>
              <p className="text-sm text-slate-600">Please review all information before submitting</p>
            </div>

            {/* Header Summary */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="bg-slate-50 border-b border-slate-200">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-slate-600" />
                  Invoice Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</span>
                    <p className="text-sm font-medium text-slate-900 mt-1">
                      {invoiceType === 'receipt' ? 'Receipt' : 'Return'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Invoice #</span>
                    <p className="text-sm font-medium text-slate-900 mt-1">{headerDetails.invoiceNumber}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Supplier</span>
                    <p className="text-sm font-medium text-slate-900 mt-1">
                      {suppliers.find((s: any) => s.id === selectedSupplier)?.name}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</span>
                    <p className="text-sm font-medium text-slate-900 mt-1">{headerDetails.invoiceDate}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Payment Status</span>
                    <p className="text-sm font-medium text-slate-900 mt-1">
                      {paymentStatus.replace('_', ' ').toUpperCase()}
                    </p>
                  </div>
                </div>
                
                {/* Financial Summary */}
                <div className="border-t border-slate-200 pt-4">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3">Financial Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-50 p-4 rounded-lg">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Subtotal</span>
                      <p className="text-lg font-bold text-slate-900 mt-1">QR {headerDetails.subtotal.toFixed(2)}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tax</span>
                      <p className="text-lg font-bold text-slate-900 mt-1">QR {headerDetails.tax.toFixed(2)}</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                      <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Total</span>
                      <p className="text-lg font-bold text-blue-600 mt-1">QR {headerDetails.total.toFixed(2)}</p>
                    </div>
                  </div>
                  {Math.abs(itemsTotal - headerDetails.total) > 0.01 && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-amber-800">
                        <strong>Note:</strong> Items total (QR {itemsTotal.toFixed(2)}) differs from header total (QR {headerDetails.total.toFixed(2)})
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Items Summary */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="bg-slate-50 border-b border-slate-200">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-slate-600" />
                  Items ({editingItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {editingItems.map((item, index) => (
                    <div key={index} className="flex justify-between items-start p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                            {index + 1}
                          </span>
                          <span className="font-semibold text-slate-900">{item.productName}</span>
                        </div>
                        {(item.sku || item.barcode) && (
                          <div className="text-xs text-slate-600 ml-8">
                            {item.sku && `SKU: ${item.sku}`}
                            {item.sku && item.barcode && ' • '}
                            {item.barcode && `Barcode: ${item.barcode}`}
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-sm text-slate-600">{item.quantity} × QR {item.unitPrice.toFixed(2)}</div>
                        <div className="text-base font-bold text-slate-900">QR {item.totalPrice.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-200 mt-4 pt-4 flex justify-between items-center">
                  <span className="text-base font-bold text-slate-900">Items Total:</span>
                  <span className="text-xl font-bold text-blue-600">QR {itemsTotal.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Image Preview (if scanned) */}
            {imagePreview && (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50 border-b border-slate-200">
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Camera className="w-5 h-5 text-slate-600" />
                    Scanned Invoice
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <img 
                    src={imagePreview} 
                    alt="Scanned invoice" 
                    className="w-full max-h-64 object-contain rounded-lg border-2 border-slate-200"
                  />
                </CardContent>
              </Card>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-4xl h-[95vh] max-h-[95vh] overflow-y-auto p-0">
        <DialogHeader className="pb-0 border-b bg-white px-4 sm:px-6 pt-4 pb-4 sticky top-0 z-10">
          {/* Header with Back Button and Steps */}
          <div className="flex items-center justify-between gap-4 mb-3">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={currentStep === 1 ? handleClose : handleBack}
              className="flex items-center text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {currentStep === 1 ? 'Back to Invoices' : 'Back'}
            </Button>
            
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium text-slate-600">
                Step {currentStep} of {wizardSteps.length}
              </div>
            </div>
          </div>
          
          <div>
            <DialogTitle className="text-xl sm:text-2xl font-bold text-slate-900">
              {wizardSteps[currentStep - 1]?.title}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600 mt-1">
              {currentStep === 1 && "Select the type of invoice you want to create"}
              {currentStep === 2 && "Scan or upload your invoice for automatic data extraction"}
              {currentStep === 3 && "Review and edit the invoice header information"}
              {currentStep === 4 && "Review and confirm invoice line items"}
              {currentStep === 5 && "Set the payment status for this invoice"}
              {currentStep === 6 && "Review all details before creating the invoice"}
            </DialogDescription>
          </div>

          {/* Progress Steps - Desktop */}
          <div className="hidden sm:flex items-center justify-between mt-4 pt-4 border-t">
            {wizardSteps.map((step, index) => (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex items-center">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                    currentStep === step.number 
                      ? 'bg-blue-600 text-white' 
                      : step.completed 
                        ? 'bg-green-600 text-white' 
                        : 'bg-gray-200 text-gray-600'
                  }`}>
                    {step.completed ? <Check className="w-4 h-4" /> : step.number}
                  </div>
                  <span className={`ml-2 text-xs font-medium whitespace-nowrap ${
                    currentStep === step.number ? 'text-blue-600' : step.completed ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {step.title}
                  </span>
                </div>
                {index < wizardSteps.length - 1 && (
                  <div className={`flex-1 h-px mx-3 ${step.completed ? 'bg-green-600' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </DialogHeader>

        {/* Step Content */}
        <div className="min-h-[300px] sm:min-h-[400px] flex-1 overflow-y-auto px-4 sm:px-6 py-6 bg-slate-50">
          {renderStepContent()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-t bg-white sticky bottom-0 shadow-lg">
          <Button 
            variant="outline" 
            onClick={handleBack} 
            disabled={currentStep === 1}
            className="flex items-center border-slate-300"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span>Back</span>
          </Button>
          
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={handleClose}
              className="border-slate-300"
            >
              Cancel
            </Button>
            {currentStep === 6 ? (
              <Button 
                onClick={handleSubmit} 
                disabled={createInvoiceMutation.isPending}
                className="min-w-[120px] bg-green-600 hover:bg-green-700"
              >
                {createInvoiceMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Submit Invoice
                  </>
                )}
              </Button>
            ) : (
              <Button 
                onClick={handleNext} 
                className="flex items-center bg-blue-600 hover:bg-blue-700"
              >
                <span>Next</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}