import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Store } from "@shared/schema";
import { useAuth } from "./useAuth";

interface StoreContextType {
  currentStore: Store | null;
  setCurrentStore: (store: Store | null) => void;
  availableStores: Store[];
  isLoading: boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentStore, setCurrentStore] = useState<Store | null>(() => {
    // Try to load store from localStorage on initial load
    try {
      const saved = localStorage.getItem('selectedStore');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const { data: stores = [], isLoading } = useQuery<Store[]>({
    queryKey: ["/api/stores/active"],
    enabled: !!user,
  });

  const persistDefaultStore = useCallback(async (storeId: number | null) => {
    if (!user) {
      return;
    }

    try {
      const response = await fetch("/api/users/me/default-store", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId }),
        credentials: "include",
      });
      if (!response.ok) {
        const errorMessage = await response.text().catch(() => "");
        console.warn("Failed to persist default store selection", errorMessage || response.statusText);
      }
    } catch (error) {
      console.warn("Failed to persist default store selection", error);
    }
  }, [user]);

  // Enhanced store switching with VAT recalculation
  const handleStoreChange = useCallback((store: Store | null) => {
    const currentStoreId = currentStore?.id ?? null;
    const nextStoreId = store?.id ?? null;

    if (currentStoreId === nextStoreId) {
      return;
    }

    console.log('Switching store from', currentStore?.name, 'to:', store?.name);
    setCurrentStore(store);
    
    // Persist to localStorage
    if (store) {
      localStorage.setItem('selectedStore', JSON.stringify(store));
    } else {
      localStorage.removeItem('selectedStore');
    }

    // Persist selection server-side for cross-device continuity
    void persistDefaultStore(store ? store.id : null);
    
    // Trigger VAT recalculation when store changes
    if (store) {
      // Force refresh of VAT-related queries
      // This will be picked up by the POS system to recalculate prices
      const event = new CustomEvent('storeChanged', { 
        detail: { storeId: store.id, storeName: store.name } 
      });
      window.dispatchEvent(event);
      
      // Also clear any cached queries that depend on store
      const clearCacheEvent = new CustomEvent('clearStoreCache');
      window.dispatchEvent(clearCacheEvent);
      
      // Don't force page refresh - let React handle the state changes
      console.log('Store changed to:', store.name);
    }
  }, [currentStore?.id, currentStore?.name, persistDefaultStore]); // More specific dependencies to prevent loops

  // Set default store when stores are loaded
  useEffect(() => {
    if (!user || isLoading) {
      return;
    }

    if (stores.length === 0) {
      if (currentStore) {
        handleStoreChange(null);
      }
      return;
    }

    if (currentStore) {
      const storeExists = stores.some((store) => store.id === currentStore.id);
      if (storeExists) {
        return;
      }
    }

    const defaultStore = user.defaultStoreId
      ? stores.find((store) => store.id === user.defaultStoreId)
      : undefined;

    if (defaultStore) {
      handleStoreChange(defaultStore);
      return;
    }

    const fallbackStore = stores[0];
    if (fallbackStore) {
      handleStoreChange(fallbackStore);
    }
  }, [stores, user, isLoading, handleStoreChange]); // Include handleStoreChange now that it has stable deps

  const value: StoreContextType = {
    currentStore,
    setCurrentStore: handleStoreChange,
    availableStores: stores,
    isLoading,
  };

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (context === undefined) {
    // Return a safe default instead of throwing to prevent app crashes
    console.warn("useStore called outside of StoreProvider context - returning defaults");
    return {
      currentStore: null,
      setCurrentStore: () => {},
      availableStores: [],
      isLoading: false,
    };
  }
  return context;
}