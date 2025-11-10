import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Home, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

interface AccessDeniedProps {
  title?: string;
  description?: string;
  showBackButton?: boolean;
  showDashboardButton?: boolean;
  customBackAction?: () => void;
  customDashboardAction?: () => void;
}

export function AccessDenied({
  title = "Access Denied",
  description = "You don't have permission to access this page.",
  showBackButton = true,
  showDashboardButton = true,
  customBackAction,
  customDashboardAction,
}: AccessDeniedProps) {
  const [, setLocation] = useLocation();

  const handleBack = () => {
    if (customBackAction) {
      customBackAction();
    } else {
      window.history.back();
    }
  };

  const handleDashboard = () => {
    if (customDashboardAction) {
      customDashboardAction();
    } else {
      setLocation('/');
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">{title}</h2>
            <p className="text-muted-foreground mb-6">{description}</p>
            <div className="flex gap-3 justify-center">
              {showBackButton && (
                <Button 
                  variant="outline"
                  onClick={handleBack}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Go Back
                </Button>
              )}
              {showDashboardButton && (
                <Button 
                  onClick={handleDashboard}
                  className="flex items-center gap-2"
                >
                  <Home className="h-4 w-4" />
                  Go to Dashboard
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}