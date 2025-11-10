import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Database, Store as StoreIcon } from "lucide-react";
import type { Store } from "@shared/schema";

export default function CommonPage() {
  const { data: stores = [] } = useQuery<Store[]>({
    queryKey: ["/api/stores"],
  });

  return (
    <MainLayout pageTitle="Common Operations">
      <div className="container-responsive py-6 space-y-6">
        {/* Professional Header */}
        <Card className="border-none shadow-sm bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50 dark:from-slate-950/30 dark:via-gray-950/30 dark:to-slate-950/30">
          <CardHeader className="pb-8">
            <div className="flex items-start gap-4">
              {/* Icon Badge */}
              <div className="flex-shrink-0 bg-gradient-to-br from-slate-600 to-gray-700 rounded-xl p-3 shadow-lg">
                <Database className="h-8 w-8 text-white" />
              </div>
              
              {/* Title and Description */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                    Common Operations
                  </h1>
                  <Badge variant="outline" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                    Shared Resources
                  </Badge>
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-base leading-relaxed">
                  Centralized management of shared endpoints, stores directory, and store-specific pricing configurations.
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Store Directory Card */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg p-2.5 shadow-lg">
                <StoreIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">
                  Store Directory
                </CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Complete list of all stores in the system
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stores.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                        No stores found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    stores.map((store) => (
                      <TableRow key={store.id}>
                        <TableCell className="font-medium">{store.name}</TableCell>
                        <TableCell>{store.code || "-"}</TableCell>
                        <TableCell>{store.isActive ? "Active" : "Inactive"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
