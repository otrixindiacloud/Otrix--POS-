import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Clock, TrendingUp, Users, BarChart3 } from "lucide-react";

interface Template {
  id: string;
  name: string;
  description: string;
  query: string;
}

interface AIQueryInputProps {
  onSubmit: (query: string) => void;
  isLoading: boolean;
  templates: Template[];
}

export default function AIQueryInput({ onSubmit, isLoading, templates }: AIQueryInputProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSubmit(query.trim());
    }
  };

  const handleTemplateClick = (template: Template) => {
    setQuery(template.query);
    onSubmit(template.query);
  };

  const getTemplateIcon = (templateId: string) => {
    switch (templateId) {
      case 'daily-sales':
        return <Clock className="w-4 h-4" />;
      case 'top-products':
        return <TrendingUp className="w-4 h-4" />;
      case 'customer-analysis':
        return <Users className="w-4 h-4" />;
      default:
        return <BarChart3 className="w-4 h-4" />;
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          AI-Powered Reports
        </CardTitle>
        <p className="text-sm text-slate-600">
          Ask questions about your business data in plain English
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask me anything... e.g., 'Show me this week's top selling products' or 'What are my busiest hours?'"
            className="flex-1"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !query.trim()}>
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>

        {templates && templates.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-3">Quick Reports</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {templates.map((template) => (
                <Button
                  key={template.id}
                  variant="outline"
                  className="h-auto p-3 justify-start"
                  onClick={() => handleTemplateClick(template)}
                  disabled={isLoading}
                >
                  <div className="flex items-start gap-2 text-left">
                    {getTemplateIcon(template.id)}
                    <div>
                      <div className="font-medium text-sm">{template.name}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {template.description}
                      </div>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
          <strong>Examples you can try:</strong>
          <ul className="mt-1 space-y-1">
            <li>• "Show me sales trends for the last 30 days"</li>
            <li>• "Which products have the highest profit margins?"</li>
            <li>• "Compare cash vs card payments this month"</li>
            <li>• "Show me customer purchase patterns"</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}