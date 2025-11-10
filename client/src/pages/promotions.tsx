import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tag, Percent } from "lucide-react";
import type { Promotion } from "@shared/schema";

export default function PromotionsPage() {
  const { data: promotions = [] } = useQuery<Promotion[]>({
    queryKey: ["/api/promotions/active"],
  });

  return (
    <MainLayout pageTitle="Promotions">
      <div className="container-responsive py-6 space-y-6">
        {/* Professional Header */}
        <Card className="border-none shadow-sm bg-indigo-50 dark:bg-indigo-950/20">
          <CardHeader className="pb-8">
            <div className="flex items-start gap-4">
              {/* Icon Badge */}
              <div className="flex-shrink-0 bg-indigo-600 rounded-xl p-3 shadow-lg">
                <Percent className="h-8 w-8 text-white" />
              </div>
              
              {/* Title and Description */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                    Promotions
                  </h1>
                  <Badge className="bg-indigo-500 hover:bg-indigo-600 text-white">
                    {promotions.length} Active
                  </Badge>
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-base leading-relaxed">
                  Manage and monitor active promotional campaigns, discounts, and special offers across your stores.
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Active Promotions Card */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 bg-indigo-600 rounded-lg p-2.5 shadow-lg">
                <Tag className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">
                  Active Promotions
                </CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Current promotional offers available for the selected store
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {promotions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active promotions for the current store.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {promotions.map((promotion) => (
                  <div key={promotion.id} className="rounded-lg border border-border p-4 shadow-sm">
                    <div className="mb-2 flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-foreground">{promotion.name}</h3>
                      {promotion.isActive ? (
                        <Badge className="bg-green-500/10 text-green-600 dark:text-green-300">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{promotion.description || "No description."}</p>
                    <dl className="mt-4 space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <dt>Starts</dt>
                        <dd>{promotion.startDate ? new Date(promotion.startDate).toLocaleDateString() : "—"}</dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt>Ends</dt>
                        <dd>{promotion.endDate ? new Date(promotion.endDate).toLocaleDateString() : "—"}</dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt>Type</dt>
                        <dd className="capitalize">{promotion.type || "general"}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
