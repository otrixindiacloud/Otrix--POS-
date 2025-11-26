import { useEffect } from 'react';
import { usePOSStore } from '@/lib/pos-store';
import { useStore } from '@/hooks/useStore';

/**
 * Hook to synchronize the POS store with the global store context
 * This ensures the cart is automatically filtered when the store changes
 */
export function usePOSStoreSync() {
  const setCurrentStoreId = usePOSStore((state) => state.setCurrentStoreId);
  const { currentStore } = useStore();

  // Set initial store ID when component mounts
  useEffect(() => {
    if (currentStore?.id) {
      console.log('[usePOSStoreSync] Setting initial store ID:', currentStore.id);
      setCurrentStoreId(currentStore.id);
    }
  }, [currentStore?.id, setCurrentStoreId]);

  // Listen for store change events
  useEffect(() => {
    const handleStoreChanged = (event: CustomEvent) => {
      const { storeId } = event.detail;
      console.log('[usePOSStoreSync] Store changed event received, storeId:', storeId);
      setCurrentStoreId(storeId);
    };

    window.addEventListener('storeChanged', handleStoreChanged as EventListener);
    console.log('[usePOSStoreSync] Registered storeChanged listener');

    return () => {
      window.removeEventListener('storeChanged', handleStoreChanged as EventListener);
      console.log('[usePOSStoreSync] Unregistered storeChanged listener');
    };
  }, [setCurrentStoreId]);
}
