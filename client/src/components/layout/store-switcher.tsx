import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Store, ChevronDown, Building2, Check } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import type { Store as StoreType } from "@shared/schema";

export default function StoreSwitcher() {
  const { currentStore, setCurrentStore } = useStore();
  
  const { data: stores = [], isLoading } = useQuery<StoreType[]>({
    queryKey: ["/api/stores/active"],
  });

  const handleStoreChange = (store: StoreType) => {
    setCurrentStore(store);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
        <Building2 className="w-4 h-4 animate-pulse" />
        <span className="text-sm">Loading stores...</span>
      </div>
    );
  }

  if (!stores || stores.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 text-orange-700 rounded-md border border-orange-200">
        <Building2 className="w-4 h-4" />
        <span className="text-sm">No stores available</span>
      </div>
    );
  }

  if (stores.length === 1) {
    const store = stores[0];
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-md border border-green-200">
        <Building2 className="w-4 h-4" />
        <div className="flex flex-col">
          <span className="text-sm font-medium">{store.name}</span>
          <span className="text-xs opacity-75">{store.code}</span>
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2 min-w-[200px]">
          <Building2 className="w-4 h-4" />
          <span className="flex-1 text-left truncate">
            {currentStore?.name || "Select Store"}
          </span>
          {currentStore && (
            <Badge variant="secondary" className="text-xs">
              {currentStore.code}
            </Badge>
          )}
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Store className="w-4 h-4" />
          Switch Store Context
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {stores.map((store) => (
          <DropdownMenuItem
            key={store.id}
            onClick={() => handleStoreChange(store)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              <div>
                <div className="font-medium">{store.name}</div>
                <div className="text-xs text-muted-foreground">
                  {store.address}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {store.code}
              </Badge>
              {currentStore?.id === store.id && (
                <Check className="w-4 h-4 text-green-600" />
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}