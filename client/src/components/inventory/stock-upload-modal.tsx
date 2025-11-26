import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Plus, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/hooks/useStore";

interface StockUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UploadResult {
  success: boolean;
  message: string;
  processedCount: number;
  newProductsCount: number;
  updatedProductsCount: number;
  errors: string[];
}

export default function StockUploadModal({ isOpen, onClose }: StockUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentStore } = useStore();

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      console.log('📤 Uploading stock file...');
      
      // Ensure a store is selected
      if (!currentStore?.id) {
        throw new Error('Please select a store before uploading stock');
      }
      
      const response = await fetch(`/api/inventory/upload-stock?storeId=${currentStore.id}`, {
        method: "POST",
        body: formData,
        credentials: 'include', // Ensure cookies are sent for authentication
      });
      
      console.log('📥 Upload response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
        console.error('❌ Upload failed:', errorData);
        throw new Error(errorData.message || `Upload failed with status ${response.status}`);
      }
      
      const result = await response.json();
      console.log('✅ Upload result:', result);
      return result;
    },
    onSuccess: async (result: UploadResult) => {
      setUploadResult(result);
      if (result.success) {
        toast({
          title: "Stock Upload Successful",
          description: `Processed ${result.processedCount} items. ${result.newProductsCount} new products added, ${result.updatedProductsCount} products updated.`,
        });
        // Invalidate and refetch to ensure UI updates immediately
        await queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        await queryClient.refetchQueries({ queryKey: ["/api/products"] });
        
        // Auto-close modal after successful upload
        setTimeout(() => {
          setFile(null);
          setUploadResult(null);
          onClose();
        }, 1500);
      } else {
        toast({
          title: "Upload Completed with Errors",
          description: result.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      console.error('❌ Upload mutation error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload stock file. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const validTypes = ['.csv', '.xlsx', '.xls'];
      const fileExtension = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
      
      if (!validTypes.includes(fileExtension)) {
        toast({
          title: "Invalid File Type",
          description: "Please upload a CSV or Excel file (.csv, .xlsx, .xls)",
          variant: "destructive",
        });
        return;
      }
      
      setFile(selectedFile);
      setUploadResult(null);
    }
  };

  const handleUpload = () => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    uploadMutation.mutate(formData);
  };

  const handleClose = () => {
    if (!uploadMutation.isPending) {
      setFile(null);
      setUploadResult(null);
      onClose();
    }
  };

  const downloadTemplate = () => {
    // Create CSV template
    const csvContent = "name,barcode,qty,cost,price\nWhite Bread,1234567890123,50,1.50,3.00\nMilk 1L,9876543210987,30,2.00,4.50\nApples 1kg,1122334455667,25,3.00,6.00";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'stock_upload_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-500" />
            Upload Current Stock
          </DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file to update current stock levels. New products will be automatically added.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Download */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-green-500" />
                Template Format
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Your file should include these columns: <strong>name, barcode, qty, cost, price</strong>
                </p>
                <div className="grid grid-cols-5 gap-2 text-xs font-medium bg-gray-50 p-2 rounded">
                  <div>name</div>
                  <div>barcode</div>
                  <div>qty</div>
                  <div>cost</div>
                  <div>price</div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={downloadTemplate}
                  className="w-full"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* File Upload */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stock-file">Select Stock File</Label>
              <Input
                id="stock-file"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                disabled={uploadMutation.isPending}
              />
            </div>

            {file && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Upload Results */}
          {uploadResult && (
            <Card className={uploadResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  {uploadResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  Upload Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-medium text-lg">{uploadResult.processedCount}</div>
                      <div className="text-gray-500">Total Processed</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-lg text-green-600">{uploadResult.newProductsCount}</div>
                      <div className="text-gray-500">New Products</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-lg text-blue-600">{uploadResult.updatedProductsCount}</div>
                      <div className="text-gray-500">Updated Stock</div>
                    </div>
                  </div>
                  
                  {uploadResult.errors.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-amber-700 dark:text-amber-300 font-medium">Errors:</Label>
                      <div className="space-y-1">
                        {uploadResult.errors.slice(0, 5).map((error, index) => (
                          <div key={index} className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2 rounded-md">
                            {error}
                          </div>
                        ))}
                        {uploadResult.errors.length > 5 && (
                          <div className="text-xs text-amber-600 dark:text-amber-400">
                            ... and {uploadResult.errors.length - 5} more errors
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-yellow-800">Important Notes:</p>
                  <ul className="space-y-1 text-yellow-700">
                    <li>• Products with existing barcodes will have their stock updated</li>
                    <li>• New products will be automatically created with the provided information</li>
                    <li>• Make sure barcode format is correct (numbers only)</li>
                    <li>• Cost and price should be in decimal format (e.g., 1.50)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploadMutation.isPending}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpload}
            disabled={!file || uploadMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {uploadMutation.isPending ? (
              <>
                <Upload className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Stock
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}