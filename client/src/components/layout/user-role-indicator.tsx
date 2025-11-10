import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Shield, Users, Eye, CreditCard, ChevronDown, Info } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { USER_ROLES } from "@shared/schema";
import { VisuallyHidden } from "@/components/ui/visually-hidden";

const getRoleIcon = (role: string) => {
  switch (role) {
    case USER_ROLES.ADMIN:
      return <Shield className="h-3 w-3" />;
    case USER_ROLES.MANAGER:
      return <Users className="h-3 w-3" />;
    case USER_ROLES.SUPERVISOR:
      return <Eye className="h-3 w-3" />;
    case USER_ROLES.CASHIER:
      return <CreditCard className="h-3 w-3" />;
    default:
      return <Shield className="h-3 w-3" />;
  }
};

const getRoleDisplayName = (role: string) => {
  switch (role) {
    case USER_ROLES.ADMIN:
      return "Administrator";
    case USER_ROLES.MANAGER:
      return "Manager";
    case USER_ROLES.SUPERVISOR:
      return "Supervisor";
    case USER_ROLES.CASHIER:
      return "Cashier";
    default:
      return "Unknown";
  }
};

const getRoleBadgeColor = (role: string) => {
  switch (role) {
    case USER_ROLES.ADMIN:
      return "bg-red-100 text-red-800 border-red-200";
    case USER_ROLES.MANAGER:
      return "bg-purple-100 text-purple-800 border-purple-200";
    case USER_ROLES.SUPERVISOR:
      return "bg-blue-100 text-blue-800 border-blue-200";
    case USER_ROLES.CASHIER:
      return "bg-green-100 text-green-800 border-green-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const getRolePermissions = (role: string) => {
  switch (role) {
    case USER_ROLES.ADMIN:
      return [
        "Full system access",
        "User management",
        "All reports and analytics",
        "System configuration",
        "Administrative functions"
      ];
    case USER_ROLES.MANAGER:
      return [
        "Transaction management",
        "Inventory control",
        "Customer management",
        "Staff reports",
        "Day operations"
      ];
    case USER_ROLES.SUPERVISOR:
      return [
        "POS operations",
        "Basic reports",
        "Customer lookup",
        "Transaction oversight",
        "Staff assistance"
      ];
    case USER_ROLES.CASHIER:
      return [
        "Point of sale",
        "Customer transactions",
        "Basic customer info",
        "Product lookup",
        "Payment processing"
      ];
    default:
      return ["Limited access"];
  }
};

export default function UserRoleIndicator() {
  const { user } = useAuth();
  const [showRoleInfo, setShowRoleInfo] = useState(false);

  if (!user) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 px-2 text-xs font-medium"
          >
            <div className="flex items-center gap-2">
              {getRoleIcon(user.role)}
              <Badge 
                variant="outline" 
                className={`text-xs px-2 py-0.5 ${getRoleBadgeColor(user.role)}`}
              >
                {getRoleDisplayName(user.role)}
              </Badge>
              <ChevronDown className="h-3 w-3" />
            </div>
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.username}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email || "No email"}
              </p>
            </div>
          </DropdownMenuLabel>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => setShowRoleInfo(true)}>
            <Info className="mr-2 h-4 w-4" />
            View Role Permissions
          </DropdownMenuItem>
          
          {user.role === USER_ROLES.ADMIN && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-muted-foreground text-xs">
                Demo Mode: Role switching available in Administration
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showRoleInfo} onOpenChange={setShowRoleInfo}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getRoleIcon(user.role)}
              {getRoleDisplayName(user.role)} Permissions
            </DialogTitle>
            <DialogDescription>
              Your current role and associated system permissions
            </DialogDescription>
            <VisuallyHidden>
              <DialogTitle>Role Permissions Information</DialogTitle>
            </VisuallyHidden>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Current Role:</span>
              <Badge className={getRoleBadgeColor(user.role)}>
                {getRoleDisplayName(user.role)}
              </Badge>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-3">Permissions:</h4>
              <ul className="space-y-2">
                {getRolePermissions(user.role).map((permission, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <div className="h-1.5 w-1.5 bg-green-500 rounded-full" />
                    {permission}
                  </li>
                ))}
              </ul>
            </div>
            
            {user.role === USER_ROLES.ADMIN && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-800">
                  <strong>Admin Note:</strong> You can change user roles in the Administration section 
                  for testing different permission levels.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}