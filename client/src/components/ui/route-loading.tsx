import { useEffect, useState, Key } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

interface RouteLoadingProps {
  children: React.ReactNode;
  showDelay?: number; // Delay before showing loading indicator
}

export function RouteLoading({ children, showDelay = 150 }: RouteLoadingProps) {
  const [location] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [prevLocation, setPrevLocation] = useState(location);
  const [routeKey, setRouteKey] = useState<Key>(0);

  useEffect(() => {
    if (location !== prevLocation) {
      setIsLoading(true);
      
      // Short delay to show loading indicator for user feedback
      const timer = setTimeout(() => {
        setIsLoading(false);
        setPrevLocation(location);
        // Force remount by changing key to ensure clean state
        setRouteKey(prev => Number(prev) + 1);
      }, showDelay);

      return () => clearTimeout(timer);
    }
  }, [location, prevLocation, showDelay]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading page...</span>
        </div>
      </div>
    );
  }

  // Force remount with key to prevent stale state
  return <div key={routeKey}>{children}</div>;
}

// Hook for programmatic navigation with loading state
export function useNavigateWithLoading() {
  const [isNavigating, setIsNavigating] = useState(false);

  const navigateWithLoading = (path: string, delay = 50) => {
    setIsNavigating(true);
    
    // Provide immediate visual feedback
    setTimeout(() => {
      window.location.href = path;
      // Reset loading state after navigation (though component may unmount)
      setTimeout(() => setIsNavigating(false), 100);
    }, delay);
  };

  return { navigateWithLoading, isNavigating };
}