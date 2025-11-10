import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { Skeleton } from "@/components/ui/skeleton-loader";
import { 
  BarChart, 
  TrendingUp, 
  Coins, 
  ShoppingCart, 
  Users, 
  Calendar as CalendarIcon,
  Download,
  Eye,
  Sparkles,
  AlertCircle,
  Lightbulb,
  Info,
  Save,
  Trash2,
  Play,
  Clock,
  BookOpen,
  Settings
} from "lucide-react";
import { format } from "date-fns";
import type { Transaction, DayOperation } from "@shared/schema";
import MainLayout from "@/components/layout/main-layout";
import AIChart from "@/components/reports/ai-chart";
import AIQueryInput from "@/components/reports/ai-query-input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/hooks/useStore";

interface ReportResult {
  data: any[];
  query: {
    sql: string;
    description: string;
    chartType: 'bar' | 'line' | 'pie' | 'table' | 'number';
    title: string;
    columns: string[];
  };
  summary: string;
  insights: string[];
  hasBillData: boolean;
  transactionIds?: number[];
  additionalVisuals: {
    pieChart?: {
      sql: string;
      description: string;
      chartType: 'pie';
      title: string;
      columns: string[];
    };
    barChart?: {
      sql: string;
      description: string;
      chartType: 'bar';
      title: string;
      columns: string[];
    };
    pieData?: any[];
    barData?: any[];
  };
}

interface SavedReport {
  id: number;
  title: string;
  description?: string;
  userQuery: string;
  generatedSql: string;
  reportData: ReportResult;
  insights: string[];
  chartType: string;
  createdAt: string;
  updatedAt: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  query: string;
}

