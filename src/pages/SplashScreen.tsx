import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Zap } from "lucide-react";

export default function SplashScreen() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    const t = setTimeout(() => {
      if (loading) return;
      const onboarded = localStorage.getItem("yc_onboarded") === "1";
      if (user) navigate("/dashboard", { replace: true });
      else if (!onboarded) navigate("/onboarding", { replace: true });
      else navigate("/auth", { replace: true });
    }, 2500);
    return () => clearTimeout(t);
  }, [navigate, user, loading]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      <div className="flex flex-col items-center text-center relative z-10 px-6">
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full pulse-ring" style={{ background: "hsl(var(--primary) / 0.18)" }} />
          <div className="w-[100px] h-[100px] rounded-full bg-card border-2 border-primary flex items-center justify-center shadow-elevated">
            <Zap className="w-12 h-12 text-primary" strokeWidth={1.5} />
          </div>
        </div>
        <h1 className="text-foreground text-[32px] font-extrabold tracking-tight">YomiConnect</h1>
        <p className="text-muted-strong text-sm mt-1">Fast. Secure. Reliable.</p>
      </div>
      <div className="absolute bottom-16 left-0 right-0 flex justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-2 h-2 rounded-full bg-primary dot-pulse"
            style={{ animationDelay: `${i * 0.16}s` }} />
        ))}
      </div>
    </div>
  );
}
