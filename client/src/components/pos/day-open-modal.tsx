import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Sun, Coins, Calculator, Info, Calendar as CalendarIcon, AlertTriangle, CheckCircle, XCircle, History } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { usePOSStore } from "@/lib/pos-store";
import { useStore } from "@/hooks/useStore";

interface DayOpenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDayOpened: (dayOperation: any) => void;
}

export default function DayOpenModal({ isOpen, onClose, onDayOpened }: DayOpenModalProps) {
  const [openingCash, setOpeningCash] = useState<string>("");
  const [openingBankBalance, setOpeningBankBalance] = useState<string>("");
  const [cashierName, setCashierName] = useState<string>("Admin");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedDate, setSelectedDate } = usePOSStore();
  const { currentStore } = useStore();
  const storeId = currentStore?.id;
  const statusUrl = `/api/day-operations/status/${selectedDate}${storeId ? `?storeId=${storeId}` : ""}`;
  const openDayUrl = `/api/day-operations/open${storeId ? `?storeId=${storeId}` : ""}`;
  const previousBalancesUrl = `/api/day-operations/previous-balances?date=${selectedDate}${storeId ? `&storeId=${storeId}` : ""}`;

  // Get current user for cashier ID
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const response = await fetch("/api/auth/user");
      if (!response.ok) throw new Error("Failed to fetch user");
      return response.json();
    },
    enabled: isOpen
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('Modal opened, resetting form state');
      setOpeningCash("");
      setOpeningBankBalance("");
      setCashierName("Admin");
    }
  }, [isOpen]);

  // Convert selectedDate string to Date for format function
  const selectedDateObj = new Date(selectedDate);

  // Fetch day status for selected date
  const { data: dayStatus, isLoading: loadingStatus } = useQuery({
    queryKey: [statusUrl],
    queryFn: async () => {
      const response = await fetch(statusUrl);
      if (!response.ok) throw new Error('Failed to fetch day status');
      return response.json();
    },
    enabled: isOpen && Boolean(storeId),
    staleTime: 0, // Always fetch fresh data
  });

  // Fetch currently open day information
  const { data: openDay, isLoading: loadingOpenDay } = useQuery({
    queryKey: [openDayUrl],
    queryFn: async () => {
      const response = await fetch(openDayUrl);
      if (!response.ok) throw new Error('Failed to fetch open day');
      return response.json();
    },
    enabled: isOpen && Boolean(storeId),
    staleTime: 0, // Always fetch fresh data
  });

  // Fetch previous day's balances (cash and bank) based on selected date
  const { data: previousBalances, isLoading: loadingPrevious, error: previousBalancesError } = useQuery({
    queryKey: [previousBalancesUrl],
    queryFn: async () => {
      const response = await fetch(previousBalancesUrl);
      if (!response.ok) throw new Error('Failed to fetch previous balances');
      return response.json();
    },
    enabled: isOpen && Boolean(storeId), // Remove dayStatus?.canOpen dependency to always fetch when modal is open
    staleTime: 0, // Always fetch fresh data
  });

  // Set opening balances from previous day when data loads
  useEffect(() => {
    if (previousBalances && isOpen) {
      // Always set to previous balances when available, regardless of current value
      const prevCash = previousBalances.previousClosingCash || "0.00";
      const prevBank = previousBalances.previousBankBalance || "0.00";
      
      setOpeningCash(prevCash);
      setOpeningBankBalance(prevBank);
    } else if (!previousBalances && isOpen && !openingCash && !openingBankBalance) {
      // Only set to 0.00 if we have no previous data AND fields are empty
      setOpeningCash("0.00");
      setOpeningBankBalance("0.00");
    }
  }, [previousBalances, isOpen]);

  const openDayMutation = useMutation({
    mutationFn: async (dayData: any) => {
      if (!storeId) {
        throw new Error("Store ID is required to open a day");
      }
      
      if (!currentUser?.id) {
        throw new Error("User not authenticated");
      }
      
      const requestBody = {
        date: selectedDate, // Already in YYYY-MM-DD format
        cashierId: currentUser.id, // Use current user's ID
        storeId: storeId, // Use current store ID
        openingCash: parseFloat(dayData.openingCash).toFixed(2),
        openingBankBalance: parseFloat(dayData.openingBankBalance).toFixed(2),
        status: "open"
      };
      
      console.log("📤 Sending day open request:", requestBody);
      
      return apiRequest({
        url: "/api/day-operations/open",
        method: "POST",
        body: requestBody
      });
    },
    onSuccess: (newDay) => {
      toast({
        title: "Day Opened Successfully",
        description: `Day opened with QR ${openingCash} opening cash.`,
      });
      
      // Update global state immediately
      onDayOpened(newDay);
      
      // Invalidate ALL relevant queries to refresh data across the app
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey?.[0];
          return typeof key === "string" && key.startsWith("/api/day-operations");
        }
      });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-monitoring"] });
      
      // Reset form and close modal
      resetForm();
      onClose();
      
      // NO PAGE RELOAD - React Query handles data refresh automatically!
      console.log('✅ Day opened successfully - all queries invalidated, no reload needed');
    },
    onError: (error: any) => {
      console.error("Day open error:", error);
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to open day. Please try again.";
      toast({
        title: "Error Opening Day",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const reopenDayMutation = useMutation({
    mutationFn: async () => {
      if (!dayStatus?.dayOperation?.id) {
        throw new Error('No day operation found for selected date');
      }

      if (!dayStatus?.canReopen) {
        throw new Error('Only administrators can reopen closed days');
      }

      // Check if another day is already open
      const response = await fetch(openDayUrl, { credentials: "include" });
      let currentOpenDay = null;
      if (response.ok) {
        try {
          const text = await response.text();
          if (text && text.trim() !== '') {
            currentOpenDay = JSON.parse(text);
          }
        } catch (parseError) {
          // If response is empty or invalid JSON, treat as no open day
          console.warn("Failed to parse open day response:", parseError);
        }
      }

      if (currentOpenDay && currentOpenDay.date !== dayStatus.dayOperation.date) {
        throw new Error(`Another day is already open for ${currentOpenDay.date}. Please close it first.`);
      }

      const reopenResponse = await apiRequest({
        url: `/api/day-operations/${dayStatus.dayOperation.id}/reopen`,
        method: "PATCH"
      });

      // Safely parse JSON response, handling empty or malformed responses
      try {
        const text = await reopenResponse.text();
        
        // If response is empty, return null - queries will refresh the data
        if (!text || text.trim() === '') {
          console.warn("Reopen response is empty, will refresh from server");
          return null;
        }
        
        // Try to parse as JSON
        return JSON.parse(text);
      } catch (parseError: any) {
        // If JSON parsing fails (empty body, malformed JSON, etc.), return null
        // The queries will refresh the data from the server
        console.warn("Failed to parse reopen response, will refresh from server:", parseError?.message || parseError);
        return null;
      }
    },
    onSuccess: (reopenedDay) => {
      toast({
        title: "Day Reopened Successfully",
        description: reopenedDay 
          ? `Day ${reopenedDay.date} has been reopened for adjustments.`
          : "Day has been reopened. Refreshing data...",
      });
      
      // Update global state if we have the reopened day data
      if (reopenedDay) {
        onDayOpened(reopenedDay);
      }
      
      // Invalidate ALL relevant queries to refresh data across the app
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey?.[0];
          return typeof key === "string" && key.startsWith("/api/day-operations");
        }
      });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-monitoring"] });
      
      // Close modal
      onClose();
      
      console.log('✅ Day reopened successfully - all queries invalidated, no reload needed');
    },
    onError: (error: any) => {
      console.error("Day reopen error:", error);
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to reopen day. Please try again.";
      toast({
        title: "Error Reopening Day",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const resetForm = () => {
    setOpeningCash("");
    setOpeningBankBalance("");
    setCashierName("Admin");
    // Don't reset selectedDate as it's now managed globally
  };

  const handleSubmit = () => {
    if (!storeId) {
      toast({
        title: "No Store Selected",
        description: "Please select a store before opening a day.",
        variant: "destructive",
      });
      return;
    }

    const cashAmount = parseFloat(openingCash) || 0;
    const bankAmount = parseFloat(openingBankBalance) || 0;
    
    if (cashAmount < 0) {
      toast({
        title: "Invalid Amount",
        description: "Opening cash cannot be negative.",
        variant: "destructive",
      });
      return;
    }

    if (bankAmount < 0) {
      toast({
        title: "Invalid Amount",
        description: "Opening bank balance cannot be negative.",
        variant: "destructive",
      });
      return;
    }

    // Enhanced validation: Check for unusual variances
    const previousClosingCash = parseFloat(previousBalances?.previousClosingCash || "0");
    const previousBankBalance = parseFloat(previousBalances?.previousBankBalance || "0");
    const cashVariance = Math.abs(cashAmount - previousClosingCash);
    const bankVariance = Math.abs(bankAmount - previousBankBalance);
    
    // Alert for significant variances (>5% or >QR 50)
    const significantCashVariance = cashVariance > 50 || (previousClosingCash > 0 && cashVariance / previousClosingCash > 0.05);
    const significantBankVariance = bankVariance > 100 || (previousBankBalance > 0 && bankVariance / previousBankBalance > 0.05);
    
    if (significantCashVariance || significantBankVariance) {
      const varianceMessages = [];
      if (significantCashVariance) {
        varianceMessages.push(`Cash variance: QR ${cashVariance.toFixed(2)}`);
      }
      if (significantBankVariance) {
        varianceMessages.push(`Bank variance: QR ${bankVariance.toFixed(2)}`);
      }
      
      toast({
        title: "Unusual Balance Variance Detected",
        description: `${varianceMessages.join(', ')}. Please verify amounts before proceeding.`,
        variant: "destructive",
      });
      
      // Still allow submission but with warning
      setTimeout(() => {
        openDayMutation.mutate({
          openingCash: cashAmount,
          openingBankBalance: bankAmount,
          cashierName
        });
      }, 2000);
      return;
    }

    openDayMutation.mutate({
      openingCash: cashAmount,
      openingBankBalance: bankAmount,
      cashierName
    });
  };

  const handleClose = () => {
    if (!openDayMutation.isPending) {
      resetForm();
      onClose();
    }
  };

  const handleReturnToPOS = () => {
    handleClose();
    // Ensure we're returning to the main POS view
    if (window.location.pathname !== '/pos' && window.location.pathname !== '/') {
      window.location.href = '/pos';
    }
  };

  const previousClosingCash = parseFloat(previousBalances?.previousClosingCash || "0");
  const previousBankBalance = parseFloat(previousBalances?.previousBankBalance || "0");
  const currentCashAmount = parseFloat(openingCash) || 0;
  const currentBankAmount = parseFloat(openingBankBalance) || 0;
  const cashDifference = currentCashAmount - previousClosingCash;
  const bankDifference = currentBankAmount - previousBankBalance;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5 text-warning" />
            Open Day
            {currentStore && (
              <span className="text-sm font-normal text-muted-foreground">
                - {currentStore.name}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Start a new business day by entering opening balances
            {currentStore && (
              <span className="text-xs block mt-1">
                Store: <strong>{currentStore.name}</strong> (ID: {currentStore.id})
              </span>
            )}
          </DialogDescription>
        </DialogHeader>        <div className="space-y-4">
          {/* Currently Open Day Alert */}
          {!loadingOpenDay && openDay && (
            <Alert className="py-3 border-warning bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-sm text-warning-foreground">
                <strong>Currently Open Day:</strong> {openDay.date} 
                <span className="ml-2 text-xs">(QR {openDay.openingCash} opening cash)</span>
                <br />
                <span className="text-xs">You must close this day before opening a new one.</span>
              </AlertDescription>
            </Alert>
          )}

          {/* Day Status Alert */}
          {!loadingStatus && dayStatus && (
            <Alert className={cn(
              "py-2",
              dayStatus.status === 'closed' ? "border-red-500 bg-red-50" :
              dayStatus.status === 'open' ? "border-warning bg-warning/10" :
              "border-green-500 bg-green-50"
            )}>
              <AlertTriangle className={cn(
                "h-4 w-4",
                dayStatus.status === 'closed' ? "text-red-500" :
                dayStatus.status === 'open' ? "text-warning" :
                "text-green-500"
              )} />
              <AlertDescription className={cn(
                "text-sm",
                dayStatus.status === 'closed' ? "text-red-700" :
                dayStatus.status === 'open' ? "text-warning" :
                "text-green-700"
              )}>
                <strong>Day Status:</strong> {dayStatus.message}
                {dayStatus.status === 'closed' && dayStatus.canReopen && (
                  <span className="block mt-1 text-xs">
                    Administrators can reopen this day using the button below.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Main Content Grid - Mobile first, then desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left Column - Date & Cash Info */}
            <div className="lg:col-span-1 space-y-3">
              {/* Date Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Select Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal h-9",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      <span className="truncate">
                        {selectedDate ? format(selectedDate, "MMM d, yyyy") : "Pick a date"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDateObj}
                      onSelect={(date) => date && setSelectedDate(date.toISOString().split('T')[0])}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Previous Day Info - Compact */}
              {!loadingPrevious && (
                <Card className="bg-blue-50/50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Previous Close</span>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-600">QR {previousClosingCash.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">Recommended opening</div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Middle Column - Input Fields */}
            <div className="lg:col-span-1 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="cashier" className="text-sm font-medium">Cashier Name</Label>
                <Input
                  id="cashier"
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
                  placeholder="Enter cashier name"
                  className="h-9"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="openingCash" className="text-sm font-medium">Opening Cash (QR)</Label>
                <div className="relative">
                  <Coins className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="openingCash"
                    type="number"
                    step="0.01"
                    min="0"
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                    placeholder="0.00"
                    className="pl-10 h-9"
                  />
                </div>
                
                {/* Difference Indicator */}
                {cashDifference !== 0 && previousClosingCash > 0 && (
                  <div className={`text-xs flex items-center gap-1 ${
                    cashDifference > 0 ? 'text-red-600' : 'text-blue-600'
                  }`}>
                    <Calculator className="h-3 w-3" />
                    {cashDifference > 0 ? '+' : ''}QR {cashDifference.toFixed(2)} difference
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="openingBankBalance" className="text-sm font-medium">Opening Bank Balance (QR)</Label>
                <div className="relative">
                  <Coins className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="openingBankBalance"
                    type="number"
                    step="0.01"
                    min="0"
                    value={openingBankBalance}
                    onChange={(e) => setOpeningBankBalance(e.target.value)}
                    placeholder="0.00"
                    className="pl-10 h-9"
                  />
                </div>
                
                {/* Bank Balance Difference Indicator */}
                {bankDifference !== 0 && previousBankBalance > 0 && (
                  <div className={`text-xs flex items-center gap-1 ${
                    bankDifference > 0 ? 'text-green-600' : 'text-blue-600'
                  }`}>
                    <Calculator className="h-3 w-3" />
                    {bankDifference > 0 ? '+' : ''}QR {bankDifference.toFixed(2)} difference
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Summary */}
            <div className="lg:col-span-1">
              <Card className="bg-green-50/50 h-full">
                <CardContent className="p-3 flex flex-col justify-center">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Calculator className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-700">Starting Balance</span>
                    </div>
                    <div className="text-xl font-bold text-green-600 mb-1">QR {currentCashAmount.toFixed(2)}</div>
                    <div className="text-xs text-gray-500">
                      {currentCashAmount === previousClosingCash 
                        ? "Matches previous closing"
                        : "Custom amount"
                      }
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4 gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={handleReturnToPOS} 
            disabled={openDayMutation.isPending || reopenDayMutation.isPending}
            className="flex-1 sm:flex-none"
          >
            Close & Return to POS
          </Button>
          {/* Show Reopen button when day is closed and user has permission */}
          {dayStatus?.status === 'closed' && dayStatus?.canReopen && dayStatus?.dayOperation?.id ? (
            <Button 
              onClick={() => reopenDayMutation.mutate()}
              disabled={reopenDayMutation.isPending}
              className="flex-1 sm:flex-none bg-amber-600 hover:bg-amber-700 text-white"
            >
              {reopenDayMutation.isPending ? (
                <>
                  <History className="h-4 w-4 mr-2 animate-spin" />
                  <span className="hidden sm:inline">Reopening Day...</span>
                  <span className="sm:hidden">Reopening...</span>
                </>
              ) : (
                <>
                  <History className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Reopen Day</span>
                  <span className="sm:hidden">Reopen</span>
                </>
              )}
            </Button>
          ) : (
            <Button 
              onClick={handleSubmit}
              disabled={
                openDayMutation.isPending || 
                !openingCash || 
                !cashierName.trim() || 
                !dayStatus?.canOpen ||
                openDay // Disable if another day is already open
              }
              className={cn(
                "flex-1 sm:flex-none transition-colors",
                (dayStatus?.canOpen && !openDay)
                  ? "bg-green-600 hover:bg-green-700" 
                  : "bg-gray-400 cursor-not-allowed"
              )}
            >
              {openDayMutation.isPending ? (
                <>
                  <Sun className="h-4 w-4 mr-2 animate-spin" />
                  <span className="hidden sm:inline">Opening Day...</span>
                  <span className="sm:hidden">Opening...</span>
                </>
              ) : openDay ? (
                <>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Another Day Open</span>
                  <span className="sm:hidden">Day Open</span>
                </>
              ) : dayStatus?.status === 'open' ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Day Already Open</span>
                  <span className="sm:hidden">Already Open</span>
                </>
              ) : dayStatus?.status === 'closed' ? (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Day Already Closed</span>
                  <span className="sm:hidden">Already Closed</span>
                </>
              ) : (
                <>
                  <Sun className="h-4 w-4 mr-2" />
                  Open Day
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}