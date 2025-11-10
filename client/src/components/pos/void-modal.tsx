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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { XCircle, AlertTriangle, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Transaction } from "@shared/schema";

interface VoidModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction;
}

const voidSchema = z.object({
  reason: z.string().min(5, "Reason must be at least 5 characters"),
});

type VoidForm = z.infer<typeof voidSchema>;

export default function VoidModal({ isOpen, onClose, transaction }: VoidModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<VoidForm>({
    resolver: zodResolver(voidSchema),
    defaultValues: {
      reason: "",
    },
  });

  const voidMutation = useMutation({
    mutationFn: async (data: VoidForm) => {
      return apiRequest({
        url: `/api/transactions/${transaction.id}/void`,
        method: "POST",
        body: {
          reason: data.reason,
          voidedBy: 1 // Current user ID - should come from auth context
        },
      });
    },
    onSuccess: () => {
      toast({
        title: "Transaction Voided",
        description: "Transaction has been successfully voided.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      form.reset();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Void Failed",
        description: error.message || "Failed to void transaction",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: VoidForm) => {
    voidMutation.mutate(data);
  };

  // Check if transaction is eligible for voiding (same day)
  const transactionDate = transaction.createdAt ? new Date(transaction.createdAt) : new Date();
  const now = new Date();
  const daysDifference = Math.floor((now.getTime() - transactionDate.getTime()) / (1000 * 60 * 60 * 24));
  const canVoid = daysDifference === 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md" aria-describedby="void-description">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <XCircle className="w-5 h-5 mr-2 text-red-600" />
            Void Transaction
          </DialogTitle>
          <DialogDescription id="void-description">
            Void transaction #{transaction.transactionNumber} - This action cancels the transaction completely
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
                <span className="text-slate-600">Amount:</span>
                <div className="font-semibold">QR {parseFloat(transaction.total).toFixed(2)}</div>
              </div>
              <div>
                <span className="text-slate-600">Payment Method:</span>
                <div className="font-semibold capitalize">{transaction.paymentMethod}</div>
              </div>
              <div>
                <span className="text-slate-600">Date:</span>
                <div className="font-semibold">{transaction.createdAt ? new Date(transaction.createdAt).toLocaleDateString() : 'N/A'}</div>
              </div>
            </div>
          </div>

          {!canVoid ? (
            <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
                <div className="text-sm text-red-800">
                  <div className="font-medium">Cannot Void Transaction</div>
                  <p className="text-xs mt-1">
                    Transactions older than 1 day cannot be voided. Use refund instead.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="reason">Void Reason</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter reason for voiding this transaction (required)..."
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
              <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <div className="font-medium">Warning:</div>
                    <ul className="text-xs mt-1 space-y-1">
                      <li>• This action cannot be undone</li>
                      <li>• Transaction will be completely cancelled</li>
                      <li>• Stock will be restored for voided items</li>
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
                  disabled={voidMutation.isPending}
                  variant="destructive"
                >
                  {voidMutation.isPending ? (
                    "Processing..."
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 mr-2" />
                      Void Transaction
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {!canVoid && (
            <div className="flex justify-end pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}