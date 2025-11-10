import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export default function AuthPage() {
  const { user, logout, isLogoutLoading } = useAuth();

  return (
    <MainLayout pageTitle="Authentication">
      <div className="container-responsive py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Session Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {user ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Signed in as</p>
                  <p className="text-lg font-semibold">{user.username}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <Badge variant="outline">Role: {user.role}</Badge>
                <p className="text-sm text-muted-foreground">
                  Use this screen to quickly validate session refresh behaviour and trigger manual logout flows for troubleshooting.
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      await fetch("/api/auth/refresh", { method: "POST" });
                    }}
                  >
                    Refresh Session
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={isLogoutLoading}
                    onClick={() => logout()}
                  >
                    Logout
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No user session detected.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
