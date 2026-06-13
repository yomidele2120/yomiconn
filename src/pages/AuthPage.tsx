import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Eye, EyeOff, User, Phone, Zap } from "lucide-react";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
        toast.success("Welcome back!");
        navigate("/dashboard");
      } else {
        if (!fullName.trim()) { toast.error("Enter your full name"); return; }
        if (password !== confirm) { toast.error("Passwords do not match"); return; }
        await signUp(email, password, fullName);
        toast.success("Account created!");
        navigate("/dashboard");
      }
    } catch (err: any) {
      const m = err.message || "Something went wrong";
      if (m.includes("already")) toast.error("This email is already registered. Please sign in.");
      else toast.error(m);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen w-full bg-background relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="orb w-80 h-80 -top-20 -right-20 bg-primary/20" />
      <div className="orb w-72 h-72 -bottom-24 -left-16 bg-secondary/20" />

      <div className="relative z-10 min-h-screen flex flex-col items-center px-6 pt-12 pb-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl wallet-gradient flex items-center justify-center shadow-premium mb-3">
            <Zap className="w-6 h-6 text-white" fill="white" />
          </div>
          <span className="text-2xl font-bold text-primary">YomiConnect</span>
        </div>

        <div className="w-full max-w-md bg-card rounded-3xl shadow-premium p-7 animate-fade-in">
          <h1 className="text-[26px] font-bold text-foreground leading-tight">
            {isLogin ? "Welcome back" : "Create Account"}
          </h1>
          <p className="text-muted-foreground text-[15px] mt-1">
            {isLogin ? "Sign in to your account" : "Join thousands of Nigerians saving on data"}
          </p>

          {!isLogin && (
            <div className="mt-5 h-1 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full w-full bg-primary rounded-full" />
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {!isLogin && (
              <Field icon={User} label="Full Name">
                <Input className="auth-input pl-11" placeholder="John Doe"
                  value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </Field>
            )}
            <Field icon={Mail} label="Email">
              <Input type="email" className="auth-input pl-11" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            {!isLogin && (
              <Field icon={Phone} label="Phone number">
                <span className="absolute left-11 top-1/2 -translate-y-1/2 text-sm text-foreground font-medium pointer-events-none">🇳🇬 +234</span>
                <Input type="tel" className="auth-input pl-[6.25rem]" placeholder="8012345678"
                  value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
            )}
            <Field icon={Lock} label="Password">
              <Input type={showPw ? "text" : "password"} className="auth-input pl-11 pr-11"
                placeholder="••••••••" minLength={6}
                value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </Field>
            {!isLogin && (
              <Field icon={Lock} label="Confirm password">
                <Input type="password" className="auth-input pl-11" placeholder="••••••••"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </Field>
            )}

            {isLogin && (
              <div className="flex justify-end">
                <button type="button" className="text-primary text-sm font-medium hover:underline">
                  Forgot Password?
                </button>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full h-[52px] rounded-xl wallet-gradient text-white font-semibold text-base shadow-premium active:scale-[0.99] transition flex items-center justify-center gap-2 disabled:opacity-70">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLogin ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => setIsLogin(!isLogin)} className="text-primary font-semibold hover:underline">
              {isLogin ? "Register" : "Sign In"}
            </button>
          </p>
        </div>
      </div>

      <style>{`
        .auth-input {
          height: 56px !important;
          border-radius: 16px !important;
          background: #F9FAFB !important;
          border: 1.5px solid transparent !important;
          font-size: 15px !important;
        }
        .auth-input:focus-visible {
          border-color: hsl(var(--primary)) !important;
          background: #fff !important;
          box-shadow: 0 0 0 4px hsl(var(--primary) / 0.08) !important;
        }
      `}</style>
    </div>
  );
}

function Field({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="relative">
        <Icon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        {children}
      </div>
    </div>
  );
}
