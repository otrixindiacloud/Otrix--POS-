import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
// import { useStore } from "@/hooks/useStore";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Clock,
  User,
  Store,
  Coins,
  CheckCircle,
  XCircle,
  Plus,
  Calendar
} from "lucide-react";
import { format } from "date-fns";

interface ShiftManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShiftManagementModal({ isOpen, onClose }: ShiftManagementModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // For now, we'll use a default store - in a real app, get from store context
  const currentStore = { id: 1, name: "Main Store" };
  
  const [isStartingShift, setIsStartingShift] = useState(false);
  const [shiftNotes, setShiftNotes] = useState("");
  const [startingCash, setStartingCash] = useState("");

  // Fetch active shifts for current store
  const { data: activeShifts = [] } = useQuery({
    queryKey: ["/api/shifts", currentStore?.id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/shifts?storeId=${currentStore?.id}`);
      return await response.json();
    },
    enabled: isOpen && !!currentStore
  });

  const startShiftMutation = useMutation({
    mutationFn: async (shiftData: any) => {
      const response = await apiRequest("POST", "/api/shifts", shiftData);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Shift Started",
        description: "Your shift has been started successfully"
      });
      setIsStartingShift(false);
      setShiftNotes("");
      setStartingCash("");
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.response?.data?.message || error?.message || "Failed to create shift";
      toast({
        title: "Error Starting Shift",
        description: errorMessage,
        variant: "destructive"
      });
    }
  });

  const closeShiftMutation = useMutation({
    mutationFn: async (shiftId: number) => {
      const response = await apiRequest("POST", `/api/shifts/${shiftId}/close`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Shift Closed",
        description: "Your shift has been closed successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error Closing Shift",
        description: error.message || "Failed to close shift",
        variant: "destructive"
      });
    }
  });

  const handleStartShift = () => {
    if (!currentStore) {
      toast({
        title: "No Store Selected",
        description: "Please select a store before starting a shift",
        variant: "destructive"
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Authentication Error",
        description: "Please log in to start a shift",
        variant: "destructive"
      });
      return;
    }

    if (!startingCash || parseFloat(startingCash) < 0) {
      toast({
        title: "Invalid Starting Cash",
        description: "Please enter a valid starting cash amount",
        variant: "destructive"
      });
      return;
    }

    const shiftData = {
      storeId: currentStore.id,
      userId: user.id,
      startingCash: startingCash.toString(),
      notes: shiftNotes || "",
      status: "active" as const,
      startTime: new Date().toISOString()
    };

    startShiftMutation.mutate(shiftData);
  };

  const handleCloseShift = (shiftId: number) => {
    closeShiftMutation.mutate(shiftId);
  };

  const getCurrentShift = () => {
    return activeShifts.find((shift: any) => shift.status === "active");
  };

  const currentShift = getCurrentShift();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Shift Management
          </DialogTitle>
          <DialogDescription>
            Manage cashier shifts and track daily operations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Shift Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  Current Shift
                </span>
                {currentShift ? (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <XCircle className="w-3 h-3 mr-1" />
                    No Active Shift
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentShift ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-slate-600">Started At</Label>
                      <p className="font-medium">
                        {format(new Date(currentShift.startTime), "PPp")}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-slate-600">Starting Cash</Label>
                      <p className="font-medium">QR {currentShift.startingCash || "0.00"}</p>
                    </div>
                  </div>
                  
                  {currentShift.notes && (
                    <div>
                      <Label className="text-sm text-slate-600">Notes</Label>
                      <p className="text-sm bg-slate-50 p-2 rounded">{currentShift.notes}</p>
                    </div>
                  )}

                  <Button 
                    onClick={() => handleCloseShift(currentShift.id)}
                    disabled={closeShiftMutation.isPending}
                    variant="destructive"
                    className="w-full"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    {closeShiftMutation.isPending ? "Closing..." : "Close Shift"}
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p className="text-slate-600 mb-4">No active shift found</p>
                  <Button 
                    onClick={() => setIsStartingShift(true)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Start New Shift
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Start New Shift Form */}
          {isStartingShift && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Start New Shift</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Store</Label>
                    <div className="flex items-center p-2 bg-slate-50 rounded">
                      <Store className="w-4 h-4 mr-2 text-slate-500" />
                      <span>{currentStore?.name || "No store selected"}</span>
                    </div>
                  </div>
                  <div>
                    <Label>Starting Cash Register Amount</Label>
                    <div className="relative">
                      <Coins className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        value={startingCash}
                        onChange={(e) => setStartingCash(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Shift Notes (Optional)</Label>
                  <Textarea
                    placeholder="Add any notes about this shift..."
                    value={shiftNotes}
                    onChange={(e) => setShiftNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setIsStartingShift(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleStartShift}
                    disabled={startShiftMutation.isPending || !currentStore || !user?.id}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {startShiftMutation.isPending ? "Starting..." : "Start Shift"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Shift History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                Recent Shifts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {activeShifts.length === 0 ? (
                  <p className="text-center text-slate-500 py-4">No shifts found</p>
                ) : (
                  activeShifts.slice(0, 5).map((shift: any) => (
                    <div 
                      key={shift.id} 
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <Badge 
                          variant={shift.status === "active" ? "default" : "secondary"}
                          className={shift.status === "active" ? "bg-green-600" : ""}
                        >
                          {shift.status}
                        </Badge>
                        <div>
                          <p className="font-medium">
                            {format(new Date(shift.startTime), "MMM dd, yyyy")}
                          </p>
                          <p className="text-sm text-slate-600">
                            {format(new Date(shift.startTime), "HH:mm")} - 
                            {shift.endTime ? format(new Date(shift.endTime), "HH:mm") : "Active"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">QR {shift.startingCash || "0.00"}</p>
                        <p className="text-sm text-slate-600">Starting Cash</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}