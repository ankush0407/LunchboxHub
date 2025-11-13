import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "lucide-react";

interface WeeklyMenuModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lunchboxName: string;
  weeklyMenu?: {
    monday?: string;
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
  };
}

export function WeeklyMenuModal({ open, onOpenChange, lunchboxName, weeklyMenu }: WeeklyMenuModalProps) {
  const days = [
    { key: "monday", label: "Monday" },
    { key: "tuesday", label: "Tuesday" },
    { key: "wednesday", label: "Wednesday" },
    { key: "thursday", label: "Thursday" },
    { key: "friday", label: "Friday" },
    { key: "saturday", label: "Saturday" },
    { key: "sunday", label: "Sunday" },
  ];

  const hasMenu = weeklyMenu && Object.values(weeklyMenu).some(menu => menu && menu.trim() !== "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="weekly-menu-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Weekly Menu - {lunchboxName}
          </DialogTitle>
          <DialogDescription>
            View the complete weekly menu for this lunchbox
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-4">
          {!hasMenu ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No weekly menu available for this lunchbox.
            </p>
          ) : (
            days.map(({ key, label }) => {
              const menu = weeklyMenu?.[key as keyof typeof weeklyMenu];
              if (!menu || menu.trim() === "") return null;

              return (
                <div 
                  key={key} 
                  className="border rounded-lg p-3 bg-card hover:bg-accent/50 transition-colors"
                  data-testid={`weekly-menu-day-${key}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-lg font-semibold text-primary">
                          {label.slice(0, 3)}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm mb-1">{label}</h4>
                      <p className="text-sm text-muted-foreground" data-testid={`weekly-menu-content-${key}`}>
                        {menu}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
