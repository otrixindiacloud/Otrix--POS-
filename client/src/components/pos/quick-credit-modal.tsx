import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Coins, CreditCard, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Customer } from "@shared/schema";

interface QuickCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
}

const quickCreditSchema = z.object({
  type: z.enum(["payment", "charge"]),
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Amount must be a positive number",
  }),
  paymentMethod: z.string().min(1, "Payment method is required"),
  description: z.string().optional(),
});

type QuickCreditForm = z.infer<typeof quickCreditSchema>;

export default function QuickCreditModal({ 
  isOpen, 
  onClose, 
  customer 
}: QuickCreditModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<QuickCreditForm>({
    resolver: zodResolver(quickCreditSchema),
    defaultValues: {
      type: "payment",
      amount: "",
      paymentMethod: "",
      description: "",
    },
  });

  const createQuickCreditMutation = useMutation({
    mutationFn: async (data: QuickCreditForm) => {
      const currentBalance = parseFloat(customer.creditBalance || "0");
      const amount = parseFloat(data.amount);
      
      let newBalance: number;
      if (data.type === "charge") {
        newBalance = currentBalance + amount;
      } else {
        newBalance = currentBalance - amount;
      }

      const creditTransactionData = {
        customerId: customer.id,
        type: data.type,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        description: data.description || `Quick ${data.type} via POS`,
        previousBalance: currentBalance.toFixed(2),
        newBalance: newBalance.toFixed(2),
      };

      return apiRequest({
        url: "/api/credit-transactions",
        method: "POST",
        body: creditTransactionData,
      });
    },
    onSuccess: () => {
      toast({
        title: "Credit updated",
        description: "Customer credit balance has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      form.reset();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update credit",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: QuickCreditForm) => {
    createQuickCreditMutation.mutate(data);
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(typeof amount === 'string' ? parseFloat(amount) : amount);
  };

  const currentBalance = parseFloat(customer.creditBalance || "0");
  const amount = parseFloat(form.watch("amount") || "0");
  const type = form.watch("type");
  const newBalance = type === "charge" ? currentBalance + amount : currentBalance - amount;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <CreditCard className="w-5 h-5 mr-2" />
            Quick Credit Update
          </DialogTitle>
          <DialogDescription>
            Update {customer.name}'s credit balance quickly
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Balance */}
          <div className="bg-slate-50 p-3 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Current Balance:</span>
              <span className="font-semibold text-lg">
                {formatCurrency(customer.creditBalance || "0")}
              </span>
            </div>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="type">Action</Label>
                <Select
                  value={form.watch("type")}
                  onValueChange={(value) => form.setValue("type", value as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payment">Payment (-)</SelectItem>
                    <SelectItem value="charge">Charge (+)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="amount">Amount</Label>
                <div className="relative">
                  <Coins className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="pl-10"
                    {...form.register("amount")}
                  />
                </div>
                {form.formState.errors.amount && (
                  <div className="flex items-start gap-2 mt-1 p-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                      {form.formState.errors.amount.message}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select
                value={form.watch("paymentMethod")}
                onValueChange={(value) => form.setValue("paymentMethod", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Credit/Debit Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.paymentMethod && (
                <div className="flex items-start gap-2 mt-1 p-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                    {form.formState.errors.paymentMethod.message}
                  </p>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                placeholder="Payment description..."
                {...form.register("description")}
              />
            </div>

            {/* Preview New Balance */}
            {amount > 0 && (
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-blue-700">New Balance:</span>
                  <span className={`font-semibold text-lg ${newBalance >= 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {formatCurrency(newBalance)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createQuickCreditMutation.isPending}
              >
                {createQuickCreditMutation.isPending ? (
                  "Processing..."
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Update Credit
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}