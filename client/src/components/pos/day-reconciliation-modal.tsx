import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  Calculator, 
  Coins, 
  CreditCard, 
  Banknote,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  User,
  TrendingUp,
  Calendar as CalendarIcon
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePOSStore } from "@/lib/pos-store";
import { cn } from "@/lib/utils";

interface DayReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayOperation: any;
}

interface CashDenomination {
  value: number;
  label: string;
  count: number;
}

interface ReconciliationData {
  // Cash counts
  cashCount_100: number;
  cashCount_50: number;
  cashCount_20: number;
  cashCount_10: number;
  cashCount_5: number;
  cashCount_1: number;
  cashCount_050: number;
  cashCount_025: number;
  cashCount_010: number;
  cashCount_005: number;
  
  // Miscellaneous amounts
  cashMiscAmount: number;
  cardMiscAmount: number;
  miscNotes: string;
  reconciliationNotes: string;
}

export default function DayReconciliationModal({ isOpen, onClose, dayOperation }: DayReconciliationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setCurrentDay, setIsDayOpen } = usePOSStore();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [reconciliationData, setReconciliationData] = useState<ReconciliationData>({
    cashCount_100: 0,
    cashCount_50: 0,
    cashCount_20: 0,
    cashCount_10: 0,
    cashCount_5: 0,
    cashCount_1: 0,
    cashCount_050: 0,
    cashCount_025: 0,
    cashCount_010: 0,
    cashCount_005: 0,
    cashMiscAmount: 0,
    cardMiscAmount: 0,
    miscNotes: "",
    reconciliationNotes: ""
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get transactions for selected date for reconciliation
  const { data: todayTransactions = [] } = useQuery({
    queryKey: ["/api/transactions", format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const response = await fetch(`/api/transactions/date/${dateStr}`);
      if (!response.ok) throw new Error('Failed to fetch transactions');
      return response.json();
    },
    enabled: isOpen
  });

  // Get day operation for selected date
  const { data: dayOpForDate } = useQuery({
    queryKey: ["/api/day-operations/date", format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const response = await fetch(`/api/day-operations/date/${dateStr}`);
      if (!response.ok) return null; // Return null if no day operation found
      return response.json();
    },
    enabled: isOpen
  });

  // Reset reconciliation data when date changes
  useEffect(() => {
    setReconciliationData({
      cashCount_100: 0,
      cashCount_50: 0,
      cashCount_20: 0,
      cashCount_10: 0,
      cashCount_5: 0,
      cashCount_1: 0,
      cashCount_050: 0,
      cashCount_025: 0,
      cashCount_010: 0,
      cashCount_005: 0,
      cashMiscAmount: 0,
      cardMiscAmount: 0,
      miscNotes: "",
      reconciliationNotes: ""
    });
  }, [selectedDate]);

  const cashDenominations: CashDenomination[] = [
    { value: 100, label: "QR 100", count: reconciliationData.cashCount_100 },
    { value: 50, label: "QR 50", count: reconciliationData.cashCount_50 },
    { value: 20, label: "QR 20", count: reconciliationData.cashCount_20 },
    { value: 10, label: "QR 10", count: reconciliationData.cashCount_10 },
    { value: 5, label: "QR 5", count: reconciliationData.cashCount_5 },
    { value: 1, label: "QR 1", count: reconciliationData.cashCount_1 },
    { value: 0.50, label: "50 Fils", count: reconciliationData.cashCount_050 },
    { value: 0.25, label: "25 Fils", count: reconciliationData.cashCount_025 },
    { value: 0.10, label: "10 Fils", count: reconciliationData.cashCount_010 },
    { value: 0.05, label: "5 Fils", count: reconciliationData.cashCount_005 }
  ];

  // Calculate totals from transaction data
  const calculateTotals = () => {
    const cashTransactions = todayTransactions.filter((t: any) => t.paymentMethod === 'cash');
    const cardTransactions = todayTransactions.filter((t: any) => t.paymentMethod === 'card');
    const creditTransactions = todayTransactions.filter((t: any) => t.paymentMethod === 'credit');

    const cashSales = cashTransactions.reduce((sum: number, t: any) => sum + parseFloat(t.total || "0"), 0);
    const cardSales = cardTransactions.reduce((sum: number, t: any) => sum + parseFloat(t.total || "0"), 0);
    const creditSales = creditTransactions.reduce((sum: number, t: any) => sum + parseFloat(t.total || "0"), 0);
    const totalSales = cashSales + cardSales + creditSales;

    return {
      totalSales,
      cashSales,
      cardSales,
      creditSales,
      totalTransactions: todayTransactions.length,
      cashTransactionCount: cashTransactions.length,
      cardTransactionCount: cardTransactions.length,
      creditTransactionCount: creditTransactions.length
    };
  };

  const totals = calculateTotals();

  // Calculate actual cash count from denominations
  const actualCashCount = cashDenominations.reduce((sum, denom) => {
    return sum + (denom.value * denom.count);
  }, 0) + reconciliationData.cashMiscAmount;

  // Calculate expected cash (opening + cash sales - cash purchases) using the selected date's day operation
  const currentDayOp = dayOpForDate || dayOperation;
  const expectedCash = parseFloat(currentDayOp?.openingCash || "0") + totals.cashSales;
  const cashVariance = actualCashCount - expectedCash;

  const updateCashCount = (denominationKey: keyof ReconciliationData, value: number) => {
    setReconciliationData(prev => ({
      ...prev,
      [denominationKey]: Math.max(0, value)
    }));
  };

  const closeDayMutation = useMutation({
    mutationFn: async () => {
      if (!dayOpForDate) {
        throw new Error('No day operation found for selected date');
      }

      const closingData = {
        ...totals,
        expectedCash: expectedCash,
        actualCashCount: actualCashCount,
        closingCash: actualCashCount,
        cashDifference: cashVariance,
        ...reconciliationData,
        status: 'closed',
        closedAt: new Date().toISOString()
      };

      console.log('📥 Closing day operation:', dayOpForDate.id, 'for date:', dayOpForDate.date);

      return apiRequest({
        url: `/api/day-operations/${dayOpForDate.id}/close`,
        method: "PATCH",
        body: closingData
      });
    },
    onSuccess: () => {
      toast({
        title: "Day Closed Successfully",
        description: "Daily reconciliation completed and day has been closed.",
      });
      setCurrentDay(null);
      setIsDayOpen(false);
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey?.[0];
          return typeof key === "string" && key.startsWith("/api/day-operations");
        }
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to close day. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = () => {
    setIsSubmitting(true);
    closeDayMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Day Close Reconciliation - {format(selectedDate, 'MMM d, yyyy')}
          </DialogTitle>
          <DialogDescription>
            Count your cash, review sales totals, and complete the daily reconciliation process for the selected date.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Date Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Select Date for Reconciliation</CardTitle>
            </CardHeader>
            <CardContent>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </CardContent>
          </Card>
          {/* Sales Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Daily Sales Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">QR {totals.totalSales.toFixed(2)}</div>
                  <div className="text-sm text-gray-500">Total Sales</div>
                  <div className="text-xs text-gray-400">{totals.totalTransactions} transactions</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-semibold">QR {totals.cashSales.toFixed(2)}</div>
                  <div className="text-sm text-gray-500">Cash Sales</div>
                  <div className="text-xs text-gray-400">{totals.cashTransactionCount} transactions</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-semibold">QR {totals.cardSales.toFixed(2)}</div>
                  <div className="text-sm text-gray-500">Card Sales</div>
                  <div className="text-xs text-gray-400">{totals.cardTransactionCount} transactions</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-semibold">QR {totals.creditSales.toFixed(2)}</div>
                  <div className="text-sm text-gray-500">Credit Sales</div>
                  <div className="text-xs text-gray-400">{totals.creditTransactionCount} transactions</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cash Count Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                Cash Count
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                {cashDenominations.map((denom, index) => (
                  <div key={denom.label} className="space-y-2">
                    <Label className="text-sm font-medium">{denom.label}</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        min="0"
                        value={denom.count}
                        onChange={(e) => {
                          const key = `cashCount_${denom.value.toString().replace('.', '')}` as keyof ReconciliationData;
                          const value = Math.max(0, parseInt(e.target.value) || 0);
                          updateCashCount(key, value);
                        }}
                        className="w-20 text-center"
                      />
                      <span className="text-sm text-gray-500">×</span>
                      <span className="text-sm font-medium">QR {(denom.value * denom.count).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cash Miscellaneous Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={reconciliationData.cashMiscAmount}
                    onChange={(e) => setReconciliationData(prev => ({
                      ...prev,
                      cashMiscAmount: Math.max(0, parseFloat(e.target.value) || 0)
                    }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Card Miscellaneous Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={reconciliationData.cardMiscAmount}
                    onChange={(e) => setReconciliationData(prev => ({
                      ...prev,
                      cardMiscAmount: Math.max(0, parseFloat(e.target.value) || 0)
                    }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cash Reconciliation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-4 w-4" />
                Cash Reconciliation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Opening Balance</Label>
                  <div className="text-lg font-semibold">QR {parseFloat(currentDayOp?.openingCash || "0").toFixed(2)}</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Expected Cash</Label>
                  <div className="text-lg font-semibold">QR {expectedCash.toFixed(2)}</div>
                  <div className="text-xs text-gray-500">Opening + Cash Sales</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Actual Cash Count</Label>
                  <div className="text-lg font-semibold">QR {actualCashCount.toFixed(2)}</div>
                  <div className="text-xs text-gray-500">Counted + Misc</div>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="text-center">
                <Label className="text-sm font-medium">Cash Variance</Label>
                <div className={`text-2xl font-bold ${cashVariance === 0 ? 'text-green-600' : cashVariance > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  QR {cashVariance.toFixed(2)}
                </div>
                {cashVariance !== 0 && (
                  <Badge variant={cashVariance > 0 ? "default" : "destructive"} className="mt-1">
                    {cashVariance > 0 ? "Over" : "Under"}
                  </Badge>
                )}
              </div>

              {Math.abs(cashVariance) > 5 && (
                <Alert className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Significant cash variance detected. Please recount and verify all transactions.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Notes Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Notes & Comments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Miscellaneous Notes</Label>
                <Textarea
                  value={reconciliationData.miscNotes}
                  onChange={(e) => setReconciliationData(prev => ({
                    ...prev,
                    miscNotes: e.target.value
                  }))}
                  placeholder="Notes about miscellaneous transactions, voids, or special circumstances..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Reconciliation Notes</Label>
                <Textarea
                  value={reconciliationData.reconciliationNotes}
                  onChange={(e) => setReconciliationData(prev => ({
                    ...prev,
                    reconciliationNotes: e.target.value
                  }))}
                  placeholder="Notes about cash variance, counting discrepancies, or end-of-day issues..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Day Operation Status */}
          {!dayOpForDate && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No day operation found for {format(selectedDate, 'MMM d, yyyy')}. Please open the day first before attempting to close it.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={isSubmitting || !dayOpForDate || dayOpForDate?.status === 'closed'}
              className="flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Clock className="h-4 w-4 animate-spin" />
                  Closing Day...
                </>
              ) : dayOpForDate?.status === 'closed' ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Day Already Closed
                </>
              ) : !dayOpForDate ? (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  Day Not Opened
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Close Day
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}