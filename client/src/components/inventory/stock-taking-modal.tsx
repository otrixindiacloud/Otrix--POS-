import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Barcode, Plus, Trash2, Check, X, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface StockTakingItem {
  id?: number;
  productId?: number;
  sku: string;
  barcode?: string;
  name: string;
  uom: string;
  systemQty: number;
  actualQty: number;
  costPrice: number;
  sellingPrice: number;
  notes?: string;
  variance: number;
  varianceValue: number;
  isNewProduct: boolean;
}

interface StockTakingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StockTakingModal({ isOpen, onClose }: StockTakingModalProps) {
  const [items, setItems] = useState<StockTakingItem[]>([]);
  const [scanInput, setScanInput] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<StockTakingItem>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Submit stock taking mutation
  const submitMutation = useMutation({
    mutationFn: async (items: StockTakingItem[]) => {
      const response = await fetch('/api/stock-taking/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!response.ok) throw new Error('Failed to submit stock taking');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Stock Taking Completed",
        description: `Successfully processed ${data.session.totalItems} items. ${data.newProducts} new products created, ${data.updatedProducts} products updated.`,
      });
      setItems([]);
      setScanInput('');
      onClose();
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stock-taking/sessions'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const calculateVariance = (systemQty: number, actualQty: number, costPrice: number) => {
    const variance = actualQty - systemQty;
    const varianceValue = variance * costPrice;
    return { variance, varianceValue };
  };

  const handleScan = async () => {
    if (!scanInput.trim()) return;

    try {
      // First check if it's an exact barcode match
      let response = await fetch(`/api/products/barcode/${encodeURIComponent(scanInput)}`);
      let product = null;

      if (!response.ok) {
        // If not found by barcode, try SKU
        response = await fetch(`/api/products/sku/${encodeURIComponent(scanInput)}`);
        if (!response.ok) {
          // If still not found, search by general query
          response = await fetch(`/api/products/search?q=${encodeURIComponent(scanInput)}`);
          if (response.ok) {
            const products = await response.json();
            if (products.length === 1) {
              product = products[0];
            } else if (products.length > 1) {
              toast({
                title: "Multiple Products Found",
                description: `Found ${products.length} products. Please be more specific.`,
                variant: "destructive",
              });
              return;
            }
          }
        } else {
          product = await response.json();
        }
      } else {
        product = await response.json();
      }

      if (product) {
        // Check if already added
        const existingIndex = items.findIndex(item => item.productId === product.id);
        if (existingIndex >= 0) {
          toast({
            title: "Product Already Added",
            description: "This product is already in the stock taking list.",
            variant: "destructive",
          });
          return;
        }

        const newItem: StockTakingItem = {
          productId: product.id,
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
          uom: product.uom || 'ea',
          systemQty: product.stock || 0,
          actualQty: product.stock || 0,
          costPrice: parseFloat(product.costPrice || product.cost || '0'),
          sellingPrice: parseFloat(product.price || '0'),
          notes: '',
          variance: 0,
          varianceValue: 0,
          isNewProduct: false,
        };

        setItems([...items, newItem]);
        setScanInput('');
        toast({
          title: "Product Added",
          description: `${product.name} added to stock taking.`,
        });
      } else {
        // Product not found - create new product entry
        const newItem: StockTakingItem = {
          sku: scanInput,
          barcode: scanInput,
          name: `New Product - ${scanInput}`,
          uom: 'ea',
          systemQty: 0,
          actualQty: 0,
          costPrice: 0,
          sellingPrice: 0,
          notes: '',
          variance: 0,
          varianceValue: 0,
          isNewProduct: true,
        };

        setItems([...items, newItem]);
        setScanInput('');
        toast({
          title: "New Product Added",
          description: "Product not found in system. Added as new product.",
        });
      }
    } catch (error) {
      console.error('Scan error:', error);
      toast({
        title: "Scan Error",
        description: "Failed to process scan input.",
        variant: "destructive",
      });
    }
  };

  const handleEditStart = (index: number) => {
    setEditingIndex(index);
    setEditForm({ ...items[index] });
  };

  const handleEditSave = () => {
    if (editingIndex === null) return;

    const updatedItem = { ...items[editingIndex], ...editForm };
    const { variance, varianceValue } = calculateVariance(
      updatedItem.systemQty,
      updatedItem.actualQty,
      updatedItem.costPrice
    );
    updatedItem.variance = variance;
    updatedItem.varianceValue = varianceValue;

    const newItems = [...items];
    newItems[editingIndex] = updatedItem;
    setItems(newItems);
    setEditingIndex(null);
    setEditForm({});
  };

  const handleEditCancel = () => {
    setEditingIndex(null);
    setEditForm({});
  };

  const handleActualQtyChange = (index: number, value: string) => {
    const actualQty = parseFloat(value) || 0;
    const item = items[index];
    const { variance, varianceValue } = calculateVariance(item.systemQty, actualQty, item.costPrice);
    
    const newItems = [...items];
    newItems[index] = {
      ...item,
      actualQty,
      variance,
      varianceValue,
    };
    setItems(newItems);
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast({
        title: "No Items",
        description: "Please add at least one item to submit.",
        variant: "destructive",
      });
      return;
    }

    submitMutation.mutate(items);
  };

