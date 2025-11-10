import { useStore } from "@/hooks/useStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import VATManagement from "@/components/admin/vat-management";
import PromotionsManagement from "@/components/admin/promotions-management";
import CurrencyManagement from "@/components/admin/currency-management";
import { Percent, Tags, Globe, ShoppingBag, Sparkles, TrendingUp } from "lucide-react";
import MainLayout from "@/components/layout/main-layout";

export default function EnhancedFeaturesPage() {
  const { currentStore } = useStore();

  const content = currentStore ? (
    <div className="space-y-6">
      {/* Professional Header */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-slate-700 rounded-2xl flex items-center justify-center shadow-md">
            <Sparkles className="w-9 h-9 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-gray-800">
              Enhanced Features
            </h1>
            <p className="text-gray-600 text-base font-medium mt-1">
              Manage VAT configuration, promotions, and multi-currency settings for {currentStore.name}
            </p>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="flex flex-wrap gap-4 mt-6">
          <div className="bg-slate-50 rounded-xl px-4 py-2 border border-slate-200 shadow-sm">
            <div className="text-xs text-slate-700 font-medium flex items-center gap-1">
              <Percent className="h-3 w-3" />
              VAT Settings
            </div>
            <div className="text-lg font-black text-slate-800">Active</div>
          </div>
          <div className="bg-blue-50 rounded-xl px-4 py-2 border border-blue-200 shadow-sm">
            <div className="text-xs text-blue-700 font-medium flex items-center gap-1">
              <Tags className="h-3 w-3" />
              Promotions
            </div>
            <div className="text-lg font-black text-blue-800">Enabled</div>
          </div>
          <div className="bg-indigo-50 rounded-xl px-4 py-2 border border-indigo-200 shadow-sm">
            <div className="text-xs text-indigo-700 font-medium flex items-center gap-1">
              <Globe className="h-3 w-3" />
              Multi-Currency
            </div>
            <div className="text-lg font-black text-indigo-800">Ready</div>
          </div>
          <div className="bg-emerald-50 rounded-xl px-4 py-2 border border-emerald-200 shadow-sm">
            <div className="text-xs text-emerald-700 font-medium flex items-center gap-1">
              <ShoppingBag className="h-3 w-3" />
              Store
            </div>
            <div className="text-lg font-black text-emerald-800">{currentStore.name}</div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="vat" className="space-y-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-3">
          <TabsList className="grid w-full grid-cols-3 gap-2 bg-transparent p-0">
            <TabsTrigger 
              value="vat" 
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 data-[state=active]:bg-slate-700 data-[state=active]:text-white data-[state=active]:border-slate-700 data-[state=active]:shadow-md"
            >
              <Percent className="w-4 h-4" />
              <span className="hidden sm:inline">VAT Management</span>
              <span className="sm:hidden">VAT</span>
            </TabsTrigger>
            <TabsTrigger 
              value="promotions" 
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:border-blue-600 data-[state=active]:shadow-md"
            >
              <Tags className="w-4 h-4" />
              <span className="hidden sm:inline">Promotions</span>
              <span className="sm:hidden">Promo</span>
            </TabsTrigger>
            <TabsTrigger 
              value="currency" 
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:border-indigo-600 data-[state=active]:shadow-md"
            >
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">Multi-Currency</span>
              <span className="sm:hidden">Currency</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="vat" className="mt-6">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center shadow-md">
                  <Percent className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">VAT Configuration</h3>
                  <p className="text-gray-600 text-sm">Manage Value Added Tax rates and settings</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <VATManagement storeId={currentStore.id} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="promotions" className="mt-6">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-blue-50 border-b border-blue-200 p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
                  <Tags className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">Promotions & Discounts</h3>
                  <p className="text-gray-600 text-sm">Create and manage promotional campaigns</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <PromotionsManagement storeId={currentStore.id} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="currency" className="mt-6">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-indigo-50 border-b border-indigo-200 p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">Multi-Currency Settings</h3>
                  <p className="text-gray-600 text-sm">Configure exchange rates and currency options</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <CurrencyManagement storeId={currentStore.id} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  ) : (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-12">
        <div className="text-center max-w-md mx-auto">
          <div className="w-20 h-20 bg-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-md">
            <ShoppingBag className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-3">No Store Selected</h3>
          <p className="text-gray-600 text-base leading-relaxed">
            Please select a store from the dropdown menu to access and manage enhanced features including VAT, promotions, and multi-currency settings.
          </p>
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-sm text-blue-800 font-medium">
              💡 Tip: Use the store selector in the top navigation bar
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <MainLayout pageTitle="Enhanced Features">
      <div className="p-6 space-y-6">
        {content}
      </div>
    </MainLayout>
  );
}