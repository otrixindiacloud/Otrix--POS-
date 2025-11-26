import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePOSStore } from "@/lib/pos-store";
import { useStore } from "@/hooks/useStore";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  User, 
  Plus, 
  CreditCard, 
  Phone,
  Mail,
  MapPin,
  X,
  Store as StoreIcon
} from "lucide-react";
import type { Customer, Store } from "@shared/schema";
import CustomerModal from "../customers/customer-modal";

interface CustomerSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CustomerSearchModal({ isOpen, onClose }: CustomerSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const { setCurrentCustomer } = usePOSStore();
  const { currentStore } = useStore();

  const storeQueryParam = currentStore?.id ? `?storeId=${currentStore.id}` : "";
  
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers", currentStore?.id],
    queryFn: async () => {
      const response = await fetch(`/api/customers${storeQueryParam}`);
      if (!response.ok) throw new Error('Failed to fetch customers');
      return response.json();
    },
    enabled: isOpen && !!currentStore?.id,
  });

  const { data: stores = [] } = useQuery<Store[]>({
    queryKey: ["/api/stores/active"],
    enabled: isOpen,
  });

  const filteredCustomers = customers.filter((customer: Customer) =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone?.includes(searchQuery)
  );

  const getStoreName = (storeId: number | null | undefined) => {
    if (!storeId) return "No Store";
    const store = stores.find(s => s.id === storeId);
    return store?.name || `Store #${storeId}`;
  };

  const handleSelectCustomer = (customer: Customer) => {
    setCurrentCustomer(customer);
    onClose();
  };

  const handleAddNewCustomer = () => {
    setShowCustomerModal(true);
  };

  const handleCustomerModalClose = () => {
    setShowCustomerModal(false);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <User className="w-5 h-5 mr-2" />
              Select Customer
            </DialogTitle>
            <DialogDescription>
              Search and select a customer for this transaction
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search customers by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Add New Customer Button */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">
                  {filteredCustomers.length} customer(s) found
                </span>
                {currentStore && (
                  <Badge variant="outline" className="text-xs">
                    <StoreIcon className="w-3 h-3 mr-1" />
                    {currentStore.name}
                  </Badge>
                )}
              </div>
              <Button onClick={handleAddNewCustomer} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add New Customer
              </Button>
            </div>

            {/* Customer List */}
            <div className="max-h-96 overflow-y-auto space-y-2">
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <User className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  {!currentStore ? (
                    <>
                      <p>Please select a store</p>
                      <p className="text-sm">Select a store to view customers</p>
                    </>
                  ) : (
                    <>
                      <p>No customers found</p>
                      <p className="text-sm">Try adjusting your search or add a new customer</p>
                    </>
                  )}
                </div>
              ) : (
                filteredCustomers.map((customer: Customer) => (
                  <Card 
                    key={customer.id} 
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleSelectCustomer(customer)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-4">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={customer.profileImage || ""} />
                          <AvatarFallback className="bg-blue-100 text-blue-700">
                            {customer.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-slate-800">{customer.name}</h4>
                              {customer.storeId && (
                                <Badge variant="secondary" className="text-xs">
                                  <StoreIcon className="w-3 h-3 mr-1" />
                                  {getStoreName(customer.storeId)}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              {Number(customer.creditBalance || 0) > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  <CreditCard className="w-3 h-3 mr-1" />
                                  Balance: ${Number(customer.creditBalance || 0).toFixed(2)}
                                </Badge>
                              )}
                              {Number(customer.creditLimit || 0) > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  Limit: ${Number(customer.creditLimit || 0).toFixed(2)}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="mt-2 space-y-1">
                            {customer.email && (
                              <div className="flex items-center text-sm text-slate-600">
                                <Mail className="w-3 h-3 mr-2" />
                                <span className="truncate">{customer.email}</span>
                              </div>
                            )}
                            {customer.phone && (
                              <div className="flex items-center text-sm text-slate-600">
                                <Phone className="w-3 h-3 mr-2" />
                                <span>{customer.phone}</span>
                              </div>
                            )}
                            {customer.address && (
                              <div className="flex items-center text-sm text-slate-600">
                                <MapPin className="w-3 h-3 mr-2" />
                                <span className="truncate">{customer.address}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CustomerModal
        isOpen={showCustomerModal}
        onClose={handleCustomerModalClose}
      />
    </>
  );
}