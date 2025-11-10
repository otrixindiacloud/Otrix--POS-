import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, X, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface CustomerUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CustomerRow {
  name: string;
  email: string;
  phone: string;
  address?: string;
  creditLimit: string;
  notes?: string;
  status?: 'pending' | 'success' | 'error';
  error?: string;
}

export default function CustomerUploadModal({ isOpen, onClose }: CustomerUploadModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<CustomerRow[]>([]);
  const [uploadResults, setUploadResults] = useState<CustomerRow[]>([]);
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

      const response = await fetch('/api/customers/parse-upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to parse file');
      }

      const data = await response.json();
      setPreviewData(data.customers || []);
      setStep('preview');
    } catch (error) {
      console.error('Parse error:', error);
      toast({
        title: "Parse Error",
        description: "Failed to parse the file. Please check the format and try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpload = async () => {
    if (!previewData.length) return;

    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const results: CustomerRow[] = [];
      const total = previewData.length;

      for (let i = 0; i < previewData.length; i++) {
        const customer = previewData[i];
        try {
          await apiRequest({
            url: '/api/customers',
            method: 'POST',
            body: {
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
              address: customer.address || '',
              creditLimit: customer.creditLimit || '0.00',
              notes: customer.notes || '',
            },
          });

          results.push({ ...customer, status: 'success' });
        } catch (error: any) {
          results.push({ 
            ...customer, 
            status: 'error', 
            error: error.message || 'Failed to create customer' 
          });
        }

        setUploadProgress(Math.round(((i + 1) / total) * 100));
      }

      setUploadResults(results);
      setStep('results');
      
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      
      const successCount = results.filter(r => r.status === 'success').length;
      const errorCount = results.filter(r => r.status === 'error').length;
      
      toast({
        title: "Upload Complete",
        description: `${successCount} customers created successfully. ${errorCount} failed.`,
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
    const template = `Name,Email,Phone,Address,Credit Limit,Notes
John Doe,john@example.com,+1-555-0123,123 Main St,100.00,Regular customer
Jane Smith,jane@example.com,+1-555-0124,456 Oak Ave,250.00,VIP customer`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'customer_upload_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast({
      title: "Template Downloaded",
      description: "Customer upload template has been downloaded.",
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
            Download our template to ensure your data is formatted correctly.
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
            Upload Customer File
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
            <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">Select a file to upload</p>
            <p className="text-sm text-slate-500 mb-4">
              Supports CSV, XLS, and XLSX files
            </p>
            <Button onClick={() => document.getElementById('file-upload')?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              Choose File
            </Button>
            <input
              id="file-upload"
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
          <strong>Required fields:</strong> Name, Email, Phone, Credit Limit<br />
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
            <Users className="w-4 h-4 mr-2" />
            Import {previewData.length} Customers
          </Button>
        </div>
      </div>

      <div className="border rounded-lg max-h-96 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Credit Limit</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {previewData.map((customer, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{customer.name}</TableCell>
                <TableCell>{customer.email}</TableCell>
                <TableCell>{customer.phone}</TableCell>
                <TableCell>{customer.address || '-'}</TableCell>
                <TableCell>QR {customer.creditLimit}</TableCell>
                <TableCell>{customer.notes || '-'}</TableCell>
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
          <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{errorCount}</div>
                <div className="text-sm text-amber-600 dark:text-amber-400">Failed</div>
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
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploadResults
                  .filter(r => r.status === 'error')
                  .map((customer, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{customer.email}</TableCell>
                      <TableCell>
                        <span className="text-amber-700 dark:text-amber-300 font-medium">Failed</span>
                      </TableCell>
                      <TableCell className="text-sm text-amber-700 dark:text-amber-300">
                        {customer.error}
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
            Bulk Customer Upload
          </DialogTitle>
          <DialogDescription>
            Import multiple customers from CSV or Excel files
          </DialogDescription>
        </DialogHeader>

        {isUploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Uploading customers...</span>
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