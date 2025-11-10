import { useAuth } from "@/hooks/useAuth";
import { USER_ROLES, type UserRole } from "@shared/schema";

interface Permission {
  resource: string;
  action: string;
}

// Permission matrix - defines what each role can do
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [USER_ROLES.ADMIN]: [
    { resource: '*', action: '*' }, // Full access
  ],
  
  [USER_ROLES.MANAGER]: [
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
    { resource: 'stores', action: 'read' },
  ],
  
  [USER_ROLES.SUPERVISOR]: [
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
    { resource: 'transactions', action: 'read' },
    { resource: 'customers', action: 'read' },
    { resource: 'products', action: 'read' },
  ],
  
  [USER_ROLES.CUSTOMER]: [
    { resource: 'transactions', action: 'read' }, // Own transactions only
    { resource: 'profile', action: 'read' },
    { resource: 'profile', action: 'update' },
  ],
};

export function useRBAC() {
  const { user } = useAuth();
  
  const hasPermission = (resource: string, action: string): boolean => {
    if (!user?.role) return false;
    
    const userRole = user.role as UserRole;
    const permissions = ROLE_PERMISSIONS[userRole] || [];
    
    // Check for wildcard permissions (admin)
    const hasWildcard = permissions.some(p => 
      (p.resource === '*' && p.action === '*') ||
      (p.resource === resource && p.action === '*') ||
      (p.resource === '*' && p.action === action)
    );
    
    if (hasWildcard) return true;
    
    // Check for specific permission
    return permissions.some(p => 
      p.resource === resource && p.action === action
    );
  };
  
  const canAccess = (path: string): boolean => {
    if (!user?.role) return false;
    
    const userRole = user.role as UserRole;
    
    // Admin can access everything
    if (userRole === USER_ROLES.ADMIN) return true;
    
    // Define route access based on role
    const routeAccess: Record<string, UserRole[]> = {
      '/pos': [USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.SUPERVISOR, USER_ROLES.CASHIER],
      '/customers': [USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.SUPERVISOR, USER_ROLES.CASHIER],
      '/inventory': [USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.SUPERVISOR, USER_ROLES.CASHIER],
      '/invoices': [USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.SUPERVISOR],
      '/holds': [USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.SUPERVISOR, USER_ROLES.CASHIER],
      '/reports': [USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.SUPERVISOR],
      '/transactions': [USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.SUPERVISOR],
      '/stores': [USER_ROLES.ADMIN, USER_ROLES.MANAGER],
      '/suppliers': [USER_ROLES.ADMIN],
      '/administration': [USER_ROLES.ADMIN],
      '/stock-taking': [USER_ROLES.ADMIN, USER_ROLES.MANAGER],
    };
    
    const allowedRoles = routeAccess[path] || [];
    return allowedRoles.includes(userRole);
  };
  
  const isAdmin = user?.role === USER_ROLES.ADMIN;
  const isManager = user?.role === USER_ROLES.MANAGER;
  const isSupervisor = user?.role === USER_ROLES.SUPERVISOR;
  const isCashier = user?.role === USER_ROLES.CASHIER;
  const isCustomer = user?.role === USER_ROLES.CUSTOMER;
  
  return {
    user,
    hasPermission,
    canAccess,
    isAdmin,
    isManager,
    isSupervisor,
    isCashier,
    isCustomer,
  };
}