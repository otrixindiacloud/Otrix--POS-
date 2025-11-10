export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

export const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  SUPERVISOR: 'supervisor', 
  CASHIER: 'cashier',
  DELIVERY: 'delivery',
  CUSTOMER: 'customer'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export function hasPermission(userRole: string, requiredRoles: string[]): boolean {
  return requiredRoles.includes(userRole);
}

export function getRoleDisplayName(role: string): string {
  switch (role) {
    case USER_ROLES.ADMIN:
      return 'Administrator';
    case USER_ROLES.MANAGER:
      return 'Manager';
    case USER_ROLES.SUPERVISOR:
      return 'Supervisor';
    case USER_ROLES.CASHIER:
      return 'Cashier';
    case USER_ROLES.DELIVERY:
      return 'Delivery';
    case USER_ROLES.CUSTOMER:
      return 'Customer';
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
}

export function getRoleBadgeColor(role: string): string {
  switch (role) {
    case USER_ROLES.ADMIN:
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case USER_ROLES.MANAGER:
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case USER_ROLES.SUPERVISOR:
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case USER_ROLES.CASHIER:
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case USER_ROLES.DELIVERY:
      return 'bg-warning/10 text-warning';
    case USER_ROLES.CUSTOMER:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
}