  const handleAddManual = () => {
    const newItem: StockTakingItem = {
      sku: `NEW-${Date.now()}`,
      name: 'New Product',
      uom: 'ea',
      systemQty: 0,
      actualQty: 0,
      costPrice: 0,
      sellingPrice: 0,
      notes: '',
      variance: 0,
      varianceValue: 0,
      isNewProduct: true,
    };
    setItems([...items, newItem]);
    setEditingIndex(items.length);
    setEditForm(newItem);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Physical Stock Taking</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Scanner Section */}
          <div className="border rounded-lg p-4">
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Scan barcode or enter SKU..."
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleScan()}
                className="flex-1"
              />
              <Button onClick={handleScan} disabled={!scanInput.trim()}>
                <Barcode className="w-4 h-4 mr-2" />
                Scan/Search
              </Button>
              <Button onClick={handleAddManual} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Manual
              </Button>
            </div>
          </div>

          {/* Items Table */}
          <div className="border rounded-lg">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="text-left p-3">SKU</th>
                    <th className="text-left p-3">Product Name</th>
                    <th className="text-left p-3">UOM</th>
                    <th className="text-left p-3">System Qty</th>
                    <th className="text-left p-3">Actual Qty</th>
                    <th className="text-left p-3">Variance</th>
                    <th className="text-left p-3">Cost</th>
                    <th className="text-left p-3">Price</th>
                    <th className="text-left p-3">Notes</th>
                    <th className="text-left p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center p-8 text-muted-foreground">
                        No items scanned yet. Use the scanner above to add products.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, index) => (
                      <tr key={index} className={`border-b ${item.isNewProduct ? 'bg-blue-50' : ''}`}>
                        <td className="p-3">
                          {editingIndex === index ? (
                            <Input
                              value={editForm.sku || ''}
                              onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                              className="w-20"
                            />
                          ) : (
                            <span className={item.isNewProduct ? 'text-blue-600 font-medium' : ''}>
                              {item.sku}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {editingIndex === index ? (
                            <Input
                              value={editForm.name || ''}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="w-32"
                            />
                          ) : (
                            <span className={item.isNewProduct ? 'text-blue-600 font-medium' : ''}>
                              {item.name}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {editingIndex === index ? (
                            <Input
                              value={editForm.uom || ''}
                              onChange={(e) => setEditForm({ ...editForm, uom: e.target.value })}
                              className="w-16"
                            />
                          ) : (
                            item.uom
                          )}
                        </td>
                        <td className="p-3">{item.systemQty}</td>
                        <td className="p-3">
                          {editingIndex === index ? (
                            <Input
                              type="number"
                              value={editForm.actualQty || 0}
                              onChange={(e) => setEditForm({ ...editForm, actualQty: parseFloat(e.target.value) || 0 })}
                              className="w-20"
                            />
                          ) : (
                            <Input
                              type="number"
                              value={item.actualQty}
                              onChange={(e) => handleActualQtyChange(index, e.target.value)}
                              className="w-20"
                            />
                          )}
                        </td>
                        <td className="p-3">
                          <span className={`font-medium ${
                            item.variance > 0 ? 'text-green-600' : 
                            item.variance < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {item.variance > 0 ? '+' : ''}{item.variance}
                          </span>
                          <div className="text-xs text-muted-foreground">
                            ${item.varianceValue.toFixed(2)}
                          </div>
                        </td>
                        <td className="p-3">
                          {editingIndex === index ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={editForm.costPrice || 0}
                              onChange={(e) => setEditForm({ ...editForm, costPrice: parseFloat(e.target.value) || 0 })}
                              className="w-20"
                            />
                          ) : (
                            `$${item.costPrice.toFixed(2)}`
                          )}
                        </td>
                        <td className="p-3">
                          {editingIndex === index ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={editForm.sellingPrice || 0}
                              onChange={(e) => setEditForm({ ...editForm, sellingPrice: parseFloat(e.target.value) || 0 })}
                              className="w-20"
                            />
                          ) : (
                            `$${item.sellingPrice.toFixed(2)}`
                          )}
                        </td>
                        <td className="p-3">
                          {editingIndex === index ? (
                            <Input
                              value={editForm.notes || ''}
                              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                              className="w-24"
                            />
                          ) : (
                            item.notes || '-'
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            {editingIndex === index ? (
                              <>
                                <Button variant="ghost" size="sm" onClick={handleEditSave}>
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={handleEditCancel}>
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => handleEditStart(index)}>
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setItems(items.filter((_, i) => i !== index))}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          {items.length > 0 && (
            <div className="border rounded-lg p-4 bg-muted/50">
              <h3 className="font-medium mb-2">Summary</h3>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Items:</span>
                  <span className="ml-2 font-medium">{items.length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">New Products:</span>
                  <span className="ml-2 font-medium text-blue-600">{items.filter(i => i.isNewProduct).length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Variance Items:</span>
                  <span className="ml-2 font-medium">{items.filter(i => i.variance !== 0).length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Variance Value:</span>
                  <span className={`ml-2 font-medium ${
                    items.reduce((sum, item) => sum + item.varianceValue, 0) > 0 ? 'text-green-600' : 
                    items.reduce((sum, item) => sum + item.varianceValue, 0) < 0 ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    ${items.reduce((sum, item) => sum + item.varianceValue, 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={items.length === 0 || submitMutation.isPending}
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit Stock Taking'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}