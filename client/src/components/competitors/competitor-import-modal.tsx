import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Upload,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  FileJson,
  Search,
  Plus,
  Link as LinkIcon,
} from "lucide-react";

interface CompetitorProduct {
  name: string;
  sku?: string;
  barcode?: string;
  price: number;
  originalPrice?: number;
  url?: string;
  imageUrl?: string;
  description?: string;
  availability?: string;
}

interface ProductMatch {
  productId: number;
  productName: string;
  productSku: string;
  productBarcode: string | null;
  productPrice: string;
  confidence: number;
  matchReason: string;
}

interface CompetitorImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  competitorId?: number;
  initialCompetitor?: any;
}

export default function CompetitorImportModal({
  isOpen,
  onClose,
  competitorId: initialCompetitorId,
  initialCompetitor,
}: CompetitorImportModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'input' | 'review' | 'results'>('input');
  const [inputMethod, setInputMethod] = useState<'manual' | 'json' | 'url' | 'scrape'>('manual');
  const [competitorId, setCompetitorId] = useState<string>(
    initialCompetitorId?.toString() || initialCompetitor?.id?.toString() || ""
  );
  
  // Manual input states
  const [productName, setProductName] = useState("");
  const [productSku, setProductSku] = useState("");
  const [productBarcode, setProductBarcode] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productUrl, setProductUrl] = useState("");
  
  // JSON input
  const [jsonInput, setJsonInput] = useState("");
  
  // URL extraction
  const [extractUrl, setExtractUrl] = useState("");
  
  // Portal scraping
  const [portalUrl, setPortalUrl] = useState("");
  const [maxProducts, setMaxProducts] = useState("1000");
  const [isScraping, setIsScraping] = useState(false);
  
  // Review data
  const [products, setProducts] = useState<CompetitorProduct[]>([]);
  const [matches, setMatches] = useState<Map<string, ProductMatch | null>>(new Map());
  const [importResults, setImportResults] = useState<any>(null);

  // Fetch competitors
  const { data: competitors = [] } = useQuery({
    queryKey: ["competitors"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/competitors?activeOnly=true`);
      return await response.json();
    },
  });

  // AI Match mutation
  const matchMutation = useMutation({
    mutationFn: async (product: CompetitorProduct) => {
      const response = await apiRequest("POST", "/api/competitors/suggest-matches", {
        competitorProduct: product,
        limit: 1,
      });
      return await response.json();
    },
  });

  // Extract from URL mutation
  const extractMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await apiRequest("POST", "/api/competitors/extract-from-url", { url });
      return await response.json();
    },
    onSuccess: async (data) => {
      if (data.success && data.product) {
        // Create product from extracted data
        const extractedProduct: CompetitorProduct = {
          name: data.product.name || "",
          sku: data.product.sku || undefined,
          barcode: data.product.barcode || undefined,
          price: parseFloat(data.product.price) || 0,
          url: extractUrl,
          imageUrl: data.product.imageUrl || undefined,
          description: data.product.description || undefined,
          availability: data.product.availability || undefined,
        };
        
        // Add to products list
        setProducts([extractedProduct]);
        
        toast({
          title: "Product Info Extracted",
          description: "Product information extracted from URL. Matching with catalog...",
        });
        
        // Automatically match the product
        try {
          const matchResult = await matchMutation.mutateAsync(extractedProduct);
          const newMatches = new Map<string, ProductMatch | null>();
          
          if (matchResult.suggestions && matchResult.suggestions.length > 0) {
            newMatches.set(extractedProduct.name, matchResult.suggestions[0]);
            toast({
              title: "Match Found",
              description: `Matched to: ${matchResult.suggestions[0].productName}`,
            });
          } else {
            newMatches.set(extractedProduct.name, null);
            toast({
              title: "No Match Found",
              description: "Could not find matching product in catalog",
              variant: "destructive",
            });
          }
          
          setMatches(newMatches);
          setStep('review');
        } catch (error) {
          // If matching fails, still show the review step
          setMatches(new Map([[extractedProduct.name, null]]));
          setStep('review');
          toast({
            title: "Matching Error",
            description: "Could not match product, but you can still review it",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Extraction Failed",
          description: data.message || "Could not extract product info",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Extraction Error",
        description: error.message || "Failed to extract product information",
        variant: "destructive",
      });
    },
  });

  // Scrape portal mutation
  const scrapeMutation = useMutation({
    mutationFn: async (data: { url: string; maxProducts: number }) => {
      const response = await apiRequest("POST", "/api/competitors/scrape-portal", data);
      return await response.json();
    },
    onSuccess: async (data) => {
      if (data.success && data.products) {
        setProducts(data.products);
        setStep('review');
        
        toast({
          title: "Scraping Complete",
          description: `Found ${data.totalFound} products. Matching with your catalog...`,
        });
        
        // Auto-match all scraped products
        const newMatches = new Map<string, ProductMatch | null>();
        let matchedCount = 0;
        let totalProducts = data.products.length;
        
        for (let i = 0; i < data.products.length; i++) {
          const product = data.products[i];
          try {
            const result = await matchMutation.mutateAsync(product);
            if (result.suggestions && result.suggestions.length > 0) {
              newMatches.set(product.name, result.suggestions[0]);
              matchedCount++;
            } else {
              newMatches.set(product.name, null);
            }
          } catch (error) {
            newMatches.set(product.name, null);
          }
          
          // Update progress
          if ((i + 1) % 10 === 0 || i === data.products.length - 1) {
            toast({
              title: "Matching Progress",
              description: `Matched ${i + 1}/${totalProducts} products (${matchedCount} found)`,
            });
          }
        }
        
        setMatches(newMatches);
        
        toast({
          title: "Matching Complete",
          description: `${matchedCount} of ${totalProducts} products matched to your catalog`,
        });
      } else {
        toast({
          title: "Scraping Failed",
          description: data.message || "Could not scrape products from portal",
          variant: "destructive",
        });
      }
      setIsScraping(false);
    },
    onError: (error: any) => {
      toast({
        title: "Scraping Error",
        description: error.message || "Failed to scrape portal",
        variant: "destructive",
      });
      setIsScraping(false);
    },
  });

  // Batch import mutation
  const importMutation = useMutation({
    mutationFn: async (data: { competitorId: number; products: CompetitorProduct[] }) => {
      const response = await apiRequest("POST", "/api/competitors/batch-import", data);
      return await response.json();
    },
    onSuccess: (results) => {
      setImportResults(results);
      setStep('results');
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
      toast({
        title: "Import Complete",
        description: `${results.matched} products matched, ${results.unmatched} unmatched`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Import to inventory mutation
  const importToInventoryMutation = useMutation({
    mutationFn: async (products: CompetitorProduct[]) => {
      // Convert competitor products to inventory products
      const inventoryProducts = products.map((p) => {
        // Clean and validate price
        let cleanPrice = typeof p.price === 'number' ? p.price : parseFloat(String(p.price).replace(/[^0-9.]/g, ''));
        if (isNaN(cleanPrice)) cleanPrice = 0;

        return {
          name: p.name?.trim() || 'Unknown Product',
          sku: p.sku || `COMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          barcode: p.barcode || undefined,
          price: cleanPrice.toFixed(2),
          cost: p.originalPrice ? parseFloat(String(p.originalPrice).replace(/[^0-9.]/g, '')).toFixed(2) : undefined,
          description: p.description || undefined,
          imageUrl: p.imageUrl || undefined,
          quantity: 0,
          stock: 0,
          category: 'Imported',
        };
      });

      const response = await apiRequest("POST", "/api/products/bulk", {
        products: inventoryProducts,
      });
      return await response.json();
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      
      if (results.errors && results.errors.length > 0) {
        console.error('Import errors:', results.errors);
      }
      
      toast({
        title: "Products Added to Inventory",
        description: `${results.created} products added successfully${results.failed > 0 ? `. ${results.failed} failed - check console for details` : ""}`,
        variant: results.created > 0 ? "default" : "destructive",
      });
      
      if (results.created > 0) {
        handleClose();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import products to inventory",
        variant: "destructive",
      });
    },
  });

  const handleAddProduct = async () => {
    if (!productName || !productPrice) {
      toast({
        title: "Validation Error",
        description: "Product name and price are required",
        variant: "destructive",
      });
      return;
    }

    const product: CompetitorProduct = {
      name: productName,
      sku: productSku || undefined,
      barcode: productBarcode || undefined,
      price: parseFloat(productPrice),
      url: productUrl || undefined,
    };

    setProducts([...products, product]);
    
    // Clear form
    setProductName("");
    setProductSku("");
    setProductBarcode("");
    setProductPrice("");
    setProductUrl("");

    toast({
      title: "Product Added",
      description: "Product added to import queue",
    });
  };

  const handleParseJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      const productArray = Array.isArray(parsed) ? parsed : [parsed];
      
      const validProducts = productArray.filter(
        (p: any) => p.name && p.price
      );

      if (validProducts.length === 0) {
        toast({
          title: "No Valid Products",
          description: "No valid products found in JSON",
          variant: "destructive",
        });
        return;
      }

      setProducts(validProducts);
      setStep('review');
      toast({
        title: "JSON Parsed",
        description: `${validProducts.length} products loaded`,
      });
    } catch (error) {
      toast({
        title: "Parse Error",
        description: "Invalid JSON format",
        variant: "destructive",
      });
    }
  };

  const handleReviewAndMatch = async () => {
    if (products.length === 0) {
      toast({
        title: "No Products",
        description: "Add at least one product to continue",
        variant: "destructive",
      });
      return;
    }

    setStep('review');
    
    // Try to match each product
    const newMatches = new Map<string, ProductMatch | null>();
    
    for (const product of products) {
      try {
        const result = await matchMutation.mutateAsync(product);
        if (result.suggestions && result.suggestions.length > 0) {
          newMatches.set(product.name, result.suggestions[0]);
        } else {
          newMatches.set(product.name, null);
        }
      } catch (error) {
        newMatches.set(product.name, null);
      }
    }
    
    setMatches(newMatches);
  };

  const handleImport = () => {
    if (!competitorId) {
      toast({
        title: "Validation Error",
        description: "Please select a competitor",
        variant: "destructive",
      });
      return;
    }

    importMutation.mutate({
      competitorId: parseInt(competitorId),
      products,
    });
  };

  const handleClose = () => {
    setStep('input');
    setProducts([]);
    setMatches(new Map());
    setImportResults(null);
    setJsonInput("");
    setProductName("");
    setProductSku("");
    setProductBarcode("");
    setProductPrice("");
    setProductUrl("");
    setExtractUrl("");
    setPortalUrl("");
    setMaxProducts("1000");
    setIsScraping(false);
    onClose();
  };

  const getMatchBadge = (match: ProductMatch | null | undefined) => {
    if (!match) {
      return <Badge variant="destructive">No Match</Badge>;
    }
    
    if (match.confidence >= 90) {
      return <Badge className="bg-green-500">High ({match.confidence}%)</Badge>;
    }
    if (match.confidence >= 70) {
      return <Badge className="bg-yellow-500">Medium ({match.confidence}%)</Badge>;
    }
    return <Badge variant="secondary">Low ({match.confidence}%)</Badge>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            AI-Powered Product Import
          </DialogTitle>
          <DialogDescription>
            Import competitor products and automatically match them to your catalog using AI
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-6">
            {/* Competitor Selection */}
            <div>
              <Label>Select Competitor *</Label>
              <Select value={competitorId} onValueChange={setCompetitorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose competitor" />
                </SelectTrigger>
                <SelectContent>
                  {competitors.map((comp: any) => (
                    <SelectItem key={comp.id} value={comp.id.toString()}>
                      {comp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Input Method Selection */}
            <div>
              <Label>Input Method</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                <Button
                  variant={inputMethod === 'manual' ? 'default' : 'outline'}
                  onClick={() => setInputMethod('manual')}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Manual Entry
                </Button>
                <Button
                  variant={inputMethod === 'json' ? 'default' : 'outline'}
                  onClick={() => setInputMethod('json')}
                  className="w-full"
                >
                  <FileJson className="w-4 h-4 mr-2" />
                  JSON Import
                </Button>
                <Button
                  variant={inputMethod === 'url' ? 'default' : 'outline'}
                  onClick={() => setInputMethod('url')}
                  className="w-full"
                >
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Single Product
                </Button>
                <Button
                  variant={inputMethod === 'scrape' ? 'default' : 'outline'}
                  onClick={() => setInputMethod('scrape')}
                  className="w-full"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Scrape Portal
                </Button>
              </div>
            </div>

            {/* Manual Entry Form */}
            {inputMethod === 'manual' && (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>Product Name *</Label>
                      <Input
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        placeholder="e.g., Coca Cola 330ml"
                      />
                    </div>
                    <div>
                      <Label>SKU</Label>
                      <Input
                        value={productSku}
                        onChange={(e) => setProductSku(e.target.value)}
                        placeholder="Competitor's SKU"
                      />
                    </div>
                    <div>
                      <Label>Barcode</Label>
                      <Input
                        value={productBarcode}
                        onChange={(e) => setProductBarcode(e.target.value)}
                        placeholder="Barcode number"
                      />
                    </div>
                    <div>
                      <Label>Price (QR) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={productPrice}
                        onChange={(e) => setProductPrice(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label>Product URL</Label>
                      <Input
                        value={productUrl}
                        onChange={(e) => setProductUrl(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                  <Button onClick={handleAddProduct} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Product
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* JSON Import */}
            {inputMethod === 'json' && (
              <div className="space-y-2">
                <Label>JSON Data</Label>
                <Textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder='[{"name":"Product 1","price":10.99,"sku":"SKU123","barcode":"123456"}]'
                  rows={10}
                  className="font-mono text-sm"
                />
                <Button onClick={handleParseJson} className="w-full">
                  <FileJson className="w-4 h-4 mr-2" />
                  Parse JSON
                </Button>
              </div>
            )}

            {/* URL Extraction */}
            {inputMethod === 'url' && (
              <div className="space-y-4">
                <div>
                  <Label>Product URL</Label>
                  <div className="flex gap-2">
                    <Input
                      value={extractUrl}
                      onChange={(e) => setExtractUrl(e.target.value)}
                      placeholder="https://competitor.com/product/..."
                    />
                    <Button
                      onClick={() => extractMutation.mutate(extractUrl)}
                      disabled={!extractUrl || extractMutation.isPending}
                    >
                      {extractMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    AI will extract product information from the URL
                  </p>
                </div>
              </div>
            )}

            {/* Portal Scraping */}
            {inputMethod === 'scrape' && (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <Label>E-commerce Portal URL *</Label>
                    <Input
                      value={portalUrl}
                      onChange={(e) => setPortalUrl(e.target.value)}
                      placeholder="https://ansargallery.com or https://competitor.com/products"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter the main product listing page URL (e.g., ansargallery.com/products)
                    </p>
                  </div>
                  <div>
                    <Label>Max Products to Scrape</Label>
                    <Input
                      type="number"
                      value={maxProducts}
                      onChange={(e) => setMaxProducts(e.target.value)}
                      placeholder="1000"
                      min="1"
                      max="10000"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Limit the number of products to scrape (default: 1000)
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      if (!portalUrl) {
                        toast({
                          title: "URL Required",
                          description: "Please enter a portal URL",
                          variant: "destructive",
                        });
                        return;
                      }
                      setIsScraping(true);
                      scrapeMutation.mutate({
                        url: portalUrl,
                        maxProducts: parseInt(maxProducts) || 1000,
                      });
                    }}
                    disabled={!portalUrl || isScraping || scrapeMutation.isPending}
                    className="w-full"
                  >
                    {isScraping || scrapeMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Scraping Products...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 mr-2" />
                        Scrape All Products
                      </>
                    )}
                  </Button>
                  {isScraping && (
                    <div className="text-sm text-gray-600 text-center">
                      This may take a few minutes. Please wait...
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Product Queue */}
            {products.length > 0 && (
              <div>
                <Label>Products Queue ({products.length})</Label>
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                  {products.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm">{p.name}</span>
                      <span className="text-sm font-mono">QR {p.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Review Matches</h3>
              <Badge variant="outline">{products.length} Products</Badge>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competitor Product</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Match Status</TableHead>
                  <TableHead>Our Product</TableHead>
                  <TableHead>Our Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product, i) => {
                  const match = matches.get(product.name);
                  return (
                    <TableRow key={i}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{product.name}</div>
                          {product.sku && (
                            <div className="text-xs text-gray-500">SKU: {product.sku}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>QR {product.price.toFixed(2)}</TableCell>
                      <TableCell>{getMatchBadge(match)}</TableCell>
                      <TableCell>
                        {match ? (
                          <div>
                            <div className="font-medium">{match.productName}</div>
                            <div className="text-xs text-gray-500">{match.productSku}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {match ? `QR ${parseFloat(match.productPrice).toFixed(2)}` : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {step === 'results' && importResults && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{importResults.total}</div>
                  <div className="text-sm text-gray-600">Total</div>
                </CardContent>
              </Card>
              <Card className="bg-green-50">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-green-600">{importResults.matched}</div>
                  <div className="text-sm text-gray-600">Matched</div>
                </CardContent>
              </Card>
              <Card className="bg-yellow-50">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-yellow-600">{importResults.unmatched}</div>
                  <div className="text-sm text-gray-600">Unmatched</div>
                </CardContent>
              </Card>
              <Card className="bg-red-50">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-red-600">{importResults.errors}</div>
                  <div className="text-sm text-gray-600">Errors</div>
                </CardContent>
              </Card>
            </div>

            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importResults.details.map((detail: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{detail.competitorProduct}</TableCell>
                      <TableCell>
                        {detail.status === 'matched' && (
                          <Badge className="bg-green-500">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Matched
                          </Badge>
                        )}
                        {detail.status === 'unmatched' && (
                          <Badge variant="secondary">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Unmatched
                          </Badge>
                        )}
                        {detail.status === 'error' && (
                          <Badge variant="destructive">
                            <XCircle className="w-3 h-3 mr-1" />
                            Error
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {detail.ourProduct && (
                          <div>
                            Matched to: <span className="font-medium">{detail.ourProduct}</span>
                            {detail.confidence && ` (${detail.confidence}%)`}
                          </div>
                        )}
                        {detail.reason && <div className="text-gray-600">{detail.reason}</div>}
                        {detail.error && <div className="text-red-600">{detail.error}</div>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'input' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleReviewAndMatch}
                disabled={products.length === 0 || !competitorId || matchMutation.isPending}
              >
                {matchMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Matching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Review & Match
                  </>
                )}
              </Button>
            </>
          )}
          {step === 'review' && (
            <>
              <Button variant="outline" onClick={() => setStep('input')}>
                Back
              </Button>
              <Button
                variant="outline"
                onClick={() => importToInventoryMutation.mutate(products)}
                disabled={importToInventoryMutation.isPending}
              >
                {importToInventoryMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding to Inventory...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add to Inventory ({products.length})
                  </>
                )}
              </Button>
              <Button
                onClick={handleImport}
                disabled={importMutation.isPending || !competitorId}
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import as Competitor Prices ({products.length})
                  </>
                )}
              </Button>
            </>
          )}
          {step === 'results' && (
            <Button onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
