import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { 
  AlertTriangle, 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Eye,
  Clock,
  Coins,
  CreditCard,
  User,
  Package,
  History,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react";
import { format } from "date-fns";
import { RiskBadge } from "./risk-indicator";

interface CustomerRiskHistoryProps {
  customerId: number;
  customerName: string;
}

interface RiskHistoryItem {
  id: number;
  transactionNumber: string;
  total: string;
  paymentMethod: string;
  status: string;
  createdAt: string;
  riskAssessment: {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskScore: number;
    color: string;
    badge: string;
    riskReasons: string[];
    recommendations: string[];
  };
}

export default function CustomerRiskHistory({ customerId, customerName }: CustomerRiskHistoryProps) {
  const { data: riskHistory = [], isLoading } = useQuery<RiskHistoryItem[]>({
    queryKey: ["/api/risk/customer", customerId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/risk/customer/${customerId}`);
      return await response.json();
    },
    enabled: !!customerId,
  });

  const getRiskTrend = () => {
    if (riskHistory.length < 2) return null;
    
    const recent = riskHistory.slice(0, 3);
    const older = riskHistory.slice(3, 6);
    
    const recentAvg = recent.reduce((sum: number, item: RiskHistoryItem) => 
      sum + item.riskAssessment.riskScore, 0) / recent.length;
    const olderAvg = older.reduce((sum: number, item: RiskHistoryItem) => 
      sum + item.riskAssessment.riskScore, 0) / older.length;
    
    if (recentAvg > olderAvg + 5) return 'increasing';
    if (recentAvg < olderAvg - 5) return 'decreasing';
    return 'stable';
  };

  const getTrendIcon = (trend: string | null) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'decreasing':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      case 'stable':
        return <Minus className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getTrendLabel = (trend: string | null) => {
    switch (trend) {
      case 'increasing':
        return 'Risk Increasing';
      case 'decreasing':
        return 'Risk Decreasing';
      case 'stable':
        return 'Risk Stable';
      default:
        return 'Insufficient Data';
    }
  };

  const getOverallRiskLevel = () => {
    if (riskHistory.length === 0) return 'unknown';
    
    const avgScore = riskHistory.reduce((sum: number, item: RiskHistoryItem) => 
      sum + item.riskAssessment.riskScore, 0) / riskHistory.length;
    
    if (avgScore >= 60) return 'high';
    if (avgScore >= 35) return 'medium';
    return 'low';
  };

  const trend = getRiskTrend();
  const overallRisk = getOverallRiskLevel();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 text-xs"
        >
          <History className="h-3 w-3" />
          Risk History
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Risk History - {customerName}
          </DialogTitle>
          <DialogDescription>
            View comprehensive risk assessment history and trends for this customer's transaction patterns.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Risk Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Overall Risk Level</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {overallRisk === 'high' && <ShieldAlert className="h-5 w-5 text-red-500" />}
                  {overallRisk === 'medium' && <Shield className="h-5 w-5 text-yellow-500" />}
                  {overallRisk === 'low' && <ShieldCheck className="h-5 w-5 text-green-500" />}
                  <Badge 
                    variant="outline"
                    className={`
                      ${overallRisk === 'high' ? 'border-red-500 text-red-700' : ''}
                      ${overallRisk === 'medium' ? 'border-warning text-warning' : ''}
                      ${overallRisk === 'low' ? 'border-green-500 text-green-700' : ''}
                    `}
                  >
                    {overallRisk.toUpperCase()}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Risk Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {getTrendIcon(trend)}
                  <span className="text-sm font-medium">
                    {getTrendLabel(trend)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Total Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {riskHistory.length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Transaction History */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : riskHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <History className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No transaction history available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {riskHistory.map((item: RiskHistoryItem) => (
                    <div 
                      key={item.id} 
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-medium text-sm">
                            {item.transactionNumber}
                          </span>
                          <RiskBadge 
                            riskLevel={item.riskAssessment.riskLevel}
                            riskScore={item.riskAssessment.riskScore}
                            color={item.riskAssessment.color}
                            badge={item.riskAssessment.badge}
                            compact={true}
                          />
                        </div>
                        <div className="text-xs text-gray-600 space-y-1">
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <Coins className="h-3 w-3" />
                              QR {parseFloat(item.total).toFixed(2)}
                            </span>
                            <span className="flex items-center gap-1">
                              <CreditCard className="h-3 w-3" />
                              {item.paymentMethod}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(item.createdAt), 'MMM d, HH:mm')}
                            </span>
                          </div>
                          {item.riskAssessment.riskReasons.length > 0 && (
                            <div className="text-xs text-orange-600 max-w-md">
                              {item.riskAssessment.riskReasons.slice(0, 2).join(', ')}
                              {item.riskAssessment.riskReasons.length > 2 && '...'}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline"
                          className={`text-xs ${
                            item.status === 'completed' ? 'border-green-500 text-green-700' : 
                            item.status === 'voided' ? 'border-red-500 text-red-700' : 
                            'border-gray-500 text-gray-700'
                          }`}
                        >
                          {item.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Risk Recommendations */}
          {riskHistory.length > 0 && overallRisk !== 'low' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  Customer Risk Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {overallRisk === 'high' && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800">
                        High-risk customer profile detected. Require manager approval for large transactions.
                      </AlertDescription>
                    </Alert>
                  )}
                  {trend === 'increasing' && (
                    <Alert className="border-warning bg-warning/10">
                      <TrendingUp className="h-4 w-4 text-warning" />
                      <AlertDescription className="text-warning-foreground">
                        Risk profile is increasing. Monitor recent activity patterns closely.
                      </AlertDescription>
                    </Alert>
                  )}
                  <Alert className="border-blue-200 bg-blue-50">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      Verify customer identity and payment methods for future transactions.
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}