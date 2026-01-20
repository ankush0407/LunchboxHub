import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Store, Upload, User, DollarSign, Save, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import type { Restaurant } from "@shared/schema";
import Header from "@/components/layout/header";
import { CartProvider } from "@/hooks/use-cart";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { UploadResult } from "@uppy/core";

const restaurantProfileSchema = z.object({
  name: z.string().min(1, "Restaurant name is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  cuisine: z.string().min(1, "Cuisine type is required"),
  imageUrl: z.string().optional().or(z.literal("")),
  deliveryFee: z.string().min(1, "Delivery fee is required"),
  deliveryLocationId: z.string().min(1, "Delivery location is required"),
  orderTypes: z.string().default("both"),
  // Owner information fields
  ownerFullName: z.string().min(1, "Full name is required"),
  ownerPhoneNumber: z.string().optional(),
});

type RestaurantProfileFormData = z.infer<typeof restaurantProfileSchema>;

export default function RestaurantProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const restaurantInitialized = useRef(false);
  const userInitialized = useRef(false);

  // Fetch restaurant data for the current user
  const { data: restaurant, isLoading: restaurantLoading } = useQuery<Restaurant>({
    queryKey: ["/api/restaurants/owner", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/restaurants/owner/${user?.id}`);
      return await res.json();
    },
    enabled: !!user?.id,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch delivery locations
  const { data: deliveryLocations } = useQuery({
    queryKey: ["/api/delivery-locations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/delivery-locations");
      return await res.json();
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const form = useForm<RestaurantProfileFormData>({
    resolver: zodResolver(restaurantProfileSchema),
    defaultValues: {
      name: "",
      description: "",
      cuisine: "",
      imageUrl: "",
      deliveryFee: "",
      deliveryLocationId: "",
      orderTypes: "both",
      ownerFullName: "",
      ownerPhoneNumber: "",
    },
  });

  // Update form values when restaurant data loads (only once per data source)
  useEffect(() => {
    if (restaurant && !restaurantInitialized.current) {
      // Restaurant data is available - populate all fields
      form.reset({
        name: restaurant.name || "",
        description: restaurant.description || "",
        cuisine: restaurant.cuisine || "",
        imageUrl: restaurant.imageUrl || "",
        deliveryFee: restaurant.deliveryFee || "",
        deliveryLocationId: restaurant.deliveryLocationId || "",
        orderTypes: (restaurant as any).orderTypes || "both",
        ownerFullName: user?.fullName || "",
        ownerPhoneNumber: user?.phoneNumber || "",
      });
      setLogoUrl(restaurant.imageUrl || "");
      restaurantInitialized.current = true;
      userInitialized.current = true; // Mark user as initialized too
    } else if (user && !restaurant && !userInitialized.current) {
      // No restaurant yet, but user info available - prefill owner information
      const currentValues = form.getValues();
      form.reset({
        ...currentValues,
        ownerFullName: user.fullName || "",
        ownerPhoneNumber: user.phoneNumber || "",
      });
      userInitialized.current = true;
    }
  }, [restaurant, user]); // Removed 'form' from dependencies to prevent re-renders on input changes

  // Sync logoUrl with form when it changes (non-blocking to prevent re-renders during typing)
  useEffect(() => {
    if (logoUrl) {
      form.setValue("imageUrl", logoUrl, { shouldValidate: false, shouldDirty: false, shouldTouch: false });
    }
  }, [logoUrl]); // Only watch logoUrl changes

  const updateRestaurantMutation = useMutation({
    mutationFn: async (data: RestaurantProfileFormData) => {
      // First update user profile with owner information
      const userUpdateData = {
        fullName: data.ownerFullName,
        phoneNumber: data.ownerPhoneNumber,
      };
      await apiRequest("PUT", "/api/profile", userUpdateData);
      
      // Then update restaurant data
      const endpoint = restaurant ? `/api/restaurants/${restaurant.id}` : "/api/restaurants";
      const method = restaurant ? "PUT" : "POST";
      
      const restaurantData = {
        name: data.name,
        description: data.description,
        cuisine: data.cuisine,
        imageUrl: data.imageUrl,
        deliveryFee: data.deliveryFee,
        deliveryLocationId: data.deliveryLocationId,
        orderTypes: data.orderTypes,
        ownerId: user?.id,
      };

      const res = await apiRequest(method, endpoint, restaurantData);
      return await res.json();
    },
    onSuccess: (updatedRestaurant) => {
      queryClient.setQueryData(["/api/restaurants/owner", user?.id], updatedRestaurant);
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants"] });
      toast({
        title: restaurant ? "Restaurant Updated" : "Restaurant Created",
        description: restaurant 
          ? "Your restaurant profile has been updated successfully."
          : "Your restaurant has been created successfully.",
      });
      setIsCreating(false);
    },
    onError: (error: Error) => {
      toast({
        title: restaurant ? "Update Failed" : "Creation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: RestaurantProfileFormData) => {
    try {
      await updateRestaurantMutation.mutateAsync(data);
    } catch (error) {
      // Error handled by mutation onError
    }
  };

  if (restaurantLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  const cuisineOptions = [
    "American", "Asian", "Chinese", "Italian", "Mexican", "Indian", 
    "Japanese", "Thai", "Mediterranean", "French", "Greek", "Korean", 
    "Vietnamese", "Middle Eastern", "German", "Spanish", "Other"
  ];

  return (
    <CartProvider>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-3xl mx-auto space-y-8 p-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground">Restaurant Profile</h1>
            <p className="text-muted-foreground">
              {restaurant ? "Update your restaurant information" : "Create your restaurant profile"}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Store className="w-5 h-5" />
                <span>Restaurant Information</span>
              </CardTitle>
              <CardDescription>
                Manage your restaurant details that customers will see
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center space-x-2">
                          <Store className="w-4 h-4" />
                          <span>Restaurant Name</span>
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter your restaurant name" 
                            {...field} 
                            data-testid="input-restaurant-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Restaurant Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe your restaurant, specialties, and what makes you unique..."
                            className="min-h-[100px]"
                            {...field} 
                            data-testid="input-restaurant-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cuisine"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cuisine Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-restaurant-cuisine">
                              <SelectValue placeholder="Select cuisine type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {cuisineOptions.map((cuisine) => (
                              <SelectItem key={cuisine} value={cuisine.toLowerCase()}>
                                {cuisine}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="deliveryFee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center space-x-2">
                          <DollarSign className="w-4 h-4" />
                          <span>Delivery Fee</span>
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., 2.99" 
                            type="number"
                            step="0.01"
                            {...field} 
                            data-testid="input-restaurant-delivery-fee"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="deliveryLocationId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery Location</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-delivery-location">
                              <SelectValue placeholder="Select delivery location" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {deliveryLocations?.map((location: any) => (
                              <SelectItem key={location.id} value={location.id}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{location.name}</span>
                                  <span className="text-sm text-muted-foreground">{location.address}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="orderTypes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Accepted Order Types</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-order-types">
                              <SelectValue placeholder="Select order types" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="both">Both (Online & Pickup)</SelectItem>
                            <SelectItem value="online_only">Online Delivery Only</SelectItem>
                            <SelectItem value="pickup_only">Pickup Only</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground mt-1">
                          Choose which order types your restaurant accepts
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4">
                    <div>
                      <Label className="flex items-center space-x-2 mb-2">
                        <ImageIcon className="w-4 h-4" />
                        <span>Restaurant Logo</span>
                      </Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        Upload a square logo (recommended: 400x400px, max 5MB). This will be displayed on your restaurant profile.
                      </p>
                      
                      {logoUrl && (
                        <div className="mb-4">
                          <img 
                            src={logoUrl} 
                            alt="Restaurant logo" 
                            className="w-32 h-32 object-cover rounded-lg border"
                            data-testid="img-restaurant-logo"
                          />
                        </div>
                      )}
                      
                      <ObjectUploader
                        maxNumberOfFiles={1}
                        maxFileSize={5242880}
                        onGetUploadParameters={async () => {
                          const res = await apiRequest("POST", "/api/objects/upload-public");
                          const data = await res.json();
                          return { method: "PUT" as const, url: data.uploadURL };
                        }}
                        onComplete={(result) => {
                          if (result.successful && result.successful.length > 0) {
                            const uploadedFile = result.successful[0];
                            const rawUrl = uploadedFile.uploadURL?.split('?')[0] || "";
                            const imageUrl = rawUrl.startsWith("https://storage.googleapis.com/") 
                              ? `/public-objects/${rawUrl.split('/').slice(-1)[0]}` 
                              : rawUrl;
                            setLogoUrl(imageUrl);
                            toast({
                              title: "Logo uploaded successfully",
                              description: "Your restaurant logo has been updated.",
                            });
                          }
                        }}
                        buttonClassName="w-full sm:w-auto"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {logoUrl ? "Change Logo" : "Upload Logo"}
                      </ObjectUploader>
                    </div>
                  </div>

                  {/* Owner Information Section */}
                  <div className="pt-6 border-t">
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold flex items-center space-x-2">
                        <User className="w-5 h-5" />
                        <span>Owner Information</span>
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Update your contact information as restaurant owner
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="ownerFullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter your full name" 
                                {...field} 
                                data-testid="input-owner-fullname"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="ownerPhoneNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter your phone number" 
                                {...field} 
                                data-testid="input-owner-phone"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Email Address</Label>
                        <p className="text-foreground mt-1" data-testid="text-owner-email">
                          {user?.email} <span className="text-muted-foreground text-sm">(Cannot be changed here)</span>
                        </p>
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Account Type</Label>
                        <p className="text-foreground capitalize mt-1" data-testid="text-owner-role">
                          Restaurant Owner
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6">
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={updateRestaurantMutation.isPending}
                      data-testid="button-restaurant-save"
                    >
                      {updateRestaurantMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Save className="mr-2 h-4 w-4" />
                      {restaurant ? "Update Restaurant & Owner Info" : "Create Restaurant & Save Owner Info"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </CartProvider>
  );
}