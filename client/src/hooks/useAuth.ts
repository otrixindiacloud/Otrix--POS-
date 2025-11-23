import { useState, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, setAuthRedirectHandler } from "@/lib/queryClient";

interface LoginCredentials {
  username: string;
  password: string;
}

interface AuthUser {
  id: number;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: string;
  profileImageUrl?: string;
  defaultStoreId?: number | null;
}

export function useAuth() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Handle session expiration by redirecting to login
  const handleSessionExpired = useCallback(() => {
    console.log("Session expired - clearing user state");
    setUser(null);
    queryClient.clear();
    toast({
      title: "Session expired",
      description: "Please log in again.",
      variant: "destructive",
    });
  }, []); // queryClient and toast are stable, no need in deps

  // Set up global auth redirect handler and check authentication status
  useEffect(() => {
    // Set up the global 401 handler
    setAuthRedirectHandler(handleSessionExpired);

    // Absolute fallback - if auth check takes more than 8 seconds, force show login
    const absoluteTimeout = setTimeout(() => {
      console.error("⚠️ CRITICAL: Auth check taking too long (>8s), forcing login screen");
      setUser(null);
      setIsLoading(false);
    }, 8000);

    const checkAuth = async () => {
      console.log("🔍 Starting authentication check...");
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout (reduced from 10)

        const response = await fetch("/api/auth/user", {
          credentials: "include",
          signal: controller.signal,
          cache: "no-cache", // Ensure fresh check
        });

        clearTimeout(timeoutId);
        clearTimeout(absoluteTimeout); // Clear the fallback timeout

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          console.log("✅ Authentication check successful:", userData.username);
        } else if (response.status === 401) {
          // User is not authenticated, that's expected
          setUser(null);
          console.log("🔓 User not authenticated - showing login");
        } else {
          // Other error - assume not authenticated to avoid infinite loading
          console.warn("⚠️ Authentication check error:", response.status, response.statusText);
          setUser(null); // Clear user state on errors to show login
        }
      } catch (error: any) {
        clearTimeout(absoluteTimeout); // Clear the fallback timeout
        if (error.name === 'AbortError') {
          console.warn("⏱️ Authentication check timed out - proceeding to login");
          setUser(null); // Show login screen on timeout
        } else {
          console.warn("❌ Authentication check failed:", error);
          setUser(null); // Show login screen on error
        }
      } finally {
        console.log("🏁 Auth check complete, setting isLoading to false");
        setIsLoading(false);
      }
    };

    checkAuth();

    // Set up periodic session refresh - but don't trigger logout on failure
    const refreshInterval = setInterval(async () => {
      try {
        const response = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        
        if (response.ok) {
          console.log("Session refreshed successfully");
        } else if (response.status === 401) {
          // Session expired naturally, clear interval and trigger logout
          console.log("Session expired during refresh, logging out");
          clearInterval(refreshInterval);
          handleSessionExpired();
        } else {
          console.warn("Session refresh returned unexpected status:", response.status);
        }
      } catch (error) {
        // Network errors shouldn't trigger logout
        console.warn("Session refresh network error (non-critical):", error);
      }
    }, 15 * 60 * 1000); // Refresh every 15 minutes

    return () => {
      clearTimeout(absoluteTimeout);
      clearInterval(refreshInterval);
    };
  }, [handleSessionExpired]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const response = await apiRequest("POST", "/api/login", credentials);
      return response.json();
    },
    onSuccess: (userData: AuthUser) => {
      setUser(userData);
      toast({
        title: "Login successful",
        description: `Welcome back, ${userData.firstName || userData.username}!`,
      });
      // Force a page refresh to ensure proper state transition
      window.location.href = "/";
    },
    onError: (error: Error) => {
      console.error("Login failed:", error);
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Logout failed" }));
        throw new Error(error.message || "Logout failed");
      }
      
      return response.json();
    },
    onSuccess: () => {
      console.log("Logout API successful");
      setUser(null);
      queryClient.clear();
      // Force immediate redirect to login page
      window.location.replace("/");
    },
    onError: (error: Error) => {
      console.warn("Logout API failed, clearing session locally:", error);
      // Even if logout fails, clear local state and redirect
      setUser(null);
      queryClient.clear();
      // Force immediate redirect to login page  
      window.location.replace("/");
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    isLoginLoading: loginMutation.isPending,
    isLogoutLoading: logoutMutation.isPending,
  };
}