export default function Reports() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [aiReport, setAiReport] = useState<ReportResult | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedSavedReport, setSelectedSavedReport] = useState<SavedReport | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [reportTitle, setReportTitle] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [currentQuery, setCurrentQuery] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentStore } = useStore();

  const { data: transactions = [], isLoading: loadingTransactions } = useQuery<any[]>({
    queryKey: ["/api/transactions", currentStore?.id],
    queryFn: async () => {
      const storeQueryParam = currentStore?.id ? `?storeId=${currentStore.id}` : "";
      const response = await fetch(`/api/transactions${storeQueryParam}`);
      if (!response.ok) throw new Error("Failed to fetch transactions");
      return response.json();
    },
  });

  const { data: dayOperations = [], isLoading: loadingDays } = useQuery<any[]>({
    queryKey: ["/api/day-operations", currentStore?.id],
    queryFn: async () => {
      const storeQueryParam = currentStore?.id ? `?storeId=${currentStore.id}` : "";
      const response = await fetch(`/api/day-operations${storeQueryParam}`);
      if (!response.ok) throw new Error("Failed to fetch day operations");
      return response.json();
    },
  });

  // Fetch report stats from API
  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const { data: reportStats, isLoading: loadingStats } = useQuery<{
    todaysRevenue: number;
    todaysOrders: number;
    totalRevenue: number;
    totalCustomers: number;
  }>({
    queryKey: ["/api/reports/stats", selectedDateStr, currentStore?.id],
    queryFn: async () => {
      const params = new URLSearchParams({
        date: selectedDateStr,
      });
      if (currentStore?.id) {
        params.append("storeId", currentStore.id.toString());
      }
      const response = await fetch(`/api/reports/stats?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch report stats");
      return response.json();
    },
  });

  const { data: templates = [], isLoading: loadingTemplates } = useQuery<Template[]>({
    queryKey: ["/api/ai/reports/templates"],
    retry: false,
  });

  const { data: savedReports = [], isLoading: loadingSavedReports } = useQuery<SavedReport[]>({
    queryKey: ["/api/saved-reports"],
    retry: false,
  });

  const generateReportMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest({
        url: "/api/ai/reports/generate",
        method: "POST",
        body: { query }
      });
      return response.json();
    },
    onSuccess: (data: ReportResult) => {
      setAiReport(data);
      setActiveTab("ai-reports");
    },
    onError: (error: any) => {
      console.error('Error generating report:', error);
      
      // Check if it's an OpenAI API key error
      const errorMessage = error?.message || String(error);
      const isApiKeyError = errorMessage.includes('OpenAI API key') || 
                           errorMessage.includes('API key is required');
      
      toast({
        title: isApiKeyError ? "OpenAI API Key Required" : "Report Generation Failed",
        description: isApiKeyError 
          ? "AI-powered reports require an OpenAI API key. Please configure your OpenAI API key in the environment variables to use this feature."
          : "Unable to generate the report. Please check your query and try again.",
        variant: "destructive",
      });
    }
  });

  const saveReportMutation = useMutation({
    mutationFn: async (reportData: {
      title: string;
      description?: string;
      userQuery: string;
      generatedSql: string;
      reportData: ReportResult;
      insights: string[];
      chartType: string;
    }) => {
      return apiRequest({
        url: "/api/saved-reports",
        method: "POST",
        body: reportData
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-reports"] });
      setShowSaveDialog(false);
      setReportTitle("");
      setReportDescription("");
      toast({
        title: "Success",
        description: "Report saved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save report",
        variant: "destructive",
      });
    }
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest({
        url: `/api/saved-reports/${id}`,
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-reports"] });
      toast({
        title: "Success",
        description: "Report deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete report",
        variant: "destructive",
      });
    }
  });

  const loadSavedReportMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest({
        url: `/api/saved-reports/${id}`,
        method: "GET"
      });
      return response.json();
    },
    onSuccess: (data: SavedReport) => {
      setSelectedSavedReport(data);
      setAiReport(data.reportData);
      setCurrentQuery(data.userQuery);
      setActiveTab("ai-reports");
    },
    onError: (error) => {
      console.error('Error loading report:', error);
      toast({
        title: "Loading Failed",
        description: "Unable to load the saved report. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleSaveReport = () => {
    if (!aiReport || !reportTitle.trim()) {
      toast({
        title: "Error",
        description: "Please provide a title for the report",
        variant: "destructive",
      });
      return;
    }

    saveReportMutation.mutate({
      title: reportTitle,
      description: reportDescription,
      userQuery: currentQuery,
      generatedSql: aiReport.query?.sql || "",
      reportData: aiReport,
      insights: aiReport.insights || [],
      chartType: aiReport.query?.chartType || "table",
    });
  };

  const handleQueryGenerate = (query: string) => {
    setCurrentQuery(query);
    generateReportMutation.mutate(query);
  };

  const handleLoadSavedReport = (report: SavedReport) => {
    loadSavedReportMutation.mutate(report.id);
  };

  const handleDeleteReport = (id: number) => {
    deleteReportMutation.mutate(id);
  };

  // Use report stats from API (with defaults for loading state)
  const todaysRevenue = reportStats?.todaysRevenue ?? 0;
  const todaysOrders = reportStats?.todaysOrders ?? 0;
  const totalRevenue = reportStats?.totalRevenue ?? 0;
  const totalCustomers = reportStats?.totalCustomers ?? 0;

  // Ensure dayOperations is an array before using .find()
  const dayOperationsArray = Array.isArray(dayOperations) ? dayOperations : [];
  const selectedDayOperation = dayOperationsArray.find((day: DayOperation) => {
    return day.date === format(selectedDate, "yyyy-MM-dd");
  });

  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Header actions for desktop (removed duplicate calendar - now in main content)
  const headerActions = null;

  return (
    <MainLayout headerActions={headerActions}>
      <div className="flex h-full bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        {/* Main Content */}
        <div className="flex-1 p-6">
          {/* Professional Header */}
          <div className="mb-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Business Reports
                </h1>
                <p className="text-sm text-slate-500 mt-1 font-medium">
                  Analytics and insights for your business
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="flex items-center gap-2 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 hover:bg-blue-500 hover:border-blue-300 text-blue-700 font-medium transition-all"
                    >
                      <CalendarIcon className="h-4 w-4" />
                      {format(selectedDate, "MMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        if (date) {
                          setSelectedDate(date);
                          setIsCalendarOpen(false);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-3 py-1">
                  <BarChart className="h-3 w-3 mr-1" />
                  Analytics
                </Badge>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 bg-white shadow-sm border border-slate-200 p-1 h-12">
              <TabsTrigger 
                value="overview" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white font-semibold transition-all"
              >
                <Eye className="h-4 w-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger 
                value="ai-reports"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white font-semibold transition-all"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                AI Reports
              </TabsTrigger>
              <TabsTrigger 
                value="templates"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white font-semibold transition-all"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Templates
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 mt-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {loadingStats ? (
                  <>
                    {[...Array(4)].map((_, i) => (
                      <Card key={i} className="bg-white shadow-md border-slate-100">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-8 w-8 rounded-lg" />
                        </CardHeader>
                        <CardContent>
                          <Skeleton className="h-8 w-32 mb-2" />
                          <Skeleton className="h-3 w-20" />
                        </CardContent>
                      </Card>
                    ))}
                  </>
                ) : (
                  <>
                    <Card className="bg-white shadow-md border-green-100 hover:shadow-lg transition-shadow">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-semibold text-slate-700">Today's Revenue</CardTitle>
                        <div className="p-2 bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg">
                          <Coins className="h-4 w-4 text-green-600" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-700">QR {todaysRevenue.toFixed(2)}</div>
                        <p className="text-xs text-slate-500 mt-1">
                          {format(selectedDate, "MMM d, yyyy")}
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-white shadow-md border-blue-100 hover:shadow-lg transition-shadow">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-semibold text-slate-700">Today's Orders</CardTitle>
                        <div className="p-2 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg">
                          <ShoppingCart className="h-4 w-4 text-blue-600" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-blue-700">{todaysOrders}</div>
                        <p className="text-xs text-slate-500 mt-1">
                          Transactions completed
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-white shadow-md border-purple-100 hover:shadow-lg transition-shadow">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-semibold text-slate-700">Total Revenue</CardTitle>
                        <div className="p-2 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg">
                          <TrendingUp className="h-4 w-4 text-purple-600" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-purple-700">QR{totalRevenue.toFixed(2)}</div>
                        <p className="text-xs text-slate-500 mt-1">
                          All time
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-white shadow-md border-indigo-100 hover:shadow-lg transition-shadow">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-semibold text-slate-700">Total Customers</CardTitle>
                        <div className="p-2 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-lg">
                          <Users className="h-4 w-4 text-indigo-600" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-indigo-700">{totalCustomers}</div>
                        <p className="text-xs text-slate-500 mt-1">
                          Unique customers
                        </p>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>

              {/* Daily Operations */}
              {selectedDayOperation && (
                <Card className="bg-gradient-to-br from-white to-blue-50 shadow-lg border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold text-blue-900">
                      Daily Operations - {format(selectedDate, "MMM d, yyyy")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
                        <p className="text-sm font-semibold text-slate-600 mb-1">Opening Cash</p>
                        <p className="text-xl font-bold text-blue-700">QR{selectedDayOperation.openingCash || "0.00"}</p>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
                        <p className="text-sm font-semibold text-slate-600 mb-1">Cash Sales</p>
                        <p className="text-xl font-bold text-green-700">QR{selectedDayOperation.cashSales || "0.00"}</p>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
                        <p className="text-sm font-semibold text-slate-600 mb-1">Card Sales</p>
                        <p className="text-xl font-bold text-indigo-700">QR{selectedDayOperation.cardSales || "0.00"}</p>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
                        <p className="text-sm font-semibold text-slate-600 mb-1">Status</p>
                        <Badge 
                          variant={selectedDayOperation.status === 'open' ? 'default' : 'secondary'}
                          className={selectedDayOperation.status === 'open' 
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' 
                            : 'bg-gradient-to-r from-slate-400 to-slate-500 text-white'
                          }
                        >
                          {selectedDayOperation.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="ai-reports" className="space-y-6 mt-6">
              <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">AI-Powered Reports</h2>
                </div>
                {aiReport && (
                  <Button 
                    onClick={() => setShowSaveDialog(true)} 
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white"
                  >
                    <Save className="h-4 w-4" />
                    Save Report
                  </Button>
                )}
              </div>

              <AIQueryInput 
                onSubmit={handleQueryGenerate} 
                isLoading={generateReportMutation.isPending} 
                templates={templates || []}
              />

              {generateReportMutation.isError && (
                <Alert className={
                  String(generateReportMutation.error?.message || '').includes('OpenAI API key')
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-red-200 bg-red-50'
                }>
                  <AlertCircle className={
                    String(generateReportMutation.error?.message || '').includes('OpenAI API key')
                      ? 'h-4 w-4 text-blue-600'
                      : 'h-4 w-4 text-red-600'
                  } />
                  <AlertDescription className={
                    String(generateReportMutation.error?.message || '').includes('OpenAI API key')
                      ? 'text-blue-800'
                      : 'text-red-800'
                  }>
                    {String(generateReportMutation.error?.message || '').includes('OpenAI API key') ? (
                      <div>
                        <p className="font-semibold mb-1">OpenAI API Key Required</p>
                        <p className="text-sm">AI-powered reports require an OpenAI API key. To enable this feature:</p>
                        <ol className="list-decimal ml-4 mt-2 text-sm space-y-1">
                          <li>Get an API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline font-medium">OpenAI Platform</a></li>
                          <li>Add <code className="bg-blue-100 px-1 rounded">OPENAI_API_KEY=sk-your-key-here</code> to your environment variables</li>
                          <li>Restart the application</li>
                        </ol>
                      </div>
                    ) : (
                      'Failed to generate report. Please try again.'
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {aiReport && (
                <div className="space-y-6">
                  <Card className="bg-gradient-to-br from-white to-purple-50 shadow-lg border-purple-200">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-slate-800">
                          <div className="p-2 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg">
                            <Sparkles className="h-5 w-5 text-purple-600" />
                          </div>
                          {aiReport.query?.title || "AI Generated Report"}
                        </CardTitle>
                        <p className="text-sm text-slate-600 mt-2 font-medium">
                          {aiReport.query?.description || "Generated from your natural language query"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => exportToCSV(aiReport.data, aiReport.query?.title || "report")}
                          className="bg-white hover:bg-blue-50 border-blue-200"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export CSV
                        </Button>
                        <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
                          {aiReport.query?.chartType || "table"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Main Chart */}
                        {aiReport.data && aiReport.data.length > 0 && (
                          <div className="lg:col-span-2">
                            <AIChart 
                              data={aiReport.data} 
                              query={aiReport.query}
                              hasBillData={aiReport.hasBillData}
                              transactionIds={aiReport.transactionIds}
                            />
                          </div>
                        )}

                        {/* No Data Message */}
                        {(!aiReport.data || aiReport.data.length === 0) && (
                          <div className="lg:col-span-2 flex items-center justify-center h-64 bg-slate-50 rounded-lg">
                            <div className="text-center text-slate-500">
                              <BarChart className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                              <p className="text-lg font-medium">No data found</p>
                              <p className="text-sm">Try adjusting your query or date range</p>
                            </div>
                          </div>
                        )}

                        {/* Summary and Insights */}
                        <div className={`space-y-4 ${(!aiReport.data || aiReport.data.length === 0) ? 'lg:col-span-1' : ''}`}>
                          <div className="p-4 bg-blue-50 rounded-lg">
                            <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                              <Info className="h-4 w-4" />
                              Summary
                            </h4>
                            <p className="text-sm text-blue-800">{aiReport.summary}</p>
                          </div>

                          <div className="p-4 bg-yellow-50 rounded-lg">
                            <h4 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                              <Lightbulb className="h-4 w-4" />
                              Insights
                            </h4>
                            <ul className="text-sm text-yellow-800 space-y-1">
                              {(aiReport.insights || []).map((insight, index) => (
                                <li key={index} className="flex items-start gap-2">
                                  <span className="text-yellow-600">•</span>
                                  {insight}
                                </li>
                              ))}
                              {(!aiReport.insights || aiReport.insights.length === 0) && (
                                <li className="text-yellow-600">No specific insights generated for this report.</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Additional Visuals */}
                  {(() => {
                    const hasPieData = aiReport.additionalVisuals?.pieChart && 
                                     aiReport.additionalVisuals?.pieData && 
                                     aiReport.additionalVisuals.pieData.length > 0;
                    const hasBarData = aiReport.additionalVisuals?.barChart && 
                                     aiReport.additionalVisuals?.barData && 
                                     aiReport.additionalVisuals.barData.length > 0;
                    
                    if (!hasPieData && !hasBarData) return null;
                    
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {hasPieData && (
                          <Card className="bg-white shadow-md border-blue-100">
                            <CardHeader>
                              <CardTitle className="text-lg font-bold text-slate-800">
                                {aiReport.additionalVisuals?.pieChart?.title || "Distribution Chart"}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <AIChart 
                                data={aiReport.additionalVisuals?.pieData || []} 
                                query={aiReport.additionalVisuals?.pieChart}
                                hasBillData={false}
                              />
                            </CardContent>
                          </Card>
                        )}
                        
                        {hasBarData && (
                          <Card className="bg-white shadow-md border-indigo-100">
                            <CardHeader>
                              <CardTitle className="text-lg font-bold text-slate-800">
                                {aiReport.additionalVisuals?.barChart?.title || "Comparison Chart"}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <AIChart 
                                data={aiReport.additionalVisuals?.barData || []} 
                                query={aiReport.additionalVisuals?.barChart}
                                hasBillData={false}
                              />
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </TabsContent>

            <TabsContent value="templates" className="space-y-6 mt-6">
              {loadingTemplates ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <Card key={i} className="animate-pulse bg-white shadow-sm border-slate-200">
                      <CardHeader>
                        <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-slate-200 rounded w-full"></div>
                      </CardHeader>
                      <CardContent>
                        <div className="h-9 bg-slate-200 rounded w-full"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-200">
                  <div className="p-4 bg-gradient-to-br from-slate-100 to-blue-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                    <BarChart className="w-10 h-10 text-slate-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-700 mb-2">No report templates found</h3>
                  <p className="text-slate-500 font-medium">
                    Report templates help you quickly generate common business reports
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map((template, index) => (
                    <Card 
                      key={template.id || index} 
                      className="cursor-pointer hover:shadow-xl transition-all bg-white border-slate-200 hover:border-blue-300"
                    >
                      <CardHeader>
                        <CardTitle className="text-lg font-bold text-slate-800">{template.name}</CardTitle>
                        <p className="text-sm text-slate-600 font-medium">{template.description}</p>
                      </CardHeader>
                      <CardContent>
                        <Button
                          onClick={() => handleQueryGenerate(template.query)}
                          disabled={generateReportMutation.isPending}
                          className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold"
                        >
                          {generateReportMutation.isPending ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Generating...
                            </>
                          ) : (
                            <>
                              <BarChart className="h-4 w-4 mr-2" />
                              Generate Report
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Panel - Recent Saved Reports */}
        <div className="w-80 border-l bg-gradient-to-b from-slate-50 to-blue-50 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4 bg-white rounded-lg p-3 shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800">Recent Reports</h3>
            <div className="p-2 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg">
              <BookOpen className="h-5 w-5 text-blue-600" />
            </div>
          </div>

          {loadingSavedReports ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse bg-white rounded-lg p-3 shadow-sm border border-slate-200">
                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : savedReports.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="p-3 bg-gradient-to-br from-slate-100 to-blue-100 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                <BookOpen className="h-8 w-8 text-slate-500" />
              </div>
              <p className="text-sm font-semibold text-slate-700">No saved reports yet</p>
              <p className="text-xs mt-1 text-slate-500">Generate and save your first report</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedReports.map((report: SavedReport) => (
                <Card key={report.id} className="p-3 hover:shadow-md transition-all cursor-pointer bg-white border-slate-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm leading-tight text-slate-800">{report.title}</h4>
                      {report.description && (
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">{report.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className="text-xs bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
                          {report.chartType}
                        </Badge>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(report.createdAt), "MMM d")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLoadSavedReport(report)}
                        disabled={loadSavedReportMutation.isPending}
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white"
                      >
                        <Play className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteReport(report.id)}
                        disabled={deleteReportMutation.isPending}
                        className="hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Save Report Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800">Save Report</DialogTitle>
            <DialogDescription className="text-slate-600">
              Save this report for future reference and quick access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-700">Title</label>
              <Input
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                placeholder="Enter report title"
                className="mt-1 border-slate-300 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Description (optional)</label>
              <Textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder="Brief description of the report"
                rows={3}
                className="mt-1 border-slate-300 focus:border-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowSaveDialog(false)}
                className="border-slate-300 hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveReport}
                disabled={saveReportMutation.isPending || !reportTitle.trim()}
                className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold"
              >
                {saveReportMutation.isPending ? "Saving..." : "Save Report"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}