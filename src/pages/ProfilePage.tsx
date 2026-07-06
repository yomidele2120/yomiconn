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
        <a
          href="https://wa.me/2349135134170?text=Hi%20YomiConnect%20Support%2C%20I%20need%20help"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors">
          <span className="w-9 h-9 rounded-xl bg-[#25D366]/10 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#25D366]" aria-hidden="true">
              <path d="M20.52 3.48A11.94 11.94 0 0 0 12.02 0C5.4 0 .04 5.36.04 11.98c0 2.11.55 4.17 1.6 5.99L0 24l6.2-1.62a11.96 11.96 0 0 0 5.82 1.49h.01c6.62 0 11.98-5.36 11.98-11.98 0-3.2-1.25-6.21-3.49-8.41zM12.03 21.8h-.01a9.83 9.83 0 0 1-5.01-1.37l-.36-.21-3.68.96.98-3.59-.23-.37a9.82 9.82 0 0 1-1.5-5.24c0-5.44 4.42-9.86 9.86-9.86 2.63 0 5.11 1.03 6.97 2.89a9.79 9.79 0 0 1 2.88 6.97c0 5.44-4.42 9.82-9.9 9.82zm5.4-7.36c-.29-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.29-.77.96-.94 1.16-.17.2-.35.22-.64.07-.29-.15-1.24-.46-2.36-1.46-.87-.78-1.46-1.74-1.63-2.03-.17-.29-.02-.45.13-.6.14-.13.29-.35.44-.52.15-.17.2-.29.29-.49.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.29-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.21 5.09 4.5.71.31 1.27.49 1.7.63.71.23 1.36.19 1.87.12.57-.09 1.75-.71 2-1.4.25-.7.25-1.29.17-1.4-.07-.12-.27-.19-.56-.34z"/>
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">Chat on WhatsApp</div>
            <div className="text-[11px] text-muted-foreground">Talk to us · 0913 513 4170</div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </a>
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
                  className="w-full h-12 px-4 rounded-xl bg-muted/50 text-muted-foreground text-sm caret-current" />
              </Field>
              <Field label="Full name">
                <input value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full h-12 px-4 rounded-xl bg-card border border-border text-sm text-foreground caret-current placeholder:text-gray-400 focus:outline-none focus:border-primary" />
              </Field>
              <Field label="Phone number">
                <input type="tel" value={phone} maxLength={11}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder="08012345678"
                  className="w-full h-12 px-4 rounded-xl bg-card border border-border text-sm text-foreground caret-current placeholder:text-gray-400 focus:outline-none focus:border-primary" />
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
                  className="w-full h-12 px-4 rounded-xl bg-card border border-border tracking-[0.5em] text-center text-lg text-foreground caret-current placeholder:text-gray-400 focus:outline-none focus:border-primary" />
              </Field>
              <Field label="Confirm PIN">
                <input type="password" inputMode="numeric" maxLength={6} placeholder="Re-enter PIN"
                  value={confirmNewPin}
                  onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ""))}
                  className="w-full h-12 px-4 rounded-xl bg-card border border-border tracking-[0.5em] text-center text-lg text-foreground caret-current placeholder:text-gray-400 focus:outline-none focus:border-primary" />
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
