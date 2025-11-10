/**
 * Centralized error handling utilities for the POS application
 * Provides consistent error handling, logging, and user feedback
 */

import { toast } from "@/hooks/use-toast";

// Error types for different categories
export type ErrorCategory = 'api' | 'validation' | 'payment' | 'auth' | 'system';

export interface ErrorInfo {
  category: ErrorCategory;
  message: string;
  originalError?: Error;
  context?: Record<string, any>;
  timestamp: Date;
}

// Global error handler
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: ErrorInfo[] = [];

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  // Log error with context
  logError(error: ErrorInfo): void {
    this.errorLog.push(error);
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('POS Error:', error);
    }
    
    // Keep only last 100 errors to prevent memory issues
    if (this.errorLog.length > 100) {
      this.errorLog = this.errorLog.slice(-100);
    }
  }

  // Handle API errors
  handleApiError(error: any, context?: Record<string, any>): void {
    const errorInfo: ErrorInfo = {
      category: 'api',
      message: error.message || 'API request failed',
      originalError: error,
      context,
      timestamp: new Date()
    };

    this.logError(errorInfo);
    
    toast({
      title: "API Error",
      description: errorInfo.message,
      variant: "destructive",
    });
  }

  // Handle validation errors
  handleValidationError(message: string, context?: Record<string, any>): void {
    const errorInfo: ErrorInfo = {
      category: 'validation',
      message,
      context,
      timestamp: new Date()
    };

    this.logError(errorInfo);
    
    toast({
      title: "Validation Error",
      description: message,
      variant: "destructive",
    });
  }

  // Handle payment processing errors
  handlePaymentError(error: any, context?: Record<string, any>): void {
    const errorInfo: ErrorInfo = {
      category: 'payment',
      message: error.message || 'Payment processing failed',
      originalError: error,
      context,
      timestamp: new Date()
    };

    this.logError(errorInfo);
    
    toast({
      title: "Payment Error",
      description: errorInfo.message,
      variant: "destructive",
    });
  }

  // Get recent errors for debugging
  getRecentErrors(limit: number = 10): ErrorInfo[] {
    return this.errorLog.slice(-limit);
  }

  // Clear error log
  clearErrors(): void {
    this.errorLog = [];
  }
}

// Utility functions for safe data handling
export const safeStringOperation = (
  value: any, 
  operation: (str: string) => string, 
  defaultValue: string = ''
): string => {
  try {
    if (value === null || value === undefined) {
      return defaultValue;
    }
    const stringValue = String(value);
    return operation(stringValue);
  } catch (error) {
    console.warn('Safe string operation failed:', error);
    return defaultValue;
  }
};

export const safeNumberOperation = (
  value: any, 
  operation: (num: number) => number, 
  defaultValue: number = 0
): number => {
  try {
    const numValue = parseFloat(String(value));
    if (isNaN(numValue)) {
      return defaultValue;
    }
    return operation(numValue);
  } catch (error) {
    console.warn('Safe number operation failed:', error);
    return defaultValue;
  }
};

export const safeDateOperation = (
  value: any, 
  operation: (date: Date) => any, 
  defaultValue: any = null
): any => {
  try {
    if (!value) return defaultValue;
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return defaultValue;
    }
    return operation(date);
  } catch (error) {
    console.warn('Safe date operation failed:', error);
    return defaultValue;
  }
};

// Safe payment method formatting
export const safePaymentMethod = (paymentMethod: any): string => {
  return safeStringOperation(
    paymentMethod, 
    (str) => str.toUpperCase(), 
    'CASH'
  );
};

// Safe currency formatting
export const safeCurrencyFormat = (amount: any, currency: string = 'QR'): string => {
  const result = safeNumberOperation(
    amount,
    (num) => num, // Return the number, not the formatted string
    0
  );
  return `${currency} ${result.toFixed(2)}`;
};

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();