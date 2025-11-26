import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Package, Upload, Trash2, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertProductSchema, type Product } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { getProductTypes, getCategoriesByType, type ProductType, type Category } from "@/config/product-categories";
import { useStore } from "@/hooks/useStore";

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
}

export default function ProductModal({ isOpen, onClose, product }: ProductModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [selectedProductType, setSelectedProductType] = useState<string>("");
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const { toast } = useToast();
  const { currentStore } = useStore();

  const productTypes = getProductTypes();

  const form = useForm({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      name: "",
      description: "",
      productType: "",
      category: "",
      price: "0.00",
      cost: "0.00",
      sku: "",
      barcode: "",
      stock: 0,
      quantity: 0,
      imageUrl: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (product) {
      const productType = (product as any).productType || "";
      form.reset({
        name: product.name,
        description: product.description || "",
        productType: productType,
        category: product.category || "",
        price: product.price,
        cost: product.cost || "0.00",
        sku: product.sku,
        barcode: product.barcode || "",
        stock: product.stock || 0,
        quantity: product.quantity || 0,
        imageUrl: product.imageUrl || "",
        isActive: product.isActive !== false,
      });
      setSelectedProductType(productType);
      if (productType) {
        setAvailableCategories(getCategoriesByType(productType));
      }
      setImagePreview(product.imageUrl || "");
      setImageFile(null);
    } else {
      form.reset({
        name: "",
        description: "",
        productType: "",
        category: "",
        price: "0.00",
        cost: "0.00",
        sku: "",
        barcode: "",
        stock: 0,
        quantity: 0,
        imageUrl: "",
        isActive: true,
      });
      setSelectedProductType("");
      setAvailableCategories([]);
      setImagePreview("");
      setImageFile(null);
    }
  }, [product, form]);

  // Update available categories when product type changes
  useEffect(() => {
    if (selectedProductType) {
      const categories = getCategoriesByType(selectedProductType);
      setAvailableCategories(categories);
      
      // Reset category if it doesn't belong to the new type
      const currentCategory = form.getValues("category");
      if (currentCategory && !categories.some(cat => cat.value === currentCategory)) {
        form.setValue("category", "");
      }
    } else {
      setAvailableCategories([]);
      form.setValue("category", "");
    }
  }, [selectedProductType, form]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = async () => {
    if (!imageFile) return "";
    
    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      
      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload image');
      }
      
      const { url } = await response.json();
      return url;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Error",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
      return "";
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview("");
    form.setValue("imageUrl", "");
  };

  const handleSubmit = async (data: any) => {
    // Validate required fields
    const errors: string[] = [];
    
    if (!data.name?.trim()) {
      errors.push("Product Name is required");
    }
    if (!data.description?.trim()) {
      errors.push("Description is required");
    }
    if (!data.sku?.trim()) {
      errors.push("SKU is required");
    }
    if (!data.barcode?.trim()) {
      errors.push("Barcode is required");
    }
    if (!data.price || parseFloat(data.price) <= 0) {
      errors.push("Price must be greater than 0");
    }
    if (!data.cost || parseFloat(data.cost) < 0) {
      errors.push("Cost is required and must be 0 or greater");
    }
    
    // Ensure a store is selected for new products
    if (!product && !currentStore?.id) {
      errors.push("Please select a store before adding a product");
    }
    
    if (errors.length > 0) {
      toast({
        title: "Validation Error",
        description: (
          <div className="space-y-1">
            <p className="font-semibold">Please fill in all required fields:</p>
            <ul className="list-disc list-inside">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        ),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Upload image if a new one was selected
      let imageUrl = data.imageUrl;
      if (imageFile) {
        imageUrl = await handleImageUpload();
        if (!imageUrl) {
          // If image upload failed, don't proceed
          setIsLoading(false);
          return;
        }
      }

      const productData = {
        ...data,
        imageUrl: imageUrl || "",
        storeId: currentStore?.id, // Include storeId for new products
      };

      if (product) {
        // Edit existing product
        await apiRequest({
          url: `/api/products/${product.id}`,
          method: "PATCH",
          body: productData,
        });
        toast({
          title: "Success",
          description: "Product updated successfully!",
        });
      } else {
        // Add new product
        await apiRequest({
          url: "/api/products",
          method: "POST",
          body: productData,
        });
        toast({
          title: "Success",
          description: "Product added successfully!",
        });
      }

      // Invalidate and refetch queries to ensure UI updates
      await queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      await queryClient.refetchQueries({ queryKey: ["/api/products"] });
      
      // Small delay to ensure database transaction completes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      handleClose();
    } catch (error: any) {
      console.error("Error saving product:", error);
      
      // Parse error message for better user feedback
      let errorMessage = "Failed to save product. Please try again.";
      
      if (error?.message) {
        if (error.message.includes("duplicate key") || error.message.includes("unique constraint")) {
          errorMessage = "A product with this SKU already exists. Please use a different SKU.";
        } else if (error.message.includes("required")) {
          errorMessage = "Please fill in all required fields (Name, SKU, and Price).";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    form.reset();
    setImageFile(null);
    setImagePreview("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Package className="w-5 h-5 mr-2" />
            {product ? "Edit Product" : "Add New Product"}
          </DialogTitle>
          <DialogDescription>
            {product ? "Update product information and inventory details" : "Add a new product to your inventory"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Required Fields Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Required fields are marked with </span>
                <span className="text-red-600 font-bold">*</span>
                <span className="font-semibold"> (Name, Description, SKU, Barcode, Price, and Cost)</span>
              </p>
            </div>

            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-muted-foreground">
                Make your changes and save, or close to return.
              </div>
            
            </div>
            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Product Name <span className="text-red-600">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Enter product name" 
                        className={form.formState.errors.name ? "border-red-400" : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="productType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Type</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        setSelectedProductType(value);
                      }} 
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select product type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {productTypes.map((type: ProductType) => (
                          <SelectItem key={type.value} value={type.value}>
                            <span className="flex items-center gap-2">
                              <span>{type.icon}</span>
                              <span>{type.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={!selectedProductType}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={selectedProductType ? "Select category" : "Select type first"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableCategories.map((category: Category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Description <span className="text-red-600">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Enter detailed product description" 
                      rows={3}
                      className={form.formState.errors.description ? "border-red-400" : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Price (QR) <span className="text-red-600">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        step="0.01" 
                        min="0"
                        placeholder="0.00"
                        onChange={(e) => field.onChange(e.target.value)}
                        className={form.formState.errors.price ? "border-red-400" : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Cost (QR) <span className="text-red-600">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        step="0.01" 
                        min="0"
                        placeholder="0.00"
                        onChange={(e) => field.onChange(e.target.value)}
                        className={form.formState.errors.cost ? "border-red-400" : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => {
                  const currentStock = product?.stock || 0;
                  const quantityValue = field.value || 0;
                  const exceedsStock = product && quantityValue > currentStock;
                  
                  return (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <div>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0"
                            max={product ? currentStock : undefined}
                            placeholder="0"
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 0;
                              if (product && value > currentStock) {
                                toast({
                                  title: "Validation Error",
                                  description: `Quantity cannot exceed current stock (${currentStock}). Please adjust stock first.`,
                                  variant: "destructive",
                                });
                                field.onChange(currentStock);
                              } else {
                                field.onChange(value);
                              }
                            }}
                            className={exceedsStock ? "border-red-400" : ""}
                          />
                          {product && (
                            <p className="text-xs text-slate-500 mt-1">
                              Current stock: {currentStock} {exceedsStock && <span className="text-red-600">(Quantity exceeds stock!)</span>}
                            </p>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        min="0"
                        placeholder="0"
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      SKU <span className="text-red-600">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Product SKU (must be unique)" 
                        className={form.formState.errors.sku ? "border-red-400" : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Barcode <span className="text-red-600">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Product barcode" 
                        className={form.formState.errors.barcode ? "border-red-400" : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Product Image Upload Section */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="imageUrl"
                render={() => (
                  <FormItem>
                    <FormLabel>Product Image</FormLabel>
                    <FormControl>
                      <div className="space-y-4">
                        {/* Image Preview */}
                        {imagePreview && (
                          <div className="relative w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
                            <img
                              src={imagePreview}
                              alt="Product preview"
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={handleRemoveImage}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {/* Upload Button */}
                        {!imagePreview && (
                          <div className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageChange}
                              className="hidden"
                              id="image-upload"
                            />
                            <label
                              htmlFor="image-upload"
                              className="flex flex-col items-center justify-center cursor-pointer text-gray-500 hover:text-gray-600"
                            >
                              <ImageIcon className="w-8 h-8 mb-2" />
                              <span className="text-sm text-center">Click to upload image</span>
                            </label>
                          </div>
                        )}

                        {/* Image Upload Status */}
                        {isUploadingImage && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Upload className="w-4 h-4 mr-2 animate-spin" />
                            Uploading image...
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                <Save className="w-4 h-4 mr-2" />
                {isLoading ? "Saving..." : product ? "Update Product" : "Add Product"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}