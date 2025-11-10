import { useState, useRef, useEffect } from "react";
import { usePOSStore } from "@/lib/pos-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  CreditCard,
  X,
  ChevronUp,
  ChevronDown,
  Move,
} from "lucide-react";

export default function FloatingCartSummary() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  
  const {
    cartItems,
    getCartItemCount,
    getCartSubtotal,
    getCartTax,
    getCartTotal,
    openPaymentModal,
  } = usePOSStore();

  const subtotal = getCartSubtotal();
  const tax = getCartTax();
  const total = getCartTotal();
  const itemCount = getCartItemCount();

  // Load saved position from localStorage
  useEffect(() => {
    const savedPosition = localStorage.getItem('floatingCartPosition');
    if (savedPosition) {
      setPosition(JSON.parse(savedPosition));
    }
  }, []);

  // Handle mouse down - start dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    
    const rect = cardRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
  };

  // Handle mouse move - drag the element
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !cardRef.current) return;
      
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Get window dimensions
      const maxX = window.innerWidth - cardRef.current.offsetWidth;
      const maxY = window.innerHeight - cardRef.current.offsetHeight;
      
      // Constrain position within viewport
      const constrainedX = Math.max(0, Math.min(newX, maxX));
      const constrainedY = Math.max(0, Math.min(newY, maxY));
      
      setPosition({ x: constrainedX, y: constrainedY });
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        // Save position to localStorage
        localStorage.setItem('floatingCartPosition', JSON.stringify(position));
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, position]);

  return (
    <div 
      ref={cardRef}
      className="fixed z-50 max-w-sm hidden lg:block"
      style={{
        left: position.x || 'auto',
        top: position.y || 'auto',
        right: position.x ? 'auto' : '24px',
        bottom: position.y ? 'auto' : '24px',
        cursor: isDragging ? 'grabbing' : 'auto',
      }}
    >
      <Card className="glass-card-premium backdrop-blur-2xl shadow-modern-2xl border-0">
        <CardContent className="p-0">
          {/* Drag Handle */}
          <div 
            className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10"
            onMouseDown={handleMouseDown}
          >
            <div className="w-12 h-1.5 bg-white/30 rounded-full cursor-grab active:cursor-grabbing hover:bg-white/50 transition-colors">
              <Move className="w-3 h-3 text-black/60 mx-auto mt-0.5" />
            </div>
          </div>

          {/* Modern Collapsed Header */}
          <div 
            className="p-5 pt-7 cursor-pointer select-none hover:bg-white/10 transition-all duration-300 rounded-3xl"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
                    <ShoppingCart className="w-6 h-6 text-white" />
                  </div>
                  {itemCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 w-6 h-6 p-0 flex items-center justify-center text-xs font-bold animate-bounce shadow-lg bg-red-500 border-0"
                    >
                      {itemCount}
                    </Badge>
                  )}
                </div>
                <div>
                  <p className="text-lg font-black text-primary">
                    QR {total.toFixed(2)}
                  </p>
                  <p className="text-sm text-foreground/60 font-medium">
                    {itemCount} {itemCount === 1 ? 'item' : 'items'} • VAT: QR {tax.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {itemCount > 0 && (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openPaymentModal();
                    }}
                    className="btn-modern py-2 px-4 text-sm font-bold shadow-lg"
                  >
                    Pay
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Modern Expanded Content */}
          {isExpanded && (
            <div className="border-t border-white/20 p-5 space-y-4 backdrop-blur-xl">
              {/* Modern Summary Details */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground/60 font-medium">Subtotal:</span>
                  <span className="font-bold text-foreground">QR {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-foreground/60 font-medium">VAT Tax:</span>
                  <span className="font-bold text-foreground">QR {tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-black pt-3 border-t border-white/20">
                  <span className="text-primary">Total:</span>
                  <span className="text-primary">QR {total.toFixed(2)}</span>
                </div>
              </div>

              {/* Modern Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={openPaymentModal}
                  disabled={itemCount === 0}
                  className="w-full btn-modern py-3 font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-glow-primary"
                  size="sm"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Process Payment
                </Button>
              </div>

              {/* Cart Items Preview */}
              {cartItems.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-600 border-t border-slate-200 pt-3">
                    Cart Items:
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {cartItems.slice(0, 3).map((item) => (
                      <div key={item.productId} className="flex justify-between text-xs">
                        <span className="truncate flex-1 mr-2">
                          {item.quantity}x {item.name}
                        </span>
                        <span className="font-medium">
                          ${parseFloat(item.total).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    {cartItems.length > 3 && (
                      <div className="text-xs text-slate-400 text-center">
                        +{cartItems.length - 3} more items
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}