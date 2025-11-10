import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

interface PrefetchOptions {
  queryKey: string[];
  enabled?: boolean;
  delay?: number;
  staleTime?: number;
}

export function usePrefetch(options: PrefetchOptions[]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const prefetchQueries = async () => {
      for (const option of options) {
        if (option.enabled !== false) {
          try {
            await new Promise(resolve => setTimeout(resolve, option.delay || 0));
            queryClient.prefetchQuery({
              queryKey: option.queryKey,
              staleTime: option.staleTime ?? 5 * 60 * 1000, // allow override per-prefetch
            });
          } catch (error) {
            console.warn(`Failed to prefetch ${option.queryKey.join('/')}:`, error);
          }
        }
      }
    };

    // Start prefetching after a short delay to not block initial render
    const timeoutId = setTimeout(prefetchQueries, 100);
    return () => clearTimeout(timeoutId);
  }, [queryClient, options]);
}

export function useBackgroundRefresh(queryKeys: string[][], interval: number = 30000) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refreshData = () => {
      queryKeys.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey });
      });
    };

    const intervalId = setInterval(refreshData, interval);
    return () => clearInterval(intervalId);
  }, [queryClient, queryKeys, interval]);
}