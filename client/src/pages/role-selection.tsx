import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Utensils, Store, Users } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function RoleSelectionPage() {
  const [, setLocation] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if user doesn't exist or profile is already complete
  if (!user || user.profileComplete) {
    setLocation("/");
    return null;
  }

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      setLocation("/auth");
    } catch (error) {
      toast({
        title: "Error logging out",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRoleSubmit = async () => {
    if (!selectedRole) {
      toast({
        title: "Please select a role",
        description: "You need to choose an account type to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/complete-profile", {
        role: selectedRole,
      });

      // Update the user in cache
      queryClient.setQueryData(["/api/user"], {
        ...user,
        role: selectedRole,
        profileComplete: true,
      });

      toast({
        title: "Profile completed!",
        description: "Welcome to LunchBox. You can now start using the platform.",
      });

      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Error updating profile",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleOptions = [
    {
      value: "customer",
      label: "Customer",
      description: "Order delicious lunchboxes from restaurants",
      icon: Users,
    },
    {
      value: "restaurant_owner",
      label: "Restaurant Owner",
      description: "Manage your restaurant and create lunchbox menus",
      icon: Store,
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center relative">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Utensils className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground">LunchBox</span>
          </div>
          <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
          <CardDescription>
            Welcome {user.username}! Please select your account type to get started.
          </CardDescription>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
            className="absolute top-4 right-4"
            data-testid="button-logout"
          >
            Log Out
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Label htmlFor="role-select" className="text-base font-medium">
              Choose your account type:
            </Label>
            <Select onValueChange={setSelectedRole} data-testid="select-role">
              <SelectTrigger id="role-select">
                <SelectValue placeholder="Select account type" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center space-x-2">
                      <option.icon className="w-4 h-4" />
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Role descriptions */}
            <div className="grid gap-4 mt-4">
              {roleOptions.map((option) => (
                <div
                  key={option.value}
                  className={`p-4 border rounded-lg transition-colors ${
                    selectedRole === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <option.icon className="w-5 h-5 mt-0.5 text-primary" />
                    <div>
                      <h3 className="font-medium">{option.label}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {option.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={handleRoleSubmit}
            disabled={!selectedRole || isSubmitting}
            className="w-full"
            data-testid="button-complete-profile"
          >
            {isSubmitting ? "Setting up your account..." : "Complete Profile"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}