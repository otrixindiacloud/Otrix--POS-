import { usePOSStore } from "@/lib/pos-store";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useEffect } from "react";
import {
  Home,
  Users,
  Package,
  PauseCircle,
  BarChart,
  Moon,
  CircleDot,
  FileText,
  Shield,
  Sun,
  Settings,
  LogOut,
  Calendar,
  Zap,
  Building2,
  Clock,
  KeyRound,
  Layers,
  Gift,
  Bot,
  ShoppingCart,
  Truck,
  Receipt,
  Upload,
  HelpCircle,
  ClipboardList,
  Warehouse,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRBAC } from "@/hooks/useRBAC";
import { useStore } from "@/hooks/useStore";
import { type HeldTransaction, type DayOperation } from "@shared/schema";
import { ThemeToggle } from "@/components/theme-toggle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StoreSelector } from "@/components/StoreSelector";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

interface SidebarProps {
  onNavigate?: () => void;
  isMobile?: boolean;
  collapsed?: boolean;
}

type NavItem = {
  label: string;
  icon: LucideIcon;
  routes: string[];
  onClick: () => void;
  visible: boolean;
  badgeCount?: number;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

export default function Sidebar({ onNavigate, isMobile, collapsed = false }: SidebarProps) {
  const [rawLocation, setLocation] = useLocation();
  const currentPath = rawLocation.split("?")[0];
  const isCollapsed = Boolean(collapsed && !isMobile);
  const { user, logout, isLogoutLoading } = useAuth();
  const { canAccess, isAdmin } = useRBAC();
  const { currentStore } = useStore();
  const {
    currentDay,
    selectedDate,
    setSelectedDate,
  } = usePOSStore();

  const { data: heldTransactions = [] } = useQuery<HeldTransaction[]>({
    queryKey: ["/api/held-transactions"],
  });

  const today = new Date().toISOString().split("T")[0];

  type DayStatusResponse = {
    date: string;
    status: "open" | "closed";
    canOpen?: boolean;
    canReopen?: boolean;
    message?: string;
    dayOperation?: {
      id: number;
      openedAt?: string | null;
      closedAt?: string | null;
      openedByName?: string | null;
      closedByName?: string | null;
    };
  };

  const storeId = currentStore?.id;
  const dayStatusUrl = `/api/day-operations/status/${selectedDate}${storeId ? `?storeId=${storeId}` : ""}`;
  const openDayUrl = `/api/day-operations/open${storeId ? `?storeId=${storeId}` : ""}`;

  const { data: dayStatus, isLoading: isDayStatusLoading } = useQuery<DayStatusResponse | null>({
    queryKey: [dayStatusUrl],
    queryFn: async () => {
      const response = await fetch(dayStatusUrl);
      if (!response.ok) throw new Error("Failed to fetch day status");
      return response.json();
    },
    enabled: Boolean(storeId),
    staleTime: 30 * 1000,
  });

  const { data: openDay } = useQuery<DayOperation | null>({
    queryKey: [openDayUrl],
    enabled: Boolean(storeId),
    staleTime: 30 * 1000,
  });

  const formatTime = (date: Date | string | null) => {
    if (!date) return "N/A";
    const parsed = typeof date === "string" ? new Date(date) : date;
    return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getShiftDuration = () => {
    if (!currentDay?.openedAt) return "0h 0m";
    const start = new Date(currentDay.openedAt);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const openDayDate = openDay?.date ? String(openDay.date) : null;
  const dayMatchesSelectedDate = Boolean(openDayDate && openDayDate === selectedDate);
  const dayStatusButtonIntent = !openDayDate ? "open" : dayMatchesSelectedDate ? "close" : undefined;
  const dayStatusButtonPath = dayStatusButtonIntent ? `/till?intent=${dayStatusButtonIntent}` : "/till";
  const tillButtonLabel = !openDayDate
    ? "Open Day in Till"
    : dayMatchesSelectedDate
    ? "Close Day in Till"
    : "Till Management";
  const tillButtonVariant: "default" | "outline" = !openDayDate || dayMatchesSelectedDate ? "default" : "outline";
  const tillButtonClassName = !openDayDate
    ? "w-full bg-success text-success-foreground hover:bg-success/90"
    : dayMatchesSelectedDate
    ? "w-full bg-warning text-warning-foreground hover:bg-warning/90"
    : "w-full";
  const TillManageIcon = !openDayDate ? Sun : dayMatchesSelectedDate ? Moon : Building2;

  // Listen for global event to open day modal (triggered from payment errors)
  useEffect(() => {
    const handleOpenDayEvent = () => {
      console.log('Redirecting to till management for day open request');
      setLocation("/till?intent=open");
    };

    window.addEventListener('openDayModal', handleOpenDayEvent);

    return () => {
      window.removeEventListener('openDayModal', handleOpenDayEvent);
    };
  }, [setLocation]);

  const handleNavigate = (path: string) => {
    setLocation(path);
    onNavigate?.();
  };

  // Group navigation items into sections with original routes
  const navSections: NavSection[] = [
    {
      title: "",
      items: [
        {
          label: "Point of Sale",
          icon: Home,
          routes: ["/", "/pos"],
          onClick: () => handleNavigate("/pos"),
          visible: true,
        },
      ],
    },
    {
      title: "OPERATIONS",
      items: [
        {
          label: "Customers",
          icon: Users,
          routes: ["/customers"],
          onClick: () => handleNavigate("/customers"),
          visible: true,
        },
        {
          label: "Inventory",
          icon: Package,
          routes: ["/inventory"],
          onClick: () => handleNavigate("/inventory"),
          visible: true,
        },
        {
          label: "Stores",
          icon: Building2,
          routes: ["/stores"],
          onClick: () => handleNavigate("/stores"),
          visible: true,
        },
        {
          label: "Till Operations",
          icon: Clock,
          routes: ["/till"],
          onClick: () => handleNavigate("/till"),
          visible: true,
        },
        {
          label: "Common",
          icon: Layers,
          routes: ["/common"],
          onClick: () => handleNavigate("/common"),
          visible: true,
        },
      ],
    },
    {
      title: "SALES & INVOICING",
      items: [
        {
          label: "Promotions",
          icon: Gift,
          routes: ["/promotions"],
          onClick: () => handleNavigate("/promotions"),
          visible: true,
        },
        {
          label: "Competitors",
          icon: TrendingUp,
          routes: ["/competitors"],
          onClick: () => handleNavigate("/competitors"),
          visible: true,
        },
        {
          label: "Invoices",
          icon: FileText,
          routes: ["/invoices", "/invoices/create"],
          onClick: () => handleNavigate("/invoices"),
          visible: true,
        },
        {
          label: "Holds",
          icon: PauseCircle,
          routes: ["/holds"],
          onClick: () => handleNavigate("/holds"),
          visible: true,
          badgeCount: heldTransactions.length,
        },
      ],
    },
    {
      title: "ANALYTICS & REPORTS",
      items: [
        {
          label: "Reports",
          icon: BarChart,
          routes: ["/reports"],
          onClick: () => handleNavigate("/reports"),
          visible: true,
        },
        {
          label: "Risk Analysis",
          icon: Shield,
          routes: ["/transactions"],
          onClick: () => handleNavigate("/transactions"),
          visible: true,
        },
        {
          label: "AI Studio",
          icon: Bot,
          routes: ["/ai"],
          onClick: () => handleNavigate("/ai"),
          visible: true,
        },
      ],
    },
    {
      title: "SYSTEM",
      items: [
        {
          label: "Enhanced Features",
          icon: Zap,
          routes: ["/enhanced-features"],
          onClick: () => handleNavigate("/enhanced-features"),
          visible: isAdmin,
        },
        {
          label: "Administration",
          icon: Settings,
          routes: ["/administration"],
          onClick: () => handleNavigate("/administration"),
          visible: isAdmin,
        },
        {
          label: "Authentication",
          icon: KeyRound,
          routes: ["/auth"],
          onClick: () => handleNavigate("/auth"),
          visible: true,
        },
      ],
    },
  ];

  const renderNavItem = (item: NavItem) => {
    if (!item.visible) return null;
    const isActive = item.routes.some((route) => currentPath === route);
    const hasBadge = typeof item.badgeCount === "number" && item.badgeCount > 0;

    return (
      <Tooltip key={item.label} delayDuration={0}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            onClick={item.onClick}
            className={cn(
              "group relative w-full justify-start gap-3 h-10 px-3 rounded-lg transition-all duration-150",
              isActive
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!isCollapsed && (
              <span className="text-sm truncate flex-1 text-left">{item.label}</span>
            )}
            {!isCollapsed && hasBadge && (
              <Badge variant="secondary" className="ml-auto text-xs px-1.5 py-0">
                {item.badgeCount}
              </Badge>
            )}
          </Button>
        </TooltipTrigger>
        {isCollapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
      </Tooltip>
    );
  };

  const renderSection = (section: NavSection) => {
    const visibleItems = section.items.filter(item => item.visible);
    if (visibleItems.length === 0) return null;

    return (
      <div key={section.title || 'main'} className="space-y-1">
        {section.title && !isCollapsed && (
          <h3 className="px-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2">
            {section.title}
          </h3>
        )}
        {isCollapsed && section.title && (
          <Separator className="my-2" />
        )}
        <div className="space-y-0.5">
          {visibleItems.map(item => renderNavItem(item))}
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        "relative z-10 flex h-full flex-col overflow-hidden border-r bg-background transition-all duration-300",
        isMobile ? "w-full" : "w-auto",
        !isMobile && (isCollapsed ? "w-16" : "w-60")
      )}
      style={{ minHeight: 0 }} // Ensure flex shrinking works
    >
      {/* Store Name & Day Status Header */}
      {!isCollapsed && (
        <div className="border-b bg-card px-4 py-3">
          <div className="space-y-2">
            {/* Store Name */}
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                {currentStore?.name || "No Store Selected"}
              </span>
            </div>
            
            {/* Day Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {openDayDate ? `Opened: ${openDayDate}` : "Day Not Opened"}
                </span>
              </div>
              <CircleDot
                className={cn(
                  "h-3 w-3",
                  openDayDate ? "text-green-500" : "text-amber-500"
                )}
              />
            </div>
          </div>
        </div>
      )}

      {/* Navigation Sections */}
      <nav
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar",
          isCollapsed ? "px-2 py-4" : "px-3 py-4"
        )}
        style={{ minHeight: 0, flex: '1 1 auto' }} // Ensure proper flex behavior
      >
        <div className={cn(!isCollapsed && "space-y-6 pb-4")}>
          {navSections.map(renderSection)}
        </div>
      </nav>

      {/* Admin Info Footer */}
      <div className="border-t bg-card">
        {!isCollapsed && user && (
          <div className="px-4 py-3 border-b">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium">{user.username}</span>
              <span>•</span>
              <span className="lowercase">{user.role}</span>
            </div>
          </div>
        )}
        
        <div className={cn("p-3", isCollapsed ? "flex flex-col items-center gap-2" : "flex items-center justify-between")}>
          {!isCollapsed && (
            <span className="text-xs text-muted-foreground">Otrix POS v1.0</span>
          )}
          <div className="flex items-center gap-2">
            {!isCollapsed && <ThemeToggle />}
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => logout()}
                  disabled={isLogoutLoading}
                  className={cn("h-8 w-8", isCollapsed && "h-10 w-10")}
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign Out</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
