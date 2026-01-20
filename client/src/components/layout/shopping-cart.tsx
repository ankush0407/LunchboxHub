import { useCart } from "@/hooks/use-cart";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart as ShoppingCartIcon, MapPin, Plus, Minus, Trash2, Utensils } from "lucide-react";

interface ShoppingCartProps {
  selectedLocation: string;
}

export default function ShoppingCart({ selectedLocation }: ShoppingCartProps) {
  const [, setLocation] = useLocation();
  const { items, updateQuantity, removeItem, subtotal, itemCount, deliveryFee } = useCart();
  
  // Fetch service fee from backend
  const { data: serviceFeeData } = useQuery<{ value: string }>({
    queryKey: ["/api/settings/service-fee"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/settings/service-fee");
      return res.json();
    },
  });
  
  const serviceFee = parseFloat(serviceFeeData?.value || "2.00");
  const taxRate = 0.10;
  const tax = subtotal * taxRate;
  const total = subtotal + deliveryFee + serviceFee + tax;

  const handleCheckout = () => {
    if (items.length > 0) {
      setLocation("/checkout");
    }
  };

  return (
    <div className="sticky-cart bg-card rounded-xl shadow-sm border border-border p-6">
      <div className="mb-4">
        <div className="flex items-center space-x-2 text-lg font-semibold">
          <ShoppingCartIcon className="w-5 h-5 text-primary" />
          <span>Your Order</span>
        </div>
      </div>

      {/* Delivery Location */}
      <div className="bg-muted rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium" data-testid="cart-delivery-location">
              {selectedLocation}
            </span>
          </div>
          <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80" data-testid="button-change-location">
            Change
          </Button>
        </div>
      </div>

      {/* Cart Items */}
      <div>
        {items.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCartIcon className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Your cart is empty</p>
            <p className="text-xs text-muted-foreground mt-1">Add some delicious lunchboxes to get started!</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-4" data-testid="cart-items">
              {items.map((item) => (
                <div 
                  key={item.lunchbox.id} 
                  className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg"
                  data-testid={`cart-item-${item.lunchbox.id}`}
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    {item.lunchbox.imageUrl ? (
                      <img 
                        src={item.lunchbox.imageUrl} 
                        alt={item.lunchbox.name}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <Utensils className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-card-foreground" data-testid={`cart-item-name-${item.lunchbox.id}`}>
                      {item.lunchbox.name}
                    </h4>
                    <p className="text-xs text-muted-foreground" data-testid={`cart-item-restaurant-${item.lunchbox.id}`}>
                      {item.restaurantName}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-6 h-6 p-0"
                        onClick={() => updateQuantity(item.lunchbox.id, item.quantity - 1)}
                        data-testid={`button-decrease-${item.lunchbox.id}`}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="text-sm font-medium" data-testid={`cart-item-quantity-${item.lunchbox.id}`}>
                        {item.quantity}
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-6 h-6 p-0"
                        onClick={() => updateQuantity(item.lunchbox.id, item.quantity + 1)}
                        data-testid={`button-increase-${item.lunchbox.id}`}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="w-6 h-6 p-0 ml-2 text-destructive hover:text-destructive"
                        onClick={() => removeItem(item.lunchbox.id)}
                        data-testid={`button-remove-${item.lunchbox.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-primary" data-testid={`cart-item-total-${item.lunchbox.id}`}>
                    ${(parseFloat(item.lunchbox.price) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium" data-testid="cart-subtotal">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivery Fee</span>
                <span className="font-medium" data-testid="cart-delivery-fee">${deliveryFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Service Fee</span>
                <span className="font-medium" data-testid="cart-service-fee">${serviceFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-medium" data-testid="cart-tax">${tax.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-primary" data-testid="cart-total">${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Checkout Button */}
            <Button 
              className="w-full mt-4" 
              size="lg"
              onClick={handleCheckout}
              disabled={items.length === 0}
              data-testid="button-proceed-to-checkout"
            >
              Proceed to Checkout
            </Button>

            {/* Payment Note */}
            <div className="mt-4 text-center">
              <p className="text-xs text-muted-foreground mb-2">Payment on Delivery</p>
              <div className="flex justify-center space-x-2 text-lg">
                <span>💵</span>
                <span>💳</span>
                <span>📱</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Cash, Card, or Digital</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
