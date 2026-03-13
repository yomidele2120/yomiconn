import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, User } from "lucide-react";
import { toast } from "sonner";

export default function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      setFullName(data.full_name || "");
      setPhone(data.phone || "");
      return data;
    },
    enabled: !!user,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone })
        .eq("user_id", user!.id);
      if (error) throw error;
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <h2 className="text-xl font-heading font-bold mb-4">Profile</h2>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-heading">
            <User className="w-5 h-5 text-primary" /> Your Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email || ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
          </div>
          <div className="space-y-2">
            <Label>Phone Number</Label>
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08012345678" maxLength={11} />
          </div>
          <Button onClick={handleSave} className="w-full" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
