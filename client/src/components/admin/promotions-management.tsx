import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Tags, Plus, Calendar, Users, Package } from "lucide-react";
import type { Promotion } from "@shared/schema";

interface PromotionsManagementProps {
  storeId: number;
}

export default function PromotionsManagement({ storeId }: PromotionsManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: promotions, isLoading } = useQuery({
    queryKey: ['/api/promotions', storeId],
    queryFn: () => fetch(`/api/stores/${storeId}/promotions`).then(res => res.json()),
  });

  const createPromotionMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/promotions', 'POST', {
        storeId,
        ...data,
      });
    },
    onSuccess: () => {
      toast({ title: "Promotion created successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/promotions', storeId] });
      setShowCreateForm(false);
    },
    onError: () => {
      toast({ title: "Failed to create promotion", variant: "destructive" });
    },
  });

  const togglePromotionMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      return apiRequest(`/api/promotions/${id}`, 'PATCH', { isActive });
    },
    onSuccess: () => {
      toast({ title: "Promotion updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/promotions', storeId] });
    },
    onError: () => {
      toast({ title: "Failed to update promotion", variant: "destructive" });
    },
  });

  const handleCreatePromotion = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const promotionData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      type: formData.get('type') as string,
      value: parseFloat(formData.get('value') as string),
      minOrderAmount: formData.get('minOrderAmount') ? parseFloat(formData.get('minOrderAmount') as string) : null,
      maxDiscountAmount: formData.get('maxDiscountAmount') ? parseFloat(formData.get('maxDiscountAmount') as string) : null,
      startDate: formData.get('startDate') ? new Date(formData.get('startDate') as string) : new Date(),
      endDate: formData.get('endDate') ? new Date(formData.get('endDate') as string) : null,
      usageLimit: formData.get('usageLimit') ? parseInt(formData.get('usageLimit') as string) : null,
      customerLimit: formData.get('customerLimit') ? parseInt(formData.get('customerLimit') as string) : null,
    };
    
    createPromotionMutation.mutate(promotionData);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Tags className="w-5 h-5" />
              <span>Promotions Management</span>
            </div>
            <Button 
              onClick={() => setShowCreateForm(!showCreateForm)}
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Promotion
            </Button>
          </CardTitle>
          <CardDescription>
            Create and manage promotional offers for your store
          </CardDescription>
        </CardHeader>
        
        {showCreateForm && (
          <CardContent>
            <form onSubmit={handleCreatePromotion} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Promotion Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="e.g., Summer Sale, BOGO T-shirts"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select name="type" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage Discount</SelectItem>
                      <SelectItem value="fixed_amount">Fixed Amount Off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Describe the promotion..."
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="value">Discount Value</Label>
                  <Input
                    id="value"
                    name="value"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="10 (for 10% or $10)"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="minOrderAmount">Minimum Order</Label>
                  <Input
                    id="minOrderAmount"
                    name="minOrderAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <Label htmlFor="maxDiscountAmount">Max Discount</Label>
                  <Input
                    id="maxDiscountAmount"
                    name="maxDiscountAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    name="startDate"
                    type="datetime-local"
                    defaultValue={new Date().toISOString().slice(0, 16)}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    name="endDate"
                    type="datetime-local"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="usageLimit">Total Usage Limit</Label>
                  <Input
                    id="usageLimit"
                    name="usageLimit"
                    type="number"
                    min="1"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <Label htmlFor="customerLimit">Per Customer Limit</Label>
                  <Input
                    id="customerLimit"
                    name="customerLimit"
                    type="number"
                    min="1"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="flex space-x-2">
                <Button 
                  type="submit" 
                  disabled={createPromotionMutation.isPending}
                >
                  {createPromotionMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Create Promotion
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Promotions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {!promotions || !Array.isArray(promotions) || promotions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Tags className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                <p className="font-medium">No promotions found</p>
                <p className="text-sm">Create your first promotion to get started</p>
              </div>
            ) : (
              promotions.map((promotion: Promotion) => (
              <div 
                key={promotion.id} 
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-semibold">{promotion.name}</h4>
                    <Badge variant={promotion.isActive ? "default" : "secondary"}>
                      {promotion.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {promotion.description}
                  </p>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Tags className="w-4 h-4" />
                      <span>
                        {promotion.type === 'percentage' ? `${promotion.value}%` : `$${promotion.value}`} off
                      </span>
                    </div>
                    {promotion.usageCount !== undefined && (
                      <div className="flex items-center space-x-1">
                        <Users className="w-4 h-4" />
                        <span>{promotion.usageCount} uses</span>
                      </div>
                    )}
                    {promotion.endDate && (
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>Until {new Date(promotion.endDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={promotion.isActive || false}
                    onCheckedChange={(checked) => 
                      togglePromotionMutation.mutate({ 
                        id: promotion.id, 
                        isActive: checked 
                      })
                    }
                  />
                </div>
              </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}