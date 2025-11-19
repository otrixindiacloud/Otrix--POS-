import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import MainLayout from '@/components/layout/main-layout';
import type { Supplier } from '@shared/schema';
import { 
  Upload, 
  FileImage, 
  Loader2, 
  Check, 
  Plus, 
  ArrowLeft, 
  ArrowRight, 
  AlertCircle,
  FileText,
  Receipt,
  RotateCcw,
  Calculator,
  CreditCard,
  Coins,
  Trash2,
  Edit3,
  Eye,
  Camera,
  Sparkles,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Scan,
  RefreshCw,
  Building2,
  Calendar
} from 'lucide-react';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';

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
    uom?: string;
    crtQty?: number;
    pcsQty?: number;
    unitPrice: number;
    totalPrice: number;
    sku?: string;
    barcode?: string;
  }[];
  confidence: number;
}

interface ProductMatch {
  originalItem: any;
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

export default function InvoiceWizardPage() {
  const [, setLocation] = useLocation();
  
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
  
  // Additional form validation and error states
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: products = [] } = useQuery({
    queryKey: ["/api/products"],
  });

  const wizardSteps: InvoiceWizardStep[] = [
    { number: 1, title: 'Select Type', completed: completedSteps.includes(1) },
    { number: 2, title: 'Scan/Upload', completed: completedSteps.includes(2) },
    { number: 3, title: 'Header Details', completed: completedSteps.includes(3) },
    { number: 4, title: 'Review Items', completed: completedSteps.includes(4) },
    { number: 5, title: 'Payment Status', completed: completedSteps.includes(5) },
    { number: 6, title: 'Review & Submit', completed: completedSteps.includes(6) },
  ];

