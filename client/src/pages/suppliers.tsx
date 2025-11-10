import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Plus, 
  Building2, 
  Phone, 
  Mail, 
  MapPin,
  Edit,
  Trash2,
  Upload,
  Eye,
  User,
  Filter,
  SortAsc,
  SortDesc
} from "lucide-react";
import type { Supplier } from "@shared/schema";
import MainLayout from "@/components/layout/main-layout";
import SupplierModal from "@/components/inventory/supplier-modal";
import SupplierUploadModal from "@/components/inventory/supplier-upload-modal";
import SupplierDetailModal from "@/components/supplier/supplier-detail-modal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import LoadingSpinner from "@/components/ui/loading-spinner";

export default function Suppliers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showSupplierUploadModal, setShowSupplierUploadModal] = useState(false);
  const [showSupplierDetailModal, setShowSupplierDetailModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest({
        url: `/api/suppliers/${id}`,
        method: "DELETE",
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({
        title: "Supplier Deleted",
        description: "Supplier has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete supplier.",
        variant: "destructive",
      });
    },
  });

  const handleEditSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowSupplierModal(true);
  };

  const handleViewSupplierDetails = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowSupplierDetailModal(true);
  };

  const handleDeleteSupplier = (supplier: Supplier) => {
    if (window.confirm(`Are you sure you want to delete ${supplier.name}?`)) {
      deleteSupplierMutation.mutate(supplier.id);
    }
  };

  const handleAddSupplier = () => {
    setSelectedSupplier(null);
    setShowSupplierModal(true);
  };

  const filteredSuppliers = suppliers
    .filter((supplier: Supplier) =>
      supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.contactPerson?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.email?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a: Supplier, b: Supplier) => {
      const aValue = a[sortBy as keyof Supplier] || "";
      const bValue = b[sortBy as keyof Supplier] || "";
      const comparison = aValue.toString().localeCompare(bValue.toString());
      return sortOrder === "asc" ? comparison : -comparison;
    });

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">
                Supplier Management
              </h1>
              <p className="text-muted-foreground">
                Manage your suppliers and vendor relationships
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => setShowSupplierUploadModal(true)}
                variant="outline"
                className="shadow-md hover:shadow-lg transition-all duration-200"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
              <Button
                onClick={handleAddSupplier}
                className="shadow-md hover:shadow-lg transition-all duration-200"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Supplier
              </Button>
            </div>
          </div>

          {/* Search and Filters */}
          <Card className="shadow-lg border-0 bg-card/95 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search suppliers by name, contact person, or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                    className="px-3"
                  >
                    {sortOrder === "asc" ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Suppliers Grid */}
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSuppliers.map((supplier: Supplier) => (
                <Card key={supplier.id} className="shadow-lg border-0 bg-card/95 backdrop-blur-sm hover:shadow-xl transition-all duration-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg text-foreground">{supplier.name}</CardTitle>
                          <Badge variant="outline" className="mt-1">
                            {"General"}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewSupplierDetails(supplier)}
                          className="h-8 w-8 p-0"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditSupplier(supplier)}
                          className="h-8 w-8 p-0"
                          title="Quick Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteSupplier(supplier)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {supplier.contactPerson && (
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <User className="w-4 h-4" />
                          <span>{supplier.contactPerson}</span>
                        </div>
                      )}
                      {supplier.phone && (
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Phone className="w-4 h-4" />
                          <span>{supplier.phone}</span>
                        </div>
                      )}
                      {supplier.email && (
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Mail className="w-4 h-4" />
                          <span className="truncate">{supplier.email}</span>
                        </div>
                      )}
                      {supplier.address && (
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate">{supplier.address}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {filteredSuppliers.length === 0 && !isLoading && (
            <Card className="shadow-lg border-0 bg-card/95 backdrop-blur-sm">
              <CardContent className="p-12 text-center">
                <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Suppliers Found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? "No suppliers match your search criteria." : "Get started by adding your first supplier."}
                </p>
                <Button onClick={handleAddSupplier}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Supplier
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Modals */}
        <SupplierModal
          isOpen={showSupplierModal}
          onClose={() => setShowSupplierModal(false)}
          supplier={selectedSupplier}
        />
        <SupplierUploadModal
          isOpen={showSupplierUploadModal}
          onClose={() => setShowSupplierUploadModal(false)}
        />
        {selectedSupplier && (
          <SupplierDetailModal
            isOpen={showSupplierDetailModal}
            onClose={() => setShowSupplierDetailModal(false)}
            supplier={selectedSupplier}
          />
        )}
      </div>
    </MainLayout>
  );
}