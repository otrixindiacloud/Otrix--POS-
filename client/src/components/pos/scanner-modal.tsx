import { useState } from "react";
import { usePOSStore } from "@/lib/pos-store";
import { useStore } from "@/hooks/useStore";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  Camera, 
  Upload, 
  Scan,
  X,
  Loader2
} from "lucide-react";

export default function ScannerModal() {
  const { toast } = useToast();
  const { currentStore } = useStore();
  const {
    isScannerOpen,
    closeScanner,
    scanType,
    addToCart
  } = usePOSStore();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [manualInput, setManualInput] = useState("");

  const scanMutation = useMutation({
    mutationFn: async (scanData: any) => {
      console.log('Scanner mutation started:', scanData);
      
      if (scanData.manual) {
        // Handle manual barcode/SKU input
        let product = null;
        
        // Try barcode first
        console.log('Trying barcode lookup for:', scanData.input);
        try {
          const barcodeRes = await fetch(`/api/products/barcode/${scanData.input}`);
          if (barcodeRes.ok) {
            product = await barcodeRes.json();
            console.log('Found product by barcode:', product);
          }
        } catch (error) {
          console.error('Barcode lookup failed:', error);
        }
        
        // Try SKU if barcode failed
        if (!product) {
          console.log('Trying SKU lookup for:', scanData.input);
          try {
            const skuRes = await fetch(`/api/products/sku/${scanData.input}`);
            if (skuRes.ok) {
              product = await skuRes.json();
              console.log('Found product by SKU:', product);
            }
          } catch (skuError) {
            console.error('SKU lookup failed:', skuError);
          }
        }
        
        // Search by name as last resort
        if (!product) {
          console.log('Trying name search for:', scanData.input);
          try {
            const searchRes = await fetch(`/api/products/search?q=${encodeURIComponent(scanData.input)}`);
            if (searchRes.ok) {
              const results = await searchRes.json();
              if (results && results.length > 0) {
                product = results[0];
                console.log('Found product by search:', product);
              }
            }
          } catch (searchError) {
            console.error('Name search failed:', searchError);
          }
        }
        
        if (!product) {
          console.error('Product not found for input:', scanData.input);
          throw new Error("Product not found. Please check the barcode, SKU, or product name.");
        }
        
        console.log('Returning product:', product);
        return { success: true, type: 'product', data: product };
      } else {
        // Handle AI scanning
        const formData = new FormData();
        formData.append('image', scanData.file);
        formData.append('type', scanData.type);

        const response = await fetch("/api/scan/ai", {
          method: "POST",
          body: formData
        });

        if (!response.ok) {
          throw new Error("Failed to process image");
        }

        return response.json();
      }
    },
    onSuccess: (result) => {
      console.log('Scanner mutation success:', result);
      
      if (result.success && result.type === 'product') {
        console.log('Adding product to cart:', result.data);
        addToCart(result.data, 1, currentStore?.id);
        toast({
          title: "Product Added",
          description: `${result.data.name} added to cart`,
        });
        closeScanner();
        resetForm();
      } else if (result.success && result.type === 'invoice') {
        toast({
          title: "Invoice Processed",
          description: "Inventory updated from supplier invoice",
        });
        closeScanner();
        resetForm();
      } else {
        console.log('Scan failed:', result);
        toast({
          title: "Scan Failed",
          description: result.message || "Could not process the scan",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error('Scanner mutation error:', error);
      toast({
        title: "Scan Error",
        description: error.message || "Failed to process scan",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedFile(null);
    setManualInput("");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleManualScan = () => {
    if (!manualInput.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter a barcode, SKU, or product name",
        variant: "destructive",
      });
      return;
    }

    scanMutation.mutate({
      manual: true,
      input: manualInput.trim()
    });
  };

  const handleAIScan = () => {
    if (!selectedFile) {
      toast({
        title: "Image Required",
        description: "Please select an image to scan",
        variant: "destructive",
      });
      return;
    }

    scanMutation.mutate({
      manual: false,
      file: selectedFile,
      type: scanType
    });
  };

  const handleClose = () => {
    closeScanner();
    resetForm();
  };

  if (!isScannerOpen) return null;

  const scanTypeLabels = {
    barcode: "Barcode Scanner",
    qr: "QR Code Scanner", 
    product: "Product Recognition",
    invoice: "Invoice Processing"
  };

  return (
    <Dialog open={isScannerOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Camera className="w-5 h-5 mr-2" />
            {scanTypeLabels[scanType]}
          </DialogTitle>
          <DialogDescription>
            Scan products by uploading an image or entering a barcode, SKU, or product name manually.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Manual Input Section */}
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-2">
              Manual Entry
            </Label>
            <div className="flex space-x-2">
              <Input
                type="text"
                placeholder={
                  scanType === 'invoice' 
                    ? "Invoice number or supplier..." 
                    : "Enter barcode, SKU, or product name..."
                }
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                className="flex-1 touch-friendly"
                onKeyPress={(e) => e.key === 'Enter' && handleManualScan()}
              />
              <Button 
                onClick={handleManualScan}
                disabled={scanMutation.isPending}
                className="touch-friendly"
              >
                <Scan className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-slate-500">OR</span>
            </div>
          </div>

          {/* AI Scanning Section */}
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-2">
              {scanType === 'invoice' ? 'Upload Invoice Image' : 'Upload Product Image'}
            </Label>
            
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
              {selectedFile ? (
                <div className="space-y-2">
                  <div className="text-green-600">
                    <Upload className="w-8 h-8 mx-auto mb-2" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 mx-auto text-slate-400" />
                  <div>
                    <Label 
                      htmlFor="file-upload"
                      className="cursor-pointer text-primary hover:text-primary/80"
                    >
                      Click to upload image
                    </Label>
                    <Input
                      id="file-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    PNG, JPG, GIF up to 10MB
                  </p>
                </div>
              )}
            </div>

            {selectedFile && (
              <Button
                onClick={handleAIScan}
                disabled={scanMutation.isPending}
                className="w-full mt-4 touch-friendly"
              >
                {scanMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    Scan with AI
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={handleClose}
            className="flex-1 touch-friendly"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
