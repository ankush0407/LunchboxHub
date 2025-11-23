import { useState, useEffect, useMemo } from "react";
import { useLocationContext } from "@/contexts/location-context";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isProfileComplete, getProfileCompletionMessage } from "@/lib/profile-utils";
import { ArrowLeft, CreditCard, MapPin, ShoppingBag, Calendar, Clock, User, Building2 } from "lucide-react";
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { DeliveryBuilding, DeliveryLocation, Restaurant } from "@shared/schema";

// Initialize Stripe
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

// Payment Form Component
const PaymentForm = ({ onOrderSuccess, orderData, total }: { 
  onOrderSuccess: () => void; 
  orderData: any; 
  total: number;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const res = await apiRequest("POST", "/api/orders", orderData);
      return res.json();
    },
    onSuccess: onOrderSuccess,
    onError: (error: Error) => {
      toast({
        title: "Order Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      // Confirm the payment
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/orders`,
        },
        redirect: 'if_required',
      });

      if (error) {
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        // Payment succeeded, create the order
        createOrderMutation.mutate(orderData);
      }
    } catch (error: any) {
      toast({
        title: "Payment Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <Button 
        type="submit"
        className="w-full mt-6" 
        size="lg"
        disabled={!stripe || !elements || isProcessing || createOrderMutation.isPending}
        data-testid="button-pay-now"
      >
        {isProcessing || createOrderMutation.isPending 
          ? "Processing Payment..." 
          : `Pay $${total.toFixed(2)}`
        }
      </Button>
    </form>
  );
};

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { items, subtotal, clearCart, deliveryFee } = useCart();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedLocation } = useLocationContext();
  const [selectedDeliveryDay, setSelectedDeliveryDay] = useState("");
  const [selectedDeliveryBuilding, setSelectedDeliveryBuilding] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [isPickup, setIsPickup] = useState(false);

  const { data: deliveryLocations } = useQuery<DeliveryLocation[]>({
    queryKey: ["/api/delivery-locations"],
  });

  const { data: serviceFeeData } = useQuery<{ value: string }>({
    queryKey: ["/api/settings/service-fee"],
  });

  const firstRestaurantId = items[0]?.lunchbox?.restaurantId;
  const { data: restaurant } = useQuery<Restaurant>({
    queryKey: ["/api/restaurants", firstRestaurantId],
    queryFn: async () => {
      if (!firstRestaurantId) return null;
      const res = await apiRequest("GET", `/api/restaurants/${firstRestaurantId}`);
      return res.json();
    },
    enabled: !!firstRestaurantId,
  });

  const userDeliveryLocation = deliveryLocations?.find(loc => loc.name === selectedLocation);

  const { data: allDeliveryBuildings } = useQuery<DeliveryBuilding[]>({
    queryKey: ["/api/delivery-buildings", "location", userDeliveryLocation?.id],
    queryFn: async () => {
      if (!userDeliveryLocation?.id) return [];
      const res = await apiRequest("GET", `/api/delivery-buildings/location/${userDeliveryLocation.id}`);
      return res.json();
    },
    enabled: !!userDeliveryLocation?.id,
  });

  const deliveryBuildings = allDeliveryBuildings?.filter(building => {
    return items.every(item => 
      item.lunchbox.deliveryBuildingIds?.includes(building.id)
    );
  }) || [];

  // Redirect if cart is empty
  if (items.length === 0) {
    setLocation("/");
    return null;
  }

  // Check if profile is complete before allowing checkout
  if (!isProfileComplete(user)) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto p-8 space-y-6">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            className="mb-4"
            data-testid="button-back-home"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Menu
          </Button>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="w-5 h-5" />
                <span>Complete Your Profile</span>
              </CardTitle>
              <CardDescription>
                {getProfileCompletionMessage()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  To proceed with your order, please provide the following information:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>Full Name</li>
                  <li>Phone Number</li>
                </ul>
                <Button 
                  onClick={() => setLocation("/profile")}
                  className="w-full"
                  data-testid="button-complete-profile"
                >
                  Complete Profile
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Group items by restaurant
  const itemsByRestaurant = items.reduce((acc, item) => {
    const restaurantName = item.restaurantName;
    if (!acc[restaurantName]) {
      acc[restaurantName] = [];
    }
    acc[restaurantName].push(item);
    return acc;
  }, {} as Record<string, typeof items>);

  // Check if items are from multiple restaurants
  const restaurantNames = Object.keys(itemsByRestaurant);
  const isMultiRestaurant = restaurantNames.length > 1;

  // Get available delivery days from cart items
  const availableDeliveryDays = useMemo(() => 
    Array.from(
      new Set(
        items.flatMap(item => item.lunchbox.availableDays || [])
      )
    ).sort((a, b) => {
      const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      return dayOrder.indexOf(a.toLowerCase()) - dayOrder.indexOf(b.toLowerCase());
    }), [items]
  );

  // Set default delivery day if not selected
  useEffect(() => {
    if (!selectedDeliveryDay && availableDeliveryDays.length > 0) {
      setSelectedDeliveryDay(availableDeliveryDays[0]);
    }
  }, [selectedDeliveryDay, availableDeliveryDays]);

  // Calculate service fee, discount, and totals
  const serviceFee = parseFloat(serviceFeeData?.value || "2.00");
  
  // Calculate discount
  let discount = 0;
  if (restaurant?.discountType && restaurant?.discountValue) {
    const discountVal = parseFloat(restaurant.discountValue);
    if (restaurant.discountType === "percentage") {
      discount = (subtotal * discountVal) / 100;
    } else if (restaurant.discountType === "flat") {
      discount = discountVal;
    }
  }

  // Calculate final amounts
  const subtotalAfterDiscount = Math.max(0, subtotal - discount);
  const taxRate = 0.10;
  const tax = subtotalAfterDiscount * taxRate;
  
  // For pickup: delivery fee and service fee are $0
  const finalDeliveryFee = isPickup ? 0 : deliveryFee;
  const finalServiceFee = isPickup ? 0 : serviceFee;
  
  const total = subtotalAfterDiscount + finalDeliveryFee + finalServiceFee + tax;

  // Create payment intent when component mounts (only for delivery, not pickup)
  useEffect(() => {
    if (total > 0 && !isPickup) {
      apiRequest("POST", "/api/create-payment-intent", { amount: total })
        .then((res) => res.json())
        .then((data) => {
          setClientSecret(data.clientSecret);
        })
        .catch((error) => {
          toast({
            title: "Payment Setup Failed",
            description: "Unable to initialize payment. Please try again.",
            variant: "destructive",
          });
        });
    }
  }, [total, toast, isPickup]);

  const handleOrderSuccess = () => {
    clearCart();
    // Invalidate orders cache to show the new order
    queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    toast({
      title: "Order Placed Successfully!",
      description: "Your lunchbox order has been confirmed and is being prepared.",
    });
    setLocation("/orders");
  };

  // Validate that all items are eligible for selected delivery day and building
  const validateCheckout = () => {
    if (!selectedDeliveryDay || !selectedDeliveryBuilding) {
      return { valid: false, message: "Please select delivery day and building" };
    }

    const ineligibleItems = items.filter(item => {
      const dayEligible = item.lunchbox.availableDays?.includes(selectedDeliveryDay);
      const buildingEligible = item.lunchbox.deliveryBuildingIds?.includes(selectedDeliveryBuilding);
      return !dayEligible || !buildingEligible;
    });

    if (ineligibleItems.length > 0) {
      const itemNames = ineligibleItems.map(i => i.lunchbox.name).join(", ");
      return { 
        valid: false, 
        message: `The following items are not available for selected delivery day/building: ${itemNames}. Please remove them from cart.` 
      };
    }

    return { valid: true, message: "" };
  };

  const checkoutValidation = validateCheckout();

  const getOrderData = () => {
    const firstRestaurantItems = Object.values(itemsByRestaurant)[0];
    const restaurantId = firstRestaurantItems[0].lunchbox.restaurantId;

    return {
      restaurantId,
      subtotal: subtotal.toFixed(2),
      deliveryFee: finalDeliveryFee.toFixed(2),
      serviceFee: finalServiceFee.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      deliveryLocation: selectedLocation,
      deliveryBuildingId: selectedDeliveryBuilding,
      deliveryDay: selectedDeliveryDay,
      isPickup: isPickup,
      discount: discount.toFixed(2),
      items: firstRestaurantItems.map(item => ({
        lunchboxId: item.lunchbox.id,
        quantity: item.quantity,
        price: item.lunchbox.price,
      })),
    };
  };

  // Add mutation for pickup orders (no payment)
  const createPickupOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const res = await apiRequest("POST", "/api/orders", orderData);
      return res.json();
    },
    onSuccess: handleOrderSuccess,
    onError: (error: Error) => {
      toast({
        title: "Order Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePlacePickupOrder = () => {
    const validation = validateCheckout();
    if (!validation.valid) {
      toast({
        title: "Checkout Error",
        description: validation.message,
        variant: "destructive",
      });
      return;
    }
    createPickupOrderMutation.mutate(getOrderData());
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setLocation("/")}
                data-testid="button-back-to-home"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-xl font-bold text-foreground">Checkout</h1>
            </div>
            <div className="flex items-center space-x-2">
              <ShoppingBag className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">{items.length} items</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Details */}
          <div className="space-y-6">
            {/* Delivery Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="w-5 h-5" />
                  <span>Delivery Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>Delivery Location</Label>
                    <div className="mt-2 p-3 bg-muted rounded-lg">
                      <span className="font-medium text-foreground">{selectedLocation}</span>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="delivery-building">Delivery Building</Label>
                    <Select value={selectedDeliveryBuilding} onValueChange={setSelectedDeliveryBuilding}>
                      <SelectTrigger className="mt-2" data-testid="select-delivery-building">
                        <Building2 className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Select delivery building" />
                      </SelectTrigger>
                      <SelectContent>
                        {deliveryBuildings?.map(building => (
                          <SelectItem key={building.id} value={building.id}>
                            {building.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="delivery-day">Delivery Day</Label>
                    <Select value={selectedDeliveryDay} onValueChange={setSelectedDeliveryDay}>
                      <SelectTrigger className="mt-2" data-testid="select-delivery-day">
                        <Calendar className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Select delivery day" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDeliveryDays.map(day => (
                          <SelectItem key={day} value={day}>
                            {day.charAt(0).toUpperCase() + day.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">Estimated Delivery - Before 12:30PM at Building Reception</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Method or Place Order */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CreditCard className="w-5 h-5" />
                  <span>{isPickup ? "Confirm Order" : "Payment Information"}</span>
                </CardTitle>
                <CardDescription>
                  {isPickup 
                    ? "Review and place your pickup order" 
                    : "Enter your payment details to complete the order"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isMultiRestaurant ? (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      ⚠️ You have items from multiple restaurants. Please place separate orders for each restaurant.
                    </p>
                  </div>
                ) : !checkoutValidation.valid ? (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">
                      ⚠️ {checkoutValidation.message}
                    </p>
                  </div>
                ) : isPickup ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        Your order will be ready for pickup at the restaurant. Please pay ${total.toFixed(2)} when you collect your order.
                      </p>
                    </div>
                    <Button 
                      onClick={handlePlacePickupOrder} 
                      disabled={createPickupOrderMutation.isPending}
                      className="w-full" 
                      size="lg"
                      data-testid="button-place-pickup-order"
                    >
                      {createPickupOrderMutation.isPending ? "Placing Order..." : "Place Order"}
                    </Button>
                  </div>
                ) : clientSecret ? (
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <PaymentForm 
                      onOrderSuccess={handleOrderSuccess}
                      orderData={getOrderData()}
                      total={total}
                    />
                  </Elements>
                ) : (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Setting up payment...
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="space-y-6">
            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
                <CardDescription>Review your items before placing the order</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(itemsByRestaurant).map(([restaurantName, restaurantItems]) => (
                    <div key={restaurantName}>
                      <h4 className="font-medium text-foreground mb-2">{restaurantName}</h4>
                      <div className="space-y-3">
                        {restaurantItems.map(item => (
                          <div key={item.lunchbox.id} className="flex items-center space-x-3" data-testid={`checkout-item-${item.lunchbox.id}`}>
                            <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                              <span className="text-xs">{item.quantity}x</span>
                            </div>
                            <div className="flex-1">
                              <h5 className="text-sm font-medium text-foreground">{item.lunchbox.name}</h5>
                              <p className="text-xs text-muted-foreground">${item.lunchbox.price} each</p>
                              {item.lunchbox.dietaryTags && item.lunchbox.dietaryTags.length > 0 && (
                                <div className="flex space-x-1 mt-1">
                                  {item.lunchbox.dietaryTags.map(tag => (
                                    <Badge key={tag} variant="outline" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <span className="text-sm font-medium text-primary">
                              ${(parseFloat(item.lunchbox.price) * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {Object.keys(itemsByRestaurant).length > 1 && <Separator className="mt-4" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Pickup Option */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex flex-col">
                    <Label htmlFor="pickup-toggle" className="cursor-pointer font-medium">Pickup Order</Label>
                    <span className="text-xs text-muted-foreground">Pick up at restaurant & pay on site</span>
                  </div>
                  <Switch
                    id="pickup-toggle"
                    checked={isPickup}
                    onCheckedChange={setIsPickup}
                    data-testid="switch-pickup"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Order Total */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium" data-testid="checkout-subtotal">${subtotal.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount {restaurant?.discountType === "percentage" ? `(${restaurant.discountValue}%)` : ""}</span>
                      <span data-testid="checkout-discount">-${discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery Fee</span>
                    <span className="font-medium" data-testid="checkout-delivery-fee">${finalDeliveryFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Service Fee</span>
                    <span className="font-medium" data-testid="checkout-service-fee">${finalServiceFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="font-medium" data-testid="checkout-tax">${tax.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-primary" data-testid="checkout-total">${total.toFixed(2)}</span>
                  </div>
                  {isPickup && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Pay ${total.toFixed(2)} at the restaurant when you pick up your order.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}