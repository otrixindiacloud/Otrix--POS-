import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Trash2, 
  Camera, 
  Barcode as BarcodeIcon, 
  Edit3,
  Save,
  Calculator,
  FileText,
  User,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Coins
} from "lucide-react";
import type { Supplier, Product } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { BarcodeScanner } from "@/components/ui/barcode-scanner";
import LoadingSpinner from "@/components/ui/loading-spinner";

interface InvoiceItem {
  srNo: number;
  productId?: number;
  productName: string;
  itemCode: string;
  barcode: string;
  quantity: number;
  uom: string;
  unitCost: number;
  totalCost: number;
  sku?: string;
  isNewProduct?: boolean;
}

interface InvoiceFormData {
  supplierId: number;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  subtotal: number;
  tax: number;
  total: number;
  type: 'receipt' | 'return';
  paymentStatus: 'paid' | 'partially_paid' | 'not_paid' | 'paid_by_card';
  
  // Customer/Client fields
  crNo?: string;
  customerName?: string;
  customerPhone?: string;
  customerMobile?: string;
  customerEmail?: string;
  customerAddress?: string;
  salesmanName?: string;
  
  notes?: string;
  items: InvoiceItem[];
}

interface EnhancedInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'receipt' | 'return';
  invoice?: any;
}

