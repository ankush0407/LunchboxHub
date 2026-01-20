import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Package, Clock, CheckCircle, XCircle, Receipt } from "lucide-react";
import { format } from "date-fns";
import Header from "@/components/layout/header";
import type { Order } from "@shared/schema";

export default function Orders() {
  const { user } = useAuth();
  
  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4" />;
      case "confirmed":
        return <Package className="w-4 h-4" />;
      case "delivered":
        return <CheckCircle className="w-4 h-4" />;
      case "cancelled":
        return <XCircle className="w-4 h-4" />;
      default:
        return <Receipt className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "confirmed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "delivered":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-4xl mx-auto p-8 space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground">My Orders</h1>
            <p className="text-muted-foreground">Track your order history and current deliveries</p>
          </div>

          {!orders || orders.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Receipt className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Orders Yet</h3>
                <p className="text-muted-foreground text-center">
                  You haven't placed any orders yet. Start browsing restaurants to place your first order!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => (
                <Card key={order.id} data-testid={`order-card-${order.id}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center space-x-2">
                        <Receipt className="w-5 h-5" />
                        <span>Order #{(order as any).orderNumber || order.id.slice(0, 8)}</span>
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline"
                          className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                        >
                          {(order as any).isPickup ? "Pickup" : "Online"}
                        </Badge>
                        <Badge 
                          className={`flex items-center space-x-1 ${getStatusColor(order.status)}`}
                          data-testid={`order-status-${order.id}`}
                        >
                          {getStatusIcon(order.status)}
                          <span className="capitalize">{order.status}</span>
                        </Badge>
                      </div>
                    </div>
                    <CardDescription>
                      Placed on {format(new Date(order.createdAt || Date.now()), "PPP 'at' p")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {user?.role === "customer" && (
                          <div>
                            <h4 className="font-medium text-foreground mb-1">Restaurant</h4>
                            <p className="text-muted-foreground" data-testid={`order-restaurant-${order.id}`}>
                              {(order as any).restaurant?.name || order.restaurantId}
                            </p>
                          </div>
                        )}
                        <div>
                          <h4 className="font-medium text-foreground mb-1">Total Amount</h4>
                          <p className="text-lg font-semibold text-foreground" data-testid={`order-total-${order.id}`}>
                            ${parseFloat(order.total).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground mb-1">Order Type</h4>
                          <p className="text-muted-foreground">
                            {(order as any).isPickup ? "Pickup" : "Online"}
                          </p>
                        </div>
                      </div>
                      
                      <Separator />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium text-foreground mb-1">Delivery Location</h4>
                          <p className="text-muted-foreground" data-testid={`order-address-${order.id}`}>
                            {order.deliveryLocation}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1" data-testid={`order-building-${order.id}`}>
                            Building: {(order as any).deliveryBuilding?.name || 'N/A'}
                          </p>
                        </div>
                        {(order as any).deliveryDay && (
                          <div>
                            <h4 className="font-medium text-foreground mb-1">Delivery Day</h4>
                            <p className="text-muted-foreground capitalize" data-testid={`order-delivery-day-${order.id}`}>
                              {(order as any).deliveryDay}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {(order as any).items && (order as any).items.length > 0 && (
                        <>
                          <Separator />
                          <div>
                            <h4 className="font-medium text-foreground mb-2">Items Ordered</h4>
                            <div className="space-y-2">
                              {(order as any).items.map((item: any) => (
                                <div key={item.id} className="flex justify-between items-center p-2 bg-muted rounded-lg">
                                  <div>
                                    <span className="font-medium">{item.lunchbox?.name || 'Item'}</span>
                                    <span className="text-muted-foreground ml-2">×{item.quantity}</span>
                                  </div>
                                  <span className="font-medium">${parseFloat(item.price).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
  );
}