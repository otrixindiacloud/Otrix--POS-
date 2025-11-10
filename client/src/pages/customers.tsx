import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";
import { Search, Plus, CreditCard, User, Edit, Mail, Phone, MapPin, Coins, Upload, Eye, X } from "lucide-react";
import type { Customer } from "@shared/schema";
import MainLayout from "@/components/layout/main-layout";
import CustomerModal from "@/components/customers/customer-modal";
import CreditReconciliationModal from "@/components/customers/credit-reconciliation-modal";
import CustomerUploadModal from "@/components/customers/customer-upload-modal";
import { Skeleton } from "@/components/ui/skeleton-loader";
import LoadingSpinner from "@/components/ui/loading-spinner";

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [creditModalTab, setCreditModalTab] = useState<"new" | "history">("new");

  const { data: customers = [], isLoading, refetch: refetchCustomers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    refetchOnMount: true,
    staleTime: 0, // Always fetch fresh data
  });

  const handleAddCustomer = () => {
    setSelectedCustomer(null);
    setShowCustomerModal(true);
  };

  const handleViewCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowViewDialog(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowEditDialog(true);
  };

  const handleCreditReconciliation = (customer: Customer, tab: "new" | "history" = "new") => {
    setSelectedCustomer(customer);
    setCreditModalTab(tab);
    setShowCreditModal(true);
  };

  const handleCloseModal = () => {
    setShowCustomerModal(false);
    setSelectedCustomer(null);
  };

  const handleCloseViewDialog = () => {
    setShowViewDialog(false);
    setSelectedCustomer(null);
  };

  const handleCloseEditDialog = () => {
    setShowEditDialog(false);
    setSelectedCustomer(null);
  };

  const handleCloseCreditModal = async () => {
    setShowCreditModal(false);
    // Refetch customers to get updated credit balances
    const { data: updatedCustomers } = await refetchCustomers();
    // Update selectedCustomer with fresh data if it exists
    if (selectedCustomer && updatedCustomers) {
      const updatedCustomer = updatedCustomers.find(c => c.id === selectedCustomer.id);
      if (updatedCustomer) {
        setSelectedCustomer(updatedCustomer);
      }
    } else {
      setSelectedCustomer(null);
    }
  };

  const filteredCustomers = customers.filter((customer: Customer) =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone?.includes(searchQuery)
  );

  // Check if customer is newly created (within last 5 entries)
  const isNewCustomer = (customerId: number) => {
    const maxId = Math.max(...customers.map(c => c.id));
    return customerId >= maxId - 4; // Last 5 customers
  };

  // Header actions for desktop
  const headerActions = (
    <div className="flex items-center gap-3">
      <Button onClick={() => setShowUploadModal(true)} variant="outline" size="sm">
        <Upload className="w-4 h-4 mr-2" />
        Upload CSV/Excel
      </Button>
      <Button onClick={handleAddCustomer} size="sm">
        <Plus className="w-4 h-4 mr-2" />
        Add Customer
      </Button>
      <Badge variant="outline" className="text-xs">
        {filteredCustomers.length} Customers
      </Badge>
    </div>
  );

  // Header actions for mobile
  const mobileHeaderActions = (
    <div className="flex items-center gap-2">
      <Button onClick={handleAddCustomer} size="sm" variant="ghost">
        <Plus className="w-5 h-5" />
      </Button>
    </div>
  );

  return (
    <MainLayout 
      headerActions={headerActions}
      mobileHeaderActions={mobileHeaderActions}
    >
      <div className="p-4 sm:p-6">
        {/* Professional Header Section */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-xl border border-blue-100 dark:border-blue-900 p-6 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="bg-blue-600 dark:bg-blue-500 rounded-lg p-3 shadow-md">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Customer Management
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm sm:text-base">
                  Manage customer accounts and credit balances
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs sm:text-sm px-3 py-1.5 bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-800">
                <User className="w-3 h-3 mr-1.5" />
                {filteredCustomers.length} Customers
              </Badge>
            </div>
          </div>
        </div>

        {/* Search and Action Bar */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-400"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowUploadModal(true)} variant="outline" className="flex-1 sm:flex-none border-slate-200 dark:border-slate-700 hover:bg-blue-500 dark:hover:bg-slate-800">
                <Upload className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Upload CSV/Excel</span>
                <span className="sm:hidden">Upload</span>
              </Button>
              <Button onClick={handleAddCustomer} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
                <Plus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Add Customer</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>
          </div>
        </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/3"></div>
                  </div>
                  <div className="h-8 w-24 bg-slate-200 rounded"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-md">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-900">
                    <TableHead className="font-semibold">Customer</TableHead>
                    <TableHead className="font-semibold hidden md:table-cell">Contact</TableHead>
                    <TableHead className="font-semibold hidden lg:table-cell">Address</TableHead>
                    <TableHead className="font-semibold text-right">Credit Info</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer: Customer) => (
                    <TableRow 
                      key={customer.id} 
                      className="hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer transition-colors"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={customer.profileImage || ""} />
                            <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold text-sm">
                              {customer.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-slate-900 dark:text-white">
                                {customer.name}
                              </p>
                              {isNewCustomer(customer.id) && (
                                <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-green-500 hover:bg-green-600">
                                  NEW
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">ID: {customer.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell className="hidden md:table-cell">
                        <div className="space-y-1">
                          {customer.email && (
                            <div className="flex items-center gap-1.5 text-sm text-slate-600">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              <span className="truncate max-w-[200px]">{customer.email}</span>
                            </div>
                          )}
                          {customer.phone && (
                            <div className="flex items-center gap-1.5 text-sm text-slate-600">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{customer.phone}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell className="hidden lg:table-cell">
                        {customer.address ? (
                          <div className="flex items-center gap-1.5 text-sm text-slate-600">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="truncate max-w-[250px]">{customer.address}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </TableCell>
                      
                      <TableCell className="text-right">
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-end items-center gap-2">
                            <span className="text-slate-500">Limit:</span>
                            <span className="font-medium">QR {Number(customer.creditLimit || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-end items-center gap-2">
                            <span className="text-slate-500">Balance:</span>
                            <Badge 
                              variant={Number(customer.creditBalance || 0) > 0 ? "destructive" : "default"}
                              className="text-xs"
                            >
                              QR {Number(customer.creditBalance || 0).toFixed(2)}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewCustomer(customer)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditCustomer(customer)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCreditReconciliation(customer)}
                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                          >
                            <Coins className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && filteredCustomers.length === 0 && (
        <div className="text-center py-12">
          <User className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-600 mb-2">
            {searchQuery ? "No customers found" : "No customers yet"}
          </h3>
          <p className="text-slate-500 mb-4">
            {searchQuery 
              ? "Try adjusting your search terms" 
              : "Start by adding your first customer"
            }
          </p>
          {!searchQuery && (
            <Button onClick={handleAddCustomer}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Customer
            </Button>
          )}
        </div>
      )}

      <CustomerModal
        isOpen={showCustomerModal}
        onClose={handleCloseModal}
        customer={selectedCustomer}
      />

      {selectedCustomer && (
        <CreditReconciliationModal
          isOpen={showCreditModal}
          onClose={handleCloseCreditModal}
          customer={selectedCustomer}
          initialTab={creditModalTab}
        />
      )}

      <CustomerUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />

      {/* View Customer Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="text-2xl font-bold">Customer Details</DialogTitle>
              {selectedCustomer && (
                <Badge variant="outline" className="text-sm">
                  ID: {selectedCustomer.id}
                </Badge>
              )}
            </div>
            <DialogDescription>
              Complete information about this customer
            </DialogDescription>
          </DialogHeader>
          
          {selectedCustomer && (
            <div className="space-y-6 py-4">
              {/* Customer Profile */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={selectedCustomer.profileImage || ""} />
                  <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold text-xl">
                    {selectedCustomer.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {selectedCustomer.name}
                  </h3>
                  <p className="text-sm text-slate-500">Customer #{selectedCustomer.id}</p>
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Contact Information
                </h4>
                <div className="space-y-3 pl-6">
                  {selectedCustomer.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Email</p>
                        <p className="text-sm font-medium">{selectedCustomer.email}</p>
                      </div>
                    </div>
                  )}
                  {selectedCustomer.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Phone</p>
                        <p className="text-sm font-medium">{selectedCustomer.phone}</p>
                      </div>
                    </div>
                  )}
                  {selectedCustomer.address && (
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Address</p>
                        <p className="text-sm font-medium">{selectedCustomer.address}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Credit Information */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Credit Account
                </h4>
                <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/30 dark:to-blue-950/30 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Credit Limit</span>
                    <span className="text-lg font-bold text-slate-900 dark:text-white">
                      QR {Number(selectedCustomer.creditLimit || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Current Balance</span>
                    <Badge 
                      variant={Number(selectedCustomer.creditBalance || 0) > 0 ? "destructive" : "default"}
                      className="text-lg font-bold px-3 py-1"
                    >
                      QR {Number(selectedCustomer.creditBalance || 0).toFixed(2)}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Available Credit</span>
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">
                      QR {(Number(selectedCustomer.creditLimit || 0) - Number(selectedCustomer.creditBalance || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={() => {
                    setShowViewDialog(false);
                    handleEditCustomer(selectedCustomer);
                  }}
                  className="flex-1"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Customer
                </Button>
                <Button
                  onClick={() => {
                    setShowViewDialog(false);
                    handleCreditReconciliation(selectedCustomer, "history");
                  }}
                  variant="outline"
                  className="flex-1 border-green-200 text-green-600 hover:bg-green-500"
                >
                  <Coins className="w-4 h-4 mr-2" />
                  Transaction History
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="text-2xl font-bold">Edit Customer</DialogTitle>
              {selectedCustomer && (
                <Badge variant="outline" className="text-sm">
                  ID: {selectedCustomer.id}
                </Badge>
              )}
            </div>
            <DialogDescription>
              Update customer information and credit settings
            </DialogDescription>
          </DialogHeader>
          
          {selectedCustomer && (
            <CustomerModal
              isOpen={showEditDialog}
              onClose={handleCloseEditDialog}
              customer={selectedCustomer}
            />
          )}
        </DialogContent>
      </Dialog>
      </div>
    </MainLayout>
  );
}