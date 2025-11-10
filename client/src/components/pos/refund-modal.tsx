import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Transaction } from "@shared/schema";

interface RefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction;
}

const refundSchema = z.object({
  refundAmount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Refund amount must be a positive number",
  }),
  reason: z.string().min(5, "Reason must be at least 5 characters"),
});

type RefundForm = z.infer<typeof refundSchema>;

export default function RefundModal({ isOpen, onClose, transaction }: RefundModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<RefundForm>({
    resolver: zodResolver(refundSchema),
    defaultValues: {
      refundAmount: transaction.total,
      reason: "",
    },
  });

  const refundMutation = useMutation({
    mutationFn: async (data: RefundForm) => {
      return apiRequest({
        url: `/api/transactions/${transaction.id}/refund`,
        method: "POST",
        body: {
          refundAmount: data.refundAmount,
          reason: data.reason,
          refundedBy: 1 // Current user ID - should come from auth context
        },
      });
    },
    onSuccess: () => {
      toast({
        title: "Refund Processed",
        description: "Transaction has been successfully refunded.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      form.reset();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Refund Failed",
        description: error.message || "Failed to process refund",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RefundForm) => {
    refundMutation.mutate(data);
  };

  const maxRefundAmount = parseFloat(transaction.total);
  const currentRefundAmount = parseFloat(form.watch("refundAmount") || "0");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md" aria-describedby="refund-description">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <RefreshCw className="w-5 h-5 mr-2 text-orange-600" />
            Refund Transaction
          </DialogTitle>
          <DialogDescription id="refund-description">
            Process a refund for transaction #{transaction.transactionNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Transaction Info */}
          <div className="bg-slate-50 p-3 rounded-lg">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-slate-600">Transaction:</span>
                <div className="font-semibold">#{transaction.transactionNumber}</div>
              </div>
              <div>
                <span className="text-slate-600">Original Amount:</span>
                <div className="font-semibold">QR {parseFloat(transaction.total).toFixed(2)}</div>
              </div>
              <div>
                <span className="text-slate-600">Payment Method:</span>
                <div className="font-semibold capitalize">{transaction.paymentMethod}</div>
              </div>
              <div>
                <span className="text-slate-600">Status:</span>
                <div className="font-semibold capitalize">{transaction.status}</div>
              </div>
            </div>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="refundAmount">Refund Amount (QR)</Label>
              <Input
                id="refundAmount"
                type="number"
                step="0.01"
                max={maxRefundAmount}
                placeholder="0.00"
                {...form.register("refundAmount")}
              />
              {form.formState.errors.refundAmount && (
                <p className="text-sm text-red-600 mt-1">
                  {form.formState.errors.refundAmount.message}
                </p>
              )}
              {currentRefundAmount > maxRefundAmount && (
                <div className="flex items-center gap-1 text-red-600 text-xs mt-1">
                  <AlertTriangle className="w-3 h-3" />
                  Cannot exceed original amount
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="reason">Refund Reason</Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for refund (required)..."
                rows={3}
                {...form.register("reason")}
              />
              {form.formState.errors.reason && (
                <p className="text-sm text-red-600 mt-1">
                  {form.formState.errors.reason.message}
                </p>
              )}
            </div>

            {/* Warning Message */}
            <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5" />
                <div className="text-sm text-orange-800">
                  <div className="font-medium">Important:</div>
                  <ul className="text-xs mt-1 space-y-1">
                    <li>• This action cannot be undone</li>
                    <li>• Stock will be restored for refunded items</li>
                    <li>• Requires supervisor approval</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={refundMutation.isPending || currentRefundAmount > maxRefundAmount}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {refundMutation.isPending ? (
                  "Processing..."
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Process Refund
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