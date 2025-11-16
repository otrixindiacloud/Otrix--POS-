import { useEffect, useMemo, useState } from "react";
import { debugRender } from "@/lib/debug-infinite-loop";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePOSStore } from "@/lib/pos-store";
import { useStore } from "@/hooks/useStore";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import DayOpenModalWrapper from "@/components/pos/day-open-modal-wrapper";
import { StoreSelector } from "@/components/StoreSelector";
import { Loader2, AlertTriangle, RefreshCcw, Sun, Moon, Clock, Calendar as CalendarIcon, Building2, History } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { DayOperation } from "@shared/schema";

type DayStatusResponse = {
  status: string;
  message?: string;
  canOpen?: boolean;
  canClose?: boolean;
  canReopen?: boolean;
  dayOperation?: {
    id: number;
    date: string;
    status?: string;
    openedAt?: string | null;
    closedAt?: string | null;
    reopenedAt?: string | null;
    openedByName?: string | null;
    closedByName?: string | null;
    reopeningNote?: string | null;
    openingCash?: string | null;
    openingBankBalance?: string | null;
    closingCash?: string | null;
    actualBankBalance?: string | null;
  };
};

type DayOperationsListResponse = {
  data: Array<{
    id: number;
    date: string;
    status: string;
    openingCash?: string | null;
    openingBankBalance?: string | null;
    closingCash?: string | null;
    actualBankBalance?: string | null;
    openedAt?: string | null;
    closedAt?: string | null;
    reopenedAt?: string | null;
    openedByName?: string | null;
    closedByName?: string | null;
    reopenedByName?: string | null;
  }>;
  total: number;
  limit: number;
  offset: number;
};

const HISTORY_LIMIT = 15;

