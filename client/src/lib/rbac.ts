// Role-Based Access Control (RBAC) Service
// Comprehensive permission management for POS system
import React from 'react';

export const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  SUPERVISOR: 'supervisor',
  CASHIER: 'cashier',
  DELIVERY: 'delivery',
  CUSTOMER: 'customer'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export interface Permission {
  resource: string;
  action: string;
}

// Permission matrix - defines what each role can do
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [USER_ROLES.ADMIN]: [
    // Complete system access
    { resource: '*', action: '*' },
  ],
  
  [USER_ROLES.MANAGER]: [
    // Store management and operations
    { resource: 'transactions', action: 'create' },
    { resource: 'transactions', action: 'read' },
    { resource: 'transactions', action: 'update' },
    { resource: 'transactions', action: 'refund' },
    { resource: 'customers', action: '*' },
    { resource: 'products', action: '*' },
    { resource: 'inventory', action: '*' },
    { resource: 'reports', action: 'read' },
    { resource: 'shifts', action: '*' },
    { resource: 'day-operations', action: '*' },
    { resource: 'suppliers', action: 'read' },
    { resource: 'invoices', action: 'read' },
  ],
  
  [USER_ROLES.SUPERVISOR]: [
    // Operational oversight
    { resource: 'transactions', action: 'create' },
    { resource: 'transactions', action: 'read' },
    { resource: 'transactions', action: 'refund' },
    { resource: 'customers', action: 'read' },
    { resource: 'customers', action: 'create' },
    { resource: 'customers', action: 'update' },
    { resource: 'products', action: 'read' },
    { resource: 'products', action: 'update' },
    { resource: 'inventory', action: 'read' },
    { resource: 'inventory', action: 'update' },
    { resource: 'reports', action: 'read' },
    { resource: 'shifts', action: 'read' },
    { resource: 'shifts', action: 'update' },
    { resource: 'day-operations', action: 'read' },
  ],
  
  [USER_ROLES.CASHIER]: [
    // Basic POS operations
    { resource: 'transactions', action: 'create' },
    { resource: 'transactions', action: 'read' },
    { resource: 'customers', action: 'read' },
    { resource: 'customers', action: 'create' },
    { resource: 'products', action: 'read' },
    { resource: 'inventory', action: 'read' },
    { resource: 'shifts', action: 'read' },
    { resource: 'day-operations', action: 'read' },
  ],
  
  [USER_ROLES.DELIVERY]: [
    // Delivery-specific access
    { resource: 'transactions', action: 'read' },
    { resource: 'customers', action: 'read' },
    { resource: 'products', action: 'read' },
  ],
  
  [USER_ROLES.CUSTOMER]: [
    // Limited customer access
    { resource: 'transactions', action: 'read' }, // Own transactions only
    { resource: 'profile', action: 'read' },
    { resource: 'profile', action: 'update' },
  ],
};

// Get user role from auth context (mock implementation)
export function getCurrentUserRole(): UserRole {
  // In production, get from authenticated user context
  // For now, return admin for development
  return USER_ROLES.ADMIN;
}

// Check if user has permission for specific resource and action
export function hasPermission(
  userRole: UserRole,
  resource: string,
  action: string
): boolean {
  const permissions = ROLE_PERMISSIONS[userRole];
  
  // Check for wildcard permissions (admin)
  if (permissions.some(p => p.resource === '*' && p.action === '*')) {
    return true;
  }
  
  // Check for specific resource with wildcard action
  if (permissions.some(p => p.resource === resource && p.action === '*')) {
    return true;
  }
  
  // Check for exact permission match
  return permissions.some(p => p.resource === resource && p.action === action);
}

// Enhanced permission check with context
export function checkPermission(
  resource: string,
  action: string,
  context?: any
): boolean {
  const userRole = getCurrentUserRole();
  const hasAccess = hasPermission(userRole, resource, action);
  
  // Additional context-based checks can be added here
  // For example, checking if user owns the resource
  
  return hasAccess;
}

// Permission decorators for UI components
export function requirePermission(
  resource: string,
  action: string,
  fallback?: React.ReactNode
) {
  return function<T extends React.ComponentType<any>>(Component: T) {
    return function PermissionWrapper(props: React.ComponentProps<T>) {
      if (!checkPermission(resource, action)) {
        return fallback || null;
      }
      return React.createElement(Component, props);
    };
  };
}

// Hook for permission-based UI rendering
export function usePermissions() {
  const userRole = getCurrentUserRole();
  
  return {
    userRole,
    hasPermission: (resource: string, action: string) => 
      hasPermission(userRole, resource, action),
    checkPermission: (resource: string, action: string, context?: any) =>
      checkPermission(resource, action, context),
    canAccess: {
      // Common permission checks
      transactions: {
        create: hasPermission(userRole, 'transactions', 'create'),
        read: hasPermission(userRole, 'transactions', 'read'),
        update: hasPermission(userRole, 'transactions', 'update'),
        refund: hasPermission(userRole, 'transactions', 'refund'),
      },
      customers: {
        create: hasPermission(userRole, 'customers', 'create'),
        read: hasPermission(userRole, 'customers', 'read'),
        update: hasPermission(userRole, 'customers', 'update'),
        delete: hasPermission(userRole, 'customers', 'delete'),
      },
      products: {
        create: hasPermission(userRole, 'products', 'create'),
        read: hasPermission(userRole, 'products', 'read'),
        update: hasPermission(userRole, 'products', 'update'),
        delete: hasPermission(userRole, 'products', 'delete'),
      },
      reports: {
        read: hasPermission(userRole, 'reports', 'read'),
        create: hasPermission(userRole, 'reports', 'create'),
      },
      shifts: {
        create: hasPermission(userRole, 'shifts', 'create'),
        read: hasPermission(userRole, 'shifts', 'read'),
        update: hasPermission(userRole, 'shifts', 'update'),
        close: hasPermission(userRole, 'shifts', 'close'),
      },
      dayOperations: {
        open: hasPermission(userRole, 'day-operations', 'open'),
        close: hasPermission(userRole, 'day-operations', 'close'),
        read: hasPermission(userRole, 'day-operations', 'read'),
        reopen: hasPermission(userRole, 'day-operations', 'reopen'),
      }
    }
  };
}

// Validation helpers for specific operations
export function validateTransactionAccess(transactionId: number, action: string): boolean {
  // Check if user can perform action on specific transaction
  return checkPermission('transactions', action, { transactionId });
}

export function validateCustomerAccess(customerId: number, action: string): boolean {
  // Check if user can perform action on specific customer
  return checkPermission('customers', action, { customerId });
}

export function validateInventoryAccess(productId: number, action: string): boolean {
  // Check if user can perform action on specific product
  return checkPermission('products', action, { productId });
}

// Error messages for permission denials
export const PERMISSION_DENIED_MESSAGES = {
  TRANSACTION_CREATE: "You don't have permission to create transactions",
  TRANSACTION_REFUND: "You don't have permission to process refunds",
  CUSTOMER_UPDATE: "You don't have permission to modify customer information",
  PRODUCT_UPDATE: "You don't have permission to modify product information",
  INVENTORY_UPDATE: "You don't have permission to update inventory",
  REPORTS_ACCESS: "You don't have permission to access reports",
  SHIFT_MANAGEMENT: "You don't have permission to manage shifts",
  DAY_OPERATIONS: "You don't have permission to manage day operations",
  GENERAL: "You don't have permission to perform this action"
};