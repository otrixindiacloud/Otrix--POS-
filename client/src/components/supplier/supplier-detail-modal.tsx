import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  User, 
  CreditCard, 
  Calendar,
  Edit,
  Save,
  X,
  FileText,
  Coins
} from "lucide-react";
import type { Supplier } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { VisuallyHidden } from "@/components/ui/visually-hidden";

interface SupplierDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier;
}

export default function SupplierDetailModal({ isOpen, onClose, supplier }: SupplierDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Supplier>>(supplier);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateSupplierMutation = useMutation({
    mutationFn: async (updatedSupplier: Partial<Supplier>) => {
      return apiRequest("PATCH", `/api/suppliers/${supplier.id}`, updatedSupplier);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setIsEditing(false);
      toast({
        title: "Supplier Updated",
        description: "Supplier information has been successfully updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update supplier.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateSupplierMutation.mutate(editData);
  };

  const handleCancel = () => {
    setEditData(supplier);
    setIsEditing(false);
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(num || 0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {isEditing ? "Edit Supplier" : "Supplier Details"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Update supplier information and settings" 
              : "View comprehensive supplier information and transaction history"
            }
          </DialogDescription>
          <VisuallyHidden>
            <DialogTitle>Supplier Detail Modal</DialogTitle>
          </VisuallyHidden>
        </DialogHeader>

        <div className="space-y-6">
          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <Badge 
              variant={supplier.isActive ? "default" : "secondary"}
              className="text-sm"
            >
              {supplier.isActive ? "Active" : "Inactive"}
            </Badge>
            
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={updateSupplierMutation.isPending}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={updateSupplierMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    {updateSupplierMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </div>

          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="financial">Financial</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Basic Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="name">Company Name *</Label>
                      {isEditing ? (
                        <Input
                          id="name"
                          value={editData.name || ""}
                          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                          placeholder="Enter company name"
                        />
                      ) : (
                        <p className="text-sm font-medium mt-1">{supplier.name}</p>
                      )}
                    </div>

                  </CardContent>
                </Card>

                {/* Contact Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="contactPerson">Contact Person</Label>
                      {isEditing ? (
                        <Input
                          id="contactPerson"
                          value={editData.contactPerson || ""}
                          onChange={(e) => setEditData({ ...editData, contactPerson: e.target.value })}
                          placeholder="Enter contact person name"
                        />
                      ) : (
                        <p className="text-sm mt-1 flex items-center gap-2">
                          <User className="h-3 w-3" />
                          {supplier.contactPerson || "N/A"}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="email">Email</Label>
                      {isEditing ? (
                        <Input
                          id="email"
                          type="email"
                          value={editData.email || ""}
                          onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                          placeholder="Enter email address"
                        />
                      ) : (
                        <p className="text-sm mt-1 flex items-center gap-2">
                          <Mail className="h-3 w-3" />
                          {supplier.email || "N/A"}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      {isEditing ? (
                        <Input
                          id="phone"
                          value={editData.phone || ""}
                          onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                          placeholder="Enter phone number"
                        />
                      ) : (
                        <p className="text-sm mt-1 flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          {supplier.phone || "N/A"}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="address">Address</Label>
                      {isEditing ? (
                        <Textarea
                          id="address"
                          value={editData.address || ""}
                          onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                          placeholder="Enter full address"
                          rows={3}
                        />
                      ) : (
                        <p className="text-sm mt-1 flex items-start gap-2">
                          <MapPin className="h-3 w-3 mt-0.5" />
                          {supplier.address || "No address provided"}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="financial" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Payment Terms */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Payment Terms
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="paymentTerms">Payment Terms</Label>
                      {isEditing ? (
                        <Input
                          id="paymentTerms"
                          value={editData.paymentTerms || ""}
                          onChange={(e) => setEditData({ ...editData, paymentTerms: e.target.value })}
                          placeholder="e.g., Net 30, Due on Receipt"
                        />
                      ) : (
                        <p className="text-sm mt-1">{supplier.paymentTerms || "Not specified"}</p>
                      )}
                    </div>


                    <div>
                      <Label htmlFor="taxId">Tax ID</Label>
                      {isEditing ? (
                        <Input
                          id="taxId"
                          value={editData.taxId || ""}
                          onChange={(e) => setEditData({ ...editData, taxId: e.target.value })}
                          placeholder="Enter tax identification number"
                        />
                      ) : (
                        <p className="text-sm mt-1">{supplier.taxId || "Not provided"}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Financial Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Coins className="h-4 w-4" />
                      Financial Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Total Purchases</Label>
                        <p className="text-lg font-semibold">QR 0.00</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Outstanding Balance</Label>
                        <p className="text-lg font-semibold">QR 0.00</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Last Payment</Label>
                        <p className="text-sm">Never</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        <Badge variant="outline" className="text-xs">
                          Good Standing
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Transaction History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-lg font-medium">No transaction history</p>
                    <p className="text-sm">Transactions with this supplier will appear here</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}