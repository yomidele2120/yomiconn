import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, User, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useTransactionPin } from "@/hooks/useTransactionPin";

export default function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  // PIN management
  const { hasPin, isLoading: pinLoading, setPin, resetPin } = useTransactionPin();
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [pinSaving, setPinSaving] = useState(false);

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

  const handlePinSubmit = async () => {
    if (newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
      toast.error("PIN must be 4-6 digits");
      return;
    }
    if (newPin !== confirmNewPin) {
      toast.error("PINs do not match");
      return;
    }

    setPinSaving(true);
    try {
      if (hasPin) {
        if (!currentPin) {
          toast.error("Enter your current PIN");
          return;
        }
        await resetPin(currentPin, newPin);
        toast.success("PIN changed successfully");
      } else {
        await setPin(newPin);
        toast.success("Transaction PIN set successfully");
      }
      setNewPin("");
      setConfirmNewPin("");
      setCurrentPin("");
    } catch (error: any) {
      toast.error(error.message || "PIN operation failed");
    } finally {
      setPinSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <h2 className="text-xl font-heading font-bold mb-4">Profile</h2>
      <div className="space-y-4">
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

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-heading">
              <Lock className="w-5 h-5 text-primary" /> Transaction PIN
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pinLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <ShieldCheck className={`w-4 h-4 ${hasPin ? 'text-accent' : 'text-muted-foreground'}`} />
                  <span className={hasPin ? 'text-accent' : 'text-muted-foreground'}>
                    {hasPin ? 'PIN is set' : 'No PIN set — required for purchases'}
                  </span>
                </div>

                {hasPin && (
                  <div className="space-y-2">
                    <Label>Current PIN</Label>
                    <Input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="••••"
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>{hasPin ? "New PIN" : "Set PIN"}</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="4-6 digits"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Confirm PIN</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Re-enter PIN"
                    value={confirmNewPin}
                    onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ""))}
                  />
                </div>

                <Button onClick={handlePinSubmit} className="w-full" disabled={pinSaving || newPin.length < 4}>
                  {pinSaving && <Loader2 className="animate-spin" />}
                  {hasPin ? "Change PIN" : "Set PIN"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
