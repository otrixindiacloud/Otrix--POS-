import productCategoriesConfig from './product-categories.json';

export interface ProductType {
  value: string;
  label: string;
  icon: string;
}

export interface Category {
  value: string;
  label: string;
}

export interface QuickCategory extends Category {
  type: string;
}

export interface ProductCategoriesConfig {
  productTypes: ProductType[];
  categories: Record<string, Category[]>;
  quickCategories: QuickCategory[];
}

// Type-safe access to the configuration
export const productConfig: ProductCategoriesConfig = productCategoriesConfig as ProductCategoriesConfig;

// Helper functions
export const getProductTypes = (): ProductType[] => {
  return productConfig.productTypes;
};

export const getCategoriesByType = (type: string): Category[] => {
  return productConfig.categories[type] || [];
};

export const getAllCategories = (): Category[] => {
  return Object.values(productConfig.categories).flat();
};

export const getQuickCategories = (): QuickCategory[] => {
  return productConfig.quickCategories;
};

export const getCategoryLabel = (value: string): string => {
  const allCategories = getAllCategories();
  const category = allCategories.find(cat => cat.value === value);
  return category?.label || value;
};

export const getProductTypeLabel = (value: string): string => {
  const type = productConfig.productTypes.find(t => t.value === value);
  return type?.label || value;
};

export const getProductTypeByCategory = (categoryValue: string): string | null => {
  for (const [type, categories] of Object.entries(productConfig.categories)) {
    if (categories.some(cat => cat.value === categoryValue)) {
      return type;
    }
  }
  return null;
};
