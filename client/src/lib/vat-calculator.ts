import { useStore } from "@/hooks/useStore";
import { useQuery } from "@tanstack/react-query";

export interface VATCalculation {
  baseAmount: number;
  vatAmount: number;
  totalAmount: number;
  vatRate: number;
  applicableRate: string;
}

export interface VATConfiguration {
  id: number;
  storeId: number;
  category: string;
  vatRate: string;
  description: string;
  isActive: boolean;
}

// VAT Calculator utility functions
export class VATCalculator {
  
  /**
   * Calculate VAT for a product based on store and product-specific rates
   */
  static calculateVAT(
    basePrice: number, 
    productCategory: string | null,
    productVATRate: string | null,
    storeId: number | null,
    storeDefaultVATRate: string | null,
    vatConfigurations: VATConfiguration[] = []
  ): VATCalculation {
    
    let applicableRate = 0;
    let rateSource = "default";
    
    // Priority 1: Product-specific VAT rate
    if (productVATRate && productVATRate !== "0.00") {
      applicableRate = parseFloat(productVATRate);
      rateSource = "product-specific";
    }
    // Priority 2: Store + Category specific rate
    else if (storeId && productCategory) {
      const categoryConfig = vatConfigurations.find(
        config => config.storeId === storeId && 
                 config.category.toLowerCase() === productCategory.toLowerCase() &&
                 config.isActive
      );
      
      if (categoryConfig) {
        applicableRate = parseFloat(categoryConfig.vatRate);
        rateSource = `store-category (${categoryConfig.description})`;
      }
    }
    
    // Priority 3: Store default VAT rate
    if (applicableRate === 0 && storeDefaultVATRate) {
      applicableRate = parseFloat(storeDefaultVATRate);
      rateSource = "store-default";
    }
    
    // Priority 4: System default (0%)
    if (applicableRate === 0) {
      applicableRate = 0;
      rateSource = "system-default";
    }
    
    const vatAmount = (basePrice * applicableRate) / 100;
    const totalAmount = basePrice + vatAmount;
    
    return {
      baseAmount: basePrice,
      vatAmount: parseFloat(vatAmount.toFixed(2)),
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      vatRate: applicableRate,
      applicableRate: rateSource
    };
  }
  
  /**
   * Calculate total VAT for multiple items
   */
  static calculateCartVAT(
    cartItems: Array<{
      product: {
        category: string | null;
        vatRate: string | null;
        price: string;
      };
      quantity: number;
    }>,
    storeId: number | null,
    storeDefaultVATRate: string | null,
    vatConfigurations: VATConfiguration[] = []
  ): {
    totalBase: number;
    totalVAT: number;
    totalWithVAT: number;
    itemBreakdown: Array<VATCalculation & { quantity: number; lineTotal: number }>;
  } {
    
    let totalBase = 0;
    let totalVAT = 0;
    const itemBreakdown: Array<VATCalculation & { quantity: number; lineTotal: number }> = [];
    
    cartItems.forEach(item => {
      const basePrice = parseFloat(item.product.price);
      const calculation = this.calculateVAT(
        basePrice,
        item.product.category,
        item.product.vatRate,
        storeId,
        storeDefaultVATRate,
        vatConfigurations
      );
      
      const lineTotal = calculation.totalAmount * item.quantity;
      
      itemBreakdown.push({
        ...calculation,
        quantity: item.quantity,
        lineTotal: parseFloat(lineTotal.toFixed(2))
      });
      
      totalBase += calculation.baseAmount * item.quantity;
      totalVAT += calculation.vatAmount * item.quantity;
    });
    
    return {
      totalBase: parseFloat(totalBase.toFixed(2)),
      totalVAT: parseFloat(totalVAT.toFixed(2)),
      totalWithVAT: parseFloat((totalBase + totalVAT).toFixed(2)),
      itemBreakdown
    };
  }
}

// React hook for VAT calculations
export function useVATCalculation() {
  const { currentStore } = useStore();
  
  // Fetch VAT configurations for current store
  const { data: vatConfigurations = [] } = useQuery<VATConfiguration[]>({
    queryKey: ["/api/vat-configurations", currentStore?.id],
    enabled: !!currentStore?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
  
  const calculateProductVAT = (
    basePrice: number,
    productCategory: string | null = null,
    productVATRate: string | null = null
  ) => {
    return VATCalculator.calculateVAT(
      basePrice,
      productCategory,
      productVATRate,
      currentStore?.id || null,
      currentStore?.defaultVatRate || null,
      vatConfigurations
    );
  };
  
  const calculateCartVAT = (cartItems: Array<{
    product: {
      category: string | null;
      vatRate: string | null;
      price: string;
    };
    quantity: number;
  }>) => {
    return VATCalculator.calculateCartVAT(
      cartItems,
      currentStore?.id || null,
      currentStore?.defaultVatRate || null,
      vatConfigurations
    );
  };
  
  return {
    calculateProductVAT,
    calculateCartVAT,
    vatConfigurations,
    currentStore
  };
}