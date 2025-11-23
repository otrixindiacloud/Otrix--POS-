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
    retry: 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
    onSuccess: (data) => {
      console.log('[useStore] Fetched stores:', data.length, 'stores');
    },
    onError: (error) => {
      console.error('[useStore] Failed to fetch stores:', error);
    },
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
    setCurrentStore((prevStore) => {
      const currentStoreId = prevStore?.id ?? null;
      const nextStoreId = store?.id ?? null;

      if (currentStoreId === nextStoreId) {
        console.log('[useStore] Store unchanged, skipping update');
        return prevStore; // Return same reference to prevent re-render
      }

      console.log('[useStore] Switching store from', prevStore?.name, '(id:', currentStoreId, ') to:', store?.name, '(id:', nextStoreId, ')');
      
      // Persist to localStorage
      if (store) {
        localStorage.setItem('selectedStore', JSON.stringify(store));
        console.log('[useStore] Saved store to localStorage');
      } else {
        localStorage.removeItem('selectedStore');
        console.log('[useStore] Removed store from localStorage');
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
        console.log('[useStore] Dispatched storeChanged event');
        
        // Also clear any cached queries that depend on store
        const clearCacheEvent = new CustomEvent('clearStoreCache');
        window.dispatchEvent(clearCacheEvent);
        console.log('[useStore] Dispatched clearStoreCache event');
        
        // Don't force page refresh - let React handle the state changes
        console.log('[useStore] Store change complete:', store.name);
      }
      
      return store; // Return new store
    });
  }, [persistDefaultStore]); // Remove currentStore from deps - using functional update instead

  // Set default store when stores are loaded
  useEffect(() => {
    console.log('[useStore] Store initialization effect triggered:', {
      hasUser: !!user,
      isLoading,
      storesCount: stores.length,
      currentStoreId: currentStore?.id,
      userDefaultStoreId: user?.defaultStoreId
    });

    if (!user || isLoading) {
      console.log('[useStore] Skipping initialization: user or stores loading');
      return;
    }

    if (stores.length === 0) {
      console.warn('[useStore] No stores available');
      if (currentStore) {
        console.log('[useStore] Clearing current store');
        handleStoreChange(null);
      }
      return;
    }

    if (currentStore) {
      const storeExists = stores.some((store) => store.id === currentStore.id);
      if (storeExists) {
        console.log('[useStore] Current store still valid:', currentStore.name);
        return;
      }
      console.warn('[useStore] Current store no longer exists:', currentStore.id);
    }

    const defaultStore = user.defaultStoreId
      ? stores.find((store) => store.id === user.defaultStoreId)
      : undefined;

    if (defaultStore) {
      console.log('[useStore] Setting user default store:', defaultStore.name);
      handleStoreChange(defaultStore);
      return;
    }

    const fallbackStore = stores[0];
    if (fallbackStore) {
      console.log('[useStore] Setting fallback store (first available):', fallbackStore.name);
      handleStoreChange(fallbackStore);
    }
  }, [stores, user, isLoading, currentStore]); // Removed handleStoreChange from dependencies

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