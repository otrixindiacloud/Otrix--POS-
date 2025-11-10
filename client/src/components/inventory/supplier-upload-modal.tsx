import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, X, Building } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface SupplierUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SupplierRow {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address?: string;
  notes?: string;
  status?: 'pending' | 'success' | 'error';
  error?: string;
}

export default function SupplierUploadModal({ isOpen, onClose }: SupplierUploadModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<SupplierRow[]>([]);
  const [uploadResults, setUploadResults] = useState<SupplierRow[]>([]);
  const [step, setStep] = useState<'select' | 'preview' | 'results'>('select');
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please select a CSV or Excel file (.csv, .xls, .xlsx)",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    await parseFile(file);
  };

  const parseFile = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      console.log("📤 Uploading file for parsing:", file.name);

      const response = await fetch('/api/suppliers/parse-upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("❌ Parse error response:", data);
        throw new Error(data.message || 'Failed to parse file');
      }

      console.log("✅ Parsed suppliers:", data.suppliers?.length || 0);
      
      if (!data.suppliers || data.suppliers.length === 0) {
        throw new Error('No valid supplier data found in file');
      }

      setPreviewData(data.suppliers || []);
      setStep('preview');
    } catch (error) {
      console.error('Parse error:', error);
      
      let errorMessage = "Failed to parse the file. Please check the format and try again.";
      
      if (error instanceof Error) {
        if (error.message.includes("Required columns missing") || error.message.includes("Found:")) {
          errorMessage = error.message; // Use the detailed message from backend
        } else if (error.message.includes("header row")) {
          errorMessage = "File must contain a header row and at least one data row.";
        } else if (error.message.includes("No valid supplier")) {
          errorMessage = "No valid supplier data found. Please check that your file has data rows with required fields filled.";
        } else if (error.message) {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Parse Error",
        description: errorMessage,
        variant: "destructive",
        duration: 6000,
      });
    }
  };

  const handleUpload = async () => {
    if (!previewData.length) return;

    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const results: SupplierRow[] = [];
      const total = previewData.length;

      for (let i = 0; i < previewData.length; i++) {
        const supplier = previewData[i];
        try {
          await apiRequest({
            url: '/api/suppliers',
            method: 'POST',
            body: {
              name: supplier.name,
              contactPerson: supplier.contactPerson,
              email: supplier.email,
              phone: supplier.phone,
              address: supplier.address || '',
              notes: supplier.notes || '',
            },
          });

          results.push({ ...supplier, status: 'success' });
        } catch (error: any) {
          results.push({ 
            ...supplier, 
            status: 'error', 
            error: error.message || 'Failed to create supplier' 
          });
        }

        setUploadProgress(Math.round(((i + 1) / total) * 100));
      }

      setUploadResults(results);
      setStep('results');
      
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      
      const successCount = results.filter(r => r.status === 'success').length;
      const errorCount = results.filter(r => r.status === 'error').length;
      
      toast({
        title: "Upload Complete",
        description: `${successCount} suppliers created successfully. ${errorCount} failed.`,
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: "An error occurred during upload. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    const template = `Name,Contact Person,Email,Phone,Address,Notes
ABC Wholesalers,John Smith,john@abcwholesale.com,+1-555-0123,123 Industrial Blvd,Primary supplier for electronics
XYZ Distributors,Sarah Johnson,sarah@xyzdist.com,+1-555-0124,456 Commerce Ave,Reliable delivery schedule`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'supplier_upload_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast({
      title: "Template Downloaded",
      description: "Supplier upload template has been downloaded.",
    });
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreviewData([]);
    setUploadResults([]);
    setStep('select');
    setUploadProgress(0);
    onClose();
  };

  const renderSelectStep = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Download className="w-5 h-5 mr-2" />
            Download Template
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 mb-4">
            Download our template to ensure your supplier data is formatted correctly.
          </p>
          <Button onClick={downloadTemplate} variant="outline" className="w-full">
            <Download className="w-4 h-4 mr-2" />
            Download CSV Template
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Upload className="w-5 h-5 mr-2" />
            Upload Supplier File
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
            <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">Select a file to upload</p>
            <p className="text-sm text-slate-500 mb-4">
              Supports CSV, XLS, and XLSX files
            </p>
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-left">
              <p className="text-xs font-semibold text-blue-900 mb-2">Required Columns:</p>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>• <strong>Name</strong> - Supplier name</li>
                <li>• <strong>Contact Person</strong> - Primary contact</li>
                <li>• <strong>Email</strong> - Email address</li>
                <li>• <strong>Phone</strong> - Phone number</li>
                <li>• Address (optional)</li>
                <li>• Notes (optional)</li>
              </ul>
            </div>
            <Button onClick={() => document.getElementById('supplier-file-upload')?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              Choose File
            </Button>
            <input
              id="supplier-file-upload"
              type="file"
              accept=".csv,.xls,.xlsx"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          {selectedFile && (
            <div className="mt-4 p-3 bg-slate-50 rounded border">
              <p className="text-sm">
                <span className="font-medium">Selected:</span> {selectedFile.name}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Required fields:</strong> Name, Contact Person, Email, Phone<br />
          <strong>Optional fields:</strong> Address, Notes
        </AlertDescription>
      </Alert>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Preview Import Data</h3>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => setStep('select')}>
            Back
          </Button>
          <Button onClick={handleUpload} disabled={isUploading || !previewData.length}>
            <Building className="w-4 h-4 mr-2" />
            Import {previewData.length} Suppliers
          </Button>
        </div>
      </div>

      <div className="border rounded-lg max-h-96 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {previewData.map((supplier, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{supplier.name}</TableCell>
                <TableCell>{supplier.contactPerson}</TableCell>
                <TableCell>{supplier.email}</TableCell>
                <TableCell>{supplier.phone}</TableCell>
                <TableCell>{supplier.address || '-'}</TableCell>
                <TableCell>{supplier.notes || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  const renderResultsStep = () => {
    const successCount = uploadResults.filter(r => r.status === 'success').length;
    const errorCount = uploadResults.filter(r => r.status === 'error').length;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Import Results</h3>
          <Button onClick={handleClose}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Done
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-700">{successCount}</div>
                <div className="text-sm text-green-600">Successful</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-700">{errorCount}</div>
                <div className="text-sm text-red-600">Failed</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {errorCount > 0 && (
          <div className="border rounded-lg max-h-64 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploadResults
                  .filter(r => r.status === 'error')
                  .map((supplier, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{supplier.name}</TableCell>
                      <TableCell>{supplier.contactPerson}</TableCell>
                      <TableCell>
                        <span className="text-amber-700 dark:text-amber-300 font-medium">Failed</span>
                      </TableCell>
                      <TableCell className="text-sm text-amber-700 dark:text-amber-300">
                        {supplier.error}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <FileSpreadsheet className="w-5 h-5 mr-2" />
            Bulk Supplier Upload
          </DialogTitle>
          <DialogDescription>
            Import multiple suppliers from CSV or Excel files
          </DialogDescription>
        </DialogHeader>

        {isUploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Uploading suppliers...</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} />
          </div>
        )}

        {step === 'select' && renderSelectStep()}
        {step === 'preview' && renderPreviewStep()}
        {step === 'results' && renderResultsStep()}
      </DialogContent>
    </Dialog>
  );
}