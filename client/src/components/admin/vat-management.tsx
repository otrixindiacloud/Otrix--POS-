import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Percent, Settings } from "lucide-react";
import type { VatConfiguration } from "@shared/schema";

interface VATManagementProps {
  storeId: number;
}

export default function VATManagement({ storeId }: VATManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingConfig, setEditingConfig] = useState<VatConfiguration | null>(null);

  const { data: vatConfigs, isLoading } = useQuery({
    queryKey: ['/api/vat-configurations', storeId],
    queryFn: () => fetch(`/api/stores/${storeId}/vat-configurations`).then(res => res.json()),
  });

  const updateVATMutation = useMutation({
    mutationFn: async (data: { category: string; vatRate: number }) => {
      return apiRequest(`/api/vat-configurations/${editingConfig?.id}`, 'PATCH', data);
    },
    onSuccess: () => {
      toast({ title: "VAT configuration updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/vat-configurations', storeId] });
      setEditingConfig(null);
    },
    onError: () => {
      toast({ title: "Failed to update VAT configuration", variant: "destructive" });
    },
  });

  const createVATMutation = useMutation({
    mutationFn: async (data: { storeId: number; category: string; vatRate: number; description: string }) => {
      return apiRequest('/api/vat-configurations', 'POST', data);
    },
    onSuccess: () => {
      toast({ title: "VAT configuration created successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/vat-configurations', storeId] });
    },
    onError: () => {
      toast({ title: "Failed to create VAT configuration", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const category = formData.get('category') as string;
    const vatRate = parseFloat(formData.get('vatRate') as string);
    
    if (editingConfig) {
      updateVATMutation.mutate({ category, vatRate });
    } else {
      createVATMutation.mutate({
        storeId,
        category,
        vatRate,
        description: `VAT rate for ${category} items`
      });
    }
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
          <CardTitle className="flex items-center space-x-2">
            <Percent className="w-5 h-5" />
            <span>VAT Configuration</span>
          </CardTitle>
          <CardDescription>
            Configure VAT rates for different product categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  name="category"
                  defaultValue={editingConfig?.category || ''}
                  placeholder="e.g., food, electronics, clothing"
                  required
                />
              </div>
              <div>
                <Label htmlFor="vatRate">VAT Rate (%)</Label>
                <Input
                  id="vatRate"
                  name="vatRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  defaultValue={editingConfig?.vatRate || '5'}
                  required
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <Button 
                type="submit" 
                disabled={updateVATMutation.isPending || createVATMutation.isPending}
              >
                {updateVATMutation.isPending || createVATMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {editingConfig ? 'Update' : 'Create'} VAT Configuration
              </Button>
              {editingConfig && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingConfig(null)}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current VAT Configurations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {vatConfigs?.map((config: VatConfiguration) => (
              <div 
                key={config.id} 
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <span className="font-medium capitalize">{config.category}</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    {config.vatRate}% VAT
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch checked={config.isActive ?? false} disabled />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingConfig(config)}
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {!vatConfigs?.length && (
              <p className="text-muted-foreground text-center py-4">
                No VAT configurations found. Create one above.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}