  // Enhanced mutation with better error handling
  const scanMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/supplier-invoices/scan', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to scan invoice');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setExtractedData(data.extractedData);
      setProductMatches(data.productMatches || []);
      setInvoiceImageUrl(data.imagePath);
      setIsProcessing(false);
      setErrors({}); // Clear any previous errors
      
      // Auto-populate header details from extracted data
      if (data.extractedData) {
        // Auto-populate items with better validation
        const items = data.extractedData.items?.map((item: any, index: number) => ({
          ...item,
          srNo: index + 1,
          productName: item.productName || '',
          quantity: Math.max(1, item.quantity || 1),
          uom: item.uom || null,
          crtQty: item.crtQty || null,
          pcsQty: item.pcsQty || null,
          unitPrice: Math.max(0, item.unitPrice || 0),
          totalPrice: Math.max(0, item.totalPrice || item.quantity * item.unitPrice || 0),
          sku: item.sku || '',
          barcode: item.barcode || '',
        })) || [];
        
        setEditingItems(items);
        
        // Calculate totals from items to ensure consistency
        const calculatedSubtotal = items.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
        const calculatedTax = calculatedSubtotal * 0; // 0% VAT
        const calculatedTotal = calculatedSubtotal + calculatedTax;
        
        setHeaderDetails({
          invoiceNumber: data.extractedData.invoiceNumber || `${invoiceType.toUpperCase()}-${Date.now()}`,
          invoiceDate: data.extractedData.invoiceDate || new Date().toISOString().split('T')[0],
          dueDate: data.extractedData.dueDate || '',
          subtotal: Number(calculatedSubtotal.toFixed(2)),
          tax: Number(calculatedTax.toFixed(2)),
          total: Number(calculatedTotal.toFixed(2)),
        });
        
        // Try to find supplier match with better fuzzy matching
        const extractedSupplierName = data.extractedData.supplierName?.toLowerCase();
        if (extractedSupplierName) {
          const matchedSupplier = suppliers.find((supplier) => {
            const supplierName = supplier.name.toLowerCase();
            return supplierName.includes(extractedSupplierName) || 
                   extractedSupplierName.includes(supplierName) ||
                   supplierName.split(' ').some(word => extractedSupplierName.includes(word));
          });
          if (matchedSupplier) {
            setSelectedSupplier(matchedSupplier.id);
          }
        }
      }
      
      markStepCompleted(2);
      setCurrentStep(3);
      
      const confidence = data.extractedData?.confidence || 0;
      const confidencePercent = Math.round(confidence * 100);
      
      toast({
        title: "🎉 Invoice Scanned Successfully",
        description: `Extracted ${data.extractedData?.items?.length || 0} items with ${confidencePercent}% confidence`,
        duration: 5000,
      });
    },
    onError: (error: any) => {
      setIsProcessing(false);
      console.error("Scan error:", error);
      
      // More detailed error message
      let errorMessage = error.message || "Failed to scan invoice. Please try again.";
      
      // Check for specific error types
      if (error.message?.includes("OpenAI") || error.message?.includes("API")) {
        errorMessage = "AI service is temporarily unavailable. Please try again in a moment.";
      } else if (error.message?.includes("network") || error.message?.includes("fetch")) {
        errorMessage = "Network error. Please check your connection and try again.";
      } else if (error.message?.includes("timeout")) {
        errorMessage = "Request timed out. The image might be too large or complex.";
      }
      
      toast({
        title: "Scan Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 6000,
      });
      
      setErrors({ extraction: errorMessage });
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (payload: any) => {
      console.log("📤 Sending to backend:", JSON.stringify(payload, null, 2));
      
      const response = await fetch('/api/supplier-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("❌ Backend error:", errorData);
        throw new Error(errorData.message || 'Failed to create invoice');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-invoices"] });
      setIsSubmitting(false);
      toast({
        title: "✅ Invoice Created Successfully",
        description: `Invoice #${data.invoice?.invoiceNumber || 'N/A'} has been created`,
        duration: 5000,
      });
      setTimeout(() => setLocation('/invoices'), 1000);
    },
    onError: (error: any) => {
      setIsSubmitting(false);
      console.error('Invoice creation error:', error);
      
      let errorMessage = "Failed to create invoice";
      if (error.message?.includes("Invoice number already exists") || error.message?.includes("already exists")) {
        errorMessage = "Invoice already added. This invoice number already exists in the system.";
      } else if (error.message?.includes("supplier")) {
        errorMessage = "Please select a valid supplier.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "❌ Creation Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  const markStepCompleted = (stepNumber: number) => {
    if (!completedSteps.includes(stepNumber)) {
      setCompletedSteps([...completedSteps, stepNumber]);
    }
  };

  // Enhanced validation functions
  const validateStep = (step: number): { isValid: boolean; errors: Record<string, string> } => {
    const newErrors: Record<string, string> = {};
    
    switch (step) {
      case 1:
        if (!invoiceType) {
          newErrors.invoiceType = "Please select an invoice type";
        }
        break;
      case 2:
        if (!selectedFile) {
          newErrors.file = "Please upload an invoice image";
        } else if (!extractedData) {
          newErrors.extraction = "Please click 'Scan Invoice' button to extract data before continuing";
        }
        break;
      case 3:
        if (!selectedSupplier) {
          newErrors.supplier = "Please select a supplier";
        }
        if (!headerDetails.invoiceNumber?.trim()) {
          newErrors.invoiceNumber = "Invoice number is required";
        }
        if (!headerDetails.invoiceDate) {
          newErrors.invoiceDate = "Invoice date is required";
        }
        if (headerDetails.total <= 0) {
          newErrors.total = "Total amount must be greater than 0";
        }
        break;
      case 4:
        if (editingItems.length === 0) {
          newErrors.items = "At least one item is required";
        }
        editingItems.forEach((item, index) => {
          if (!item.productName?.trim()) {
            newErrors[`item_${index}_name`] = `Item ${index + 1}: Product name is required`;
          }
          if (item.quantity <= 0) {
            newErrors[`item_${index}_quantity`] = `Item ${index + 1}: Quantity must be greater than 0`;
          }
          if (item.unitPrice <= 0) {
            newErrors[`item_${index}_price`] = `Item ${index + 1}: Unit price must be greater than 0`;
          }
        });
        break;
      case 5:
        if (!paymentStatus) {
          newErrors.paymentStatus = "Please select a payment status";
        }
        break;
    }
    
    return { isValid: Object.keys(newErrors).length === 0, errors: newErrors };
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image smaller than 10MB",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File Type",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      setErrors(prev => ({ ...prev, file: '' }));
    }
  };

  const handleScanInvoice = () => {
    // Only validate that a file is selected, not the full step validation
    if (!selectedFile) {
      const error = "Please upload an invoice image first";
      setErrors({ file: error });
      toast({
        title: "Validation Error",
        description: error,
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setErrors({});
    
    console.log("🔍 Starting invoice scan...", {
      fileName: selectedFile!.name,
      fileSize: selectedFile!.size,
      fileType: selectedFile!.type,
      invoiceType: invoiceType
    });
    
    const formData = new FormData();
    formData.append('invoice', selectedFile!);
    formData.append('invoiceType', invoiceType);
    
    scanMutation.mutate(formData);
  };

  const updateItemValue = (index: number, field: string, value: any) => {
    const updatedItems = [...editingItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Auto-calculate total price when quantity or unit price changes
    if (field === 'quantity' || field === 'unitPrice') {
      const quantity = field === 'quantity' ? value : updatedItems[index].quantity;
      const unitPrice = field === 'unitPrice' ? value : updatedItems[index].unitPrice;
      updatedItems[index].totalPrice = (quantity || 0) * (unitPrice || 0);
    }
    
    setEditingItems(updatedItems);
    
    // Auto-update totals
    updateHeaderTotals(updatedItems);
    
    // Clear validation errors for this field
    setErrors(prev => ({ 
      ...prev, 
      [`item_${index}_${field.replace('unitPrice', 'price').replace('productName', 'name')}`]: '' 
    }));
  };

  const updateHeaderTotals = (items: any[]) => {
    const subtotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    const vat = subtotal * 0; // 0% VAT
    const total = subtotal + vat;
    
    setHeaderDetails(prev => ({
      ...prev,
      subtotal: Number(subtotal.toFixed(2)),
      tax: Number(vat.toFixed(2)),
      total: Number(total.toFixed(2)),
    }));
  };

  const addNewItem = () => {
    const newItem = {
      srNo: editingItems.length + 1,
      productName: '',
      quantity: 1,
      uom: null,
      crtQty: null,
      pcsQty: null,
      unitPrice: 0,
      totalPrice: 0,
      sku: '',
      barcode: '',
    };
    setEditingItems([...editingItems, newItem]);
  };

  const removeItem = (index: number) => {
    const updatedItems = editingItems.filter((_, i) => i !== index)
      .map((item, i) => ({ ...item, srNo: i + 1 }));
    setEditingItems(updatedItems);
    updateHeaderTotals(updatedItems);
  };

  const canProceedToNextStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!invoiceType;
      case 2:
        return !!extractedData && !!selectedFile;
      case 3:
        return !!(selectedSupplier && headerDetails.invoiceNumber && headerDetails.invoiceDate);
      case 4:
        return editingItems.length > 0 && editingItems.every(item => 
          item.productName && item.quantity > 0 && item.unitPrice > 0
        );
      case 5:
        return !!paymentStatus;
      default:
        return true;
    }
  };

  const handleNextStep = () => {
    if (canProceedToNextStep(currentStep)) {
      markStepCompleted(currentStep);
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    // Final validation before submitting
    if (!invoiceType || !selectedSupplier || !headerDetails.invoiceNumber || editingItems.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please complete all required fields before submitting",
        variant: "destructive",
      });
      return;
    }

    // Prepare the data in the format expected by the backend
    const invoiceData = {
      type: invoiceType,
      supplierId: selectedSupplier,
      invoiceNumber: headerDetails.invoiceNumber,
      invoiceDate: headerDetails.invoiceDate,
      dueDate: headerDetails.dueDate || null,
      subtotal: headerDetails.subtotal,
      tax: headerDetails.tax,
      total: headerDetails.total,
      paymentStatus,
      imagePath: invoiceImageUrl,
    };

    const items = editingItems.map(item => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      sku: item.sku || null,
      barcode: item.barcode || null,
    }));

    // Backend expects { invoiceData, items, stockAdjustments }
    const payload = {
      invoiceData,
      items,
      stockAdjustments: [], // Optional: add stock adjustments if needed
    };

    console.log("📤 Submitting invoice:", payload);
    createInvoiceMutation.mutate(payload);
  };

  const getStepProgress = () => {
    return ((currentStep - 1) / wizardSteps.length) * 100;
  };

  const desktopHeaderActions = (
    <div className="hidden items-center gap-4 md:flex">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">
          Step {currentStep} of {wizardSteps.length}
        </span>
        <div className="w-40">
          <Progress value={getStepProgress()} className="h-2" />
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setLocation('/invoices')}
        className="flex items-center gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Invoices
      </Button>
    </div>
  );

  const mobileHeaderActions = (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">
        {currentStep}/{wizardSteps.length}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLocation('/invoices')}
        className="touch-target"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <MainLayout
      pageTitle="Create Invoice"
      headerActions={desktopHeaderActions}
      mobileHeaderActions={mobileHeaderActions}
    >
      <div className="mx-auto flex-1 space-y-6 px-4 py-6 md:max-w-4xl">
        {/* Professional Mobile Progress */}
        <Card className="md:hidden border shadow-sm bg-white">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold border-2",
                  completedSteps.includes(currentStep) 
                    ? "bg-green-500 border-green-500 text-white" 
                    : "bg-blue-500 border-blue-500 text-white"
                )}>
                  {currentStep}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-900">
                    {wizardSteps[currentStep - 1]?.title}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    Step {currentStep} of {wizardSteps.length}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs font-medium border-blue-200 text-blue-700">
                {Math.round(getStepProgress())}%
              </Badge>
            </div>
            <Progress value={getStepProgress()} className="h-2" />
          </CardContent>
        </Card>

        {/* Professional Desktop Stepper */}
        <div className="hidden md:block">
          <Card className="border shadow-sm bg-white">
            <CardContent className="p-6">
              <div className="relative">
                {/* Background Progress Line - Behind circles */}
                <div className="absolute top-5 left-0 right-0 h-0.5 flex items-center px-12">
                  <div className="w-full h-0.5 bg-gray-200 relative">
                    <div 
                      className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${((currentStep - 1) / (wizardSteps.length - 1)) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Steps */}
                <div className="relative flex items-start justify-between">
                  {wizardSteps.map((step) => (
                    <div key={step.number} className="flex flex-col items-center" style={{ flex: '0 0 auto' }}>
                      {/* Step Circle */}
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-full border-2 bg-white transition-all duration-200",
                          step.completed && "border-green-500 bg-green-500",
                          currentStep === step.number && !step.completed && "border-blue-500 bg-blue-500",
                          !step.completed && currentStep !== step.number && "border-gray-300 bg-white"
                        )}
                      >
                        {step.completed ? (
                          <Check className="h-5 w-5 text-white" strokeWidth={2.5} />
                        ) : (
                          <span className={cn(
                            "text-sm font-semibold",
                            currentStep === step.number ? "text-white" : "text-gray-500"
                          )}>
                            {step.number}
                          </span>
                        )}
                      </div>
                      
                      {/* Step Label */}
                      <div className="mt-2 text-center w-24">
                        <span className={cn(
                          "text-xs font-medium block",
                          step.completed ? "text-green-600" : 
                          currentStep === step.number ? "text-blue-600" : "text-gray-500"
                        )}>
                          {step.title}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Step 1: Type Selection */}
          {currentStep === 1 && (
            <div>
              <Card className="border shadow-sm">
                <CardHeader className="bg-blue-50 border-b">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg font-semibold text-gray-900">
                        Select Invoice Type
                      </CardTitle>
                      <p className="text-sm text-gray-600 mt-1">
                        Choose the type of invoice you want to create
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Step 1/6
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 p-8">
                  <RadioGroup 
                    value={invoiceType} 
                    onValueChange={(value: InvoiceType) => {
                      setInvoiceType(value);
                      setErrors(prev => ({ ...prev, invoiceType: '' }));
                    }}
                    className="grid grid-cols-1 gap-4"
                  >
                    <div className={`
                        relative p-6 border-2 rounded-xl cursor-pointer transition-all duration-200
                        ${invoiceType === 'receipt' 
                          ? 'border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-200' 
                          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                        }
                      `}
                    >
                      <div className="flex items-center space-x-4">
                        <RadioGroupItem value="receipt" id="receipt" className="mt-1" />
                        <Label htmlFor="receipt" className="flex-1 cursor-pointer">
                          <div className="flex items-start space-x-4">
                            <div className={`
                              p-3 rounded-lg transition-colors duration-200
                              ${invoiceType === 'receipt' ? 'bg-blue-100' : 'bg-gray-100'}
                            `}>
                              <Receipt className={`
                                h-6 w-6 transition-colors duration-200
                                ${invoiceType === 'receipt' ? 'text-blue-600' : 'text-gray-600'}
                              `} />
                            </div>
                            <div className="flex-1">
                              <div className={`
                                font-semibold text-lg transition-colors duration-200
                                ${invoiceType === 'receipt' ? 'text-blue-900' : 'text-gray-900'}
                              `}>
                                Receipt Invoice
                              </div>
                              <div className={`
                                text-sm mt-2 transition-colors duration-200
                                ${invoiceType === 'receipt' ? 'text-blue-700' : 'text-gray-600'}
                              `}>
                                Standard purchase invoice from supplier with items and amounts
                              </div>
                            </div>
                          </div>
                        </Label>
                        {invoiceType === 'receipt' && (
                          <CheckCircle className="h-6 w-6 text-blue-500" />
                        )}
                      </div>
                    </div>

                    <div className={`
                        relative p-6 border-2 rounded-xl cursor-pointer transition-all duration-200
                        ${invoiceType === 'return' 
                          ? 'border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-200' 
                          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                        }
                      `}
                    >
                      <div className="flex items-center space-x-4">
                        <RadioGroupItem value="return" id="return" className="mt-1" />
                        <Label htmlFor="return" className="flex-1 cursor-pointer">
                          <div className="flex items-start space-x-4">
                            <div className={`
                              p-3 rounded-lg transition-colors duration-200
                              ${invoiceType === 'return' ? 'bg-blue-100' : 'bg-gray-100'}
                            `}>
                              <RefreshCw className={`
                                h-6 w-6 transition-colors duration-200
                                ${invoiceType === 'return' ? 'text-blue-600' : 'text-gray-600'}
                              `} />
                            </div>
                            <div className="flex-1">
                              <div className={`
                                font-semibold text-lg transition-colors duration-200
                                ${invoiceType === 'return' ? 'text-blue-900' : 'text-gray-900'}
                              `}>
                                Return Invoice
                              </div>
                              <div className={`
                                text-sm mt-2 transition-colors duration-200
                                ${invoiceType === 'return' ? 'text-blue-700' : 'text-gray-600'}
                              `}>
                                Return or refund invoice to supplier for returned items
                              </div>
                            </div>
                          </div>
                        </Label>
                        {invoiceType === 'return' && (
                          <CheckCircle className="h-6 w-6 text-blue-500" />
                        )}
                      </div>
                    </div>
                  </RadioGroup>
                  
                  {errors.invoiceType && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{errors.invoiceType}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 2: Scan/Upload */}
          {currentStep === 2 && (
            <div>
              <Card className="border shadow-sm">
                <CardHeader className="bg-purple-50 border-b">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Scan className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg font-semibold text-gray-900">
                        Scan Invoice
                      </CardTitle>
                      <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5" />
                        AI-powered data extraction
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Step 2/6
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 p-8">
                  <div className={`
                    border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200
                    ${selectedFile 
                      ? 'border-green-300 bg-green-50' 
                      : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }
                  `}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    
                    {!imagePreview ? (
                      <div className="space-y-6">
                        <div className="mx-auto w-16 h-16 bg-purple-100 rounded-lg flex items-center justify-center">
                          <FileImage className="w-8 h-8 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">
                            Upload Invoice Image
                          </h3>
                          <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto text-center">
                            Select a clear, high-quality image of your invoice for AI-powered extraction
                          </p>
                          <div className="inline-flex flex-col gap-1.5 text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3 mx-auto">
                            <div className="flex items-center gap-2">
                              <Check className="h-3.5 w-3.5 text-green-600" />
                              <span>Supported: JPG, PNG, JPEG</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Check className="h-3.5 w-3.5 text-green-600" />
                              <span>Maximum size: 10MB</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Check className="h-3.5 w-3.5 text-green-600" />
                              <span>Ensure text is clearly visible</span>
                            </div>
                          </div>
                        </div>
                        <Button 
                          onClick={() => fileInputRef.current?.click()}
                          className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3"
                          size="lg"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Choose File
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="relative">
                          <img 
                            src={imagePreview} 
                            alt="Invoice preview" 
                            className="max-h-80 mx-auto rounded-lg border shadow-lg"
                          />
                          <Badge 
                            className="absolute top-2 right-2 bg-green-500 text-white"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Uploaded
                          </Badge>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                          <Button 
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            className="border-gray-300 hover:border-gray-400"
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Change File
                          </Button>
                          <Button 
                            onClick={handleScanInvoice}
                            disabled={isProcessing}
                            className="bg-purple-600 hover:bg-purple-700 text-white min-w-40 animate-pulse shadow-lg shadow-purple-300"
                          >
                            {isProcessing ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <Scan className="w-4 h-4 mr-2" />
                                Scan Invoice
                              </>
                            )}
                          </Button>
                        </div>
                        
                        {/* Reminder to scan if not yet scanned */}
                        {!extractedData && (
                          <Alert className="mt-4 border-blue-200 bg-blue-50">
                            <Sparkles className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-800">
                              Click the <strong>"Scan Invoice"</strong> button above to extract data using AI before proceeding to the next step.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Extraction Results */}
                  {extractedData && (
                    <div className="mt-8">
                      <Alert className="border-green-200 bg-green-50">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                          <strong>Invoice scanned successfully!</strong> AI has extracted the following data with {Math.round(extractedData.confidence * 100)}% confidence. You can review and edit in the next steps.
                        </AlertDescription>
                      </Alert>
                      
                      <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
                        <h4 className="font-medium text-gray-900 mb-3">Extracted Information:</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Supplier:</span>
                            <p className="font-medium">{extractedData.supplierName || 'Not detected'}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Invoice Number:</span>
                            <p className="font-medium">{extractedData.invoiceNumber || 'Not detected'}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Date:</span>
                            <p className="font-medium">{extractedData.invoiceDate || 'Not detected'}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Total Amount:</span>
                            <p className="font-medium">QR {extractedData.total || 'Not detected'}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Items Found:</span>
                            <p className="font-medium">{extractedData.items?.length || 0} item(s)</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Validation Errors */}
                  {(errors.file || errors.extraction) && (
                    <div className="space-y-2">
                      {errors.file && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{errors.file}</AlertDescription>
                        </Alert>
                      )}
                      {errors.extraction && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{errors.extraction}</AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 3: Header Details */}
          {currentStep === 3 && (
            <Card className="border shadow-sm">
              <CardHeader className="bg-gray-50 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900">Header Details</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      Review and edit invoice header information
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Step 3/6
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="supplier">Supplier *</Label>
                    <Select 
                      value={selectedSupplier?.toString() || ""} 
                      onValueChange={(value) => setSelectedSupplier(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id.toString()}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invoiceNumber">Invoice Number *</Label>
                    <Input
                      id="invoiceNumber"
                      value={headerDetails.invoiceNumber}
                      onChange={(e) => setHeaderDetails(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                      placeholder="Enter invoice number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invoiceDate">Invoice Date *</Label>
                    <Input
                      id="invoiceDate"
                      type="date"
                      value={headerDetails.invoiceDate}
                      onChange={(e) => setHeaderDetails(prev => ({ ...prev, invoiceDate: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={headerDetails.dueDate}
                      onChange={(e) => setHeaderDetails(prev => ({ ...prev, dueDate: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subtotal">Subtotal (QR)</Label>
                    <Input
                      id="subtotal"
                      type="number"
                      step="0.01"
                      value={headerDetails.subtotal}
                      onChange={(e) => setHeaderDetails(prev => ({ ...prev, subtotal: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tax">VAT (QR)</Label>
                    <Input
                      id="tax"
                      type="number"
                      step="0.01"
                      value={headerDetails.tax}
                      onChange={(e) => setHeaderDetails(prev => ({ ...prev, tax: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="total">Total (QR)</Label>
                    <Input
                      id="total"
                      type="number"
                      step="0.01"
                      value={headerDetails.total}
                      onChange={(e) => setHeaderDetails(prev => ({ ...prev, total: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                      className="font-medium text-lg"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Items */}
          {currentStep === 4 && (
            <Card className="border shadow-sm">
              <CardHeader className="bg-gray-50 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900">Invoice Items</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      Review and edit extracted items
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Step 4/6
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {editingItems.map((item, index) => {
                  const match = productMatches[index];
                  return (
                    <Card key={index}>
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Item {index + 1}</span>
                            {match?.action === 'match' && (
                              <Badge variant="outline" className="text-green-600">
                                <Check className="w-3 h-3 mr-1" />
                                Matched ({Math.round(match.matchConfidence * 100)}%)
                              </Badge>
                            )}
                            {match?.action !== 'match' && (
                              <Badge variant="outline" className="text-blue-600">
                                <Scan className="w-3 h-3 mr-1" />
                                Scanned Item
                              </Badge>
                            )}
                            {item.uom && (
                              <Badge variant="outline" className="text-purple-600 bg-purple-50">
                                {item.uom}
                                {item.crtQty && item.pcsQty && (
                                  <span className="ml-1 text-xs">({item.crtQty}/{item.pcsQty})</span>
                                )}
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeItem(index)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Remove
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                          <div className="sm:col-span-2 lg:col-span-1">
                            <Label className="text-xs sm:text-sm">Product Name</Label>
                            <Input 
                              value={item.productName}
                              onChange={(e) => updateItemValue(index, 'productName', e.target.value)}
                              className="text-sm"
                              placeholder="Product name"
                            />
                          </div>
                          <div>
                            <Label className="text-xs sm:text-sm">
                              Quantity
                              {item.uom && (
                                <span className="ml-1 text-xs font-normal text-purple-600">
                                  ({item.uom})
                                </span>
                              )}
                            </Label>
                            <Input 
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItemValue(index, 'quantity', parseInt(e.target.value) || 0)}
                              className="text-sm"
                              placeholder="0"
                              min="0"
                            />
                          </div>
                          <div>
                            <Label className="text-xs sm:text-sm">
                              CRT/PCS
                              <span className="ml-1 text-xs font-normal text-gray-500">(packing info)</span>
                              {item.crtQty && item.pcsQty && (
                                <span className="ml-1 text-xs font-normal text-green-600">
                                  ✓ Extracted
                                </span>
                              )}
                            </Label>
                            <Input 
                              type="text"
                              value={item.crtQty && item.pcsQty ? `${item.crtQty}/${item.pcsQty}` : ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                const match = value.match(/^(\d+)\/(\d+)$/);
                                if (match) {
                                  const crtQty = parseInt(match[1]);
                                  const pcsQty = parseInt(match[2]);
                                  updateItemValue(index, 'crtQty', crtQty);
                                  updateItemValue(index, 'pcsQty', pcsQty);
                                  // Don't auto-calculate quantity - CRT/PCS is just packing info
                                  // updateItemValue(index, 'quantity', crtQty * pcsQty);
                                } else if (value === '') {
                                  updateItemValue(index, 'crtQty', null);
                                  updateItemValue(index, 'pcsQty', null);
                                }
                              }}
                              className={cn("text-sm font-mono", item.crtQty && item.pcsQty && "border-green-300 bg-green-50")}
                              placeholder="2/24 (packing info)"
                            />
                            {item.crtQty && item.pcsQty && (
                              <p className="text-[10px] text-gray-500 mt-1">
                                📦 {item.crtQty} carton(s) × {item.pcsQty} pieces = {item.crtQty * item.pcsQty} total pcs (info only)
                              </p>
                            )}
                          </div>
                          <div>
                            <Label className="text-xs sm:text-sm">Unit Price (QR)</Label>
                            <Input 
                              type="text"
                              inputMode="decimal"
                              value={Number(item.unitPrice).toFixed(2)}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Allow typing decimal values
                                if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                                  updateItemValue(index, 'unitPrice', value === '' ? 0 : parseFloat(value) || 0);
                                }
                              }}
                              className="text-sm"
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <Label className="text-xs sm:text-sm">Total Price (QR)</Label>
                            <Input 
                              type="text"
                              value={Number(item.totalPrice).toFixed(2)}
                              className="text-sm bg-gray-50"
                              placeholder="0.00"
                              readOnly
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                          <div>
                            <Label className="text-xs sm:text-sm">
                              UOM
                              {item.uom && (
                                <span className="ml-1 text-xs font-normal text-green-600">
                                  ✓ Extracted
                                </span>
                              )}
                            </Label>
                            <Input 
                              value={item.uom || ''}
                              onChange={(e) => updateItemValue(index, 'uom', e.target.value.toUpperCase())}
                              className={cn("text-sm", item.uom && "border-green-300 bg-green-50")}
                              placeholder="CRT, PCS, BOX, etc."
                              maxLength={10}
                            />
                          </div>
                          <div>
                            <Label className="text-xs sm:text-sm">
                              SKU
                              {item.sku && (
                                <span className="ml-1 text-xs font-normal text-green-600">
                                  ✓ Extracted
                                </span>
                              )}
                            </Label>
                            <Input 
                              value={item.sku || ''}
                              onChange={(e) => updateItemValue(index, 'sku', e.target.value)}
                              className={cn("text-sm", item.sku && "border-green-300 bg-green-50")}
                              placeholder="Optional SKU"
                            />
                          </div>
                          <div>
                            <Label className="text-xs sm:text-sm">
                              Barcode
                              {item.barcode && (
                                <span className="ml-1 text-xs font-normal text-green-600">
                                  ✓ Extracted
                                </span>
                              )}
                            </Label>
                            <Input 
                              value={item.barcode || ''}
                              onChange={(e) => updateItemValue(index, 'barcode', e.target.value)}
                              className={cn("text-sm", item.barcode && "border-green-300 bg-green-50")}
                              placeholder="Optional barcode"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {editingItems.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>No items found. Click "Add Item Manually" below to add items.</p>
                  </div>
                )}

                {/* Add Item Manually Button */}
                <div className="pt-4 border-t">
                  <Button
                    onClick={addNewItem}
                    variant="outline"
                    className="w-full border-dashed border-2 border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400 py-6"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Add Item Manually
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 5: Payment Status */}
          {currentStep === 5 && (
            <Card className="border shadow-sm">
              <CardHeader className="bg-gray-50 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900">Payment Status</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      Select the payment status for this invoice
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Step 5/6
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <RadioGroup 
                  value={paymentStatus} 
                  onValueChange={(value: PaymentStatus) => setPaymentStatus(value)}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                >
                  <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                    <RadioGroupItem value="paid" id="paid" />
                    <Label htmlFor="paid" className="flex-1 cursor-pointer">
                      <div className="font-medium text-green-600">Paid</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Invoice has been fully paid
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                    <RadioGroupItem value="not_paid" id="not_paid" />
                    <Label htmlFor="not_paid" className="flex-1 cursor-pointer">
                      <div className="font-medium text-red-600">Not Paid</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Invoice is pending payment
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                    <RadioGroupItem value="credit" id="credit" />
                    <Label htmlFor="credit" className="flex-1 cursor-pointer">
                      <div className="font-medium text-blue-600">Credit</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Paid using credit terms
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                    <RadioGroupItem value="paid_by_card" id="paid_by_card" />
                    <Label htmlFor="paid_by_card" className="flex-1 cursor-pointer">
                      <div className="font-medium text-purple-600">Paid by Card</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Paid using credit/debit card
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          )}

          {/* Step 6: Review & Submit */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <Card className="border shadow-sm">
                <CardHeader className="bg-gray-50 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-semibold text-gray-900">Review & Submit</CardTitle>
                      <p className="text-sm text-gray-600 mt-1">
                        Review all details before creating the invoice
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Step 6/6
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
                    <div><strong>Type:</strong> {invoiceType === 'receipt' ? 'Receipt' : 'Return'}</div>
                    <div><strong>Invoice #:</strong> {headerDetails.invoiceNumber}</div>
                    <div><strong>Supplier:</strong> {suppliers.find((supplier) => supplier.id === selectedSupplier)?.name}</div>
                    <div><strong>Date:</strong> {headerDetails.invoiceDate}</div>
                    <div><strong>Payment Status:</strong> {paymentStatus.replace('_', ' ').toUpperCase()}</div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium mb-2">Financial Summary</h4>
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>QR {headerDetails.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>VAT:</span>
                        <span>QR {headerDetails.tax.toFixed(2)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-medium text-base">
                        <span>Total:</span>
                        <span>QR {headerDetails.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium mb-2">Items ({editingItems.length})</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {editingItems.map((item, index) => (
                        <div key={index} className="flex justify-between items-center text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                          <div className="flex-1">
                            <div className="font-medium">{item.productName}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {item.quantity}
                              {item.uom && <span className="text-purple-600"> {item.uom}</span>}
                              {item.crtQty && item.pcsQty && (
                                <span className="text-purple-600"> ({item.crtQty}×{item.pcsQty})</span>
                              )}
                              {' × QR '}{item.unitPrice.toFixed(2)}
                            </div>
                          </div>
                          <div className="font-medium">
                            QR {item.totalPrice.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Image Preview */}
              {imagePreview && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm sm:text-base">Scanned Invoice</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <img 
                      src={imagePreview} 
                      alt="Scanned invoice" 
                      className="w-full max-h-32 sm:max-h-48 object-contain rounded border"
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Professional Navigation */}
          <div className="sticky bottom-0 z-10 bg-white border-t shadow-lg">
            <div className="p-6">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                {/* Previous and Cancel Buttons */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Button 
                    variant="outline" 
                    onClick={handlePrevStep}
                    disabled={currentStep === 1}
                    className={cn(
                      "flex items-center gap-2 px-6 py-2.5 flex-1 sm:flex-initial",
                      currentStep === 1 && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => setLocation('/invoices')}
                    className="flex items-center gap-2 px-6 py-2.5 flex-1 sm:flex-initial border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Cancel</span>
                  </Button>
                </div>

                {/* Center Progress Indicator */}
                <div className="flex items-center gap-4 order-first sm:order-none w-full sm:w-auto justify-center">
                  <Badge variant="outline" className="text-sm font-semibold px-3 py-1.5">
                    Step {currentStep} of {wizardSteps.length}
                  </Badge>
                  
                  <div className="hidden sm:block w-32 bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${(currentStep / wizardSteps.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Next/Submit Button */}
                {currentStep < wizardSteps.length ? (
                  <Button 
                    onClick={() => {
                      const validation = validateStep(currentStep);
                      if (!validation.isValid) {
                        setErrors(validation.errors);
                        Object.values(validation.errors).forEach(error => {
                          toast({
                            title: "Validation Error",
                            description: error,
                            variant: "destructive",
                          });
                        });
                        return;
                      }
                      handleNextStep();
                    }}
                    disabled={!canProceedToNextStep(currentStep)}
                    className={cn(
                      "flex items-center gap-2 px-6 py-2.5 w-full sm:w-auto",
                      !canProceedToNextStep(currentStep) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button 
                    onClick={() => {
                      const validation = validateStep(currentStep);
                      if (!validation.isValid) {
                        setErrors(validation.errors);
                        Object.values(validation.errors).forEach(error => {
                          toast({
                            title: "Validation Error",
                            description: error,
                            variant: "destructive",
                          });
                        });
                        return;
                      }
                      handleSubmit();
                    }}
                    disabled={createInvoiceMutation.isPending || !canProceedToNextStep(currentStep)}
                    className={cn(
                      "flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto",
                      (createInvoiceMutation.isPending || !canProceedToNextStep(currentStep)) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {createInvoiceMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Create Invoice</span>
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Step-specific help text */}
              <div className="mt-4 text-center border-t pt-4">
                <p className="text-sm text-gray-600">
                  {currentStep === 1 && "Select the type of invoice you want to create"}
                  {currentStep === 2 && "Upload a clear image of your invoice for AI processing"}
                  {currentStep === 3 && "Review and edit the supplier and header information"}
                  {currentStep === 4 && "Review and edit the extracted line items"}
                  {currentStep === 5 && "Select the payment status for this invoice"}
                  {currentStep === 6 && "Review all details before creating the invoice"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}