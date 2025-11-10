import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PauseCircle, Play, User, Clock, RefreshCw, Trash2, Package } from "lucide-react";
import type { HeldTransaction } from "@shared/schema";
import MainLayout from "@/components/layout/main-layout";
import { usePOSStore } from "@/lib/pos-store";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton-loader";
import LoadingSpinner from "@/components/ui/loading-spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState, useEffect } from "react";

// Component to display a held transaction card with customer info
function HeldTransactionCard({ 
  heldTransaction, 
  onResume, 
  onDelete,
  formatTime,
  getTransactionData,
  getCartItems,
  getTotalAmount 
}: any) {
  const [customerName, setCustomerName] = useState<string | null>(null);
  
  const transactionData = getTransactionData(heldTransaction);
  const cartItems = getCartItems(transactionData);
  const totalAmount = getTotalAmount(transactionData);

  // Fetch customer data if customerId exists
  useEffect(() => {
    const fetchCustomer = async () => {
      // First check if customer data is in transaction
      if (transactionData?.customer) {
        const customer = transactionData.customer;
        const name = customer.name || 'Unknown Customer';
        setCustomerName(name);
        return;
      }

      // Otherwise fetch by customerId
      if (heldTransaction.customerId) {
        try {
          const response = await apiRequest({
            url: `/api/customers/${heldTransaction.customerId}`,
            method: "GET",
          });
          const customer = await response.json();
          const name = customer.name || 'Unknown Customer';
          setCustomerName(name);
        } catch (error) {
          console.warn("Could not fetch customer:", error);
          setCustomerName(null);
        }
      }
    };

    fetchCustomer();
  }, [heldTransaction.customerId, transactionData]);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center">
            <PauseCircle className="w-5 h-5 mr-2 text-amber-500" />
            Hold #{heldTransaction.id}
          </CardTitle>
          <Badge variant="secondary">On Hold</Badge>
        </div>
        <div className="flex items-center text-sm text-slate-500">
          <Clock className="w-4 h-4 mr-1" />
          {formatTime(heldTransaction.createdAt)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Customer Name */}
          {customerName && (
            <div className="flex items-center text-sm bg-blue-50 dark:bg-blue-950/20 p-2 rounded-md">
              <User className="w-4 h-4 mr-2 text-blue-600" />
              <span className="font-medium text-blue-900 dark:text-blue-100">{customerName}</span>
            </div>
          )}
          
          {/* Items List */}
          {cartItems.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-900/20 rounded-lg p-3">
              <div className="flex items-center mb-2">
                <Package className="w-4 h-4 mr-2 text-slate-600" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {cartItems.length} Item{cartItems.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {cartItems.slice(0, 5).map((item: any, index: number) => (
                  <div key={index} className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span className="truncate flex-1 mr-2">
                      {item.quantity}x {item.name || 'Unknown Item'}
                    </span>
                    <span className="font-medium whitespace-nowrap">
                      QR {parseFloat(item.total || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
                {cartItems.length > 5 && (
                  <div className="text-xs text-slate-500 italic">
                    +{cartItems.length - 5} more items...
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total:</span>
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  QR {totalAmount.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Hold Reason */}
          {heldTransaction.holdReason && (
            <div className="text-sm">
              <span className="font-medium text-slate-600 dark:text-slate-400">Reason: </span>
              <span className="text-slate-700 dark:text-slate-300">{heldTransaction.holdReason}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button 
              onClick={() => onResume(heldTransaction)}
              className="flex-1 bg-green-600 hover:bg-green-700"
              size="sm"
            >
              <Play className="w-4 h-4 mr-1" />
              Resume
            </Button>
            <Button 
              onClick={() => onDelete(heldTransaction.id)}
              variant="destructive"
              size="sm"
              className="px-3"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Holds() {
  const queryClient = useQueryClient();
  const [holdToDelete, setHoldToDelete] = useState<number | null>(null);
  
  const { data: heldTransactions = [], isLoading, error, refetch } = useQuery({
    queryKey: ["/api/held-transactions"],
    queryFn: async () => {
      const response = await apiRequest({
        method: "GET",
        url: "/api/held-transactions",
      });
      return await response.json();
    },
    staleTime: 30 * 1000, // 30 seconds - refetch if data is older than this
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchInterval: 60 * 1000, // Refetch every minute to keep data fresh
  });

  const { resumeTransaction, setResumedHeldTransactionId } = usePOSStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/held-transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/held-transactions"] });
      toast({
        title: "Success",
        description: "Held transaction removed successfully",
      });
      setHoldToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to remove held transaction",
        variant: "destructive",
      });
      setHoldToDelete(null);
    },
  });

  const formatTime = (date: Date | string | null) => {
    if (!date) return 'No date available';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString();
  };

  const getTransactionData = (heldTransaction: HeldTransaction) => {
    try {
      return typeof heldTransaction.transactionData === 'string' 
        ? JSON.parse(heldTransaction.transactionData) 
        : heldTransaction.transactionData;
    } catch {
      return null;
    }
  };

  const getCustomerName = (transactionData: any) => {
    // Check if customer data exists in transactionData (old format) or fetch by customerId
    if (transactionData?.customer) {
      const customer = transactionData.customer;
      return customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown Customer';
    }
    // Return null if no customer data - we'll show customer by ID separately
    return null;
  };

  const getCartItems = (transactionData: any) => {
    // Support both 'items' (current) and 'cartItems' (legacy) field names
    return transactionData?.items || transactionData?.cartItems || [];
  };

  const getTotalAmount = (transactionData: any) => {
    const items = getCartItems(transactionData);
    return items.reduce((sum: number, item: any) => sum + (parseFloat(item.total) || 0), 0);
  };

  const handleResumeTransaction = async (heldTransaction: HeldTransaction) => {
    try {
      // Parse the transaction data
      const transactionData = typeof heldTransaction.transactionData === 'string' 
        ? JSON.parse(heldTransaction.transactionData) 
        : heldTransaction.transactionData;

      // Load the transaction back into the POS cart
      resumeTransaction(heldTransaction.transactionData);
      
      // Set the held transaction ID for deletion after completion
      setResumedHeldTransactionId(heldTransaction.id);
      
      // If there's a customer ID, fetch and set the customer data
      if (transactionData.customerId) {
        try {
          const response = await apiRequest({
            url: `/api/customers/${transactionData.customerId}`,
            method: "GET",
          });
          
          // Extract customer data from response
          const customer = await response.json();
          
          // Set the full customer data
          const { setCurrentCustomer } = usePOSStore.getState();
          setCurrentCustomer(customer);
        } catch (customerError) {
          console.warn("Could not fetch customer data:", customerError);
          // Continue without customer data
        }
      }
      
      // Show success message
      toast({
        title: "Success",
        description: "Transaction resumed successfully",
      });

      // Navigate to POS page with back reference
      setLocation("/pos?from=holds");
    } catch (error) {
      console.error("Failed to resume transaction:", error);
      toast({
        title: "Error",
        description: "Failed to resume transaction",
        variant: "destructive",
      });
    }
  };

  return (
    <MainLayout>
      <div className="p-6">
        {/* Professional Header */}
        <Card className="border-none shadow-sm bg-purple-50 dark:bg-purple-950/20 mb-6">
          <CardHeader className="pb-8">
            <div className="flex items-start gap-4">
              {/* Icon Badge */}
              <div className="flex-shrink-0 bg-purple-600 rounded-xl p-3 shadow-lg">
                <PauseCircle className="h-8 w-8 text-white" />
              </div>
              
              {/* Title and Description */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                    Held Transactions
                  </h1>
                  <Badge className="bg-purple-500 hover:bg-purple-600 text-white">
                    {heldTransactions.length} On Hold
                  </Badge>
                  <Button
                    onClick={() => refetch()}
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    disabled={isLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-base leading-relaxed">
                  Manage temporarily suspended transactions and resume them when ready.
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

      {error ? (
        <div className="text-center py-12">
          <PauseCircle className="w-12 h-12 text-red-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-600 mb-2">Error Loading Held Transactions</h3>
          <p className="text-red-500 mb-4">
            Unable to load held transactions. Please try refreshing the page.
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => refetch()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-1" />
              Try Again
            </Button>
            <Button onClick={() => window.location.reload()} variant="outline">
              Refresh Page
            </Button>
          </div>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-slate-200 rounded w-1/3"></div>
                  <div className="h-3 bg-slate-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : heldTransactions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {heldTransactions.map((heldTransaction: HeldTransaction) => (
            <HeldTransactionCard
              key={heldTransaction.id}
              heldTransaction={heldTransaction}
              onResume={handleResumeTransaction}
              onDelete={setHoldToDelete}
              formatTime={formatTime}
              getTransactionData={getTransactionData}
              getCartItems={getCartItems}
              getTotalAmount={getTotalAmount}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <PauseCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-600 mb-2">No held transactions</h3>
          <p className="text-slate-500 mb-4">
            Held transactions will appear here when customers need to suspend their purchase
          </p>
          <div className="text-sm text-slate-400">
            <p>To hold a transaction:</p>
            <p>1. Add items to cart in POS</p>
            <p>2. Use the "Hold" button during checkout</p>
            <p>3. Resume transactions from this page</p>
          </div>
        </div>
      )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={holdToDelete !== null} onOpenChange={(open) => !open && setHoldToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Held Transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this held transaction? This action cannot be undone and all cart items will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => holdToDelete && deleteMutation.mutate(holdToDelete)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}