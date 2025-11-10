import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, X, Package, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Product } from "@shared/schema";
import { Link } from "wouter";

interface StockAlertProps {
  lowStockProducts: Product[];
  onDismiss?: () => void;
}

export function StockAlert({ lowStockProducts, onDismiss }: StockAlertProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  if (isDismissed || lowStockProducts.length === 0) {
    return null;
  }

  const outOfStockCount = lowStockProducts.filter(p => (p.quantity || 0) === 0).length;
  const lowStockCount = lowStockProducts.filter(p => {
    const qty = p.quantity || 0;
    return qty > 0 && qty <= 5;
  }).length;

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const sortedProducts = [...lowStockProducts].sort((a, b) => {
    const aQty = a.quantity || 0;
    const bQty = b.quantity || 0;
    if (aQty === 0 && bQty > 0) return -1;
    if (aQty > 0 && bQty === 0) return 1;
    return aQty - bQty;
  });

  const displayedProducts = isExpanded ? sortedProducts : sortedProducts.slice(0, 5);

  return (
    <Alert variant="destructive" className="mb-6 border-amber-300 dark:border-amber-700">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <AlertTitle className="flex items-center gap-2 mb-2">
              <span>Stock Alert</span>
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                {lowStockProducts.length} {lowStockProducts.length === 1 ? 'item' : 'items'}
              </Badge>
            </AlertTitle>
            <AlertDescription className="space-y-3">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                {outOfStockCount > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-red-600 dark:text-red-400">
                      {outOfStockCount} Out of Stock
                    </span>
                  </div>
                )}
                {lowStockCount > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-amber-600 dark:text-amber-400">
                      {lowStockCount} Low Stock
                    </span>
                  </div>
                )}
              </div>

              {displayedProducts.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wide">
                    Products Requiring Attention:
                  </div>
                  <div className="space-y-1.5">
                    {displayedProducts.map((product) => {
                      const qty = product.quantity || 0;
                      const isOutOfStock = qty === 0;
                      return (
                        <div
                          key={product.id}
                          className="flex items-center justify-between p-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Package className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">
                                {product.name}
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                                {product.sku}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge
                              variant={isOutOfStock ? "destructive" : "secondary"}
                              className={
                                isOutOfStock
                                  ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                              }
                            >
                              {isOutOfStock ? "Out of Stock" : `${qty} units`}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {sortedProducts.length > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="w-full mt-2 text-amber-700 hover:text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:hover:text-amber-200 dark:hover:bg-amber-950/30"
                    >
                      {isExpanded ? (
                        <>
                          Show Less
                          <ChevronRight className="h-4 w-4 ml-2 rotate-90" />
                        </>
                      ) : (
                        <>
                          Show {sortedProducts.length - 5} More
                          <ChevronRight className="h-4 w-4 ml-2 -rotate-90" />
                        </>
                      )}
                    </Button>
                  )}

                  <div className="pt-2 border-t border-amber-200 dark:border-amber-800">
                    <Link href="/inventory?filter=low-stock">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800 hover:text-amber-900 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 dark:border-amber-800 dark:text-amber-200"
                      >
                        View All Low Stock Items ({lowStockProducts.length})
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </AlertDescription>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="h-8 w-8 p-0 text-amber-600 hover:text-amber-800 hover:bg-amber-100 dark:text-amber-400 dark:hover:text-amber-200 dark:hover:bg-amber-950/30 flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
}

