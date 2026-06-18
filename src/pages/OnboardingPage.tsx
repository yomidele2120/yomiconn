import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Smartphone, ShieldCheck, Zap } from "lucide-react";

const slides = [
  {
    bg: "#0F0F0F",
    icon: Smartphone,
    title: "Buy Data Instantly",
    subtitle: "Get MTN, Airtel, Glo and 9mobile data bundles in seconds at the best prices",
  },
  {
    bg: "#111111",
    icon: ShieldCheck,
    title: "Safe & Secure",
    subtitle: "Your wallet and transactions are protected with bank-grade security at every step",
  },
  {
    bg: "#0A0A0A",
    icon: Zap,
    title: "Fund Your Wallet",
    subtitle: "Top up your wallet once and pay for data, airtime, cable TV and electricity anytime",
  },
];

export default function OnboardingPage() {
  const [i, setI] = useState(0);
  const navigate = useNavigate();
  const slide = slides[i];
  const Icon = slide.icon;
  const last = i === slides.length - 1;

  const finish = () => {
    localStorage.setItem("yc_onboarded", "1");
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen w-full flex flex-col relative overflow-hidden transition-colors duration-500"
      style={{ background: slide.bg }}>
      <button onClick={finish}
        className="absolute top-5 right-5 z-20 text-muted-strong text-sm font-medium hover:text-foreground transition">
        Skip
      </button>

      <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10 animate-fade-in" key={i}>
        <div className="w-48 h-48 mb-10 relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-border" />
          <div className="absolute inset-6 rounded-full border-2 border-primary/40" />
          <div className="absolute inset-12 rounded-full bg-card flex items-center justify-center border border-border">
            <Icon className="w-14 h-14 text-primary" strokeWidth={1.5} />
          </div>
        </div>
        <h2 className="text-foreground text-[26px] font-bold text-center leading-tight tracking-tight">{slide.title}</h2>
        <p className="text-muted-foreground text-sm text-center mt-3 max-w-[280px] leading-relaxed">{slide.subtitle}</p>
      </div>

      <div className="px-6 pb-10 relative z-10">
        <div className="flex justify-center gap-2 mb-8">
          {slides.map((_, idx) => (
            <span key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === i ? "w-8 bg-primary" : "w-1.5 bg-muted-disabled"
              }`} />
          ))}
        </div>
        <button
          onClick={() => (last ? finish() : setI(i + 1))}
          className="w-full h-[52px] rounded-[10px] font-bold text-base bg-primary text-primary-foreground transition active:scale-[0.98]"
        >
          {last ? "Get Started" : "Next"}
        </button>
      </div>
    </div>
  );
}
