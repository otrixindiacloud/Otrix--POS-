import { Building2, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/hooks/useStore";
import { cn } from "@/lib/utils";

interface StoreSelectorProps {
  className?: string;
  variant?: "default" | "compact";
}

export function StoreSelector({ className, variant = "default" }: StoreSelectorProps) {
  const { currentStore, setCurrentStore, availableStores, isLoading } = useStore();

  if (isLoading) {
    return (
      <div className={cn("animate-pulse", className)}>
        {variant === "compact" ? (
          <div className="h-8 bg-gray-200 rounded w-32"></div>
        ) : (
          <Card>
            <CardContent className="p-3">
              <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-16"></div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (availableStores.length === 0) {
    return (
      <div className={cn("text-sm text-red-500 flex items-center gap-2", className)}>
        <Building2 className="h-4 w-4" />
        <span>No stores available - Please create a store first</span>
      </div>
    );
  }

  if (availableStores.length === 1) {
    const store = availableStores[0];
    return (
      <div className={cn(className)}>
        {variant === "compact" ? (
          <Badge variant="secondary" className="flex items-center gap-2">
            <Building2 className="h-3 w-3" />
            {store.name}
          </Badge>
        ) : (
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-600" />
                <div>
                  <div className="font-medium text-sm">{store.name}</div>
                  <div className="text-xs text-gray-500">Code: {store.code}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant === "compact" ? "outline" : "ghost"}
          className={cn(
            "justify-between",
            variant === "compact" ? "h-8 px-3" : "h-auto p-3 bg-white hover:bg-gray-50",
            className
          )}
        >
          <div className="flex items-center gap-2">
            <Building2 className={cn("text-blue-600", variant === "compact" ? "h-3 w-3" : "h-4 w-4")} />
            <div className={cn(variant === "compact" ? "text-sm" : "text-left")}>
              {variant === "compact" ? (
                <span className="font-medium">{currentStore?.name || "Select Store"}</span>
              ) : (
                <>
                  <div className="font-medium text-sm">{currentStore?.name || "Select Store"}</div>
                  {currentStore && (
                    <div className="text-xs text-gray-500">Code: {currentStore.code}</div>
                  )}
                </>
              )}
            </div>
          </div>
          <ChevronDown className={cn(variant === "compact" ? "h-3 w-3" : "h-4 w-4")} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {availableStores.map((store) => (
          <DropdownMenuItem
            key={store.id}
            onClick={() => {
              console.log('Store selector clicked:', store);
              setCurrentStore(store);
            }}
            className="flex items-center justify-between p-3 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <div>
                <div className="font-medium text-sm">{store.name}</div>
                <div className="text-xs text-gray-500">Code: {store.code}</div>
                {store.address && (
                  <div className="text-xs text-gray-400 truncate max-w-48">
                    {store.address}
                  </div>
                )}
              </div>
            </div>
            {currentStore?.id === store.id && (
              <Check className="h-4 w-4 text-green-600" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}