import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Users, Store, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, Store as StoreType, UserStore } from "@shared/schema";

type SafeUser = Omit<User, "password">;
type UserStoreRecord = Omit<UserStore, "assignedAt"> & { assignedAt: string | null };

interface StoreAccessInfo extends StoreType {
  assignmentId: number | null;
  canAccess: boolean | null;
  assignedAt: string | null;
  assignedBy: number | null;
  accessType: "assignment" | "manager" | "default";
}

interface UserStoreAssignmentsResponse {
  assignments: Array<{
    store: StoreType;
    assignment: UserStoreRecord;
  }>;
  accessibleStores: StoreAccessInfo[];
}

interface StoreUserAssignmentDetail {
  user: SafeUser;
  assignment: UserStoreRecord;
}

export function UserStoreManagement() {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedStore, setSelectedStore] = useState<StoreType | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  // Fetch all users
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  // Fetch all stores
  const { data: stores = [], isLoading: storesLoading } = useQuery<StoreType[]>({
    queryKey: ["/api/stores/active"],
  });

  // Fetch user stores for selected user
  const userStoresEndpoint = selectedUser
    ? `/api/admin/users/${selectedUser.id}/stores`
    : "/api/admin/users/placeholder/stores";
  const { data: userStoreData, isLoading: userAssignmentsLoading } = useQuery<UserStoreAssignmentsResponse>({
    queryKey: [userStoresEndpoint],
    enabled: !!selectedUser,
  });

  const userAssignments = userStoreData?.assignments ?? [];
  const userAccessibleStores = userStoreData?.accessibleStores ?? [];

  const unassignedAccessibleStores = useMemo(() => {
    if (!selectedUser || userAccessibleStores.length === 0) {
      return [] as StoreAccessInfo[];
    }
    const assignedIds = new Set(userAssignments.map(({ store }) => store.id));
    return userAccessibleStores.filter((store) => !assignedIds.has(store.id));
  }, [selectedUser, userAccessibleStores, userAssignments]);

  // Fetch store users for selected store
  const storeUsersEndpoint = selectedStore
    ? `/api/admin/stores/${selectedStore.id}/users`
    : "/api/admin/stores/placeholder/users";
  const { data: storeUserAssignments = [], isLoading: storeUserAssignmentsLoading } = useQuery<StoreUserAssignmentDetail[]>({
    queryKey: [storeUsersEndpoint],
    enabled: !!selectedStore,
  });

  // Assign user to store mutation
  const assignUserMutation = useMutation({
    mutationFn: async (data: { userId: number; storeId: number; canAccess: boolean }) => {
      const response = await apiRequest({
        method: "POST",
        url: `/api/admin/users/${data.userId}/stores/${data.storeId}/assign`,
        body: { canAccess: data.canAccess },
      });
      return response.json();
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stores/active"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${variables.userId}/stores`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/stores/${variables.storeId}/users`] });
      setAssignDialogOpen(false);
      if (!selectedUser || selectedUser.id !== variables.userId) {
        const newlySelected = users.find((user) => user.id === variables.userId);
        if (newlySelected) {
          setSelectedUser(newlySelected);
        }
      }
      if (!selectedStore || selectedStore.id !== variables.storeId) {
        const storeMatch = stores.find((store) => store.id === variables.storeId);
        if (storeMatch) {
          setSelectedStore(storeMatch);
        }
      }
      toast({
        title: "Success",
        description: "User assigned to store successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign user to store",
        variant: "destructive",
      });
    },
  });

  // Remove user from store mutation
  const removeUserMutation = useMutation({
    mutationFn: async (data: { userId: number; storeId: number }) => {
      const response = await apiRequest({
        method: "DELETE",
        url: `/api/admin/users/${data.userId}/stores/${data.storeId}`,
      });
      return response.json();
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stores/active"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${variables.userId}/stores`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/stores/${variables.storeId}/users`] });
      toast({
        title: "Success",
        description: "User removed from store successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove user from store",
        variant: "destructive",
      });
    },
  });

  // Toggle access mutation
  const toggleAccessMutation = useMutation({
    mutationFn: async (data: { userId: number; storeId: number; canAccess: boolean }) => {
      const response = await apiRequest({
        method: "PATCH",
        url: `/api/admin/users/${data.userId}/stores/${data.storeId}/access`,
        body: { canAccess: data.canAccess },
      });
      return response.json();
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stores/active"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${variables.userId}/stores`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/stores/${variables.storeId}/users`] });
      toast({
        title: "Success",
        description: "User access updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user access",
        variant: "destructive",
      });
    },
  });

  const handleAssignUser = (userId: number, storeId: number, canAccess: boolean = true) => {
    assignUserMutation.mutate({
      userId,
      storeId,
      canAccess,
    });
  };

  const handleRemoveUser = (userId: number, storeId: number) => {
    removeUserMutation.mutate({ userId, storeId });
  };

  const handleToggleAccess = (userId: number, storeId: number, canAccess: boolean) => {
    toggleAccessMutation.mutate({ userId, storeId, canAccess });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'manager': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'supervisor': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'cashier': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  if (usersLoading || storesLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">User Store Management</h2>
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Assign User to Store
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign User to Store</DialogTitle>
              <DialogDescription>
                Select a user and store to create a new assignment with access permissions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select User</Label>
                <Select onValueChange={(value) => setSelectedUser(users.find(u => u.id === parseInt(value)) || null)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.username} - {user.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Select Store</Label>
                <Select onValueChange={(value) => setSelectedStore(stores.find(s => s.id === parseInt(value)) || null)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a store" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id.toString()}>
                        {store.name} ({store.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={() => selectedUser && selectedStore && handleAssignUser(selectedUser.id, selectedStore.id)}
                disabled={!selectedUser || !selectedStore || assignUserMutation.isPending}
                className="w-full"
              >
                {assignUserMutation.isPending ? "Assigning..." : "Assign User"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users with their store assignments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Users & Store Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {users.map((user) => (
                <div key={user.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold">{user.username}</h3>
                        <Badge className={getRoleColor(user.role)}>
                          {user.role}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Assigned Stores:</h4>
                    <div className="space-y-1">
                      {selectedUser?.id === user.id ? (
                        <div className="space-y-2">
                          {userAssignmentsLoading ? (
                            <p className="text-sm text-muted-foreground">Loading assignments...</p>
                          ) : userAssignments.length > 0 ? (
                            userAssignments.map(({ store, assignment }) => (
                              <div key={store.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-2 rounded">
                                <div className="flex flex-col">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm font-medium">{store.name}</span>
                                    {assignment.canAccess === false && (
                                      <Badge variant="destructive" className="text-xs">
                                        Disabled
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">{store.code}</div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Switch
                                    checked={assignment.canAccess !== false}
                                    onCheckedChange={(checked) => handleToggleAccess(user.id, store.id, checked)}
                                    disabled={toggleAccessMutation.isPending}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveUser(user.id, store.id)}
                                    disabled={removeUserMutation.isPending}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">No stores assigned</p>
                          )}

                          {unassignedAccessibleStores.length > 0 && (
                            <div className="pt-3 border-t border-dashed border-muted-foreground/30">
                              <p className="text-xs uppercase text-muted-foreground">Additional Access</p>
                              <div className="mt-2 space-y-1">
                                {unassignedAccessibleStores.map((store) => (
                                  <div key={store.id} className="flex items-center justify-between bg-muted/50 dark:bg-gray-900/60 p-2 rounded">
                                    <div>
                                      <div className="text-sm font-medium">{store.name}</div>
                                      <div className="text-xs text-muted-foreground">{store.code}</div>
                                    </div>
                                    <Badge variant="outline" className="text-xs">
                                      {store.accessType === "manager" ? "Manager Access" : "Default Store"}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setSelectedStore(null);
                          }}
                        >
                          View Assignments
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Stores with their user assignments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Store className="w-5 h-5 mr-2" />
              Stores & User Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stores.map((store) => (
                <div key={store.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{store.name}</h3>
                      <p className="text-sm text-muted-foreground">{store.code}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Assigned Users:</h4>
                    <div className="space-y-1">
                      {selectedStore?.id === store.id ? (
                        storeUserAssignmentsLoading ? (
                          <p className="text-sm text-muted-foreground">Loading assignments...</p>
                        ) : storeUserAssignments.length > 0 ? (
                          storeUserAssignments.map(({ user, assignment }) => (
                            <div key={user.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-2 rounded">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium">{user.username}</span>
                                <Badge className={getRoleColor(user.role)} variant="secondary">
                                  {user.role}
                                </Badge>
                                {assignment.canAccess === false && (
                                  <Badge variant="destructive" className="text-xs">
                                    Disabled
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                <Switch
                                  checked={assignment.canAccess !== false}
                                  onCheckedChange={(checked) => handleToggleAccess(user.id, store.id, checked)}
                                  disabled={toggleAccessMutation.isPending}
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveUser(user.id, store.id)}
                                  disabled={removeUserMutation.isPending}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No users assigned</p>
                        )
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedStore(store);
                            setSelectedUser(null);
                          }}
                        >
                          View Assignments
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}