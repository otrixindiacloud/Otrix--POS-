import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth } from "@/hooks/useAuth";
import { StoreProvider } from "@/hooks/useStore";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/LoginPage";
import POS from "@/pages/pos";
import Customers from "@/pages/customers";
import Inventory from "@/pages/inventory";
import ProductDetail from "@/pages/product-detail";
import StockTaking from "@/pages/stock-taking";
import Invoices from "@/pages/invoices";
import InvoiceWizard from "@/pages/invoice-wizard";
import Holds from "@/pages/holds";
import Reports from "@/pages/reports";
import Transactions from "@/pages/transactions";
import Administration from "@/pages/Administration";
import { StoresPage } from "@/pages/StoresPage";
import Suppliers from "@/pages/suppliers";
import EnhancedFeaturesPage from "@/pages/enhanced-features";
import TillPage from "@/pages/till";
import AuthPage from "@/pages/auth";
import CommonPage from "@/pages/common";
import { PWAStatus } from "@/components/pwa/pwa-status";
import { RouteLoading } from "@/components/ui/route-loading";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import PromotionsPage from "@/pages/promotions";
import AIPage from "@/pages/ai";
import CompetitorsPage from "@/pages/competitors";
import CreditReconciliationPage from "@/pages/credit-reconciliation";

function AuthenticatedRouter() {
  return (
    <>
      <RouteLoading>
        <Switch>
          <Route path="/" component={POS} />
          <Route path="/pos" component={POS} />
          <Route path="/customers" component={Customers} />
          <Route path="/inventory" component={Inventory} />
          <Route path="/products/:id" component={ProductDetail} />
          <Route path="/stock-taking" component={StockTaking} />
          <Route path="/invoices" component={Invoices} />
          <Route path="/invoices/create" component={InvoiceWizard} />
          <Route path="/holds" component={Holds} />
          <Route path="/reports" component={Reports} />
          <Route path="/transactions" component={Transactions} />
          <Route path="/stores" component={StoresPage} />
          <Route path="/suppliers" component={Suppliers} />
          <Route path="/administration" component={Administration} />
          <Route path="/till" component={TillPage} />
          <Route path="/auth" component={AuthPage} />
          <Route path="/common" component={CommonPage} />
          <Route path="/promotions" component={PromotionsPage} />
          <Route path="/ai" component={AIPage} />
          <Route path="/competitors" component={CompetitorsPage} />
          <Route path="/credit-reconciliation/:customerId?" component={CreditReconciliationPage} />
          <Route path="/enhanced-features" component={EnhancedFeaturesPage} />
          <Route component={NotFound} />
        </Switch>
      </RouteLoading>
      <PWAStatus />
    </>
  );
}

function Router() {
  const { user, isLoading } = useAuth();

  // Add debugging to help identify blank screen issues
  useEffect(() => {
    console.log("📍 Router state:", { user: user?.username, isLoading });
  }, [user, isLoading]);

  // Always render the same component structure to avoid hooks order issues
  return (
    <>
      {isLoading ? (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Checking authentication...</p>
            <p className="text-xs text-muted-foreground mt-2">If this takes too long, please refresh the page</p>
          </div>
        </div>
      ) : !user ? (
        <LoginPage />
      ) : (
        <StoreProvider>
          <AuthenticatedRouter />
        </StoreProvider>
      )}
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light" storageKey="pos-ui-theme">
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;