export default function EnhancedInvoiceModal({ isOpen, onClose, type, invoice }: EnhancedInvoiceModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  
  const generateUniqueInvoiceNumber = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${type.toUpperCase()}-${timestamp}-${random}`;
  };

  const [formData, setFormData] = useState<InvoiceFormData>({
    supplierId: 0,
    invoiceNumber: generateUniqueInvoiceNumber(),
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    subtotal: 0,
    tax: 0,
    total: 0,
    type,
    paymentStatus: 'not_paid',
    items: [{
      srNo: 1,
      productName: '',
      itemCode: '',
      barcode: '',
      quantity: 1,
      uom: 'pcs',
      unitCost: 0,
      totalCost: 0
    }]
  });

  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery({
    queryKey: ["/api/suppliers"],
  });

  const { data: products = [] } = useQuery({
    queryKey: ["/api/products"],
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen && !invoice) {
      const generateUniqueInvoiceNumber = () => {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `${type.toUpperCase()}-${timestamp}-${random}`;
      };

      setFormData({
        supplierId: 0,
        invoiceNumber: generateUniqueInvoiceNumber(),
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        subtotal: 0,
        tax: 0,
        total: 0,
        type,
        paymentStatus: 'not_paid',
        items: [{
          srNo: 1,
          productName: '',
          itemCode: '',
          barcode: '',
          quantity: 1,
          uom: 'pcs',
          unitCost: 0,
          totalCost: 0
        }]
      });
    }
  }, [isOpen, type, invoice]);

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Submitting invoice data:", data);
      try {
        const response = await apiRequest({
          url: '/api/supplier-invoices',
          method: 'POST',
          body: data,
        });
        
        const result = await response.json();
        console.log("API response:", result);
        return result;
      } catch (error) {
        console.error("API request failed:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("Invoice created successfully:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-invoices"] });
      toast({
        title: "Success",
        description: `${type === 'receipt' ? 'Receipt' : 'Return'} created successfully`,
      });
      onClose();
    },
    onError: (error: any) => {
      console.error("Invoice creation error:", error);
      
      let errorMessage = `Failed to create ${type}`;
      
      if (error.message) {
        if (error.message.includes("Invoice number already exists")) {
          // Generate a new unique invoice number and suggest retry
          const timestamp = Date.now();
          const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
          const newNumber = `${type.toUpperCase()}-${timestamp}-${random}`;
          
          setFormData(prev => ({
            ...prev,
            invoiceNumber: newNumber
          }));
          
          errorMessage = `Invoice number already exists. Updated to: ${newNumber}. Please try again.`;
        } else if (error.message.includes("Invalid supplier")) {
          errorMessage = "Please select a valid supplier.";
        } else if (error.message.includes("At least one invoice item is required")) {
          errorMessage = "Please add at least one item to the invoice.";
        } else if (error.message.includes("Validation error")) {
          errorMessage = `Validation error: ${error.details || error.message}`;
        } else if (error.message.includes("Invalid data for item")) {
          errorMessage = error.message;
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleBarcodeScanned = (barcode: string) => {
    if (activeItemIndex !== null) {
      const product = (products as Product[]).find((p: Product) => p.barcode === barcode || p.sku === barcode);
      
      const updatedItems = [...formData.items];
      updatedItems[activeItemIndex] = {
        ...updatedItems[activeItemIndex],
        barcode,
        ...(product && {
          productId: product.id,
          productName: product.name,
          itemCode: product.sku || '',
          sku: product.sku,
          unitCost: parseFloat(product.cost?.toString() || '0'),
          totalCost: parseFloat(product.cost?.toString() || '0') * updatedItems[activeItemIndex].quantity
        })
      };
      
      setFormData({ ...formData, items: updatedItems });
      calculateTotals(updatedItems);
    }
    setShowCameraModal(false);
    setActiveItemIndex(null);
  };

  const generateBarcode = () => {
    return `BC${Date.now().toString().slice(-8)}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  };

  const addNewItem = () => {
    const newItem: InvoiceItem = {
      srNo: formData.items.length + 1,
      productName: '',
      itemCode: '',
      barcode: generateBarcode(),
      quantity: 1,
      uom: 'pcs',
      unitCost: 0,
      totalCost: 0
    };
    
    setFormData({ 
      ...formData, 
      items: [...formData.items, newItem] 
    });
  };

  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      const updatedItems = formData.items.filter((_, i) => i !== index);
      // Reorder serial numbers
      const reorderedItems = updatedItems.map((item, i) => ({ ...item, srNo: i + 1 }));
      setFormData({ ...formData, items: reorderedItems });
      calculateTotals(reorderedItems);
    }
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const updatedItems = [...formData.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Auto-calculate total cost when quantity or unit cost changes
    if (field === 'quantity' || field === 'unitCost') {
      updatedItems[index].totalCost = updatedItems[index].quantity * updatedItems[index].unitCost;
    }
    
    setFormData({ ...formData, items: updatedItems });
    calculateTotals(updatedItems);
  };

  const calculateTotals = (items: InvoiceItem[]) => {
    const subtotal = items.reduce((sum, item) => sum + item.totalCost, 0);
    const tax = subtotal * 0; // 0% VAT
    const total = subtotal + tax;
    
    setFormData(prev => ({
      ...prev,
      subtotal,
      tax,
      total
    }));
  };

  const handleSaveInvoice = () => {
    // Validate required fields with detailed feedback
    if (!formData.supplierId || formData.supplierId === 0) {
      toast({
        title: "Missing Supplier",
        description: "Please select a supplier from the dropdown",
        variant: "destructive",
      });
      return;
    }

    if (!formData.invoiceNumber?.trim()) {
      toast({
        title: "Missing Invoice Number",
        description: "Please enter an invoice number",
        variant: "destructive",
      });
      return;
    }

    if (formData.items.length === 0) {
      toast({
        title: "No Items Added",
        description: "Please add at least one item to the invoice",
        variant: "destructive",
      });
      return;
    }

    // Check each item for required fields
    const invalidItems = [];
    for (let i = 0; i < formData.items.length; i++) {
      const item = formData.items[i];
      if (!item.productName?.trim()) {
        invalidItems.push(`Item ${i + 1}: Missing product name`);
      }
      if (!item.barcode?.trim()) {
        invalidItems.push(`Item ${i + 1}: Missing barcode`);
      }
      if (!item.quantity || item.quantity <= 0) {
        invalidItems.push(`Item ${i + 1}: Invalid quantity`);
      }
      if (!item.unitCost || item.unitCost <= 0) {
        invalidItems.push(`Item ${i + 1}: Invalid unit cost`);
      }
    }

    if (invalidItems.length > 0) {
      toast({
        title: "Invalid Item Data", 
        description: invalidItems.slice(0, 3).join(', ') + (invalidItems.length > 3 ? '...' : ''),
        variant: "destructive",
      });
      return;
    }

    setShowPaymentModal(true);
  };

  const handleConfirmPayment = () => {
    // Validate required fields with detailed feedback
    if (!formData.supplierId || formData.supplierId === 0) {
      toast({
        title: "Missing Supplier",
        description: "Please select a supplier from the dropdown",
        variant: "destructive",
      });
      return;
    }

    if (!formData.invoiceNumber?.trim()) {
      toast({
        title: "Missing Invoice Number",
        description: "Please enter an invoice number",
        variant: "destructive",
      });
      return;
    }

    if (formData.items.length === 0) {
      toast({
        title: "No Items Added",
        description: "Please add at least one item to the invoice",
        variant: "destructive",
      });
      return;
    }

    // Check each item for required fields
    const invalidItems = [];
    for (let i = 0; i < formData.items.length; i++) {
      const item = formData.items[i];
      if (!item.productName?.trim()) {
        invalidItems.push(`Item ${i + 1}: Missing product name`);
      }
      if (!item.barcode?.trim()) {
        invalidItems.push(`Item ${i + 1}: Missing barcode`);
      }
      if (!item.quantity || item.quantity <= 0) {
        invalidItems.push(`Item ${i + 1}: Invalid quantity`);
      }
      if (!item.unitCost || item.unitCost <= 0) {
        invalidItems.push(`Item ${i + 1}: Invalid unit cost`);
      }
    }

    if (invalidItems.length > 0) {
      toast({
        title: "Invalid Item Data", 
        description: invalidItems.slice(0, 3).join(', ') + (invalidItems.length > 3 ? '...' : ''),
        variant: "destructive",
      });
      return;
    }

    const invoiceData = {
      supplierId: formData.supplierId,
      invoiceNumber: formData.invoiceNumber,
      invoiceDate: formData.invoiceDate,
      dueDate: formData.dueDate || undefined,
      subtotal: formData.subtotal.toString(),
      tax: formData.tax.toString(),
      total: formData.total.toString(),
      status: 'pending',
      paymentStatus: formData.paymentStatus,
      type: formData.type,
      crNo: formData.crNo || null,
      customerName: formData.customerName || null,
      customerPhone: formData.customerPhone || null,
      customerMobile: formData.customerMobile || null,
      customerEmail: formData.customerEmail || null,
      customerAddress: formData.customerAddress || null,
      salesmanName: formData.salesmanName || null,
      notes: formData.notes || null,
    };

    const items = formData.items.map(item => ({
      srNo: item.srNo,
      productId: item.productId || null,
      productName: item.productName,
      itemCode: item.itemCode || "",
      barcode: item.barcode,
      quantity: Number(item.quantity),
      uom: item.uom,
      unitCost: Number(item.unitCost),
      totalCost: Number(item.totalCost),
      sku: item.sku || null,
      isNewProduct: item.isNewProduct || false
    }));

    console.log("Submitting invoice with data:", { invoiceData, items });

    createInvoiceMutation.mutate({ invoiceData, items, stockAdjustments: [] });
    setShowPaymentModal(false);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Create {type === 'receipt' ? 'Receipt' : 'Return'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Header Information */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Invoice Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="supplier">Supplier *</Label>
                      <Select 
                        value={formData.supplierId > 0 ? formData.supplierId.toString() : ""} 
                        onValueChange={(value) => setFormData({ ...formData, supplierId: parseInt(value) })}
                      >
                        <SelectTrigger className={formData.supplierId === 0 ? "border-amber-400 dark:border-amber-600" : ""}>
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          {(suppliers as Supplier[]).map((supplier: Supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id.toString()}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {formData.supplierId === 0 && (
                        <div className="flex items-start gap-2 mt-1 p-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                          <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">Please select a supplier</p>
                        </div>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="invoiceNumber">Invoice Number *</Label>
                      <Input
                        id="invoiceNumber"
                        value={formData.invoiceNumber}
                        onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                        placeholder="INV-001"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="invoiceDate">Invoice Date *</Label>
                      <Input
                        id="invoiceDate"
                        type="date"
                        value={formData.invoiceDate}
                        onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="dueDate">Due Date</Label>
                      <Input
                        id="dueDate"
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Customer Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Customer Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="crNo">CR No.</Label>
                      <Input
                        id="crNo"
                        value={formData.crNo || ''}
                        onChange={(e) => setFormData({ ...formData, crNo: e.target.value })}
                        placeholder="Commercial Registration No."
                      />
                    </div>
                    <div>
                      <Label htmlFor="customerName">Customer Name</Label>
                      <Input
                        id="customerName"
                        value={formData.customerName || ''}
                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                        placeholder="Customer name"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="customerPhone">Phone</Label>
                      <Input
                        id="customerPhone"
                        value={formData.customerPhone || ''}
                        onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                        placeholder="Phone number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="customerMobile">Mobile</Label>
                      <Input
                        id="customerMobile"
                        value={formData.customerMobile || ''}
                        onChange={(e) => setFormData({ ...formData, customerMobile: e.target.value })}
                        placeholder="Mobile number"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="customerEmail">Email</Label>
                    <Input
                      id="customerEmail"
                      type="email"
                      value={formData.customerEmail || ''}
                      onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                      placeholder="customer@email.com"
                    />
                  </div>

                  <div>
                    <Label htmlFor="customerAddress">Address</Label>
                    <Textarea
                      id="customerAddress"
                      value={formData.customerAddress || ''}
                      onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                      placeholder="Customer address"
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label htmlFor="salesmanName">Sales Man</Label>
                    <Input
                      id="salesmanName"
                      value={formData.salesmanName || ''}
                      onChange={(e) => setFormData({ ...formData, salesmanName: e.target.value })}
                      placeholder="Salesman name"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Items & Summary */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">Invoice Items</CardTitle>
                  <Button onClick={addNewItem} size="sm" variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Item
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4 max-h-96 overflow-y-auto">
                  {formData.items.map((item, index) => (
                    <Card key={index} className="border border-gray-200">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">#{item.srNo}</Badge>
                          {formData.items.length > 1 && (
                            <Button
                              onClick={() => removeItem(index)}
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label>Product Name *</Label>
                            <Input
                              value={item.productName}
                              onChange={(e) => updateItem(index, 'productName', e.target.value)}
                              placeholder="Product name"
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label>Item Code</Label>
                            <Input
                              value={item.itemCode}
                              onChange={(e) => updateItem(index, 'itemCode', e.target.value)}
                              placeholder="Item code"
                              className="text-sm"
                            />
                          </div>
                        </div>

                        <div>
                          <Label>Barcode *</Label>
                          <div className="flex gap-2">
                            <Input
                              value={item.barcode}
                              onChange={(e) => updateItem(index, 'barcode', e.target.value)}
                              placeholder="Barcode"
                              className="text-sm"
                            />
                            <Button
                              onClick={() => {
                                setActiveItemIndex(index);
                                setShowCameraModal(true);
                              }}
                              size="sm"
                              variant="outline"
                            >
                              <Camera className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => updateItem(index, 'barcode', generateBarcode())}
                              size="sm"
                              variant="outline"
                            >
                              <BarcodeIcon className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label>Quantity *</Label>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label>UOM</Label>
                            <Select value={item.uom} onValueChange={(value) => updateItem(index, 'uom', value)}>
                              <SelectTrigger className="text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pcs">Pieces</SelectItem>
                                <SelectItem value="kg">Kilogram</SelectItem>
                                <SelectItem value="ltr">Liter</SelectItem>
                                <SelectItem value="mtr">Meter</SelectItem>
                                <SelectItem value="box">Box</SelectItem>
                                <SelectItem value="pack">Pack</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Unit Cost</Label>
                            <Input
                              type="number"
                              value={item.unitCost}
                              onChange={(e) => updateItem(index, 'unitCost', parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              className="text-sm"
                            />
                          </div>
                        </div>

                        <div>
                          <Label>Total Cost</Label>
                          <Input
                            value={item.totalCost.toFixed(2)}
                            readOnly
                            className="bg-gray-50 text-sm font-medium"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>

              {/* Invoice Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calculator className="w-4 h-4" />
                    Invoice Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span className="font-medium">QR {formData.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax (15%):</span>
                    <span className="font-medium">QR {formData.tax.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>QR {formData.total.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button onClick={onClose} variant="outline">
              Cancel
            </Button>
            <Button onClick={handleSaveInvoice} disabled={createInvoiceMutation.isPending}>
              {createInvoiceMutation.isPending ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save {type === 'receipt' ? 'Receipt' : 'Return'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Status Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5" />
              Payment Status
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">Total Amount</div>
              <div className="text-2xl font-bold">QR {formData.total.toFixed(2)}</div>
            </div>

            <div>
              <Label>Payment Status</Label>
              <Select value={formData.paymentStatus} onValueChange={(value) => setFormData({ ...formData, paymentStatus: value as any })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      Paid
                    </div>
                  </SelectItem>
                  <SelectItem value="partially_paid">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                      Partially Paid
                    </div>
                  </SelectItem>
                  <SelectItem value="not_paid">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full" />
                      Not Paid
                    </div>
                  </SelectItem>
                  <SelectItem value="paid_by_card">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Paid by Card
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button onClick={() => setShowPaymentModal(false)} variant="outline">
              Cancel
            </Button>
            <Button onClick={handleConfirmPayment} disabled={createInvoiceMutation.isPending}>
              {createInvoiceMutation.isPending ? (
                <LoadingSpinner size="sm" />
              ) : (
                "Confirm & Save"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onScan={handleBarcodeScanned}
      />
    </>
  );
}