import { useState } from "react";
import { Lunchbox } from "@shared/schema";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { isProfileComplete, getProfileCompletionMessage } from "@/lib/profile-utils";
import { Utensils, Plus, Calendar } from "lucide-react";
import { useLocation } from "wouter";
import { WeeklyMenuModal } from "./weekly-menu-modal";

interface LunchboxCardProps {
  lunchbox: Lunchbox;
  restaurantName: string;
  restaurantDeliveryFee: number;
}

export default function LunchboxCard({ lunchbox, restaurantName, restaurantDeliveryFee }: LunchboxCardProps) {
  const { addItem } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showWeeklyMenu, setShowWeeklyMenu] = useState(false);

  const hasWeeklyMenu = lunchbox.weeklyMenu && Object.values(lunchbox.weeklyMenu).some(menu => menu && menu.trim() !== "");

  const handleAddToCart = () => {
    if (!lunchbox.isAvailable) {
      toast({
        title: "Item Unavailable",
        description: "This lunchbox is currently not available.",
        variant: "destructive",
      });
      return;
    }

    // Check if user profile is complete before adding to cart
    if (!isProfileComplete(user)) {
      toast({
        title: "Complete Your Profile",
        description: getProfileCompletionMessage(),
        variant: "destructive",
        action: (
          <Button variant="outline" size="sm" onClick={() => setLocation("/profile")}>
            Complete Profile
          </Button>
        )
      });
      return;
    }

    addItem(lunchbox, restaurantName, restaurantDeliveryFee);
    toast({
      title: "Added to Cart",
      description: `${lunchbox.name} has been added to your cart.`,
    });
  };

  return (
    <div 
      className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
      data-testid={`lunchbox-card-${lunchbox.id}`}
    >
      <div className="w-full sm:w-20 h-40 sm:h-20 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
        {lunchbox.imageUrl ? (
          <img 
            src={lunchbox.imageUrl} 
            alt={lunchbox.name}
            className="w-full h-full object-cover rounded-lg"
          />
        ) : (
          <Utensils className="w-8 h-8 text-muted-foreground" />
        )}
      </div>
      
      <div className="flex-1 w-full">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex-1">
            <h4 className="font-semibold text-card-foreground" data-testid={`lunchbox-name-${lunchbox.id}`}>
              {lunchbox.name}
            </h4>
            <p className="text-sm text-muted-foreground mb-2 line-clamp-2" data-testid={`lunchbox-description-${lunchbox.id}`}>
              {lunchbox.description}
            </p>
            
            <div className="space-y-2">
              {lunchbox.dietaryTags && lunchbox.dietaryTags.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {lunchbox.dietaryTags.map(tag => (
                    <Badge 
                      key={tag} 
                      variant="outline" 
                      className="text-xs bg-accent/10 text-accent border-accent/20"
                      data-testid={`lunchbox-tag-${tag}-${lunchbox.id}`}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              
              <div className="flex items-center gap-2 flex-wrap">
                {lunchbox.availableDays && lunchbox.availableDays.length > 0 && (
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {lunchbox.availableDays.map(day => day.slice(0, 3).toUpperCase()).join(", ")}
                    </span>
                  </div>
                )}
                {hasWeeklyMenu && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-primary hover:underline"
                    onClick={() => setShowWeeklyMenu(true)}
                    data-testid={`button-view-weekly-menu-${lunchbox.id}`}
                  >
                    View Weekly Menu
                  </Button>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 sm:gap-2 w-full sm:w-auto">
            <div className="text-lg font-bold text-primary" data-testid={`lunchbox-price-${lunchbox.id}`}>
              ${lunchbox.price}
            </div>
            <Button 
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              size="sm"
              onClick={handleAddToCart}
              disabled={!lunchbox.isAvailable}
              data-testid={`button-add-to-cart-${lunchbox.id}`}
            >
              {lunchbox.isAvailable ? (
                <>
                  <Plus className="w-4 h-4 mr-1" />
                  Add to Cart
                </>
              ) : (
                "Unavailable"
              )}
            </Button>
          </div>
        </div>
      </div>

      <WeeklyMenuModal 
        open={showWeeklyMenu}
        onOpenChange={setShowWeeklyMenu}
        lunchboxName={lunchbox.name}
        weeklyMenu={lunchbox.weeklyMenu || undefined}
      />
    </div>
  );
}
