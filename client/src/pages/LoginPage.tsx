import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Eye, EyeOff, Store, Users, Shield, Truck, CreditCard, UserCog, Building2, Lock } from "lucide-react";
import { getRoleDisplayName, getRoleBadgeColor } from "@/lib/authUtils";

export default function LoginPage() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoginLoading } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username && password) {
      login({ username, password });
    }
  };

  const demoUsers = [
    { username: "admin", password: "admin", role: "admin", icon: Shield },
    { username: "manager", password: "manager", role: "manager", icon: UserCog },
    { username: "supervisor", password: "supervisor", role: "supervisor", icon: Users },
    { username: "cashier", password: "cashier", role: "cashier", icon: Store },
    { username: "delivery", password: "delivery", role: "delivery", icon: Truck },
    { username: "customer", password: "customer", role: "customer", icon: CreditCard },
  ];

  const handleDemoLogin = (demoUser: { username: string; password: string }) => {
    setUsername(demoUser.username);
    setPassword(demoUser.password);
    login({ username: demoUser.username, password: demoUser.password });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 relative transition-colors duration-300">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/20">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.15) 1px, transparent 0)`,
          backgroundSize: '20px 20px'
        }} />
      </div>

      {/* Theme Toggle */}
      <div className="absolute top-6 right-6 z-10">
        <ThemeToggle />
      </div>

      {/* Header */}
      <div className="absolute top-6 left-6 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 dark:bg-blue-500 rounded-xl flex items-center justify-center shadow-lg">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Otrix POS</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Point of Sale System</p>
          </div>
        </div>
      </div>
      
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-12 relative z-10">
        {/* Login Form */}
        <div className="flex items-center justify-center">
          <Card className="w-full max-w-md bg-white dark:bg-slate-800 border-0 shadow-xl dark:shadow-2xl">
            <CardHeader className="text-center space-y-6 pb-8">
              <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-700/50 rounded-3xl flex items-center justify-center mx-auto">
                <Lock className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-2xl font-semibold text-slate-800 dark:text-slate-100">Welcome Back</CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400 text-base">
                  Sign in to access your POS dashboard
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-3">
                  <Label htmlFor="username" className="text-sm font-medium text-slate-700 dark:text-slate-300">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoginLoading}
                    required
                    className="h-12 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 focus:bg-white dark:focus:bg-slate-700 focus:border-blue-300 dark:focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-900/50 transition-colors text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoginLoading}
                      required
                      className="h-12 pr-12 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 focus:bg-white dark:focus:bg-slate-700 focus:border-blue-300 dark:focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-900/50 transition-colors text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-10 w-10 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoginLoading}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl dark:shadow-2xl" 
                  disabled={isLoginLoading}
                >
                  {isLoginLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Signing in...
                    </div>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Forgot your password? Contact your administrator
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Demo Users */}
        <div className="flex items-center justify-center">
          <Card className="w-full max-w-md bg-white dark:bg-slate-800 border-0 shadow-xl dark:shadow-2xl">
            <CardHeader className="pb-6">
              <div className="text-center space-y-2">
                <CardTitle className="text-xl font-semibold text-slate-800 dark:text-slate-100">Quick Access</CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                  Demo accounts for testing different user roles
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                {demoUsers.map((user) => {
                  const Icon = user.icon;
                  return (
                    <Button
                      key={user.username}
                      variant="outline"
                      className="w-full h-auto p-4 justify-start hover:bg-slate-50 dark:hover:bg-slate-700/50 border-slate-200 dark:border-slate-600 rounded-xl transition-all duration-200 bg-transparent dark:bg-transparent"
                      onClick={() => handleDemoLogin(user)}
                      disabled={isLoginLoading}
                    >
                      <div className="flex items-center gap-4 w-full">
                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Icon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="font-medium text-slate-800 dark:text-slate-100">{user.username}</div>
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            Password: {user.password}
                          </div>
                        </div>
                        <Badge 
                          variant="secondary" 
                          className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700/50 font-medium"
                        >
                          {getRoleDisplayName(user.role)}
                        </Badge>
                      </div>
                    </Button>
                  );
                })}
              </div>

              <Separator className="my-6 bg-slate-200 dark:bg-slate-700" />

              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 text-center space-y-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Demo Environment</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Each role provides different access levels and permissions within the POS system.
                  Click any account above for instant access.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 text-center text-sm text-slate-400 dark:text-slate-500">
        <p>© 2025 Otrix POS System. All rights reserved.</p>
      </div>
    </div>
  );
}