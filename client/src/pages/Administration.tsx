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
import { Shield, Users, Save, Store } from "lucide-react";
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
        </Tabs>
      </div>
    );
  }

  return <MainLayout pageTitle="Administration">{content}</MainLayout>;
}
