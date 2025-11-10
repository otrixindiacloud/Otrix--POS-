import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Tag, Percent } from "lucide-react";
import { usePOSStore } from "@/lib/pos-store";
import { useStore } from "@/hooks/useStore";

interface Promotion {
  id: number;
  name: string;
  type: string;
  value: number;
}

export default function PromotionIndicator() {
  const { cartItems } = usePOSStore();
  const { currentStore } = useStore();

  const { data: activePromotions = [] } = useQuery<Promotion[]>({
    queryKey: ["/api/promotions/active"],
    enabled: !!currentStore,
  });

  const { data: applicablePromotions = [] } = useQuery<Promotion[]>({
    queryKey: ["/api/promotions/applicable", cartItems],
    enabled: cartItems.length > 0 && !!currentStore,
  });

  const handleApplyPromotions = async () => {
    try {
      for (const promotion of applicablePromotions) {
        const response = await fetch('/api/promotions/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            promotionId: promotion.id,
            cartItems: cartItems.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price
            }))
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log(`Applied promotion ${promotion.name}:`, result);
          // Update POS store with promotion discount
          const discountEvent = new CustomEvent('promotionApplied', {
            detail: { promotion: promotion, discount: result.discount }
          });
          window.dispatchEvent(discountEvent);
        }
      }
    } catch (error) {
      console.error('Error applying promotions:', error);
    }
  };

  // Safely check if activePromotions exists and has length
  if (!activePromotions || activePromotions.length === 0) return null;

  return (
    <div className="flex items-center space-x-2 flex-wrap">
      <div className="flex items-center space-x-1">
        <Sparkles className="w-4 h-4 text-yellow-500" />
        <Badge variant="outline" className="text-xs bg-yellow-50 border-yellow-200 text-yellow-700">
          <Tag className="w-3 h-3 mr-1" />
          {activePromotions?.length || 0} Active Offers
        </Badge>
      </div>

      {applicablePromotions && applicablePromotions.length > 0 && (
        <div className="flex items-center space-x-2">
          <Badge className="text-xs bg-green-100 border-green-200 text-green-700 animate-pulse">
            <Percent className="w-3 h-3 mr-1" />
            {applicablePromotions.length} Available
          </Badge>
          <Button
            onClick={handleApplyPromotions}
            size="sm"
            className="text-xs bg-green-600 hover:bg-green-700 text-white"
          >
            Apply Now
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleApplyPromotions}
            className="h-6 text-xs px-2 bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-900/30 border-green-200"
          >
            Apply Discounts
          </Button>
        </div>
      )}

      {applicablePromotions && applicablePromotions.length === 0 && cartItems.length > 0 && (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          Add more items for discounts
        </Badge>
      )}
    </div>
  );
}