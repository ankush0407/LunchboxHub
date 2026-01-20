import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Restaurant, Lunchbox, DeliveryBuilding, DeliveryLocation } from "@shared/schema";
import { useLocationContext } from "@/contexts/location-context";
import Header from "@/components/layout/header";
import ShoppingCart from "@/components/layout/shopping-cart";
import RestaurantCard from "@/components/restaurant-card";
import LunchboxCard from "@/components/lunchbox-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Filter, SortAsc, Calendar, Building2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const locations = ["Amazon SLU", "Amazon Bellevue", "Amazon Redmond"];
const cuisineTypes = ["All", "Mediterranean", "Japanese", "Italian", "American", "Vegetarian"];
const weekDays = [
  { value: "all", label: "All Days" },
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" }
];

export default function HomePage() {
  const { selectedLocation, setSelectedLocation } = useLocationContext();
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [selectedCuisine, setSelectedCuisine] = useState("All");
  const [selectedDeliveryDay, setSelectedDeliveryDay] = useState("all");
  const [selectedDeliveryBuilding, setSelectedDeliveryBuilding] = useState<string>("all");
  const [sortBy, setSortBy] = useState("featured");

  // Fetch delivery locations
  const { data: deliveryLocations } = useQuery<DeliveryLocation[]>({
    queryKey: ["/api/delivery-locations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/delivery-locations");
      return await res.json();
    },
  });

  const userDeliveryLocation = deliveryLocations?.find(loc => loc.name === selectedLocation);

  const { data: deliveryBuildings } = useQuery<DeliveryBuilding[]>({
    queryKey: ["/api/delivery-buildings", "location", userDeliveryLocation?.id],
    queryFn: async () => {
      if (!userDeliveryLocation?.id) return [];
      const res = await apiRequest("GET", `/api/delivery-buildings/location/${userDeliveryLocation.id}`);
      return res.json();
    },
    enabled: !!userDeliveryLocation?.id,
  });

  const { data: restaurants, isLoading: restaurantsLoading } = useQuery<Restaurant[]>({
    queryKey: ["/api/restaurants"],
  });

  // Fetch all lunchboxes for all restaurants to enable day-based restaurant filtering
  const { data: allLunchboxes } = useQuery<Record<string, Lunchbox[]>>({
    queryKey: ["/api/restaurants", "all-lunchboxes"],
    queryFn: async () => {
      if (!restaurants) return {};
      
      const lunchboxPromises = restaurants.map(async (restaurant) => {
        const res = await apiRequest("GET", `/api/restaurants/${restaurant.id}/lunchboxes`);
        const lunchboxes = await res.json();
        return { restaurantId: restaurant.id, lunchboxes };
      });
      
      const results = await Promise.all(lunchboxPromises);
      const lunchboxesByRestaurant: Record<string, Lunchbox[]> = {};
      
      results.forEach(({ restaurantId, lunchboxes }) => {
        lunchboxesByRestaurant[restaurantId] = lunchboxes;
      });
      
      return lunchboxesByRestaurant;
    },
    enabled: !!restaurants && restaurants.length > 0,
  });

  const { data: lunchboxes, isLoading: lunchboxesLoading } = useQuery<Lunchbox[]>({
    queryKey: ["/api/restaurants", selectedRestaurant?.id, "lunchboxes"],
    enabled: !!selectedRestaurant,
  });

  // Find selected location ID
  const selectedLocationId = deliveryLocations?.find(
    (location: any) => location.name === selectedLocation
  )?.id;

  const filteredAndSortedRestaurants = (() => {
    const filtered = restaurants?.filter(restaurant => {
      const cuisineMatch = selectedCuisine === "All" || restaurant.cuisine.toLowerCase().includes(selectedCuisine.toLowerCase());
      // Filter by delivery location - if restaurant has no location set, show it for all locations
      const locationMatch = !restaurant.deliveryLocationId || restaurant.deliveryLocationId === selectedLocationId;
      
      // Filter by delivery building - only show restaurants that have lunchboxes available for the selected building
      const buildingMatch = selectedDeliveryBuilding === "all" || (() => {
        const restaurantLunchboxes = allLunchboxes?.[restaurant.id] || [];
        return restaurantLunchboxes.some(lunchbox => 
          // Only match if the lunchbox explicitly has delivery buildings set AND includes the selected building
          lunchbox.deliveryBuildingIds && 
          lunchbox.deliveryBuildingIds.length > 0 && 
          lunchbox.deliveryBuildingIds.includes(selectedDeliveryBuilding)
        );
      })();
      
      // Filter by day availability - only show restaurants that have lunchboxes available for the selected day
      const dayMatch = selectedDeliveryDay === "all" || (() => {
        const restaurantLunchboxes = allLunchboxes?.[restaurant.id] || [];
        return restaurantLunchboxes.some(lunchbox => 
          lunchbox.availableDays?.includes(selectedDeliveryDay)
        );
      })();
      
      return cuisineMatch && locationMatch && buildingMatch && dayMatch;
    }) || [];

    // Sort restaurants based on selected sort option
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "cuisine":
          return a.cuisine.localeCompare(b.cuisine);
        case "rating":
          // For now, random sort since we don't have ratings
          return Math.random() - 0.5;
        case "newest":
          // Sort by ID as a proxy for newest (latest created)
          return b.id.localeCompare(a.id);
        default: // "featured"
          return 0; // Keep original order for featured
      }
    });
  })();

  const filteredLunchboxes = lunchboxes?.filter(lunchbox => {
    // Filter by day
    const dayMatch = selectedDeliveryDay === "all" || lunchbox.availableDays?.includes(selectedDeliveryDay);
    
    // Filter by delivery building
    const buildingMatch = selectedDeliveryBuilding === "all" || (
      lunchbox.deliveryBuildingIds && 
      lunchbox.deliveryBuildingIds.length > 0 && 
      lunchbox.deliveryBuildingIds.includes(selectedDeliveryBuilding)
    );
    
    return dayMatch && buildingMatch;
  }) || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
        
        {/* Hero Section */}
        <section className="gradient-hero py-16 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-black/40"></div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-lg mb-4">
              Fresh Lunchboxes<br />
              <span className="text-white/95 drop-shadow-lg">Delivered to Your Office</span>
            </h1>
            <p className="text-xl text-white drop-shadow-md mb-8 max-w-2xl mx-auto">
              Order from premium local restaurants and get your favorite meals delivered directly to Amazon buildings
            </p>
            
            {/* Location & Search */}
            <div className="max-w-md mx-auto bg-white rounded-xl p-2 shadow-lg">
              <div className="flex items-center space-x-2">
                <div className="flex-1 flex items-center space-x-2 px-3">
                  <MapPin className="w-5 h-5 text-primary" />
                  <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                    <SelectTrigger className="border-0 focus:ring-0 text-foreground" data-testid="select-location">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {deliveryLocations?.map((location: any) => (
                        <SelectItem key={location.id} value={location.name}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => {
                    setSelectedRestaurant(null);
                    // Scroll to restaurants section
                    const restaurantsSection = document.getElementById('restaurants-section');
                    if (restaurantsSection) {
                      restaurantsSection.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  data-testid="button-browse-restaurants"
                >
                  Browse Restaurants
                </Button>
              </div>
            </div>
          </div>
        </section>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-3">
              {/* Filters */}
              <section className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Filters</h3>
                  <div className="flex items-center space-x-4">
                    <Select value={selectedDeliveryBuilding} onValueChange={setSelectedDeliveryBuilding}>
                      <SelectTrigger className="w-[180px]" data-testid="select-delivery-building">
                        <Building2 className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="All Buildings" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Buildings</SelectItem>
                        {deliveryBuildings?.map(building => (
                          <SelectItem key={building.id} value={building.id}>
                            {building.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={selectedDeliveryDay} onValueChange={setSelectedDeliveryDay}>
                      <SelectTrigger className="w-[180px]" data-testid="select-delivery-day">
                        <Calendar className="w-4 h-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {weekDays.map(day => (
                          <SelectItem key={day.value} value={day.value}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-[180px]" data-testid="select-sort">
                        <SortAsc className="w-4 h-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="featured">Featured</SelectItem>
                        <SelectItem value="name">Name A-Z</SelectItem>
                        <SelectItem value="cuisine">Cuisine Type</SelectItem>
                        <SelectItem value="newest">Newest</SelectItem>
                        <SelectItem value="rating">Rating</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-3">Cuisine Type</h4>
                  <div className="flex flex-wrap gap-3">
                    {cuisineTypes.map(cuisine => (
                      <Badge
                        key={cuisine}
                        variant={selectedCuisine === cuisine ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={() => setSelectedCuisine(cuisine)}
                        data-testid={`badge-cuisine-${cuisine.toLowerCase()}`}
                      >
                        {cuisine}
                      </Badge>
                    ))}
                  </div>
                </div>
              </section>

              {selectedRestaurant ? (
                /* Restaurant Details */
                <section className="bg-card rounded-xl shadow-sm border border-border p-6">
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted">
                      {selectedRestaurant.imageUrl ? (
                        <img 
                          src={selectedRestaurant.imageUrl} 
                          alt={selectedRestaurant.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-2xl">🍽️</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-card-foreground">{selectedRestaurant.name}</h2>
                        <Button 
                          variant="outline" 
                          onClick={() => setSelectedRestaurant(null)}
                          data-testid="button-back-to-restaurants"
                        >
                          Back to Restaurants
                        </Button>
                      </div>
                      <p className="text-muted-foreground">{selectedRestaurant.description}</p>
                      <div className="flex items-center space-x-4 mt-2">
                        <span className="text-sm font-medium">⭐ {selectedRestaurant.rating}</span>
                        <span className="text-sm text-muted-foreground">{selectedRestaurant.deliveryTime} delivery</span>
                        <span className="text-sm text-muted-foreground">${selectedRestaurant.deliveryFee} delivery fee</span>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-card-foreground">Available Lunchboxes</h3>
                    
                    {lunchboxesLoading ? (
                      <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="flex items-center space-x-4 p-4 border border-border rounded-lg">
                            <Skeleton className="w-20 h-20 rounded-lg" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-[200px]" />
                              <Skeleton className="h-3 w-[300px]" />
                              <div className="flex space-x-2">
                                <Skeleton className="h-6 w-16" />
                                <Skeleton className="h-6 w-20" />
                              </div>
                            </div>
                            <Skeleton className="h-10 w-24" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredLunchboxes.length > 0 ? (
                          filteredLunchboxes.map(lunchbox => (
                            <LunchboxCard 
                              key={lunchbox.id} 
                              lunchbox={lunchbox} 
                              restaurantName={selectedRestaurant.name}
                              restaurantDeliveryFee={parseFloat(selectedRestaurant.deliveryFee)}
                            />
                          ))
                        ) : (
                          <div className="text-center py-8">
                            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <h4 className="text-lg font-semibold text-foreground mb-2">No lunchboxes available</h4>
                            <p className="text-muted-foreground">
                              {selectedDeliveryDay === "all" 
                                ? "This restaurant has no lunchboxes available." 
                                : `No lunchboxes available for ${weekDays.find(d => d.value === selectedDeliveryDay)?.label}.`
                              }
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              ) : (
                /* Restaurant Grid */
                <section id="restaurants-section" className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6">Featured Restaurants</h2>
                  
                  {restaurantsLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                          <Skeleton className="w-full h-48" />
                          <div className="p-4 space-y-2">
                            <Skeleton className="h-5 w-[150px]" />
                            <Skeleton className="h-4 w-[100px]" />
                            <Skeleton className="h-4 w-[200px]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {filteredAndSortedRestaurants.map(restaurant => (
                        <RestaurantCard 
                          key={restaurant.id} 
                          restaurant={restaurant} 
                          onSelect={setSelectedRestaurant}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>

            {/* Shopping Cart Sidebar */}
            <div className="lg:col-span-1">
              <ShoppingCart selectedLocation={selectedLocation} />
            </div>
          </div>
        </main>
      </div>
  );
}
