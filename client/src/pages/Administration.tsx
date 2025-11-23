import { useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getRoleDisplayName, getRoleBadgeColor, USER_ROLES } from "@/lib/authUtils";
import { Shield, Users, Save, Store, Settings, RefreshCw } from "lucide-react";
import { UserStoreManagement } from "@/components/admin/user-store-management";
import { AccessDenied } from "@/components/ui/access-denied";
import MainLayout from "@/components/layout/main-layout";

interface User {
  id: number;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: string;
  profileImageUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function Administration() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [roleUpdates, setRoleUpdates] = useState<Record<number, string>>({});

  // Always call hooks before any conditional returns
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    retry: false,
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      const response = await apiRequest("PATCH", `/api/users/${userId}/role`, { role });
      return response.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["/api/users"], (oldUsers: User[] = []) =>
        oldUsers.map((u) => (u.id === updatedUser.id ? updatedUser : u))
      );
      setRoleUpdates((prev) => {
        const { [updatedUser.id]: _, ...rest } = prev;
        return rest;
      });
      toast({
        title: "Role updated",
        description: `${updatedUser.username}'s role has been updated to ${getRoleDisplayName(updatedUser.role)}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update role",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncProductsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/sync-products-to-stores", {});
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Sync completed",
        description: `Assigned ${result.assignedCount} products to stores. Skipped ${result.skippedCount} existing assignments.`,
      });
      // Invalidate product queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRoleChange = (userId: number, newRole: string) => {
    setRoleUpdates((prev) => ({
      ...prev,
      [userId]: newRole,
    }));
  };

  const handleSaveRole = (userId: number) => {
    const newRole = roleUpdates[userId];
    if (newRole) {
      updateRoleMutation.mutate({ userId, role: newRole });
    }
  };

  const hasChanges = (userId: number, currentRole: string) => {
    return roleUpdates[userId] && roleUpdates[userId] !== currentRole;
  };

  let content: ReactNode;

  if (!user || user.role !== USER_ROLES.ADMIN) {
    content = (
      <AccessDenied
        title="Administrator Access Required"
        description="You need administrator privileges to access this page."
      />
    );
  } else if (isLoading) {
    content = (
      <div className="container mx-auto p-6">
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
            <p>Loading users...</p>
          </div>
        </div>
      </div>
    );
  } else {
    content = (
      <div className="container mx-auto space-y-6 p-6">
        <div className="mb-6 flex items-center gap-3">
          <Shield className="h-8 w-8" />
          <div>
            <h1 className="text-3xl font-bold">Administration</h1>
            <p className="text-muted-foreground">System administration and user management</p>
          </div>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              User Roles
            </TabsTrigger>
            <TabsTrigger value="stores" className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              Store Access
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              System Utilities
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  Assign roles to users to control their access and permissions within the system.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {users.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">No users found.</div>
                  ) : (
                    users.map((userData) => {
                      const pendingRole = roleUpdates[userData.id];
                      const displayRole = pendingRole || userData.role;
                      const showSaveButton = hasChanges(userData.id, userData.role);

                      return (
                        <div
                          key={userData.id}
                          className="flex items-center justify-between rounded-lg border p-4"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                              <span className="text-sm font-semibold">
                                {userData.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="font-semibold">{userData.username}</div>
                              {userData.email && (
                                <div className="text-sm text-muted-foreground">{userData.email}</div>
                              )}
                              {userData.firstName && userData.lastName && (
                                <div className="text-sm text-muted-foreground">
                                  {userData.firstName} {userData.lastName}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <Badge className={getRoleBadgeColor(userData.role)}>
                              {getRoleDisplayName(userData.role)}
                            </Badge>

                            <Select
                              value={displayRole}
                              onValueChange={(value) => handleRoleChange(userData.id, value)}
                              disabled={userData.id === user.id}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.values(USER_ROLES).map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {getRoleDisplayName(role)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Button
                              onClick={() => handleSaveRole(userData.id)}
                              disabled={!showSaveButton || updateRoleMutation.isPending}
                              size="sm"
                            >
                              <Save className="mr-2 h-4 w-4" />
                              Save
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stores">
            <UserStoreManagement />
          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Product Synchronization</CardTitle>
                <CardDescription>
                  Sync all products to all stores. This ensures every store has access to all products in the inventory.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                    <div className="flex items-start gap-3">
                      <Settings className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-yellow-900">Important Information</p>
                        <ul className="mt-2 space-y-1 text-sm text-yellow-800">
                          <li>• This will create store_product entries for all products in all stores</li>
                          <li>• Existing assignments will be skipped (no duplicates)</li>
                          <li>• Each store will get its own inventory tracking for each product</li>
                          <li>• Store-specific pricing and stock levels can be set after sync</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => syncProductsMutation.mutate()}
                    disabled={syncProductsMutation.isPending}
                    className="w-full sm:w-auto"
                    size="lg"
                  >
                    {syncProductsMutation.isPending ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Syncing Products...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Sync All Products to All Stores
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return <MainLayout pageTitle="Administration">{content}</MainLayout>;
}
