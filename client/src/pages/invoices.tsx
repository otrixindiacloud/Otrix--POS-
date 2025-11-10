import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Search, 
  Plus, 
  Camera, 
  FileText, 
  Truck, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Eye,
  Edit,
  Coins,
  Filter,
  Calendar,
  SortAsc,
  SortDesc,
  X,
  Upload,
  CreditCard,
  User,
  Phone,
  Mail,
  Image,
  ImageOff,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import type { Supplier, SupplierInvoice } from "@shared/schema";
import MainLayout from "@/components/layout/main-layout";
import { Link } from "wouter";

import EnhancedInvoiceModal from "@/components/inventory/enhanced-invoice-modal";
import SupplierModal from "@/components/inventory/supplier-modal";
import InvoiceDetailModal from "@/components/inventory/invoice-detail-modal";
import SupplierUploadModal from "@/components/inventory/supplier-upload-modal";
import InvoiceWizardModal from "@/components/inventory/invoice-wizard-modal";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton-loader";
import LoadingSpinner from "@/components/ui/loading-spinner";

export default function Invoices() {
  const [searchQuery, setSearchQuery] = useState("");

  const [showEnhancedInvoiceModal, setShowEnhancedInvoiceModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showSupplierUploadModal, setShowSupplierUploadModal] = useState(false);
  const [showInvoiceWizard, setShowInvoiceWizard] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<SupplierInvoice | null>(null);
  const [showInvoiceDetail, setShowInvoiceDetail] = useState(false);

  
  // Enhanced filtering state
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [attachmentFilter, setAttachmentFilter] = useState("all");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);

  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<SupplierInvoice[]>({
    queryKey: ["/api/supplier-invoices"],
  });



  const handleCreateInvoice = (type: 'receipt' | 'return') => {
    setShowEnhancedInvoiceModal(true);
  };

  const handleAddSupplier = () => {
    setSelectedSupplier(null);
    setShowSupplierModal(true);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowSupplierModal(true);
  };

  const handleViewInvoice = (invoice: SupplierInvoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceDetail(true);
  };

  const handleEditInvoice = (invoice: SupplierInvoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceDetail(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'success';
      case 'pending': return 'warning';
      case 'overdue': return 'destructive';
      case 'cancelled': return 'secondary';
      default: return 'default';
    }
  };

  const getPaymentStatusColor = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'paid': return 'bg-green-100 text-green-800 border-green-200';
      case 'partially_paid': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'paid_by_card': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'not_paid': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPaymentStatusIcon = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'paid': return <CheckCircle className="w-3 h-3" />;
      case 'partially_paid': return <Clock className="w-3 h-3" />;
      case 'paid_by_card': return <CreditCard className="w-3 h-3" />;
      case 'not_paid': return <AlertTriangle className="w-3 h-3" />;
      default: return <Clock className="w-3 h-3" />;
    }
  };

  const getTypeIcon = (type: string) => {
    return type === 'return' ? <AlertTriangle className="w-4 h-4" /> : <FileText className="w-4 h-4" />;
  };

  const filteredSuppliers = suppliers.filter((supplier: Supplier) =>
    supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    supplier.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Enhanced filtering for invoices
  const baseFilteredInvoices = invoices.filter((invoice: SupplierInvoice) => {
    const supplier = suppliers.find((s: Supplier) => s.id === invoice.supplierId);
    
    // Text search filter
    const matchesSearch = searchQuery === "" || (
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (supplier && supplier.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      invoice.notes?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    // Status filter
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    
    // Type filter
    const matchesType = typeFilter === "all" || invoice.type === typeFilter;
    
    // Supplier filter
    const matchesSupplier = supplierFilter === "all" || invoice.supplierId.toString() === supplierFilter;
    
    // Attachment filter
    const matchesAttachment = attachmentFilter === "all" || 
      (attachmentFilter === "has_attachment" && invoice.invoiceImageUrl) ||
      (attachmentFilter === "missing_attachment" && !invoice.invoiceImageUrl);
    
    // Date range filter
    const invoiceDate = new Date(invoice.invoiceDate);
    const matchesDateRange = (!dateRange.from || invoiceDate >= new Date(dateRange.from)) &&
                            (!dateRange.to || invoiceDate <= new Date(dateRange.to));
    
    return matchesSearch && matchesStatus && matchesType && matchesSupplier && matchesAttachment && matchesDateRange;
  });

  // Enhanced sorting
  const filteredInvoices = [...baseFilteredInvoices].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case "date":
        comparison = new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime();
        break;
      case "amount":
        comparison = parseFloat(a.total) - parseFloat(b.total);
        break;
      case "supplier":
        const supplierA = suppliers.find(s => s.id === a.supplierId)?.name || "";
        const supplierB = suppliers.find(s => s.id === b.supplierId)?.name || "";
        comparison = supplierA.localeCompare(supplierB);
        break;
      case "invoice":
        comparison = a.invoiceNumber.localeCompare(b.invoiceNumber);
        break;
      case "status":
        comparison = a.status.localeCompare(b.status);
        break;
      default:
        comparison = 0;
    }
    
    return sortOrder === "desc" ? -comparison : comparison;
  });

  // Clear all filters function
  const clearAllFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
    setSupplierFilter("all");
    setAttachmentFilter("all");
    setDateRange({ from: "", to: "" });
    setSortBy("date");
    setSortOrder("desc");
  };

  // Check if any filters are active
  const hasActiveFilters = searchQuery !== "" || statusFilter !== "all" || 
                          typeFilter !== "all" || supplierFilter !== "all" ||
                          attachmentFilter !== "all" ||
                          dateRange.from !== "" || dateRange.to !== "";

  const pendingInvoices = invoices.filter((inv: SupplierInvoice) => inv.status === 'pending');
  const totalPendingAmount = pendingInvoices.reduce((sum: number, inv: SupplierInvoice) => 
    sum + parseFloat(inv.total), 0
  );

  // Attachment statistics
  const invoicesWithAttachments = invoices.filter((inv: SupplierInvoice) => inv.invoiceImageUrl);
  const invoicesWithoutAttachments = invoices.filter((inv: SupplierInvoice) => !inv.invoiceImageUrl);
  const mandatoryAttachmentInvoices = invoices.filter((inv: SupplierInvoice) => 
    inv.type === 'receipt' || inv.type === 'return'
  );
  const mandatoryMissingAttachments = mandatoryAttachmentInvoices.filter((inv: SupplierInvoice) => 
    !inv.invoiceImageUrl
  );

  return (
    <MainLayout>
      <div className="p-6">
        {/* Professional Header */}
        <Card className="border-none shadow-sm bg-teal-50 dark:bg-teal-950/20 mb-6">
          <CardHeader className="pb-8">
            <div className="flex items-start gap-4">
              {/* Icon Badge */}
              <div className="flex-shrink-0 bg-teal-600 rounded-xl p-3 shadow-lg">
                <FileText className="h-8 w-8 text-white" />
              </div>
              
              {/* Title and Description */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                    Invoice Management
                  </h1>
                  <Badge className="bg-teal-500 hover:bg-teal-600 text-white">
                    {invoices.length} Invoices
                  </Badge>
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-base leading-relaxed">
                  Manage supplier invoices, receipts, and returns with AI processing and automated workflows.
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Suppliers</p>
                  <p className="text-2xl font-bold">{suppliers.length}</p>
                </div>
                <Truck className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Invoices</p>
                  <p className="text-2xl font-bold">{invoices.length}</p>
                  <p className="text-xs text-slate-500">
                    {filteredInvoices.length !== invoices.length && `(${filteredInvoices.length} filtered)`}
                  </p>
                </div>
                <FileText className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Pending</p>
                  <p className="text-2xl font-bold">{pendingInvoices.length}</p>
                  <p className="text-xs text-orange-600 font-medium">QR {totalPendingAmount.toFixed(2)}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Paid</p>
                  <p className="text-2xl font-bold">
                    {invoices.filter((inv: SupplierInvoice) => inv.status === 'paid').length}
                  </p>
                  <p className="text-xs text-green-600 font-medium">
                    ${invoices.filter((inv: SupplierInvoice) => inv.status === 'paid')
                      .reduce((sum: number, inv: SupplierInvoice) => sum + parseFloat(inv.total), 0).toFixed(2)}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Missing Scans</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {mandatoryMissingAttachments.length}
                  </p>
                  <p className="text-xs text-gray-500">
                    of {mandatoryAttachmentInvoices.length} mandatory
                  </p>
                </div>
                <ImageOff className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Search and Filter Bar */}
        <div className="space-y-4 mb-6">
          {/* Main Search and Action Buttons */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search invoices by number, supplier, or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={() => setShowInvoiceWizard(true)} 
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Camera className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Scan Invoice</span>
                <span className="sm:hidden">Scan</span>
              </Button>
              <Link href="/invoices/create">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Create Invoice</span>
                  <span className="sm:hidden">Create</span>
                </Button>
              </Link>
            </div>
            

            
            <div className="flex gap-2">
              <Button onClick={() => setShowSupplierUploadModal(true)} variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                Upload CSV/Excel
              </Button>
              <Button onClick={handleAddSupplier}>
                <Plus className="w-4 h-4 mr-2" />
                Add Supplier
              </Button>
            </div>
          </div>

          {/* Filter Controls */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">Filters:</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="h-8"
              >
                {showFilters ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-1" />
                    Hide Filters
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-1" />
                    Show Filters
                  </>
                )}
              </Button>
            </div>
            
            {showFilters && (
              <>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Status:</label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Type:</label>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="receipt">Receipt</SelectItem>
                        <SelectItem value="return">Return</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Supplier:</label>
                    <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Suppliers</SelectItem>
                        {suppliers.map((supplier: Supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id.toString()}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Attachment:</label>
                    <Select value={attachmentFilter} onValueChange={setAttachmentFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="has_attachment">Has Scan</SelectItem>
                        <SelectItem value="missing_attachment">Missing Scan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <Input
                      type="date"
                      placeholder="From"
                      value={dateRange.from}
                      onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                      className="w-36"
                    />
                    <span className="text-sm text-gray-500">to</span>
                    <Input
                      type="date"
                      placeholder="To"
                      value={dateRange.to}
                      onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                      className="w-36"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Sort:</label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="amount">Amount</SelectItem>
                        <SelectItem value="supplier">Supplier</SelectItem>
                        <SelectItem value="invoice">Invoice #</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                    >
                      {sortOrder === "asc" ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                    </Button>
                  </div>

                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearAllFilters}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Clear All
                    </Button>
                  )}
                </div>

                {/* Filter Summary */}
                {hasActiveFilters && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>Showing {filteredInvoices.length} of {invoices.length} invoices</span>
                      {searchQuery && <Badge variant="outline">Search: "{searchQuery}"</Badge>}
                      {statusFilter !== "all" && <Badge variant="outline">Status: {statusFilter}</Badge>}
                      {typeFilter !== "all" && <Badge variant="outline">Type: {typeFilter}</Badge>}
                      {supplierFilter !== "all" && (
                        <Badge variant="outline">
                          Supplier: {suppliers.find(s => s.id.toString() === supplierFilter)?.name}
                        </Badge>
                      )}
                      {attachmentFilter !== "all" && (
                        <Badge variant="outline">
                          Attachment: {attachmentFilter === "has_attachment" ? "Has Scan" : "Missing Scan"}
                        </Badge>
                      )}
                      {(dateRange.from || dateRange.to) && (
                        <Badge variant="outline">
                          Date: {dateRange.from || "Start"} - {dateRange.to || "End"}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>

        <Tabs defaultValue="invoices" className="space-y-6">
          <TabsList>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="space-y-4">
            {invoicesLoading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="animate-pulse flex items-center gap-4 p-4 border border-slate-200 rounded-lg">
                        <div className="h-4 bg-slate-200 rounded w-32"></div>
                        <div className="h-4 bg-slate-200 rounded flex-1"></div>
                        <div className="h-4 bg-slate-200 rounded w-24"></div>
                        <div className="h-4 bg-slate-200 rounded w-20"></div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-slate-200 dark:border-slate-800">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-900">
                        <TableHead className="font-bold">Invoice #</TableHead>
                        <TableHead className="font-bold">Supplier</TableHead>
                        <TableHead className="font-bold">Type</TableHead>
                        <TableHead className="font-bold">Date</TableHead>
                        <TableHead className="font-bold">Due Date</TableHead>
                        <TableHead className="font-bold text-right">Amount</TableHead>
                        <TableHead className="font-bold">Status</TableHead>
                        <TableHead className="font-bold">Payment</TableHead>
                        <TableHead className="font-bold text-center">Scan</TableHead>
                        <TableHead className="font-bold text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices.map((invoice: SupplierInvoice) => {
                        const supplier = suppliers.find((s: Supplier) => s.id === invoice.supplierId);
                        const isOverdue = invoice.dueDate && new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid';
                        return (
                          <TableRow 
                            key={invoice.id} 
                            className={`hover:bg-slate-50 dark:hover:bg-slate-900 ${isOverdue ? 'bg-red-50 dark:bg-red-950/10' : ''}`}
                          >
                            {/* Invoice Number */}
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {getTypeIcon(invoice.type)}
                                <span>{invoice.invoiceNumber}</span>
                              </div>
                              {invoice.customerName && (
                                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {invoice.customerName}
                                </div>
                              )}
                            </TableCell>

                            {/* Supplier */}
                            <TableCell>
                              <div>
                                <div className="font-medium text-slate-900 dark:text-white">{supplier?.name || 'Unknown'}</div>
                                {supplier?.email && (
                                  <div className="text-xs text-slate-500">{supplier.email}</div>
                                )}
                              </div>
                            </TableCell>

                            {/* Type */}
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={invoice.type === 'return' ? 'border-orange-300 text-orange-700 bg-orange-50' : 'border-blue-300 text-blue-700 bg-blue-50'}
                              >
                                {invoice.type.toUpperCase()}
                              </Badge>
                            </TableCell>

                            {/* Invoice Date */}
                            <TableCell className="whitespace-nowrap">
                              {format(new Date(invoice.invoiceDate), 'MMM dd, yyyy')}
                            </TableCell>

                            {/* Due Date */}
                            <TableCell className="whitespace-nowrap">
                              {invoice.dueDate ? (
                                <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>
                                  {format(new Date(invoice.dueDate), 'MMM dd, yyyy')}
                                  {isOverdue && (
                                    <Badge variant="destructive" className="ml-2 text-xs">
                                      OVERDUE
                                    </Badge>
                                  )}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </TableCell>

                            {/* Amount */}
                            <TableCell className="text-right">
                              <div className="font-semibold text-slate-900 dark:text-white">
                                QR {parseFloat(invoice.total).toFixed(2)}
                              </div>
                              <div className="text-xs text-slate-500">
                                Tax: QR {parseFloat(invoice.tax || '0').toFixed(2)}
                              </div>
                            </TableCell>

                            {/* Status */}
                            <TableCell>
                              <Badge variant={getStatusColor(invoice.status) as any}>
                                {invoice.status.toUpperCase()}
                              </Badge>
                            </TableCell>

                            {/* Payment Status */}
                            <TableCell>
                              {invoice.paymentStatus && (
                                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border font-medium ${getPaymentStatusColor(invoice.paymentStatus)}`}>
                                  {getPaymentStatusIcon(invoice.paymentStatus)}
                                  <span>
                                    {invoice.paymentStatus.replace('_', ' ').toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </TableCell>

                            {/* Scan Status */}
                            <TableCell className="text-center">
                              {invoice.invoiceImageUrl ? (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs bg-green-50 border border-green-200 text-green-700 font-medium">
                                  <Image className="w-3.5 h-3.5" />
                                  <span>Scanned</span>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs bg-orange-50 border border-orange-200 text-orange-700 font-medium">
                                  <ImageOff className="w-3.5 h-3.5" />
                                  <span>No Scan</span>
                                </div>
                              )}
                            </TableCell>

                            {/* Actions */}
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleViewInvoice(invoice)}
                                  className="h-8"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {invoice.status !== 'paid' && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleViewInvoice(invoice)}
                                    className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  >
                                    <Coins className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}

            {!invoicesLoading && filteredInvoices.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    {searchQuery || hasActiveFilters ? "No invoices found" : "No invoices yet"}
                  </h3>
                  <p className="text-slate-500 mb-6">
                    {searchQuery || hasActiveFilters
                      ? "Try adjusting your search terms or filters" 
                      : "Start by creating your first invoice"
                    }
                  </p>
                  {!searchQuery && !hasActiveFilters && (
                    <Link href="/invoices/create">
                      <Button className="bg-teal-600 hover:bg-teal-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Create First Invoice
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="suppliers" className="space-y-4">
            {suppliersLoading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="animate-pulse flex items-center gap-4 p-4 border border-slate-200 rounded-lg">
                        <div className="h-4 bg-slate-200 rounded w-48"></div>
                        <div className="h-4 bg-slate-200 rounded flex-1"></div>
                        <div className="h-4 bg-slate-200 rounded w-32"></div>
                        <div className="h-4 bg-slate-200 rounded w-24"></div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-slate-200 dark:border-slate-800">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-900">
                        <TableHead className="font-bold">Supplier Name</TableHead>
                        <TableHead className="font-bold">Contact Person</TableHead>
                        <TableHead className="font-bold">Email</TableHead>
                        <TableHead className="font-bold">Phone</TableHead>
                        <TableHead className="font-bold">Payment Terms</TableHead>
                        <TableHead className="font-bold text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSuppliers.map((supplier: Supplier) => (
                        <TableRow 
                          key={supplier.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-900"
                        >
                          {/* Supplier Name */}
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Truck className="w-4 h-4 text-slate-500" />
                              <span className="text-slate-900 dark:text-white">{supplier.name}</span>
                            </div>
                          </TableCell>

                          {/* Contact Person */}
                          <TableCell>
                            {supplier.contactPerson ? (
                              <div className="flex items-center gap-2">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                <span>{supplier.contactPerson}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </TableCell>

                          {/* Email */}
                          <TableCell>
                            {supplier.email ? (
                              <div className="flex items-center gap-2">
                                <Mail className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-slate-700 dark:text-slate-300">{supplier.email}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </TableCell>

                          {/* Phone */}
                          <TableCell>
                            {supplier.phone ? (
                              <div className="flex items-center gap-2">
                                <Phone className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-slate-700 dark:text-slate-300">{supplier.phone}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </TableCell>

                          {/* Payment Terms */}
                          <TableCell>
                            {supplier.paymentTerms ? (
                              <Badge variant="outline" className="font-medium">
                                {supplier.paymentTerms}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEditSupplier(supplier)}
                              className="h-8"
                            >
                              <Edit className="w-4 h-4 mr-1.5" />
                              <span>Edit</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}

            {!suppliersLoading && filteredSuppliers.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <Truck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    {searchQuery ? "No suppliers found" : "No suppliers yet"}
                  </h3>
                  <p className="text-slate-500 mb-6">
                    {searchQuery 
                      ? "Try adjusting your search terms" 
                      : "Start by adding your first supplier"
                    }
                  </p>
                  {!searchQuery && (
                    <Button onClick={handleAddSupplier} className="bg-teal-600 hover:bg-teal-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Supplier
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Modals */}

        <InvoiceWizardModal
          isOpen={showInvoiceWizard}
          onClose={() => setShowInvoiceWizard(false)}
        />

        <EnhancedInvoiceModal
          isOpen={showEnhancedInvoiceModal}
          onClose={() => setShowEnhancedInvoiceModal(false)}
          type="receipt"
        />

        <SupplierModal
          isOpen={showSupplierModal}
          onClose={() => setShowSupplierModal(false)}
          supplier={selectedSupplier}
        />

        <SupplierUploadModal
          isOpen={showSupplierUploadModal}
          onClose={() => setShowSupplierUploadModal(false)}
        />

        {showInvoiceDetail && selectedInvoice && (
          <InvoiceDetailModal
            isOpen={showInvoiceDetail}
            onClose={() => {
              setShowInvoiceDetail(false);
              setSelectedInvoice(null);
            }}
            invoice={selectedInvoice}
            supplier={suppliers.find(s => s.id === selectedInvoice.supplierId)}
          />
        )}
      </div>
    </MainLayout>
  );
}