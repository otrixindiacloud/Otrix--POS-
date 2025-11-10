import { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { 
  AlertTriangle, 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  X, 
  Eye,
  Clock,
  Coins,
  CreditCard,
  User,
  Package,
  RotateCcw
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface RiskFactors {
  highValueTransaction: boolean;
  unusualQuantity: boolean;
  firstTimeCustomer: boolean;
  frequentReturns: boolean;
  suspiciousPaymentPattern: boolean;
  lowStockItems: boolean;
  multipleHighValueItems: boolean;
  cashOnlyLargeTransaction: boolean;
  rapidSequentialTransactions: boolean;
  unusualTimeTransaction: boolean;
}

interface RiskAssessment {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  riskFactors: RiskFactors;
  riskReasons: string[];
  color: string;
  badge: string;
  recommendations: string[];
}

interface RiskIndicatorProps {
  transactionData: {
    customerId?: number;
    total: number;
    items: Array<{
      productId: number;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
    paymentMethod: string;
    cashTendered?: number;
  };
  onRiskAssessed?: (risk: RiskAssessment) => void;
  className?: string;
}

export default function RiskIndicator({ transactionData, onRiskAssessed, className }: RiskIndicatorProps) {
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (transactionData.total > 0 && transactionData.items.length > 0) {
      assessRisk();
    }
  }, [transactionData]);

  const assessRisk = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", '/api/risk/assess', transactionData);
      const data = await response.json() as RiskAssessment;
      setRiskAssessment(data);
      onRiskAssessed?.(data);
    } catch (error) {
      console.error('Error assessing risk:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <ShieldAlert className="h-4 w-4 text-red-500" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'medium':
        return <Shield className="h-4 w-4 text-yellow-500" />;
      case 'low':
      default:
        return <ShieldCheck className="h-4 w-4 text-green-500" />;
    }
  };

  const getFactorIcon = (factor: string) => {
    switch (factor) {
      case 'highValueTransaction':
      case 'cashOnlyLargeTransaction':
        return <Coins className="h-4 w-4" />;
      case 'firstTimeCustomer':
      case 'frequentReturns':
      case 'rapidSequentialTransactions':
        return <User className="h-4 w-4" />;
      case 'suspiciousPaymentPattern':
        return <CreditCard className="h-4 w-4" />;
      case 'lowStockItems':
      case 'multipleHighValueItems':
      case 'unusualQuantity':
        return <Package className="h-4 w-4" />;
      case 'unusualTimeTransaction':
        return <Clock className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getFactorLabel = (factor: string) => {
    switch (factor) {
      case 'highValueTransaction':
        return 'High Value';
      case 'unusualQuantity':
        return 'Large Quantity';
      case 'firstTimeCustomer':
        return 'New Customer';
      case 'frequentReturns':
        return 'Frequent Returns';
      case 'suspiciousPaymentPattern':
        return 'Payment Pattern';
      case 'lowStockItems':
        return 'Low Stock';
      case 'multipleHighValueItems':
        return 'Multiple Expensive Items';
      case 'cashOnlyLargeTransaction':
        return 'Large Cash Payment';
      case 'rapidSequentialTransactions':
        return 'Rapid Transactions';
      case 'unusualTimeTransaction':
        return 'Off-Hours';
      default:
        return factor;
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        <span className="text-sm text-gray-600">Assessing risk...</span>
      </div>
    );
  }

  if (!riskAssessment) {
    return null;
  }

  const activeFactors = Object.entries(riskAssessment.riskFactors)
    .filter(([_, value]) => value)
    .map(([key, _]) => key);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-2 px-2 py-1 h-auto"
            style={{ 
              borderColor: riskAssessment.color,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
          >
            {getRiskIcon(riskAssessment.riskLevel)}
            <Badge 
              variant="outline" 
              className="text-xs font-medium"
              style={{ 
                borderColor: riskAssessment.color,
                color: riskAssessment.color
              }}
            >
              {riskAssessment.badge}
            </Badge>
          </Button>
        </DialogTrigger>
        
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getRiskIcon(riskAssessment.riskLevel)}
              Transaction Risk Assessment
            </DialogTitle>
            <DialogDescription>
              Detailed analysis of potential risk factors and security recommendations for this transaction.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Risk Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  Risk Summary
                  <Badge 
                    variant="outline" 
                    className="text-sm font-medium"
                    style={{ 
                      borderColor: riskAssessment.color,
                      color: riskAssessment.color
                    }}
                  >
                    {riskAssessment.badge} ({riskAssessment.riskScore}/100)
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-full bg-gray-200 rounded-full h-2"
                    >
                      <div 
                        className="h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${riskAssessment.riskScore}%`,
                          backgroundColor: riskAssessment.color
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium whitespace-nowrap">
                      {riskAssessment.riskScore}%
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Risk Level:</span>
                      <span className="ml-2 capitalize">{riskAssessment.riskLevel}</span>
                    </div>
                    <div>
                      <span className="font-medium">Active Factors:</span>
                      <span className="ml-2">{activeFactors.length}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Risk Factors */}
            {activeFactors.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Risk Factors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeFactors.map((factor) => (
                      <div 
                        key={factor}
                        className="flex items-center gap-2 p-2 border rounded-lg"
                      >
                        {getFactorIcon(factor)}
                        <span className="text-sm font-medium">
                          {getFactorLabel(factor)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Risk Reasons */}
            {riskAssessment.riskReasons.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Risk Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {riskAssessment.riskReasons.map((reason, index) => (
                      <Alert key={index} className="border-orange-200 bg-orange-50">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-orange-800">
                          {reason}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recommendations */}
            {riskAssessment.recommendations.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {riskAssessment.recommendations.map((recommendation, index) => (
                      <Alert key={index} className="border-blue-200 bg-blue-50">
                        <Shield className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-blue-800">
                          {recommendation}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => assessRisk()}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Reassess
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDetails(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface RiskBadgeProps {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  color: string;
  badge: string;
  compact?: boolean;
}

export function RiskBadge({ riskLevel, riskScore, color, badge, compact = false }: RiskBadgeProps) {
  return (
    <div className="flex items-center gap-1">
      {getRiskIcon(riskLevel)}
      <Badge 
        variant="outline" 
        className={`${compact ? 'text-xs' : 'text-sm'} font-medium`}
        style={{ 
          borderColor: color,
          color: color
        }}
      >
        {badge}
      </Badge>
      {!compact && (
        <span className="text-xs text-gray-500">
          ({riskScore})
        </span>
      )}
    </div>
  );
}

function getRiskIcon(level: string) {
  switch (level) {
    case 'critical':
      return <ShieldAlert className="h-4 w-4 text-red-500" />;
    case 'high':
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    case 'medium':
      return <Shield className="h-4 w-4 text-yellow-500" />;
    case 'low':
    default:
      return <ShieldCheck className="h-4 w-4 text-green-500" />;
  }
}