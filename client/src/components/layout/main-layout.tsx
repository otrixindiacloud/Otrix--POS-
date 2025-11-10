import { useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Sidebar from "@/components/pos/sidebar";
import DayCloseModal from "@/components/pos/day-close-modal";
import StoreSwitcher from "@/components/layout/store-switcher";
import UserRoleIndicator from "@/components/layout/user-role-indicator";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

interface MainLayoutProps {
  children: React.ReactNode;
  pageTitle?: string;
  headerActions?: React.ReactNode;
  mobileHeaderActions?: React.ReactNode;
}

const ROUTE_TITLES: Record<string, string> = {
  "/": "Point of Sale",
  "/pos": "Point of Sale",
  "/customers": "Customer Management",
  "/inventory": "Inventory",
  "/stock-taking": "Stock Taking",
  "/invoices": "Invoices",
  "/invoices/create": "Create Invoice",
  "/holds": "Held Transactions",
  "/reports": "Reports",
  "/transactions": "Transactions",
  "/stores": "Stores",
  "/suppliers": "Suppliers",
  "/competitors": "Competitors",
  "/administration": "Administration",
  "/till": "Till & Day Operations",
  "/auth": "Authentication",
  "/common": "Common Operations",
  "/promotions": "Promotions",
  "/ai": "AI Insights",
  "/credit-reconciliation": "Credit Reconciliation",
  "/enhanced-features": "Enhanced Features",
};

export default function MainLayout({
  children,
  pageTitle,
  headerActions,
  mobileHeaderActions,
}: MainLayoutProps) {
  const isMobile = useIsMobile();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [location] = useLocation();
  const { user } = useAuth();

  const resolvedTitle = useMemo(() => {
    if (pageTitle) return pageTitle;
    const normalizedPath = location.endsWith("/") && location !== "/"
      ? location.slice(0, -1)
      : location;
    return ROUTE_TITLES[normalizedPath] ?? "Operations Hub";
  }, [location, pageTitle]);

  // Always show navigation - not just for POS
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-background" key={location}>
        {/* Mobile Header with Navigation */}
        <div className="flex items-center justify-between p-4 bg-card border-b border-border z-50 flex-shrink-0">
          <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="touch-target">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0 mobile-modal">
              <Sidebar onNavigate={() => setIsSidebarOpen(false)} />
            </SheetContent>
          </Sheet>
          
          <div className="flex flex-col items-start" key={`title-${location}`}>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">RetailPro</span>
            <h1 className="text-lg font-semibold text-foreground">{resolvedTitle}</h1>
          </div>

          <div className="flex items-center gap-2" key={`actions-${location}`}>
            {mobileHeaderActions}
          </div>
        </div>

        {/* Store Switcher - Mobile */}
        {user?.role === 'admin' && (
          <div className="px-4 pb-2 border-b flex-shrink-0">
            <StoreSwitcher />
          </div>
        )}

        {/* Mobile Content */}
        <div className="flex-1 overflow-auto min-h-0">
          {children}
        </div>

        <DayCloseModal />
      </div>
    );
  }

  // Desktop Layout with Navigation
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background" key={location}>
      <header className="flex items-center justify-between px-6 py-3 bg-card border-b border-border flex-shrink-0 z-50">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            aria-label={isSidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </Button>

          <div className="flex flex-col" key={`title-${location}`}>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">RetailPro</span>
            <span className="text-lg font-semibold text-foreground">{resolvedTitle}</span>
          </div>
        </div>

        <div className="flex items-center gap-3" key={`actions-${location}`}>
          {headerActions}
          <div className="hidden md:flex">
            <StoreSwitcher />
          </div>
          <UserRoleIndicator />
        </div>
      </header>
      
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar collapsed={isSidebarCollapsed} />
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
      <DayCloseModal />
    </div>
  );
}