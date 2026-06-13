import DashboardLayout from "@/components/DashboardLayout";
import { BellOff } from "lucide-react";

export default function NotificationsPage() {
  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-foreground">Notifications</h1>
        <button className="text-primary text-sm font-semibold hover:underline">Mark all read</button>
      </div>

      <div className="flex flex-col items-center justify-center text-center py-24 bg-card rounded-3xl shadow-card">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <BellOff className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="text-foreground font-semibold">No notifications yet</p>
        <p className="text-muted-foreground text-sm mt-1 max-w-xs">
          Your transactions, alerts, and offers will appear here.
        </p>
      </div>
    </DashboardLayout>
  );
}
