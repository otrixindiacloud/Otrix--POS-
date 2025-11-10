import { usePOSStore } from "@/lib/pos-store";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { User, X } from "lucide-react";

export default function CustomerCreditModal() {
  const {
    isCreditModalOpen,
    closeCreditModal,
    currentCustomer
  } = usePOSStore();

  if (!isCreditModalOpen || !currentCustomer) return null;

  const creditBalance = parseFloat(String(currentCustomer.creditBalance || "0"));
  const creditLimit = parseFloat(String(currentCustomer.creditLimit || "0"));
  const availableCredit = creditLimit - creditBalance;

  return (
    <Dialog open={isCreditModalOpen} onOpenChange={closeCreditModal}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Customer Credit Account</DialogTitle>
          <DialogDescription>
            View customer credit account details including balance, limit, and available credit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Info */}
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <User className="w-8 h-8 text-green-600" />
            </div>
            <h4 className="text-lg font-semibold text-slate-800">
              {currentCustomer.name}
            </h4>
            <p className="text-slate-600">Customer #{currentCustomer.id}</p>
          </div>

          {/* Credit Details */}
          <div className="space-y-4">
            <Card className="bg-slate-50">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Current Balance:</span>
                  <span className="text-xl font-bold text-green-600">
                    ${creditBalance.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-50">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Credit Limit:</span>
                  <span className="font-semibold text-slate-800">
                    ${creditLimit.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-50">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Available Credit:</span>
                  <span className="font-semibold text-primary">
                    ${availableCredit.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={closeCreditModal}
            className="flex-1 touch-friendly"
          >
            <X className="w-4 h-4 mr-2" />
            Close & Return to POS
          </Button>
          
          <Button
            onClick={closeCreditModal}
            className="flex-1 touch-friendly"
          >
            Use Credit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
