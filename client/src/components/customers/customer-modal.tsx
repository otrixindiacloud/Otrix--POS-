import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, Save, User, Upload, CreditCard, Camera, FileImage } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertCustomerSchema, type Customer } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer?: Customer | null;
}

export default function CustomerModal({ isOpen, onClose, customer }: CustomerModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [idCardImageFile, setIdCardImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string>("");
  const [idCardImagePreview, setIdCardImagePreview] = useState<string>("");
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(insertCustomerSchema.extend({
      email: z.string().email("Please enter a valid email address"),
      phone: z.string().min(1, "Phone number is required"),
    })),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      creditLimit: "0.00",
      notes: "",
    },
  });

  useEffect(() => {
    if (customer) {
      form.reset({
        name: customer.name,
        email: customer.email || "",
        phone: customer.phone || "",
        address: customer.address || "",
        creditLimit: customer.creditLimit || "0.00",
        notes: customer.notes || "",
      });
      setProfileImagePreview(customer.profileImage || "");
      setIdCardImagePreview(customer.idCardImage || "");
    } else {
      form.reset({
        name: "",
        email: "",
        phone: "",
        address: "",
        creditLimit: "0.00",
        notes: "",
      });
      setProfileImagePreview("");
      setIdCardImagePreview("");
    }
    setProfileImageFile(null);
    setIdCardImageFile(null);
  }, [customer, form]);

  const handleImageUpload = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    
    const response = await fetch("/api/upload/image", {
      method: "POST",
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error("Failed to upload image");
    }
    
    const result = await response.json();
    return result.url;
  };

  const handleProfileImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfileImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleIdCardImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIdCardImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setIdCardImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      let profileImageUrl = customer?.profileImage || "";
      let idCardImageUrl = customer?.idCardImage || "";

      // Upload profile image if selected
      if (profileImageFile) {
        profileImageUrl = await handleImageUpload(profileImageFile);
      }

      // Upload ID card image if selected
      if (idCardImageFile) {
        idCardImageUrl = await handleImageUpload(idCardImageFile);
      }

      const customerData = {
        ...data,
        profileImage: profileImageUrl,
        idCardImage: idCardImageUrl,
      };

      if (customer) {
        // Update existing customer
        await apiRequest({
          url: `/api/customers/${customer.id}`,
          method: "PUT",
          body: customerData,
        });
        toast({
          title: "Success",
          description: "Customer updated successfully!",
        });
      } else {
        // Create new customer
        await apiRequest({
          url: "/api/customers",
          method: "POST",
          body: customerData,
        });
        toast({
          title: "Success",
          description: "Customer created successfully!",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      handleClose();
    } catch (error) {
      console.error("Error saving customer:", error);
      toast({
        title: "Error",
        description: "Failed to save customer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    form.reset();
    setProfileImageFile(null);
    setIdCardImageFile(null);
    setProfileImagePreview("");
    setIdCardImagePreview("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <User className="w-5 h-5 mr-2" />
            {customer ? "Edit Customer" : "Add New Customer"}
          </DialogTitle>
          <DialogDescription>
            {customer ? "Update customer information and settings" : "Create a new customer account with profile and credit settings"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Images */}
              <div className="space-y-4">
                {/* Profile Image */}
                <Card>
                  <CardContent className="p-4">
                    <Label className="text-sm font-medium mb-3 block">Profile Photo</Label>
                    <div className="flex flex-col items-center space-y-3">
                      <Avatar className="w-24 h-24">
                        <AvatarImage src={profileImagePreview} />
                        <AvatarFallback className="text-2xl">
                          {form.watch("name")?.[0]?.toUpperCase() || <User className="w-8 h-8" />}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('profile-image')?.click()}
                        >
                          <Camera className="w-4 h-4 mr-1" />
                          Upload
                        </Button>
                        {profileImagePreview && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setProfileImagePreview("");
                              setProfileImageFile(null);
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <input
                        id="profile-image"
                        type="file"
                        accept="image/*"
                        onChange={handleProfileImageSelect}
                        className="hidden"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* ID Card Image */}
                <Card>
                  <CardContent className="p-4">
                    <Label className="text-sm font-medium mb-3 block">ID Card / Document</Label>
                    <div className="space-y-3">
                      {idCardImagePreview ? (
                        <div className="relative">
                          <img
                            src={idCardImagePreview}
                            alt="ID Card"
                            className="w-full h-32 object-cover rounded border"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => {
                              setIdCardImagePreview("");
                              setIdCardImageFile(null);
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center">
                          <FileImage className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                          <p className="text-sm text-slate-500">No ID card uploaded</p>
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => document.getElementById('id-card-image')?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload ID Card
                      </Button>
                      <input
                        id="id-card-image"
                        type="file"
                        accept="image/*"
                        onChange={handleIdCardImageSelect}
                        className="hidden"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Middle Column - Basic Info */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter customer name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address *</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="customer@example.com" required />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Phone *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="+1 (555) 123-4567" required />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Enter customer address"
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Right Column - Credit & Notes */}
              <div className="space-y-4">
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4">
                    <div className="flex items-center mb-3">
                      <CreditCard className="w-5 h-5 mr-2 text-green-600" />
                      <Label className="text-sm font-medium">Credit Settings</Label>
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="creditLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Credit Limit ($) *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number" 
                              step="0.01" 
                              min="0"
                              placeholder="0.00"
                              required
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {customer && (
                      <div className="mt-3 pt-3 border-t border-green-200">
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-600">Current Balance:</span>
                            <span className="font-medium">
                              ${Number(customer.creditBalance || 0).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Available Credit:</span>
                            <span className="font-medium text-green-600">
                              ${(Number(form.watch("creditLimit") || 0) - Number(customer.creditBalance || 0)).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Additional notes about the customer..."
                          rows={4}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  "Saving..."
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {customer ? "Update Customer" : "Create Customer"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}