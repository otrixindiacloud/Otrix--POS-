import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Brain, FileText, Lightbulb, TrendingUp, Users, ShoppingCart } from "lucide-react";

interface RecommendationResponse {
  recommendedProducts?: Array<{ id: number; name: string; score: number }>;
  [key: string]: unknown;
}

interface ReportTemplate {
  id: number;
  name: string;
  description: string;
  query: string;
}

export default function AIPage() {
  const [customerId, setCustomerId] = useState<string>("");
  const [cartItemsJson, setCartItemsJson] = useState<string>("[]");
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendationResponse | null>(null);
  const [query, setQuery] = useState("Daily sales summary");
  const [reportResult, setReportResult] = useState<string>("");
  const [reportLoading, setReportLoading] = useState(false);

  const { data: templates = [] } = useQuery<ReportTemplate[]>({
    queryKey: ["/api/ai/reports/templates"],
  });

  const handleGenerateRecommendations = async () => {
    setIsLoading(true);
    try {
      const parsedCart = JSON.parse(cartItemsJson || "[]");
      const response = await fetch("/api/ai/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId ? Number(customerId) : undefined,
          cartItems: parsedCart,
        }),
      });
      const data = await response.json();
      setRecommendations(data);
    } catch (error) {
      console.error("Failed to generate recommendations", error);
      setRecommendations({ error: "Failed to generate recommendations" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setReportLoading(true);
    try {
      const response = await fetch("/api/ai/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await response.json();
      setReportResult(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Failed to generate AI report", error);
      setReportResult("Failed to generate AI report");
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <MainLayout pageTitle="AI Insights">
      <div className="p-6 space-y-6">
        {/* Professional Header */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-md">
              <Brain className="w-9 h-9 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-gray-800">
                AI Intelligence Hub
              </h1>
              <p className="text-gray-600 text-base font-medium mt-1">
                Harness the power of AI for insights, recommendations, and automated reporting
              </p>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="flex flex-wrap gap-4 mt-6">
            <div className="bg-blue-50 rounded-xl px-4 py-2 border border-blue-200 shadow-sm">
              <div className="text-xs text-blue-700 font-medium">Active Templates</div>
              <div className="text-2xl font-black text-blue-800">{templates.length}</div>
            </div>
            <div className="bg-indigo-50 rounded-xl px-4 py-2 border border-indigo-200 shadow-sm">
              <div className="text-xs text-indigo-700 font-medium">AI Models</div>
              <div className="text-2xl font-black text-indigo-800">3</div>
            </div>
            <div className="bg-green-50 rounded-xl px-4 py-2 border border-green-200 shadow-sm">
              <div className="text-xs text-green-700 font-medium">Status</div>
              <div className="text-lg font-black text-green-700">Active</div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recommendation Engine Card */}
          <Card className="shadow-lg border-gray-200 hover:shadow-xl transition-shadow">
            <CardHeader className="bg-purple-50 border-b border-purple-100">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                  <Lightbulb className="h-5 w-5 text-white" />
                </div>
                Smart Recommendations
              </CardTitle>
              <CardDescription className="text-gray-600">
                Get AI-powered product recommendations based on customer behavior and cart analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-600" />
                    Customer ID
                    <Badge variant="outline" className="ml-auto text-xs">Optional</Badge>
                  </label>
                  <Input
                    value={customerId}
                    onChange={(event) => setCustomerId(event.target.value)}
                    placeholder="Enter customer ID (e.g., 42)"
                    className="border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-purple-600" />
                    Cart Items (JSON Format)
                  </label>
                  <Textarea
                    value={cartItemsJson}
                    onChange={(event) => setCartItemsJson(event.target.value)}
                    rows={5}
                    placeholder='[{"productId": 1, "quantity": 2}]'
                    className="font-mono text-sm border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-500">Enter cart items in JSON format for analysis</p>
                </div>
              </div>
              
              <Button 
                onClick={handleGenerateRecommendations} 
                disabled={isLoading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-md"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Recommendations
                  </>
                )}
              </Button>
              
              {recommendations && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-semibold text-gray-700">Results:</span>
                  </div>
                  <pre className="max-h-80 overflow-auto rounded-lg bg-gray-50 p-4 text-sm border border-gray-200 font-mono">
{JSON.stringify(recommendations, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Reports Card */}
          <Card className="shadow-lg border-gray-200 hover:shadow-xl transition-shadow">
            <CardHeader className="bg-blue-50 border-b border-blue-100">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                AI Report Generator
              </CardTitle>
              <CardDescription className="text-gray-600">
                Generate intelligent business reports with natural language queries
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Brain className="h-4 w-4 text-blue-600" />
                  Natural Language Query
                </label>
                <Textarea
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  rows={3}
                  placeholder="Ask anything: Daily sales summary, Top selling products, Revenue trends..."
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500">Type your question in plain English</p>
              </div>
              
              <Button 
                onClick={handleGenerateReport} 
                disabled={reportLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md"
              >
                {reportLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Report...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate AI Report
                  </>
                )}
              </Button>
              
              {reportResult && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-semibold text-gray-700">Report Output:</span>
                  </div>
                  <pre className="max-h-80 overflow-auto rounded-lg bg-gray-50 p-4 text-sm border border-gray-200 font-mono">
{reportResult}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Report Templates Card */}
        <Card className="shadow-lg border-gray-200">
          <CardHeader className="bg-emerald-50 border-b border-emerald-100">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              Quick Report Templates
            </CardTitle>
            <CardDescription className="text-gray-600">
              Pre-configured report templates for instant insights
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {templates.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No templates available</p>
                <p className="text-sm text-gray-400 mt-1">Templates will appear here when configured</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="group p-4 border border-gray-200 rounded-xl hover:border-emerald-300 hover:shadow-md transition-all bg-white hover:bg-emerald-50"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Sparkles className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-800 mb-1 group-hover:text-emerald-700 transition-colors">
                          {template.name}
                        </h4>
                        <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                          {template.description}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-colors"
                          onClick={() => {
                            setQuery(template.query);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          <Lightbulb className="h-3 w-3 mr-1" />
                          Use Template
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
