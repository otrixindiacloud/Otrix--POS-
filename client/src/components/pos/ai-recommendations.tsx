import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePOSStore } from "@/lib/pos-store";
import { useStore } from "@/hooks/useStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Sparkles, 
  TrendingUp, 
  Users, 
  ShoppingCart,
  Package,
  Plus
} from "lucide-react";
import type { Product } from "@shared/schema";

export default function AIRecommendations() {
  const { cartItems, currentCustomer, addToCart } = usePOSStore();
  const { currentStore } = useStore();
  const [isGenerating, setIsGenerating] = useState(false);

  // Get customer purchase history for AI recommendations
  const { data: customerHistory } = useQuery({
    queryKey: ["/api/customers", currentCustomer?.id, "history"],
    enabled: !!currentCustomer,
  });

  // Get AI recommendations based on current cart and customer
  const { data: recommendations = [], isLoading } = useQuery({
    queryKey: [
      "/api/ai/recommendations", 
      currentCustomer?.id, 
      cartItems.map(item => item.productId).join(',')
    ],
    queryFn: async () => {
      const response = await fetch("/api/ai/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: currentCustomer?.id,
          cartItems: cartItems.map(item => ({
            productId: item.productId,
            productName: item.name,
            quantity: item.quantity,
            price: item.price
          }))
        })
      });
      
      if (!response.ok) throw new Error("Failed to get recommendations");
      return response.json();
    },
    enabled: cartItems.length > 0 || !!currentCustomer,
    refetchOnWindowFocus: false,
  });

  const handleAddRecommendation = (product: Product) => {
    addToCart(product, 1, currentStore?.id);
  };

  if (cartItems.length === 0 && !currentCustomer) {
    return (
      <Card className="bg-card border-purple-200">
        <CardContent className="p-6 text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-4 text-purple-400" />
          <p className="text-muted-foreground">
            Add items to cart or select a customer to see AI recommendations
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-purple-200">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Sparkles className="w-5 h-5 mr-2 text-purple-600" />
          AI Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center space-x-3">
                <Skeleton className="w-12 h-12 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="w-16 h-8" />
              </div>
            ))}
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-4">
            <Package className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-500">
              No recommendations available
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec: any) => (
              <Card key={rec.product.id} className="bg-white/80 hover:bg-white transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-slate-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-800 text-sm">
                          {rec.product.name}
                        </h4>
                        <p className="text-xs text-slate-600">
                          ${parseFloat(rec.product.price).toFixed(2)}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {rec.reason === 'frequently_bought_together' && (
                              <>
                                <Users className="w-3 h-3 mr-1" />
                                Often bought together
                              </>
                            )}
                            {rec.reason === 'customer_history' && (
                              <>
                                <TrendingUp className="w-3 h-3 mr-1" />
                                Customer favorite
                              </>
                            )}
                            {rec.reason === 'trending' && (
                              <>
                                <TrendingUp className="w-3 h-3 mr-1" />
                                Trending
                              </>
                            )}
                            {rec.reason === 'seasonal' && (
                              <>
                                <Sparkles className="w-3 h-3 mr-1" />
                                Seasonal
                              </>
                            )}
                          </Badge>
                          <span className="text-xs text-green-600 font-medium">
                            {rec.confidence}% match
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => handleAddRecommendation(rec.product)}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {currentCustomer && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">
                Based on {currentCustomer.name}'s history
              </span>
              <Badge variant="outline" className="text-xs">
                <ShoppingCart className="w-3 h-3 mr-1" />
                {cartItems.length} items in cart
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}