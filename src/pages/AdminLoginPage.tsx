import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Eye, EyeOff, Shield, ArrowLeft } from "lucide-react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      // Verify admin role
      const { data: sess } = await supabase.auth.getUser();
      if (!sess.user) throw new Error("Sign-in failed");
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", sess.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!roleRow) {
        await supabase.auth.signOut();
        toast.error("Access denied. This account is not an administrator.");
        return;
      }
      toast.success("Welcome, admin");
      navigate("/admin");
    } catch (err: any) {
      toast.error(err.message || "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-foreground relative overflow-hidden flex items-center justify-center px-6 py-10">
      <div className="orb w-96 h-96 -top-32 -right-32 bg-primary/30" />
      <div className="orb w-80 h-80 -bottom-24 -left-20 bg-accent/20" />

      <button
        onClick={() => navigate("/auth")}
        className="absolute top-6 left-6 z-20 flex items-center gap-1 text-sm text-background/70 hover:text-background"
      >
        <ArrowLeft className="w-4 h-4" /> User login
      </button>

      <div className="relative z-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl gold-gradient flex items-center justify-center shadow-premium mb-3">
            <Shield className="w-7 h-7 text-foreground" />
          </div>
          <span className="text-2xl font-bold text-background">Admin Console</span>
          <span className="text-sm text-background/60 mt-1">YomiConnect operator access</span>
        </div>

        <div className="bg-card rounded-3xl shadow-premium p-7 animate-fade-in">
          <h1 className="text-[24px] font-bold text-foreground">Sign in to dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Authorized administrators only.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</Label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  className="h-14 rounded-2xl bg-muted border-transparent pl-11"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</Label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type={showPw ? "text" : "password"}
                  className="h-14 rounded-2xl bg-muted border-transparent pl-11 pr-11"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[52px] rounded-xl wallet-gradient text-white font-semibold shadow-premium active:scale-[0.99] transition flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign in to Admin
            </button>
          </form>

          <div className="mt-5 p-3 rounded-xl bg-muted/60 text-xs text-muted-foreground text-center">
            🔒 Non-admin accounts will be signed out automatically.
          </div>
        </div>
      </div>
    </div>
  );
}
