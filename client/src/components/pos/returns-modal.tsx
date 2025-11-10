import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { RotateCcw, Search, Receipt, Package } from "lucide-react";
import { format } from "date-fns";
import type { Transaction, TransactionItem } from "@shared/schema";

type ReturnTransaction = Transaction & {
  customerName?: string | null;
  totalAmount?: string | null;
};

type ReturnTransactionItem = TransactionItem & {
  productName?: string | null;
  productSku?: string | null;
  productBarcode?: string | null;
};

interface ReturnsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ReturnItem {
  id: number;
  quantity: number;
  reason: string;
}

const formatDateTime = (value?: Date | string | null) => {
  if (!value) {
    return "N/A";
  }

  try {
    return format(new Date(value), "MMM dd, yyyy hh:mm a");
  } catch (error) {
    return "N/A";
  }
};

const toNumber = (value?: number | string | null) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

export default function ReturnsModal({ isOpen, onClose }: ReturnsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState<ReturnTransaction | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [returnReason, setReturnReason] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading } = useQuery<ReturnTransaction[]>({
    queryKey: ["/api/transactions"],
    enabled: isOpen,
  });

  const { data: transactionItems = [], isLoading: isLoadingItems } = useQuery<ReturnTransactionItem[]>({
    queryKey: [`/api/transactions/${selectedTransaction?.id}/items`],
    enabled: Boolean(selectedTransaction?.id),
  });

  // Debug logs removed to clean up console output

  const filteredTransactions = transactions.filter((tx) =>
    tx.transactionNumber.includes(searchQuery) ||
    tx.customerName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const processReturnMutation = useMutation({
    mutationFn: async (returnData: { transactionId: number; items: ReturnItem[]; reason: string }) => {
      return apiRequest({
        url: "/api/returns",
        method: "POST",
        body: returnData,
      });
    },
    onSuccess: () => {
      toast({
        title: "Return Processed",
        description: "The return has been processed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      resetForm();
    },
    onError: (error: { message?: string }) => {
      toast({
        title: "Return Failed",
        description: error.message || "Failed to process return",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSearchQuery("");
    setSelectedTransaction(null);
    setReturnItems([]);
    setReturnReason("");
  };

  const handleTransactionSelect = (transaction: ReturnTransaction) => {
    setSelectedTransaction(transaction);
    setReturnItems([]);
  };

  const handleItemToggle = (item: ReturnTransactionItem, checked: boolean) => {
    if (checked) {
      setReturnItems((prev) => [
        ...prev,
        {
          id: item.id,
          quantity: item.quantity,
          reason: returnReason,
        },
      ]);
      return;
    }

    setReturnItems((prev) => prev.filter((returnItem) => returnItem.id !== item.id));
  };

  const handleQuantityChange = (itemId: number, quantity: number) => {
    setReturnItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, quantity } : item))
    );
  };

  const handleProcessReturn = () => {
    if (!selectedTransaction || returnItems.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select items to return",
        variant: "destructive",
      });
      return;
    }

    const returnData = {
      transactionId: selectedTransaction.id,
      items: returnItems,
      reason: returnReason,
    };

    processReturnMutation.mutate(returnData);
  };

  const totalReturnAmount = returnItems.reduce((sum, returnItem) => {
    const item = transactionItems.find((ti) => ti.id === returnItem.id);
    const unitPrice = item ? toNumber(item.unitPrice) : 0;
    return sum + unitPrice * returnItem.quantity;
  }, 0);

  const resolveTransactionTotal = (transaction: ReturnTransaction) => {
    return toNumber(transaction.total ?? transaction.totalAmount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center">
            <RotateCcw className="w-5 h-5 mr-2" />
            Process Return
          </DialogTitle>
          <DialogDescription>
            Find and process returns for completed transactions
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6">
          {!selectedTransaction ? (
            <>
              {/* Search Transactions */}
              <div className="space-y-4 pb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by transaction number or customer name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="max-h-96 overflow-y-auto space-y-2">
                  {isLoading ? (
                    <div className="text-center py-8">Loading transactions...</div>
                  ) : filteredTransactions.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Receipt className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                      <p>No transactions found</p>
                    </div>
                  ) : (
                    filteredTransactions.map((transaction: ReturnTransaction) => (
                      <Card
                        key={transaction.id}
                        className="hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => handleTransactionSelect(transaction)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-slate-800">
                                Transaction #{transaction.transactionNumber}
                              </h4>
                              <p className="text-sm text-slate-600">
                                {formatDateTime(transaction.createdAt)}
                              </p>
                              {transaction.customerName && (
                                <p className="text-sm text-slate-600">
                                  Customer: {transaction.customerName}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <Badge variant="secondary">
                                QR {resolveTransactionTotal(transaction).toFixed(2)}
                              </Badge>
                              <p className="text-xs text-slate-500 mt-1 capitalize">
                                {transaction.paymentMethod}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Selected Transaction Details */}
              <div className="space-y-4 pb-4">
                <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Transaction #{selectedTransaction.transactionNumber}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTransaction(null)}
                    >
                      ← Back to Search
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p>
                        <strong>Date:</strong> {formatDateTime(selectedTransaction?.createdAt)}
                      </p>
                      <p>
                        <strong>Customer:</strong> {selectedTransaction?.customerName || "Walk-in"}
                      </p>
                    </div>
                    <div>
                      <p>
                        <strong>Total:</strong> QR {resolveTransactionTotal(selectedTransaction).toFixed(2)}
                      </p>
                      <p>
                        <strong>Payment:</strong> {selectedTransaction.paymentMethod}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Return Reason */}
              <div className="space-y-2">
                <Label htmlFor="returnReason">Return Reason</Label>
                <Input
                  id="returnReason"
                  placeholder="Enter reason for return..."
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                />
              </div>

              {/* Items to Return */}
              <div className="space-y-4">
                <h3 className="font-medium">Select Items to Return</h3>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {isLoadingItems ? (
                    <div className="text-center py-8">
                      <p className="text-slate-500">Loading items...</p>
                    </div>
                  ) : transactionItems.length === 0 ? (
                    <div className="text-center py-8">
                      <Package className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                      <p className="text-slate-500">No items found for this transaction</p>
                    </div>
                  ) : (
                    transactionItems.map((item: ReturnTransactionItem) => {
                      const isSelected = returnItems.some((ri) => ri.id === item.id);
                      const returnItem = returnItems.find((ri) => ri.id === item.id);
                      
                      // Get the unit price and quantity
                      const unitPrice = toNumber(item.unitPrice);
                      const quantity = item.quantity || 0;
                      const itemTotal = unitPrice * quantity;
                      
                      // Get product name from the joined data
                      const productName = item.productName || 'Unknown Product';

                      console.log("Item Debug:", {
                        id: item.id,
                        productName,
                        unitPrice: item.unitPrice,
                        parsedUnitPrice: unitPrice,
                        quantity,
                        itemTotal,
                        fullItem: item
                      });

                      return (
                        <Card key={item.id} className={isSelected ? "border-blue-500" : ""}>
                          <CardContent className="p-4">
                            <div className="flex items-center space-x-4">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => handleItemToggle(item, checked as boolean)}
                              />
                              <Package className="w-8 h-8 text-slate-400" />
                              <div className="flex-1">
                                <h4 className="font-medium">{productName}</h4>
                                <p className="text-sm text-slate-600">
                                  QR{unitPrice.toFixed(2)} × {quantity} = QR{itemTotal.toFixed(2)}
                                </p>
                              </div>
                              {isSelected && (
                                <div className="flex items-center space-x-2">
                                  <Label htmlFor={`qty-${item.id}`} className="text-sm">
                                    Qty:
                                  </Label>
                                  <Input
                                    id={`qty-${item.id}`}
                                    type="number"
                                    min="1"
                                    max={item.quantity}
                                    value={returnItem?.quantity || item.quantity}
                                    onChange={(e) =>
                                      handleQuantityChange(item.id, Math.max(1, parseInt(e.target.value) || 1))
                                    }
                                    className="w-16"
                                  />
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Return Summary */}
              {returnItems.length > 0 && (
                <Card className="bg-blue-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Return Summary</h4>
                        <p className="text-sm text-slate-600">
                          {returnItems.length} item(s) selected for return
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-blue-600">
                          QR {totalReturnAmount.toFixed(2)}
                        </p>
                        <p className="text-sm text-slate-600">Refund Amount</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              </div>
            </>
          )}
        </div>

        {/* Action Buttons - Fixed at bottom, outside scrollable area */}
        {selectedTransaction && (
          <div className="border-t px-6 py-4 bg-white">
            <div className="flex space-x-2">
              <Button
                onClick={handleProcessReturn}
                disabled={
                  returnItems.length === 0 || !returnReason.trim() || processReturnMutation.isPending
                }
                className="flex-1"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {processReturnMutation.isPending ? "Processing..." : "Process Return"}
              </Button>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}