import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Coins, RefreshCw, TrendingUp, Globe } from "lucide-react";
import type { CurrencyRate } from "@shared/schema";

const CURRENCIES = {
  QAR: { name: 'Qatari Riyal', symbol: 'QR' },
  AED: { name: 'UAE Dirham', symbol: 'AED' },
  SAR: { name: 'Saudi Riyal', symbol: 'SR' },
  KWD: { name: 'Kuwaiti Dinar', symbol: 'KD' },
  BHD: { name: 'Bahraini Dinar', symbol: 'BD' },
  USD: { name: 'US Dollar', symbol: 'USD' },
  EUR: { name: 'Euro', symbol: '€' },
  GBP: { name: 'British Pound', symbol: '£' },
};

interface CurrencyManagementProps {
  storeId: number;
}

export default function CurrencyManagement({ storeId }: CurrencyManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddRate, setShowAddRate] = useState(false);

  const { data: currencyRates, isLoading } = useQuery({
    queryKey: ['/api/currency-rates'],
  });

  const { data: storeInfo } = useQuery({
    queryKey: ['/api/stores', storeId],
  });

  const addRateMutation = useMutation({
    mutationFn: async (data: { fromCurrency: string; toCurrency: string; rate: number }) => {
      return apiRequest('/api/currency-rates', 'POST', data);
    },
    onSuccess: () => {
      toast({ title: "Exchange rate added successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/currency-rates'] });
      setShowAddRate(false);
    },
    onError: () => {
      toast({ title: "Failed to add exchange rate", variant: "destructive" });
    },
  });

  const updateBaseCurrencyMutation = useMutation({
    mutationFn: async (currency: string) => {
      return apiRequest(`/api/stores/${storeId}`, 'PATCH', { baseCurrency: currency });
    },
    onSuccess: () => {
      toast({ title: "Base currency updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/stores', storeId] });
    },
    onError: () => {
      toast({ title: "Failed to update base currency", variant: "destructive" });
    },
  });

  const convertAmountMutation = useMutation({
    mutationFn: async (data: { amount: number; fromCurrency: string; toCurrency: string }) => {
      return apiRequest('/api/currency/convert', 'POST', data);
    },
    onSuccess: (result: any) => {
      toast({ 
        title: "Currency Conversion", 
        description: `${result.originalAmount} ${result.fromCurrency} = ${result.convertedAmount} ${result.toCurrency}` 
      });
    },
  });

  const handleAddRate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      fromCurrency: formData.get('fromCurrency') as string,
      toCurrency: formData.get('toCurrency') as string,
      rate: parseFloat(formData.get('rate') as string),
    };
    
    addRateMutation.mutate(data);
  };

  const handleTestConversion = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      amount: parseFloat(formData.get('amount') as string),
      fromCurrency: formData.get('fromCurrency') as string,
      toCurrency: formData.get('toCurrency') as string,
    };
    
    convertAmountMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Globe className="w-5 h-5" />
            <span>Multi-Currency Settings</span>
          </CardTitle>
          <CardDescription>
            Configure base currency and exchange rates for international transactions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Store Base Currency</Label>
            <Select 
              value={(storeInfo as any)?.baseCurrency || 'QAR'} 
              onValueChange={(value) => updateBaseCurrencyMutation.mutate(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CURRENCIES).map(([code, info]) => (
                  <SelectItem key={code} value={code}>
                    {info.symbol} {info.name} ({code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="pt-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Exchange Rates</h4>
              <Button 
                size="sm" 
                onClick={() => setShowAddRate(!showAddRate)}
              >
                <Coins className="w-4 h-4 mr-2" />
                Add Rate
              </Button>
            </div>

            {showAddRate && (
              <Card className="mb-4">
                <CardContent className="pt-4">
                  <form onSubmit={handleAddRate} className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="fromCurrency">From Currency</Label>
                        <Select name="fromCurrency" required>
                          <SelectTrigger>
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(CURRENCIES).map(([code, info]) => (
                              <SelectItem key={code} value={code}>
                                {code} - {info.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="toCurrency">To Currency</Label>
                        <Select name="toCurrency" required>
                          <SelectTrigger>
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(CURRENCIES).map(([code, info]) => (
                              <SelectItem key={code} value={code}>
                                {code} - {info.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="rate">Exchange Rate</Label>
                        <Input
                          id="rate"
                          name="rate"
                          type="number"
                          step="0.0001"
                          min="0"
                          placeholder="3.64"
                          required
                        />
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button type="submit" size="sm" disabled={addRateMutation.isPending}>
                        {addRateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Add Rate
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowAddRate(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(currencyRates as any)?.map((rate: CurrencyRate) => (
                <div key={rate.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">
                      {rate.fromCurrency} → {rate.toCurrency}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      1 {rate.fromCurrency} = {rate.rate} {rate.toCurrency}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      {rate.rate}
                    </Badge>
                  </div>
                </div>
              ))}
              {!(currencyRates as any)?.length && (
                <p className="text-muted-foreground text-center py-4 col-span-2">
                  No exchange rates configured. Add rates above to enable multi-currency support.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <RefreshCw className="w-5 h-5" />
            <span>Currency Converter (Test)</span>
          </CardTitle>
          <CardDescription>
            Test currency conversion with current rates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleTestConversion} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="100"
                  required
                />
              </div>
              <div>
                <Label htmlFor="testFromCurrency">From</Label>
                <Select name="fromCurrency" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CURRENCIES).map(([code, info]) => (
                      <SelectItem key={code} value={code}>
                        {code} - {info.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="testToCurrency">To</Label>
                <Select name="toCurrency" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CURRENCIES).map(([code, info]) => (
                      <SelectItem key={code} value={code}>
                        {code} - {info.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={convertAmountMutation.isPending}>
              {convertAmountMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Convert
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}