import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Global authentication state for handling 401 redirects
let authRedirectHandler: (() => void) | null = null;

export function setAuthRedirectHandler(handler: () => void) {
  authRedirectHandler = handler;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage = res.statusText;
    let errorData: any = null;
    
    try {
      // Try to parse as JSON first (most API errors)
      errorData = await res.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      // If JSON parsing fails, try as text
      try {
        const text = await res.text();
        if (text) errorMessage = text;
      } catch {
        // Use statusText as fallback
      }
    }
    
    // Handle 401 Unauthorized - but be careful not to trigger on expected scenarios
    if (res.status === 401) {
      // Only trigger auth redirect if it's a legitimate auth failure
      // Don't trigger on endpoints that might naturally return 401
      const url = res.url || '';
      const isAuthEndpoint = url.includes('/api/auth/') || url.includes('/api/login') || url.includes('/api/logout');
      
      if (!isAuthEndpoint && authRedirectHandler) {
        console.log("401 detected on non-auth endpoint, triggering session expired handler");
        authRedirectHandler();
      }
      
      throw new Error("Session expired. Please log in again.");
    }
    
    // Create enhanced error with response data attached
    const error = new Error(errorMessage) as any;
    error.response = {
      status: res.status,
      statusText: res.statusText,
      data: errorData
    };
    
    throw error;
  }
}

// Overloaded function signatures
export async function apiRequest<T = any>(
  method: string,
  url: string,
  body?: unknown
): Promise<Response>;

export async function apiRequest<T = any>(options: {
  method: string;
  url: string;
  body?: unknown;
}): Promise<Response>;

// Implementation
export async function apiRequest<T = any>(
  methodOrOptions: string | { method: string; url: string; body?: unknown },
  url?: string,
  body?: unknown
): Promise<Response> {
  let method: string;
  let requestUrl: string;
  let requestBody: unknown;

  if (typeof methodOrOptions === 'object') {
    // Object format: { method, url, body }
    method = methodOrOptions.method;
    requestUrl = methodOrOptions.url;
    requestBody = methodOrOptions.body;
  } else {
    // Individual parameters format
    method = methodOrOptions;
    requestUrl = url!;
    requestBody = body;
  }
  
  const controller = new AbortController();
  // Increase timeout for specific requests that may take longer
  let timeout = 10000; // Default 10 seconds
  
  if (requestUrl.includes('/logout')) {
    timeout = 15000; // 15 seconds for logout
  } else if (requestUrl.includes('/api/transactions') && method === 'POST') {
    timeout = 30000; // 30 seconds for creating transactions (includes stock updates, items processing, etc.)
  } else if (requestUrl.includes('/api/transactions') && (method === 'PUT' || method === 'PATCH')) {
    timeout = 25000; // 25 seconds for updating transactions
  } else if (requestUrl.includes('/generate-invoice') || requestUrl.includes('/pdf')) {
    timeout = 20000; // 20 seconds for generating PDFs/invoices
  }
  
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);
  
  try {
    const res = await fetch(requestUrl, {
      method,
      headers: {
        ...(requestBody ? { "Content-Type": "application/json" } : {}),
        "Cache-Control": method === "GET" ? "max-age=300" : "no-cache", // 5 min cache for GET requests
      },
      body: requestBody ? JSON.stringify(requestBody) : undefined,
      credentials: "include",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Improve error messages for abort signals
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeout/1000} seconds. Please try again.`);
      }
      if (error.message.includes('signal is aborted')) {
        throw new Error('Request was cancelled. Please try again.');
      }
    }
    
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 2 * 60 * 1000, // 2 minutes (reduced from 5 for faster initial loads)
      gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
      retry: (failureCount, error: any) => {
        // Don't retry on 401 errors - user needs to authenticate
        if (error?.message?.includes('401')) return false;
        // Don't retry on network errors that might indicate server restart
        if (error?.name === 'TypeError' && error?.message?.includes('fetch')) return false;
        return failureCount < 1; // Only retry once for faster response
      },
      retryDelay: attemptIndex => Math.min(500 * 2 ** attemptIndex, 2000), // Faster retry delays (500ms, 1s max 2s)
    },
    mutations: {
      retry: (failureCount, error: any) => {
        // Don't retry on 401 errors for mutations either
        if (error?.message?.includes('401')) return false;
        return failureCount < 1;
      },
    },
  },
});
