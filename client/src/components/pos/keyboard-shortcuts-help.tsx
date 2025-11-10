import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogTrigger 
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Keyboard, CreditCard, Coins, Tags, ScanBarcode, HelpCircle } from "lucide-react";

const shortcuts = [
  {
    key: "F1",
    action: "Card Payment",
    description: "Process card payment instantly",
    icon: CreditCard,
    color: "bg-blue-500"
  },
  {
    key: "F2", 
    action: "Exact Cash",
    description: "Process exact cash payment",
    icon: Coins,
    color: "bg-green-500"
  },
  {
    key: "F3",
    action: "Store Credit", 
    description: "Use customer store credit",
    icon: Tags,
    color: "bg-purple-500"
  },
  {
    key: "F4",
    action: "More Options",
    description: "Open full payment modal",
    icon: CreditCard,
    color: "bg-slate-500"
  },
  {
    key: "F12",
    action: "Scanner",
    description: "Open barcode scanner",
    icon: ScanBarcode,
    color: "bg-orange-500"
  }
];

export default function KeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-500 hover:text-slate-700"
        >
          <Keyboard className="w-4 h-4 mr-1" />
          <span className="text-xs">Shortcuts</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these shortcuts for faster checkout operations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {shortcuts.map((shortcut) => (
            <Card key={shortcut.key} className="border border-slate-200">
              <CardContent className="p-3">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 ${shortcut.color} rounded flex items-center justify-center`}>
                    <shortcut.icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {shortcut.key}
                      </Badge>
                      <span className="font-medium text-sm">{shortcut.action}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {shortcut.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="pt-3 border-t border-slate-200">
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <HelpCircle className="w-3 h-3" />
            <span>Shortcuts work when not typing in input fields</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}