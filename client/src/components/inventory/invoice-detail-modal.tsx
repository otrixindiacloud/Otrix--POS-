import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  Calendar, 
  Coins, 
  Package, 
  Truck,
  Edit,
  Save,
  X,
  CreditCard,
  User,
  Phone,
  Mail,
  MapPin,
  Image,
  Download,
  Eye,
  Upload,
  AlertTriangle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Supplier, SupplierInvoice, SupplierInvoiceItem, SupplierPayment } from "@shared/schema";
import PaymentModal from "./payment-modal";

interface InvoiceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: SupplierInvoice;
  supplier?: Supplier;
}

export default function InvoiceDetailModal({ isOpen, onClose, invoice, supplier }: InvoiceDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedInvoice, setEditedInvoice] = useState(invoice);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch invoice items
  const { data: invoiceItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['/api/supplier-invoices', invoice.id, 'items'],
    queryFn: () => apiRequest({ method: 'GET', url: `/api/supplier-invoices/${invoice.id}/items` }),
    enabled: isOpen,
  });

  // Fetch invoice payments
  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['/api/supplier-invoices', invoice.id, 'payments'],
    queryFn: () => apiRequest({ method: 'GET', url: `/api/supplier-invoices/${invoice.id}/payments` }),
    enabled: isOpen,
  });

  // Ensure payments is always an array
  const payments = Array.isArray(paymentsData) ? paymentsData : [];

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<SupplierInvoice>) => {
      return apiRequest({
        url: `/api/supplier-invoices/${invoice.id}`,
        method: 'PATCH',
        body: data,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Invoice updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/supplier-invoices'] });
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update invoice. Please try again.",
        variant: "destructive",
      });
      console.error("Invoice update error:", error);
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      ...editedInvoice,
      invoiceDate: new Date(editedInvoice.invoiceDate),
      dueDate: editedInvoice.dueDate ? new Date(editedInvoice.dueDate) : null,
      processedAt: editedInvoice.processedAt ? new Date(editedInvoice.processedAt) : null,
    });
  };

  const handleCancel = () => {
    setEditedInvoice(invoice);
    setIsEditing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    return type === 'return' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800';
  };

  const totalPaid = payments.reduce((sum: number, payment: SupplierPayment) => 
    sum + (parseFloat(payment.amount) || 0), 0
  );
  const remainingBalance = (parseFloat(invoice.total) || 0) - totalPaid;
  const isFullyPaid = remainingBalance <= 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] w-[95vw] overflow-y-auto bg-slate-50">
        <DialogHeader className="border-b bg-white px-6 py-4 -mx-6 -mt-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-2xl font-bold text-slate-900 mb-1">
                Invoice Details - <span className="text-blue-600">{invoice.invoiceNumber}</span>
              </DialogTitle>
              <p className="text-sm text-slate-500">
                {supplier?.name || 'Unknown Supplier'} • {format(new Date(invoice.invoiceDate), 'MMM dd, yyyy')}
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {!isEditing ? (
                <>
                  <Button 
                    onClick={() => setShowPaymentModal(true)}
                    disabled={isFullyPaid}
                    className={isFullyPaid ? "bg-green-500 hover:bg-green-600" : "bg-blue-600 hover:bg-blue-700"}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    {isFullyPaid ? "Paid" : "Pay"}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsEditing(true)}
                    className="border-slate-300"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    variant="outline" 
                    onClick={handleCancel}
                    disabled={updateMutation.isPending}
                    className="border-slate-300"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {updateMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column - Invoice Info */}
          <div className="xl:col-span-2 space-y-6">
            {/* Basic Info Card */}
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <div className="p-1.5 bg-blue-100 rounded">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  Invoice Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-xs font-medium text-slate-600 uppercase mb-2 block">Invoice Number</Label>
                    {isEditing ? (
                      <Input
                        value={editedInvoice.invoiceNumber}
                        onChange={(e) => setEditedInvoice({ ...editedInvoice, invoiceNumber: e.target.value })}
                        className="border-slate-300"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-slate-900">{invoice.invoiceNumber}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-600 uppercase mb-2 block">Supplier</Label>
                    <p className="text-sm font-semibold text-slate-900">{supplier?.name || 'Unknown Supplier'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-xs font-medium text-slate-600 uppercase mb-2 block">Invoice Date</Label>
                    {isEditing ? (
                      <Input
                        type="date"
                        value={format(new Date(editedInvoice.invoiceDate), 'yyyy-MM-dd')}
                        onChange={(e) => setEditedInvoice({ 
                          ...editedInvoice, 
                          invoiceDate: e.target.value as any
                        })}
                        className="border-slate-300"
                      />
                    ) : (
                      <p className="text-sm text-slate-700">{format(new Date(invoice.invoiceDate), 'MMM dd, yyyy')}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-600 uppercase mb-2 block">Due Date</Label>
                    {isEditing ? (
                      <Input
                        type="date"
                        value={editedInvoice.dueDate ? format(new Date(editedInvoice.dueDate), 'yyyy-MM-dd') : ''}
                        onChange={(e) => setEditedInvoice({ 
                          ...editedInvoice, 
                          dueDate: (e.target.value || null) as any
                        })}
                        className="border-slate-300"
                      />
                    ) : (
                      <p className="text-sm text-slate-700">{invoice.dueDate ? format(new Date(invoice.dueDate), 'MMM dd, yyyy') : 'Not specified'}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-slate-600 uppercase mb-2 block">Status</Label>
                    {isEditing ? (
                      <Select
                        value={editedInvoice.status}
                        onValueChange={(value) => setEditedInvoice({ ...editedInvoice, status: value })}
                      >
                        <SelectTrigger className="border-slate-300">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className={`${getStatusColor(invoice.status)} mt-1`}>
                        {invoice.status.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-600 uppercase mb-2 block">Payment Status</Label>
                    {isEditing ? (
                      <Select
                        value={editedInvoice.paymentStatus || 'not_paid'}
                        onValueChange={(value) => setEditedInvoice({ ...editedInvoice, paymentStatus: value })}
                      >
                        <SelectTrigger className="border-slate-300">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="partially_paid">Partially Paid</SelectItem>
                          <SelectItem value="not_paid">Not Paid</SelectItem>
                          <SelectItem value="paid_by_card">Paid by Card</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50 mt-1">
                        {invoice.paymentStatus?.replace('_', ' ').toUpperCase() || 'NOT PAID'}
                      </Badge>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-600 uppercase mb-2 block">Type</Label>
                    <Badge className={`${getTypeColor(invoice.type)} mt-1`}>
                      {invoice.type.toUpperCase()}
                    </Badge>
                  </div>
                </div>

                {(invoice.notes || isEditing) && (
                  <div>
                    <Label className="text-xs font-medium text-slate-600 uppercase mb-2 block">Notes</Label>
                    {isEditing ? (
                      <Textarea
                        value={editedInvoice.notes || ''}
                        onChange={(e) => setEditedInvoice({ ...editedInvoice, notes: e.target.value })}
                        placeholder="Add notes about this invoice..."
                        className="border-slate-300"
                        rows={3}
                      />
                    ) : (
                      <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-md">{invoice.notes || 'No notes'}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Customer Information */}
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <div className="p-1.5 bg-purple-100 rounded">
                    <User className="w-4 h-4 text-purple-600" />
                  </div>
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-xs font-medium text-slate-600 uppercase mb-2 block">CR No.</Label>
                    {isEditing ? (
                      <Input
                        value={editedInvoice.crNo || ''}
                        onChange={(e) => setEditedInvoice({ ...editedInvoice, crNo: e.target.value })}
                        placeholder="Commercial Registration No."
                        className="border-slate-300"
                      />
                    ) : (
                      <p className="text-sm text-slate-700">{invoice.crNo || <span className="text-slate-400">Not specified</span>}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-600 uppercase mb-2 block">Customer Name</Label>
                    {isEditing ? (
                      <Input
                        value={editedInvoice.customerName || ''}
                        onChange={(e) => setEditedInvoice({ ...editedInvoice, customerName: e.target.value })}
                        placeholder="Customer name"
                        className="border-slate-300"
                      />
                    ) : (
                      <p className="text-sm text-slate-700">{invoice.customerName || <span className="text-slate-400">Not specified</span>}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-xs font-medium text-slate-600 uppercase mb-2 block">Phone</Label>
                    {isEditing ? (
                      <Input
                        value={editedInvoice.customerPhone || ''}
                        onChange={(e) => setEditedInvoice({ ...editedInvoice, customerPhone: e.target.value })}
                        placeholder="Phone number"
                        className="border-slate-300"
                      />
                    ) : (
                      <p className="text-sm text-slate-700">{invoice.customerPhone || <span className="text-slate-400">Not specified</span>}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-600 uppercase mb-2 block">Mobile</Label>
                    {isEditing ? (
                      <Input
                        value={editedInvoice.customerMobile || ''}
                        onChange={(e) => setEditedInvoice({ ...editedInvoice, customerMobile: e.target.value })}
                        placeholder="Mobile number"
                        className="border-slate-300"
                      />
                    ) : (
                      <p className="text-sm text-slate-700">{invoice.customerMobile || <span className="text-slate-400">Not specified</span>}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-slate-600 uppercase mb-2 block">Email</Label>
                  {isEditing ? (
                    <Input
                      type="email"
                      value={editedInvoice.customerEmail || ''}
                      onChange={(e) => setEditedInvoice({ ...editedInvoice, customerEmail: e.target.value })}
                      placeholder="customer@email.com"
                      className="border-slate-300"
                    />
                  ) : (
                    <p className="text-sm text-slate-700">{invoice.customerEmail || <span className="text-slate-400">Not specified</span>}</p>
                  )}
                </div>

                <div>
                  <Label className="text-xs font-medium text-slate-600 uppercase mb-2 block">Address</Label>
                  {isEditing ? (
                    <Textarea
                      value={editedInvoice.customerAddress || ''}
                      onChange={(e) => setEditedInvoice({ ...editedInvoice, customerAddress: e.target.value })}
                      placeholder="Customer address"
                      rows={2}
                      className="border-slate-300"
                    />
                  ) : (
                    <p className="text-sm text-slate-700">{invoice.customerAddress || <span className="text-slate-400">Not specified</span>}</p>
                  )}
                </div>

                <div>
                  <Label className="text-xs font-medium text-slate-600 uppercase mb-2 block">Sales Man</Label>
                  {isEditing ? (
                    <Input
                      value={editedInvoice.salesmanName || ''}
                      onChange={(e) => setEditedInvoice({ ...editedInvoice, salesmanName: e.target.value })}
                      placeholder="Salesman name"
                      className="border-slate-300"
                    />
                  ) : (
                    <p className="text-sm text-slate-700">{invoice.salesmanName || <span className="text-slate-400">Not specified</span>}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Scanned Invoice Attachment */}
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                    <div className="p-1.5 bg-green-100 rounded">
                      <Image className="w-4 h-4 text-green-600" />
                    </div>
                    Scanned Invoice
                  </CardTitle>
                  {invoice.type === 'receipt' && (
                    <Badge variant="outline" className="text-xs border-orange-200 text-orange-700 bg-orange-50">
                      Required
                    </Badge>
                  )}
                  {invoice.type === 'return' && (
                    <Badge variant="outline" className="text-xs border-red-200 text-red-700 bg-red-50">
                      Required
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {invoice.invoiceImageUrl ? (
                  <div className="space-y-4">
                    {/* Image Preview */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                      <img 
                        src={invoice.invoiceImageUrl} 
                        alt="Scanned Invoice" 
                        className="w-full h-64 object-contain"
                      />
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => invoice.invoiceImageUrl && window.open(invoice.invoiceImageUrl, '_blank')}
                        className="flex items-center gap-2 border-slate-300"
                      >
                        <Eye className="w-4 h-4" />
                        View Full Size
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          if (invoice.invoiceImageUrl) {
                            const link = document.createElement('a');
                            link.href = invoice.invoiceImageUrl;
                            link.download = `invoice-${invoice.invoiceNumber}.jpg`;
                            link.click();
                          }
                        }}
                        className="flex items-center gap-2 border-slate-300"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </Button>
                    </div>

                    {/* Image Info */}
                    <div className="text-xs text-slate-600 bg-green-50 p-3 rounded-lg border border-green-100">
                      <p className="font-medium text-green-700">✓ Attachment uploaded</p>
                      {invoice.processedAt && (
                        <p className="text-slate-600 mt-1">Processed on {format(new Date(invoice.processedAt), 'MMM dd, yyyy • HH:mm')}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 border-2 border-dashed border-orange-200 rounded-lg bg-orange-50/30">
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <div className="p-4 bg-orange-100 rounded-full">
                          <AlertTriangle className="w-8 h-8 text-orange-600" />
                        </div>
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 text-base">No Scanned Copy Attached</h3>
                        <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
                          {invoice.type === 'receipt' 
                            ? 'Receipt invoices require a scanned copy for compliance and verification' 
                            : 'Return invoices require a scanned copy for proper documentation'
                          }
                        </p>
                      </div>
                      
                      {/* Upload Action */}
                      <div className="mt-4">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                          onClick={() => {
                            toast({
                              title: "Upload Invoice Scan",
                              description: "Please use the 'Scan Invoice' feature to add an attachment",
                            });
                          }}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Scanned Copy
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Invoice Items */}
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <div className="p-1.5 bg-indigo-100 rounded">
                    <Package className="w-4 h-4 text-indigo-600" />
                  </div>
                  Invoice Items
                  <Badge variant="outline" className="ml-auto text-xs border-slate-300">
                    {Array.isArray(invoiceItems) ? invoiceItems.length : 0} items
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {itemsLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-3 text-sm text-slate-500">Loading items...</p>
                  </div>
                ) : Array.isArray(invoiceItems) && invoiceItems.length > 0 ? (
                  <div className="space-y-3">
                    {invoiceItems.map((item: SupplierInvoiceItem, index: number) => (
                      <div key={item.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50 hover:bg-slate-100/70 transition-colors">
                        <div className="space-y-3">
                          {/* Header Row */}
                          <div className="flex justify-between items-start gap-3">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              <Badge variant="outline" className="text-xs font-mono border-slate-300 flex-shrink-0 mt-0.5">
                                #{item.srNo || index + 1}
                              </Badge>
                              <h4 className="font-semibold text-slate-900 text-sm leading-tight">{item.productName}</h4>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-bold text-lg text-blue-600">QR {(parseFloat(item.totalCost) || 0).toFixed(2)}</p>
                            </div>
                          </div>

                          {/* Product Identifiers */}
                          {(item.itemCode || item.barcode || item.sku) && (
                            <div className="flex flex-wrap gap-2">
                              {item.itemCode && (
                                <div className="inline-flex items-center gap-1.5 text-xs bg-white border border-slate-200 rounded px-2 py-1">
                                  <span className="text-slate-500">Code:</span>
                                  <span className="font-mono font-medium text-slate-700">{item.itemCode}</span>
                                </div>
                              )}
                              {item.barcode && (
                                <div className="inline-flex items-center gap-1.5 text-xs bg-white border border-slate-200 rounded px-2 py-1">
                                  <span className="text-slate-500">Barcode:</span>
                                  <span className="font-mono font-medium text-slate-700">{item.barcode}</span>
                                </div>
                              )}
                              {item.sku && (
                                <div className="inline-flex items-center gap-1.5 text-xs bg-white border border-slate-200 rounded px-2 py-1">
                                  <span className="text-slate-500">SKU:</span>
                                  <span className="font-mono font-medium text-slate-700">{item.sku}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Quantity and Pricing */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-500">Qty:</span>
                                <span className="font-semibold text-slate-900">{item.quantity}</span>
                                {item.uom && (
                                  <span className="text-slate-500">({item.uom})</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-500">Unit Price:</span>
                                <span className="font-semibold text-slate-900">QR {(parseFloat(item.unitCost) || 0).toFixed(2)}</span>
                              </div>
                            </div>
                            <div className="text-xs text-slate-500 font-mono">
                              {item.quantity} × QR {(parseFloat(item.unitCost) || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No items found</p>
                    <p className="text-sm mt-1">This invoice has no line items</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Financial Summary */}
          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="border-b border-slate-100 bg-gradient-to-br from-blue-50 to-indigo-50">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <div className="p-1.5 bg-blue-100 rounded">
                    <Coins className="w-4 h-4 text-blue-600" />
                  </div>
                  Financial Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">Subtotal:</span>
                    <span className="font-semibold text-slate-900">QR {(parseFloat(invoice.subtotal) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">Tax:</span>
                    <span className="font-semibold text-slate-900">QR {(parseFloat(invoice.tax || '0') || 0).toFixed(2)}</span>
                  </div>
                </div>
                
                <Separator className="bg-slate-200" />
                
                <div className="flex justify-between items-center py-2 px-3 bg-blue-50 rounded-lg">
                  <span className="font-bold text-slate-900">Total:</span>
                  <span className="font-bold text-xl text-blue-600">QR {(parseFloat(invoice.total) || 0).toFixed(2)}</span>
                </div>
                
                <Separator className="bg-slate-200" />
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">Paid:</span>
                    <span className="font-semibold text-green-600">QR {totalPaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 px-3 bg-orange-50 rounded-lg">
                    <span className="font-bold text-slate-900">Balance:</span>
                    <span className={`font-bold text-lg ${remainingBalance > 0 ? "text-orange-600" : "text-green-600"}`}>
                      QR {remainingBalance.toFixed(2)}
                    </span>
                  </div>
                </div>
                
                {isFullyPaid && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-semibold text-green-700 text-center">✓ Fully Paid</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <div className="p-1.5 bg-amber-100 rounded">
                    <Calendar className="w-4 h-4 text-amber-600" />
                  </div>
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-600 mb-0.5">Created</p>
                    <p className="text-sm font-semibold text-slate-900">{invoice.createdAt ? format(new Date(invoice.createdAt), 'MMM dd, yyyy') : 'N/A'}</p>
                    <p className="text-xs text-slate-500">{invoice.createdAt ? format(new Date(invoice.createdAt), 'HH:mm') : ''}</p>
                  </div>
                </div>
                {invoice.processedAt && (
                  <>
                    <div className="ml-1 h-6 w-px bg-slate-200"></div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full mt-1.5"></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-600 mb-0.5">Processed</p>
                        <p className="text-sm font-semibold text-slate-900">{format(new Date(invoice.processedAt), 'MMM dd, yyyy')}</p>
                        <p className="text-xs text-slate-500">{format(new Date(invoice.processedAt), 'HH:mm')}</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Supplier Info */}
            {supplier && (
              <Card className="border-slate-200 shadow-sm bg-white">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                    <div className="p-1.5 bg-teal-100 rounded">
                      <Truck className="w-4 h-4 text-teal-600" />
                    </div>
                    Supplier Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{supplier.name}</p>
                  </div>
                  {supplier.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-600">{supplier.email}</span>
                    </div>
                  )}
                  {supplier.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-600">{supplier.phone}</span>
                    </div>
                  )}
                  {supplier.address && (
                    <div className="flex items-start gap-2 text-sm pt-2 border-t border-slate-100">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-600">{supplier.address}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Payment Modal */}
        {showPaymentModal && (
          <PaymentModal
            isOpen={showPaymentModal}
            onClose={() => setShowPaymentModal(false)}
            invoice={invoice}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}