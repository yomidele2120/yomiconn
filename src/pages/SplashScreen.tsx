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
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #6C3AE8 0%, #3A8AE8 100%)" }}>
      <div className="absolute inset-0 opacity-30">
        <div className="orb w-96 h-96 bg-white/20 top-[-10%] left-[-10%]" />
        <div className="orb w-96 h-96 bg-white/10 bottom-[-15%] right-[-10%]" />
      </div>
      <div className="flex flex-col items-center text-center relative z-10 px-6">
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full bg-white/30 pulse-ring" />
          <div className="w-[100px] h-[100px] rounded-full bg-white/15 border-[3px] border-white/90 backdrop-blur flex items-center justify-center shadow-2xl">
            <Zap className="w-12 h-12 text-white" fill="white" strokeWidth={1.5} />
          </div>
        </div>
        <h1 className="text-white text-[32px] font-extrabold tracking-tight">YomiConnect</h1>
        <p className="text-white/60 text-sm mt-1">Fast. Secure. Reliable.</p>
      </div>
      <div className="absolute bottom-16 left-0 right-0 flex justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-2.5 h-2.5 rounded-full bg-white dot-pulse"
            style={{ animationDelay: `${i * 0.16}s` }} />
        ))}
      </div>
    </div>
  );
}
