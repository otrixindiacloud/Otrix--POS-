import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  Coins, 
  CreditCard, 
  Banknote, 
  Receipt,
  Save,
  X,
  History
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { SupplierInvoice, SupplierPayment } from "@shared/schema";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: SupplierInvoice;
}

export default function PaymentModal({ isOpen, onClose, invoice }: PaymentModalProps) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing payments
  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['/api/supplier-invoices', invoice.id, 'payments'],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/supplier-invoices/${invoice.id}/payments`);
      return await response.json();
    },
    enabled: isOpen,
  });

  // Ensure payments is always an array
  const payments = Array.isArray(paymentsData) ? paymentsData : [];

  const createPaymentMutation = useMutation({
    mutationFn: async (paymentData: any) => {
      const response = await apiRequest("POST", `/api/supplier-invoices/${invoice.id}/payments`, paymentData);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Payment recorded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/supplier-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/supplier-invoices', invoice.id, 'payments'] });
      handleReset();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to record payment. Please try again.",
        variant: "destructive",
      });
      console.error("Payment creation error:", error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      });
      return;
    }

    createPaymentMutation.mutate({
      amount,
      paymentMethod,
      reference,
      paymentDate,
      notes,
    });
  };

  const handleReset = () => {
    setAmount("");
    setPaymentMethod("cash");
    setReference("");
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setNotes("");
  };

  const totalPaid = payments.reduce((sum: number, payment: SupplierPayment) => 
    sum + (parseFloat(payment.amount) || 0), 0
  );
  const remainingBalance = (parseFloat(invoice.total) || 0) - totalPaid;
  const isFullyPaid = remainingBalance <= 0;

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Banknote className="w-4 h-4" />;
      case 'card': return <CreditCard className="w-4 h-4" />;
      case 'bank_transfer': return <Coins className="w-4 h-4" />;
      case 'check': return <Receipt className="w-4 h-4" />;
      default: return <Coins className="w-4 h-4" />;
    }
  };

  const handleQuickAmount = (percentage: number) => {
    const quickAmount = (remainingBalance * percentage / 100).toFixed(2);
    setAmount(quickAmount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5" />
            Record Payment - Invoice #{invoice.invoiceNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Payment Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>New Payment</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="amount">Amount *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={remainingBalance}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        disabled={isFullyPaid}
                      />
                      {!isFullyPaid && (
                        <div className="flex gap-1 mt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickAmount(25)}
                            className="text-xs"
                          >
                            25%
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickAmount(50)}
                            className="text-xs"
                          >
                            50%
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickAmount(100)}
                            className="text-xs"
                          >
                            Full
                          </Button>
                        </div>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="paymentMethod">Payment Method *</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                          <SelectItem value="check">Check</SelectItem>
                          <SelectItem value="credit">Credit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="reference">Reference</Label>
                      <Input
                        id="reference"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="Check number, transfer ID, etc."
                      />
                    </div>
                    <div>
                      <Label htmlFor="paymentDate">Payment Date *</Label>
                      <Input
                        id="paymentDate"
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Additional notes about this payment..."
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClose}
                      disabled={createPaymentMutation.isPending}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                    <Button 
                      type="submit"
                      disabled={createPaymentMutation.isPending || isFullyPaid}
                    >
                      <Save className="w-4 h-4 mr-1" />
                      {createPaymentMutation.isPending ? "Recording..." : "Record Payment"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Payment Summary & History */}
          <div className="space-y-6">
            {/* Financial Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="w-4 h-4" />
                  Payment Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span>Invoice Total:</span>
                  <span className="font-medium">QR {(parseFloat(invoice.total) || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Paid:</span>
                  <span className="font-medium text-green-600">QR {totalPaid.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Remaining:</span>
                  <span className={remainingBalance > 0 ? "text-orange-600" : "text-green-600"}>
                    QR {remainingBalance.toFixed(2)}
                  </span>
                </div>
                {isFullyPaid && (
                  <Badge className="w-full justify-center bg-green-100 text-green-800">
                    Fully Paid
                  </Badge>
                )}
              </CardContent>
            </Card>

            {/* Payment History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Payment History ({payments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {paymentsLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-500">Loading...</p>
                  </div>
                ) : payments.length > 0 ? (
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {payments.map((payment: SupplierPayment) => (
                      <div key={payment.id} className="border rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            {getPaymentMethodIcon(payment.paymentMethod)}
                            <span className="font-medium">${(parseFloat(payment.amount) || 0).toFixed(2)}</span>
                          </div>
                          <span className="text-sm text-gray-500">
                            {format(new Date(payment.paymentDate), 'MMM dd, yyyy')}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="capitalize">{payment.paymentMethod.replace('_', ' ')}</span>
                          {payment.reference && (
                            <span className="text-gray-500">Ref: {payment.reference}</span>
                          )}
                        </div>
                        {payment.notes && (
                          <p className="text-sm text-gray-600 mt-1">{payment.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <Coins className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No payments recorded yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}