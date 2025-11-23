import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Coins, TrendingUp } from "lucide-react";

interface CurrencySelectorProps {
  onCurrencyChange?: (currency: string) => void;
  currentCurrency?: string;
}

interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: string;
}

// Define currencies outside component to prevent recreation
const CURRENCIES = [
  { code: "QAR", symbol: "QR", name: "Qatari Riyal" },
  { code: "AED", symbol: "AED", name: "UAE Dirham" },
  { code: "SAR", symbol: "SR", name: "Saudi Riyal" },
  { code: "KWD", symbol: "KD", name: "Kuwaiti Dinar" },
  { code: "BHD", symbol: "BD", name: "Bahraini Dinar" },
  { code: "USD", symbol: "USD", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
] as const;

export default function CurrencySelector({ onCurrencyChange, currentCurrency = "QAR" }: CurrencySelectorProps) {
  const [selectedCurrency, setSelectedCurrency] = useState(currentCurrency);

  const { data: exchangeRates = [] } = useQuery<ExchangeRate[]>({
    queryKey: ["/api/currency-rates"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes to reduce refetching
  });

  // Stabilize the change handler
  const handleCurrencyChange = useCallback((currency: string) => {
    setSelectedCurrency(currency);
    onCurrencyChange?.(currency);
  }, [onCurrencyChange]);

  // Memoize exchange rates map
  const ratesMap = useMemo(() => {
    const map = new Map<string, number>();
    exchangeRates.forEach((rate: ExchangeRate) => {
      if (rate.fromCurrency === "QAR") {
        map.set(rate.toCurrency, parseFloat(rate.rate));
      }
    });
    return map;
  }, [exchangeRates]);

  // Get current exchange rate
  const getCurrentRate = useMemo(() => {
    if (selectedCurrency === "QAR") return 1;
    return ratesMap.get(selectedCurrency) ?? 1;
  }, [selectedCurrency, ratesMap]);

  // Pre-compute currency items to prevent recalculation during render
  const currencyItems = useMemo(() => {
    return CURRENCIES.map((currency) => {
      const rate = currency.code === "QAR" ? 1 : (ratesMap.get(currency.code) ?? 1);
      return {
        ...currency,
        rate,
      };
    });
  }, [ratesMap]);

  return (
    <div className="flex items-center space-x-2">
      <div className="flex items-center space-x-1">
        <Coins className="w-3 h-3 text-white/80 dark:text-slate-300" />
        <Badge variant="outline" className="text-xs bg-white/10 border-white/20 text-white/90 dark:bg-slate-700/50 dark:border-slate-600/30 dark:text-slate-200">
          <TrendingUp className="w-3 h-3 mr-1" />
          Multi-Currency
        </Badge>
      </div>
      
      <Select value={selectedCurrency} onValueChange={handleCurrencyChange}>
        <SelectTrigger className="w-24 h-7 text-xs bg-white/10 border-white/20 text-white/90 dark:bg-slate-700/50 dark:border-slate-600/30 dark:text-slate-200 hover:bg-white/20 transition-colors">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="min-w-[140px]">
          {currencyItems.map((currency) => (
            <SelectItem key={currency.code} value={currency.code}>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-2">
                  <span className="font-bold">{currency.symbol}</span>
                  <span>{currency.code}</span>
                </div>
                {currency.code !== "QAR" && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ≈{currency.rate.toFixed(3)}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {selectedCurrency !== "QAR" && (
        <Badge variant="secondary" className="text-xs px-2 py-1">
          Rate: {getCurrentRate.toFixed(3)}
        </Badge>
      )}
    </div>
  );
}