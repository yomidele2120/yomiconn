import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Smartphone, ShieldCheck, Wallet } from "lucide-react";

const slides = [
  {
    bg: "linear-gradient(135deg, #6C3AE8 0%, #4F2BD1 100%)",
    icon: Smartphone,
    title: "Buy Data Instantly",
    subtitle: "Get MTN, Airtel, Glo and 9mobile data bundles in seconds at the best prices",
    accent: "rgba(245,166,35,0.18)",
  },
  {
    bg: "linear-gradient(135deg, #3A8AE8 0%, #2061C4 100%)",
    icon: ShieldCheck,
    title: "Safe & Secure",
    subtitle: "Your wallet and transactions are protected with bank-grade security at every step",
    accent: "rgba(255,255,255,0.18)",
  },
  {
    bg: "linear-gradient(135deg, #1A1A2E 0%, #0E0E1A 100%)",
    icon: Wallet,
    title: "Fund Your Wallet",
    subtitle: "Top up your wallet once and pay for data, airtime, cable TV and electricity anytime",
    accent: "rgba(245,166,35,0.25)",
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
    <div className="min-h-screen w-full flex flex-col relative overflow-hidden transition-all duration-500"
      style={{ background: slide.bg }}>
      <button onClick={finish}
        className="absolute top-5 right-5 z-20 text-white/70 text-sm font-medium hover:text-white transition">
        Skip
      </button>

      <div className="absolute inset-0 pointer-events-none">
        <div className="orb w-80 h-80 top-[-10%] right-[-10%]" style={{ background: slide.accent }} />
        <div className="orb w-72 h-72 bottom-[10%] left-[-15%]" style={{ background: slide.accent }} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10 animate-fade-in" key={i}>
        <div className="w-48 h-48 mb-10 relative">
          <div className="absolute inset-0 rounded-[40%_60%_55%_45%/55%_45%_55%_45%] bg-white/10 backdrop-blur-sm" />
          <div className="absolute inset-4 rounded-full bg-white/15 flex items-center justify-center">
            <Icon className="w-20 h-20 text-white" strokeWidth={1.5} />
          </div>
        </div>
        <h2 className="text-white text-[28px] font-bold text-center leading-tight">{slide.title}</h2>
        <p className="text-white/70 text-[15px] text-center mt-3 max-w-sm leading-relaxed">{slide.subtitle}</p>
      </div>

      <div className="px-6 pb-10 relative z-10">
        <div className="flex justify-center gap-2 mb-8">
          {slides.map((_, idx) => (
            <span key={idx}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === i ? "w-8 bg-white" : "w-2 bg-white/40"
              }`} />
          ))}
        </div>
        <button
          onClick={() => (last ? finish() : setI(i + 1))}
          className={`w-full h-[52px] rounded-xl font-semibold text-base transition active:scale-[0.98] ${
            last ? "text-[#1A1A2E]" : "bg-white text-[#6C3AE8]"
          }`}
          style={last ? { background: "#F5A623" } : undefined}
        >
          {last ? "Get Started" : "Next"}
        </button>
      </div>
    </div>
  );
}
