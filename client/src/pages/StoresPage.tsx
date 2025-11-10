import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Store, type InsertStore } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, Users, MapPin, Phone, Mail, Edit, Settings, ArrowLeft } from "lucide-react";
import { StoreModal } from "@/components/StoreModal";
import { StoreProductsModal } from "@/components/StoreProductsModal";
import { useToast } from "@/hooks/use-toast";
import MainLayout from "@/components/layout/main-layout";

export function StoresPage() {
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [isProductsModalOpen, setIsProductsModalOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stores = [], isLoading } = useQuery<Store[]>({
    queryKey: ["/api/stores"],
  });

  const createStoreMutation = useMutation({
    mutationFn: async (storeData: InsertStore) => {
      const response = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      setIsStoreModalOpen(false);
      toast({ title: "Store created successfully" });
    },
    onError: (error: Error) => {
      console.error("Store creation error:", error);
      let errorMessage = "Failed to create store";
      
      if (error.message.includes("403") || error.message.includes("Insufficient permissions")) {
        errorMessage = "You don't have permission to create stores";
      } else if (error.message.includes("400") || error.message.includes("Invalid")) {
        errorMessage = "Invalid store data provided";
      } else if (error.message.includes("401") || error.message.includes("Unauthorized")) {
        errorMessage = "Please log in to continue";
      } else if (error.message.includes("duplicate") || error.message.includes("unique")) {
        errorMessage = "Store code already exists";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({ 
        title: "Creation Failed", 
        description: errorMessage,
        variant: "destructive" 
      });
    },
  });

  const updateStoreMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertStore> }) => {
      const response = await fetch(`/api/stores/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      setIsStoreModalOpen(false);
      setSelectedStore(null);
      toast({ title: "Store updated successfully" });
    },
    onError: (error: Error) => {
      console.error("Store update error:", error);
      let errorMessage = "Failed to update store";
      
      if (error.message.includes("403") || error.message.includes("Insufficient permissions")) {
        errorMessage = "You don't have permission to update stores";
      } else if (error.message.includes("404") || error.message.includes("Store not found")) {
        errorMessage = "Store not found";
      } else if (error.message.includes("400") || error.message.includes("Invalid")) {
        errorMessage = "Invalid store data provided";
      } else if (error.message.includes("401") || error.message.includes("Unauthorized")) {
        errorMessage = "Please log in to continue";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({ 
        title: "Update Failed", 
        description: errorMessage,
        variant: "destructive" 
      });
    },
  });

  const handleCreateStore = (storeData: InsertStore) => {
    createStoreMutation.mutate(storeData);
  };

  const handleUpdateStore = (storeData: InsertStore) => {
    if (selectedStore) {
      updateStoreMutation.mutate({ id: selectedStore.id, data: storeData });
    }
  };

  const handleEditStore = (store: Store) => {
    setSelectedStore(store);
    setIsStoreModalOpen(true);
  };

  const handleManageProducts = (store: Store) => {
    setSelectedStore(store);
    setIsProductsModalOpen(true);
  };

  const headerSection = (
    <div className="space-y-6">
      {/* Professional Header Section */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-xl border border-blue-100 dark:border-blue-900 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="bg-blue-600 dark:bg-blue-500 rounded-lg p-3 shadow-md">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                Store Management
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm sm:text-base">
                Manage your store locations and settings
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs sm:text-sm px-3 py-1.5 bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-800">
              <Building2 className="w-3 h-3 mr-1.5" />
              {stores.length} {stores.length === 1 ? 'Store' : 'Stores'}
            </Badge>
            <Button 
              onClick={() => setIsStoreModalOpen(true)} 
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Add Store</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  let content;

  if (isLoading) {
    content = (
      <div className="space-y-6">
        {headerSection}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, index) => (
            <Card key={index} className="animate-pulse">
              <CardHeader>
                <div className="h-4 w-3/4 rounded bg-gray-200" />
                <div className="h-3 w-1/2 rounded bg-gray-200" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 rounded bg-gray-200" />
                  <div className="h-3 w-2/3 rounded bg-gray-200" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  } else {
    content = (
      <div className="space-y-6">
        {headerSection}

        {stores.length === 0 ? (
          <Card className="border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <CardContent className="py-16 text-center">
              <div className="flex justify-center mb-6">
                <div className="bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-full p-6 shadow-lg">
                  <Building2 className="h-16 w-16 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                No stores found
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
                Get started by creating your first store location to begin managing your business operations.
              </p>
              <Button 
                onClick={() => setIsStoreModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 shadow-md hover:shadow-lg transition-all duration-200"
                size="lg"
              >
                <Plus className="mr-2 h-5 w-5" />
                Create Your First Store
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => (
              <Card 
                key={store.id} 
                className="group relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1"
              >
                {/* Active Status Indicator - Top Right */}
                <div className="absolute top-4 right-4 z-10">
                  <Badge 
                    className={`font-semibold px-3 py-1 text-xs shadow-md ${
                      store.isActive 
                        ? 'bg-green-500 hover:bg-green-600 text-white' 
                        : 'bg-slate-300 text-slate-700'
                    }`}
                  >
                    {store.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <CardHeader className="pb-3">
                  {/* Store Header with Icon and Name */}
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-3.5 shadow-lg group-hover:shadow-xl transition-shadow">
                      <Building2 className="h-7 w-7 text-white" />
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1.5 truncate">
                        {store.name}
                      </h3>
                      <Badge 
                        variant="outline" 
                        className="font-mono text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                      >
                        {store.code}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-0">
                  {/* Contact Information Section */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                      Contact Information
                    </h4>
                    
                    <div className="space-y-2">
                      {store.address ? (
                        <div className="flex items-start gap-3 group/item">
                          <div className="flex-shrink-0 mt-0.5">
                            <MapPin className="h-4 w-4 text-blue-500" />
                          </div>
                          <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed flex-1">
                            {store.address}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 opacity-50">
                          <MapPin className="h-4 w-4 text-slate-400" />
                          <span className="text-sm text-slate-400 italic">No address</span>
                        </div>
                      )}
                      
                      {store.phone ? (
                        <div className="flex items-center gap-3 group/item">
                          <div className="flex-shrink-0">
                            <Phone className="h-4 w-4 text-green-500" />
                          </div>
                          <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                            {store.phone}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 opacity-50">
                          <Phone className="h-4 w-4 text-slate-400" />
                          <span className="text-sm text-slate-400 italic">No phone</span>
                        </div>
                      )}
                      
                      {store.email ? (
                        <div className="flex items-center gap-3 group/item">
                          <div className="flex-shrink-0">
                            <Mail className="h-4 w-4 text-purple-500" />
                          </div>
                          <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                            {store.email}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 opacity-50">
                          <Mail className="h-4 w-4 text-slate-400" />
                          <span className="text-sm text-slate-400 italic">No email</span>
                        </div>
                      )}
                      
                      {store.managerId && (
                        <div className="flex items-center gap-3 pt-1 border-t border-slate-100 dark:border-slate-800 mt-2">
                          <div className="flex-shrink-0">
                            <Users className="h-4 w-4 text-orange-500" />
                          </div>
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            Manager ID: <span className="font-semibold text-slate-900 dark:text-slate-200">{store.managerId}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditStore(store)}
                      className="flex-1 h-9 border-slate-200 hover:bg-blue-500 hover:border-slate-300 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:border-slate-600 transition-all duration-200"
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Store
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleManageProducts(store)}
                      className="flex-1 h-9 border-slate-200 hover:bg-blue-500 hover:border-slate-300 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:border-slate-600 transition-all duration-200"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Products
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <MainLayout pageTitle="Stores">
      <div className="p-6">
        {content}
      </div>

      <StoreModal
        store={selectedStore}
        isOpen={isStoreModalOpen}
        onClose={() => {
          setIsStoreModalOpen(false);
          setSelectedStore(null);
        }}
        onSubmit={selectedStore ? handleUpdateStore : handleCreateStore}
        isLoading={createStoreMutation.isPending || updateStoreMutation.isPending}
      />

      <StoreProductsModal
        store={selectedStore}
        isOpen={isProductsModalOpen}
        onClose={() => {
          setIsProductsModalOpen(false);
          setSelectedStore(null);
        }}
      />
    </MainLayout>
  );
}