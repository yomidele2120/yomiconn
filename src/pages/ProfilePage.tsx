import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTransactionPin } from "@/hooks/useTransactionPin";
import {
  Loader2, User, Lock, ShieldCheck, ChevronRight, LogOut, Bell,
  HelpCircle, FileText, MessageCircle, X, Mail, Phone, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent } from "@/components/ui/sheet";

function initials(name?: string | null, email?: string | null) {
  if (name) return name.split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
  if (email) return email[0].toUpperCase();
  return "U";
}

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [editOpen, setEditOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pinSaving, setPinSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");

  const { hasPin, setPin, resetPin } = useTransactionPin();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles").select("*").eq("user_id", user!.id).single();
      if (error) throw error;
      setFullName(data.full_name || "");
      setPhone(data.phone || "");
      return data;
    },
    enabled: !!user,
  });

  const displayName = profile?.full_name || (user?.user_metadata as any)?.full_name || user?.email?.split("@")[0] || "Account";

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles")
        .update({ full_name: fullName, phone }).eq("user_id", user!.id);
      if (error) throw error;
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setEditOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to update profile");
    } finally { setSaving(false); }
  };

  const handlePinSubmit = async () => {
    if (newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
      toast.error("PIN must be 4-6 digits"); return;
    }
    if (newPin !== confirmNewPin) { toast.error("PINs do not match"); return; }
    setPinSaving(true);
    try {
      if (hasPin) {
        if (!currentPin) { toast.error("Enter your current PIN"); return; }
        await resetPin(currentPin, newPin);
        toast.success("PIN changed");
      } else {
        await setPin(newPin);
        toast.success("Transaction PIN set");
      }
      setNewPin(""); setConfirmNewPin(""); setCurrentPin("");
      setPinOpen(false);
    } catch (e: any) {
      toast.error(e.message || "PIN operation failed");
    } finally { setPinSaving(false); }
  };

  return (
    <DashboardLayout>
      {/* Hero */}
      <div className="rounded-3xl wallet-gradient text-white p-5 shadow-premium relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-12 -left-8 w-36 h-36 rounded-full bg-white/5 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur border-2 border-white/40 flex items-center justify-center text-xl font-bold">
            {initials(displayName, user?.email)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[17px] font-bold truncate">{displayName}</p>
            <p className="text-white/75 text-xs truncate">{user?.email}</p>
            <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 backdrop-blur text-[10px] font-semibold">
              <CheckCircle2 className="w-3 h-3" /> Verified
            </div>
          </div>
        </div>
        <button onClick={() => setEditOpen(true)}
          className="mt-4 w-full h-10 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur text-white text-sm font-semibold transition active:scale-[0.99]">
          Edit Profile
        </button>
      </div>

      {/* Quick info */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <InfoTile icon={Mail} label="Email" value={user?.email || "—"} />
        <InfoTile icon={Phone} label="Phone" value={profile?.phone || "Not set"} />
      </div>

      {/* Account */}
      <SectionTitle>Account</SectionTitle>
      <Group>
        <Row icon={User} label="Personal Information" onClick={() => setEditOpen(true)} />
        <Row icon={Lock} label="Transaction PIN"
          hint={hasPin ? "Set" : "Not set"}
          hintTone={hasPin ? "success" : "warning"}
          onClick={() => setPinOpen(true)} />
        <Row icon={Bell} label="Notifications" onClick={() => navigate("/notifications")} />
      </Group>

      {/* Support */}
      <SectionTitle>Support</SectionTitle>
      <Group>
        <Row icon={MessageCircle} label="Help Center" onClick={() => toast.info("Coming soon")} />
        <Row icon={FileText} label="Terms & Privacy" onClick={() => toast.info("Coming soon")} />
        <Row icon={HelpCircle} label="About YomiConnect" onClick={() => toast.info("v1.0 · YomiConnect")} />
      </Group>

      {/* Sign out */}
      <button
        onClick={async () => { await signOut(); navigate("/auth"); }}
        className="mt-5 w-full h-12 rounded-2xl bg-card border border-destructive/30 text-destructive font-semibold flex items-center justify-center gap-2 hover:bg-destructive/5 transition active:scale-[0.99]">
        <LogOut className="w-4 h-4" /> Sign Out
      </button>

      <p className="text-center text-[11px] text-muted-foreground mt-5">YomiConnect · v1.0</p>

      {/* Edit profile sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="bottom" className="rounded-t-[28px] border-0 p-0 max-h-[85vh] overflow-y-auto">
          <div className="mx-auto w-10 h-1.5 rounded-full bg-muted my-3" />
          <div className="px-5 pb-7">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">Edit Profile</h3>
              <button onClick={() => setEditOpen(false)} className="p-1.5 rounded-full hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <Field label="Email">
                <input value={user?.email || ""} disabled
                  className="w-full h-12 px-4 rounded-xl bg-muted/50 text-muted-foreground text-sm" />
              </Field>
              <Field label="Full name">
                <input value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full h-12 px-4 rounded-xl bg-card border border-border text-sm focus:outline-none focus:border-primary" />
              </Field>
              <Field label="Phone number">
                <input type="tel" value={phone} maxLength={11}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder="08012345678"
                  className="w-full h-12 px-4 rounded-xl bg-card border border-border text-sm focus:outline-none focus:border-primary" />
              </Field>
              <button onClick={handleSave} disabled={saving}
                className="w-full h-12 mt-2 rounded-xl wallet-gradient text-white font-semibold shadow-premium flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.99]">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save Changes
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* PIN sheet */}
      <Sheet open={pinOpen} onOpenChange={setPinOpen}>
        <SheetContent side="bottom" className="rounded-t-[28px] border-0 p-0 max-h-[85vh] overflow-y-auto">
          <div className="mx-auto w-10 h-1.5 rounded-full bg-muted my-3" />
          <div className="px-5 pb-7">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">{hasPin ? "Change Transaction PIN" : "Set Transaction PIN"}</h3>
              <button onClick={() => setPinOpen(false)} className="p-1.5 rounded-full hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-muted/40">
              <ShieldCheck className={`w-4 h-4 ${hasPin ? "text-success" : "text-warning"}`} />
              <span className="text-xs text-muted-foreground">
                {hasPin ? "PIN is active — required for every purchase" : "Set a 4-6 digit PIN to authorize purchases"}
              </span>
            </div>

            <div className="space-y-4">
              {hasPin && (
                <Field label="Current PIN">
                  <input type="password" inputMode="numeric" maxLength={6} placeholder="••••"
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
                    className="w-full h-12 px-4 rounded-xl bg-card border border-border tracking-[0.5em] text-center text-lg focus:outline-none focus:border-primary" />
                </Field>
              )}
              <Field label={hasPin ? "New PIN" : "Choose PIN"}>
                <input type="password" inputMode="numeric" maxLength={6} placeholder="4-6 digits"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                  className="w-full h-12 px-4 rounded-xl bg-card border border-border tracking-[0.5em] text-center text-lg focus:outline-none focus:border-primary" />
              </Field>
              <Field label="Confirm PIN">
                <input type="password" inputMode="numeric" maxLength={6} placeholder="Re-enter PIN"
                  value={confirmNewPin}
                  onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ""))}
                  className="w-full h-12 px-4 rounded-xl bg-card border border-border tracking-[0.5em] text-center text-lg focus:outline-none focus:border-primary" />
              </Field>

              <button onClick={handlePinSubmit} disabled={pinSaving || newPin.length < 4}
                className="w-full h-12 mt-2 rounded-xl wallet-gradient text-white font-semibold shadow-premium flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.99]">
                {pinSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {hasPin ? "Change PIN" : "Set PIN"}
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}

function InfoTile({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-card rounded-2xl p-3 shadow-card">
      <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <p className="text-foreground text-sm font-semibold mt-1 truncate">{value}</p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="label-eyebrow mt-6 mb-2 px-1">{children}</p>;
}

function Group({ children }: { children: React.ReactNode }) {
  return <div className="bg-card rounded-2xl shadow-card divide-y divide-border overflow-hidden">{children}</div>;
}

function Row({ icon: Icon, label, hint, hintTone, onClick }: {
  icon: any; label: string; hint?: string; hintTone?: "success" | "warning"; onClick?: () => void;
}) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition text-left">
      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
        <Icon className="w-4 h-4" />
      </div>
      <span className="flex-1 text-sm font-semibold text-foreground">{label}</span>
      {hint && (
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
          hintTone === "success" ? "bg-success/12 text-success" : "bg-warning/15 text-warning"
        }`}>{hint}</span>
      )}
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  );
}
