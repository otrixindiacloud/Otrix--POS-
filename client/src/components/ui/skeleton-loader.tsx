import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "rectangle" | "circle";
  height?: string;
  width?: string;
}

export function Skeleton({ className, variant = "rectangle", height = "h-4", width = "w-full" }: SkeletonProps) {
  const variantClasses = {
    text: "rounded",
    rectangle: "rounded",
    circle: "rounded-full",
  };

  return (
    <div 
      className={cn(
        "animate-pulse bg-slate-200", 
        variantClasses[variant], 
        height, 
        width, 
        className
      )}
    />
  );
}

export function ProductSkeleton() {
  return (
    <div className="p-4 border border-slate-200 rounded-lg bg-white space-y-2">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-4 p-4 border-b">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} className="h-4" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="grid grid-cols-4 gap-4 p-4">
          {Array.from({ length: cols }, (_, j) => (
            <Skeleton key={j} className="h-4" />
          ))}
        </div>
      ))}
    </div>
  );
}