const formatAmount = (value?: string | number | null) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "QAR 0.00";
  return `QAR ${numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  return format(parseISO(value), "dd MMM yyyy");
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  return format(parseISO(value), "dd MMM yyyy, HH:mm");
};

const getStatusBadgeClass = (status?: string | null) => {
  switch ((status ?? "").toLowerCase()) {
    case "open":
      return "bg-green-500/15 text-green-700 dark:text-green-300";
    case "closed":
      return "bg-slate-500/15 text-slate-700 dark:text-slate-200";
    case "reopened":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    default:
      return "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
  }
};

export default function TillPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const {
    selectedDate,
    setSelectedDate,
    openDayOpenModal,
    openDayCloseModal,
    setCurrentDay,
  } = usePOSStore();
  const { currentStore } = useStore();
  const storeId = currentStore?.id;
  const [isReopening, setIsReopening] = useState(false);
  
  // Debug infinite loop detection
  debugRender('TillPage', { selectedDate, storeId });

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const statusUrl = `/api/day-operations/status/${selectedDate}${storeId ? `?storeId=${storeId}` : ""}`;
  const openDayUrl = `/api/day-operations/open${storeId ? `?storeId=${storeId}` : ""}`;
  const historyUrl = `/api/day-operations?limit=${HISTORY_LIMIT}${storeId ? `&storeId=${storeId}` : ""}`;

  const { data: dayStatus, isLoading: statusLoading } = useQuery<DayStatusResponse | null>({
    queryKey: [statusUrl],
    queryFn: async () => {
      const response = await fetch(statusUrl);
      if (!response.ok) throw new Error("Failed to load day status");
      return response.json();
    },
    enabled: Boolean(storeId),
    staleTime: 60 * 1000,
  });

  const { data: openDay, isLoading: openDayLoading } = useQuery<DayOperation | null>({
    queryKey: [openDayUrl],
    enabled: Boolean(storeId),
    staleTime: 60 * 1000,
  });

  const { data: historyResponse, isLoading: historyLoading } = useQuery<DayOperationsListResponse | null>({
    queryKey: [historyUrl],
    queryFn: async () => {
      const response = await fetch(historyUrl);
      if (!response.ok) throw new Error("Failed to load day operations");
      return response.json();
    },
    enabled: Boolean(storeId),
    staleTime: 5 * 60 * 1000,
  });

  const activeDay = (openDay ?? null) as DayOperation | null;
  const history = historyResponse?.data ?? [];

  const normalizedStatus = dayStatus?.dayOperation?.status ?? dayStatus?.status ?? activeDay?.status ?? null;
  const displayStatus = (normalizedStatus ?? "unknown").replace(/_/g, " ").toUpperCase();
  const statusBadgeClass = getStatusBadgeClass(normalizedStatus);

  const snapshot = dayStatus?.dayOperation ?? activeDay ?? null;
  const openDayDate = activeDay?.date ?? null;
  const openDayMatchesSelected = Boolean(openDayDate && openDayDate === selectedDate);
  const blockingOpenDate = activeDay && !openDayMatchesSelected ? activeDay.date : null;
  const canOpenDay = !activeDay;
  const canCloseDay = Boolean(openDayMatchesSelected);
  const canReopenDay = Boolean(dayStatus?.status === "closed" && dayStatus?.canReopen && dayStatus?.dayOperation?.id);

  useEffect(() => {
    // setCurrentDay already sets isDayOpen internally based on day?.status === 'open'
    // No need to call setIsDayOpen separately to avoid redundant updates
    setCurrentDay(activeDay ?? null);
  }, [activeDay]); // Remove store setters from dependencies to avoid infinite loops

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const intent = params.get("intent");
    if (!intent) return;

    // If intent is close and there's a blocking open date, switch to that date
    if (intent === "close" && blockingOpenDate) {
      setSelectedDate(blockingOpenDate);
      // Open the close modal after setting the date
      setTimeout(() => {
        openDayCloseModal();
      }, 100);
    } else if (intent === "open") {
      openDayOpenModal();
    } else if (intent === "close") {
      openDayCloseModal();
    }

    params.delete("intent");
    const newSearch = params.toString();
    const newUrl = newSearch ? `/till?${newSearch}` : "/till";
    window.history.replaceState(null, "", newUrl);
  }, [openDayOpenModal, openDayCloseModal, blockingOpenDate]); // Remove setSelectedDate from dependencies to avoid infinite loops

  const handleRefresh = () => {
    if (!storeId) return;
    queryClient.invalidateQueries({ queryKey: [statusUrl] });
    queryClient.invalidateQueries({ queryKey: [openDayUrl] });
    queryClient.invalidateQueries({ queryKey: [historyUrl] });
  };

  const handleOpenDayClick = () => {
    if (!storeId) {
      toast({
        title: "Select a store",
        description: "Choose a store before opening a day.",
        variant: "destructive",
      });
      return;
    }

    if (blockingOpenDate) {
      toast({
        title: "Close existing day first",
        description: `Day ${blockingOpenDate} is still open for this store. Close it before opening a new date.`,
        variant: "destructive",
      });
      return;
    }

    openDayOpenModal();
  };

  const handleCloseDayClick = () => {
    if (!storeId) {
      toast({
        title: "Select a store",
        description: "Choose a store before closing a day.",
        variant: "destructive",
      });
      return;
    }

    if (!openDayMatchesSelected) {
      toast({
        title: "No open day for selected date",
        description: blockingOpenDate
          ? `Switch to ${blockingOpenDate} to close the active session.`
          : "There is no open day for this date.",
        variant: "destructive",
      });
      return;
    }

    openDayCloseModal();
  };

  const handleReopenClick = async () => {
    if (!storeId || !dayStatus?.dayOperation?.id) {
      toast({
        title: "Nothing to reopen",
        description: "Close a day before attempting to reopen it.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsReopening(true);
      const response = await apiRequest({
        method: "PATCH",
        url: `/api/day-operations/${dayStatus.dayOperation.id}/reopen`,
      });
      
      // Safely parse JSON response, handling empty or malformed responses
      let reopenedDay = null;
      try {
        const text = await response.text();
        
        // If response has content, try to parse as JSON
        if (text && text.trim() !== '') {
          reopenedDay = JSON.parse(text);
        } else {
          console.warn("Reopen response is empty, will refresh from server");
        }
      } catch (parseError: any) {
        // If JSON parsing fails (empty body, malformed JSON, etc.), log and continue
        // The queries will refresh the data from the server
        console.warn("Failed to parse reopen response, will refresh from server:", parseError?.message || parseError);
      }

      toast({
        title: "Day reopened",
        description: reopenedDay 
          ? `Day ${reopenedDay.date} is now open for adjustments.`
          : "Day has been reopened. Refreshing data...",
      });

      // setCurrentDay already sets isDayOpen based on day?.status === 'open'
      if (reopenedDay) {
        setCurrentDay(reopenedDay);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [statusUrl] }),
        queryClient.invalidateQueries({ queryKey: [openDayUrl] }),
        queryClient.invalidateQueries({ queryKey: [historyUrl] }),
      ]);
    } catch (error: any) {
      toast({
        title: "Failed to reopen day",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsReopening(false);
    }
  };

  return (
    <>
      <MainLayout pageTitle="Till Management">
        <div className="container-responsive space-y-6 py-6">
          {/* Professional Header */}
          <Card className="border-none shadow-sm bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/30 dark:via-teal-950/30 dark:to-cyan-950/30">
            <CardHeader className="pb-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  {/* Icon Badge */}
                  <div className="flex-shrink-0 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-3 shadow-lg">
                    <Building2 className="h-8 w-8 text-white" />
                  </div>
                  
                  {/* Title and Description */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                        Till Management
                      </h1>
                      {activeDay && (
                        <Badge className={statusBadgeClass}>
                          {displayStatus}
                        </Badge>
                      )}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-base leading-relaxed">
                      Centralized till operations - manage openings, closings, reconciliations, and history for each store from a single hub.
                    </p>
                  </div>
                </div>

                {/* Store Selector */}
                <div className="flex-shrink-0">
                  <StoreSelector variant="compact" />
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2 border-slate-200 dark:border-slate-800 shadow-md">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-b border-slate-200 dark:border-slate-700 pb-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg p-2.5 shadow-lg">
                      <CalendarIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                        Current Day Snapshot
                      </CardTitle>
                      <CardDescription className="text-slate-600 dark:text-slate-300">
                        {dayStatus?.message ?? "Review current balances, timestamps, and responsible operators."}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {currentStore ? (
                      <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <Building2 className="h-3.5 w-3.5" />
                        <span className="font-medium">{currentStore.name}</span>
                      </Badge>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRefresh}
                      disabled={statusLoading || openDayLoading || historyLoading}
                      className="h-9 hover:bg-blue-500 dark:hover:bg-white-800/80"
                    >
                      <RefreshCcw className={`mr-1.5 h-4 w-4 ${statusLoading || openDayLoading || historyLoading ? 'animate-spin' : ''}`} />
                      <span className="font-medium">Refresh</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                {statusLoading && openDayLoading ? (
                  <div className="flex items-center justify-center gap-3 py-12 text-slate-600 dark:text-slate-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="font-medium">Syncing till data…</span>
                  </div>
                ) : (
                  <>
                    {/* Status Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <Badge className={`${statusBadgeClass} px-3 py-1 font-semibold text-sm`}>
                          {displayStatus}
                        </Badge>
                        {(snapshot as any)?.openedByName ? (
                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            <span>Opened by <span className="font-semibold text-slate-900 dark:text-slate-200">{(snapshot as any).openedByName}</span></span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Opening Information */}
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-200 to-transparent dark:via-blue-800" />
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                          Opening Details
                        </span>
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-200 to-transparent dark:via-blue-800" />
                      </div>
                      
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="bg-blue-500 rounded-lg p-1.5">
                              <CalendarIcon className="h-4 w-4 text-white" />
                            </div>
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                              Managed Date
                            </span>
                          </div>
                          <p className="text-xl font-bold text-slate-900 dark:text-white">
                            {formatDate(snapshot?.date ?? selectedDate)}
                          </p>
                        </div>

                        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="bg-green-500 rounded-lg p-1.5">
                              <Clock className="h-4 w-4 text-white" />
                            </div>
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                              Opened At
                            </span>
                          </div>
                          <p className="text-xl font-bold text-slate-900 dark:text-white">
                            {formatDateTime(
                              typeof snapshot?.openedAt === 'string' 
                                ? snapshot.openedAt 
                                : snapshot?.openedAt instanceof Date 
                                ? snapshot.openedAt.toISOString() 
                                : undefined
                            )}
                          </p>
                          {snapshot?.closedAt ? (
                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Moon className="h-3 w-3" />
                              Closed {formatDateTime(
                                typeof snapshot.closedAt === 'string' 
                                  ? snapshot.closedAt 
                                  : snapshot.closedAt instanceof Date 
                                  ? snapshot.closedAt.toISOString() 
                                  : undefined
                              )}
                            </p>
                          ) : null}
                        </div>

                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-xl p-4 border border-green-200 dark:border-green-800 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="bg-green-500 rounded-lg p-1.5">
                              <Sun className="h-4 w-4 text-white" />
                            </div>
                            <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">
                              Opening Cash
                            </span>
                          </div>
                          <p className="text-xl font-bold text-green-900 dark:text-green-100">
                            {formatAmount(snapshot?.openingCash)}
                          </p>
                          <p className="mt-2 text-xs text-green-600 dark:text-green-400 font-medium">
                            Bank: {formatAmount(snapshot?.openingBankBalance)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Closing Information */}
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-200 to-transparent dark:via-purple-800" />
                        <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                          Closing & Activity
                        </span>
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-200 to-transparent dark:via-purple-800" />
                      </div>
                      
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 rounded-xl p-4 border border-purple-200 dark:border-purple-800 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="bg-purple-500 rounded-lg p-1.5">
                              <Moon className="h-4 w-4 text-white" />
                            </div>
                            <span className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
                              Closing Cash
                            </span>
                          </div>
                          <p className="text-xl font-bold text-purple-900 dark:text-purple-100">
                            {snapshot?.closingCash ? formatAmount(snapshot.closingCash) : "Pending"}
                          </p>
                          <p className="mt-2 text-xs text-purple-600 dark:text-purple-400 font-medium">
                            Bank: {snapshot?.actualBankBalance ? formatAmount(snapshot.actualBankBalance) : "Pending"}
                          </p>
                        </div>

                        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="bg-orange-500 rounded-lg p-1.5">
                              <History className="h-4 w-4 text-white" />
                            </div>
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                              Last Activity
                            </span>
                          </div>
                          <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                            {snapshot?.reopenedAt 
                              ? `Reopened ${formatDateTime(
                                  typeof snapshot.reopenedAt === 'string' 
                                    ? snapshot.reopenedAt 
                                    : snapshot.reopenedAt instanceof Date 
                                    ? snapshot.reopenedAt.toISOString() 
                                    : undefined
                                )}` 
                              : snapshot?.closedAt 
                              ? `Closed ${formatDateTime(
                                  typeof snapshot.closedAt === 'string' 
                                    ? snapshot.closedAt 
                                    : snapshot.closedAt instanceof Date 
                                    ? snapshot.closedAt.toISOString() 
                                    : undefined
                                )}` 
                              : "Active"}
                          </p>
                        </div>

                        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="bg-slate-600 rounded-lg p-1.5">
                              <Building2 className="h-4 w-4 text-white" />
                            </div>
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                              Responsible Team
                            </span>
                          </div>
                          <p className="text-xl font-bold text-slate-900 dark:text-white">
                            {(snapshot as any)?.closedByName ?? (snapshot as any)?.openedByName ?? "Unassigned"}
                          </p>
                          {(snapshot as any)?.reopeningNote ? (
                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                              {(snapshot as any).reopeningNote}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 bg-gradient-to-br from-slate-600 to-slate-700 dark:from-slate-500 dark:to-slate-600 rounded-lg p-2.5">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
                      Day Controls
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Open, close, or reopen the day for the selected store and date.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                {/* Action Buttons */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-700" />
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Quick Actions
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-700" />
                  </div>
                  
                  <Button
                    onClick={handleOpenDayClick}
                    disabled={!canOpenDay || statusLoading}
                    className="w-full h-12 gap-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sun className="h-5 w-5" />
                    <span className="font-semibold">Open Day</span>
                  </Button>
                  
                  <Button
                    onClick={handleCloseDayClick}
                    disabled={!canCloseDay || statusLoading}
                    className="w-full h-12 gap-3 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Moon className="h-5 w-5" />
                    <span className="font-semibold">Close Day</span>
                  </Button>
                  
                  <Button
                    onClick={handleReopenClick}
                    disabled={!canReopenDay || isReopening}
                    variant="outline"
                    className="w-full h-12 gap-3 border-2 border-amber-200 hover:bg-amber-50 hover:border-amber-300 dark:border-amber-800 dark:hover:bg-amber-950/30 dark:hover:border-amber-700 text-amber-700 dark:text-amber-400 shadow-sm hover:shadow transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isReopening ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <History className="h-5 w-5" />
                    )}
                    <span className="font-semibold">Reopen Day</span>
                  </Button>
                </div>

                {blockingOpenDate ? (
                  <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                    <AlertTitle className="text-amber-900 dark:text-amber-200 font-semibold">
                      Different day is currently open
                    </AlertTitle>
                    <AlertDescription className="space-y-3">
                      <p className="text-sm text-amber-800 dark:text-amber-300">
                        Day <strong>{blockingOpenDate}</strong> is currently open, but you're viewing <strong>{selectedDate}</strong>.
                      </p>
                      <Button
                        onClick={() => setSelectedDate(blockingOpenDate)}
                        size="sm"
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        Switch to {blockingOpenDate} to Close
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : null}

                <Separator className="my-4" />

                {/* Date Selector Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-700" />
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Date Management
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-700" />
                  </div>
                  
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
                    <Label htmlFor="till-date" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-3">
                      <CalendarIcon className="h-4 w-4 text-slate-500" />
                      Select Date
                    </Label>
                    <Input
                      id="till-date"
                      type="date"
                      value={selectedDate}
                      max={today}
                      onChange={(event) => setSelectedDate(event.target.value)}
                      className="h-11 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedDate(today)}
                        className="h-9 text-xs hover:bg-blue-500 dark:hover:bg-slate-800"
                      >
                        <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                        Jump to Today
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/reports?date=${selectedDate}`)}
                        className="h-9 text-xs hover:bg-blue-500 dark:hover:bg-slate-800"
                      >
                        <History className="h-3.5 w-3.5 mr-1.5" />
                        View Reports
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">Recent Day Operations</CardTitle>
                <CardDescription>
                  Track the last {HISTORY_LIMIT} day operations, including closing balances and responsible users.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                Total records: {historyResponse?.total ?? 0}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {historyLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading history…</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Opening Cash</TableHead>
                        <TableHead>Closing Cash</TableHead>
                        <TableHead>Opened By</TableHead>
                        <TableHead>Closed At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                            No day operations recorded for this store yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        history.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="whitespace-nowrap text-sm text-foreground">
                              {formatDate(entry.date)}
                            </TableCell>
                            <TableCell className="text-sm">
                              <Badge className={getStatusBadgeClass(entry.status)}>
                                {entry.status.toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-foreground">
                              {formatAmount(entry.openingCash)}
                            </TableCell>
                            <TableCell className="text-sm text-foreground">
                              {entry.closingCash ? formatAmount(entry.closingCash) : "Pending"}
                            </TableCell>
                            <TableCell className="text-sm text-foreground">
                              {entry.openedByName ?? "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm text-foreground">
                              {entry.closedAt ? formatDateTime(entry.closedAt) : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </MainLayout>

      <DayOpenModalWrapper />
    </>
  );
}
