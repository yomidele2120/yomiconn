import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Zap, Shield, Wifi, Phone, Tv, CreditCard, ArrowRight, CheckCircle, Menu, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import CheapestDealsPopup from "@/components/CheapestDealsPopup";

const features = [
  { icon: Phone, title: "Airtime Top-up", desc: "Instant airtime for all networks — MTN, Airtel, Glo, 9mobile." },
  { icon: Wifi, title: "Data Bundles", desc: "Affordable data plans delivered in seconds." },
  { icon: Zap, title: "Electricity", desc: "Prepaid & postpaid meter tokens for all DISCOs." },
  { icon: Tv, title: "Cable TV", desc: "DSTV, GOtv, Startimes subscriptions made easy." },
];

const trustPoints = [
  "Atomic wallet transactions — no double spending",
  "Paystack-secured wallet funding",
  "Real-time transaction tracking",
  "Fraud detection & account protection",
];

function useMouseGlow(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty("--glow-x", `${x}%`);
      el.style.setProperty("--glow-y", `${y}%`);
    };
    el.addEventListener("mousemove", handleMove);
    return () => el.removeEventListener("mousemove", handleMove);
  }, [ref]);
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  useMouseGlow(heroRef);

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg wallet-gradient flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg sm:text-xl font-heading font-bold text-foreground">YOMIconnect</span>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>Sign In</Button>
            <Button size="sm" onClick={() => navigate("/auth")}>
              Get Started <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
          <button className="sm:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        {menuOpen && (
          <div className="sm:hidden border-t border-border bg-background px-4 py-3 space-y-2">
            <Button variant="ghost" className="w-full justify-start" onClick={() => { navigate("/auth"); setMenuOpen(false); }}>Sign In</Button>
            <Button className="w-full" onClick={() => { navigate("/auth"); setMenuOpen(false); }}>
              Get Started <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section ref={heroRef} className="relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 hero-gradient-bg animate-gradient-shift" />
        {/* Mouse-following glow */}
        <div className="absolute inset-0 hero-glow transition-all duration-700 ease-out" />

        {/* Floating orbs */}
        <div className="orb w-72 h-72 sm:w-96 sm:h-96 bg-primary/[0.07] top-[-5%] left-[-8%] animate-float" />
        <div className="orb w-64 h-64 sm:w-80 sm:h-80 bg-accent/[0.06] bottom-[-10%] right-[-5%] animate-float" style={{ animationDelay: "2s" }} />
        <div className="orb w-48 h-48 bg-warning/[0.05] top-[20%] right-[15%] animate-glow-pulse" style={{ animationDelay: "1s" }} />

        <div className="max-w-6xl mx-auto px-4 py-12 sm:py-20 md:py-32 relative z-10">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-4 sm:mb-6 animate-fade-in">
              <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Secure & Instant VTU Platform
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-heading font-extrabold text-foreground leading-tight mb-4 sm:mb-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
              Pay Bills in{" "}
              <span className="relative inline-block">
                <span className="relative z-10 text-primary">Seconds</span>
                <span className="absolute -inset-x-2 -inset-y-1 bg-primary/10 rounded-lg -skew-y-1" />
              </span>
              , Not Minutes
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-6 sm:mb-8 leading-relaxed px-2 animate-fade-in" style={{ animationDelay: "0.2s" }}>
              Buy airtime, data, electricity tokens, and cable TV subscriptions instantly.
              Fund your wallet with Paystack and enjoy the fastest VTU experience in Nigeria.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <Button size="lg" className="w-full sm:w-auto text-base px-8" onClick={() => navigate("/auth")}>
                Create Free Account <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8" onClick={() => navigate("/auth")}>
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-12 sm:py-16 md:py-24 bg-muted/30 relative">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-foreground mb-2 sm:mb-3">All Your Bills, One Platform</h2>
            <p className="text-muted-foreground text-sm sm:text-lg max-w-lg mx-auto">Top up, subscribe, and pay — all from your YOMIconnect wallet.</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="bg-card rounded-xl p-4 sm:p-6 border border-border hover:shadow-lg hover:-translate-y-1 transition-all duration-300 animate-fade-in group"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg wallet-gradient flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300">
                  <f.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
                </div>
                <h3 className="text-sm sm:text-lg font-heading font-semibold text-foreground mb-1 sm:mb-2">{f.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust / Security */}
      <section className="py-12 sm:py-16 md:py-24 relative">
        {/* Subtle animated accent */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8 sm:gap-12 items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-foreground mb-3 sm:mb-4">Built for Security & Speed</h2>
              <p className="text-sm sm:text-lg text-muted-foreground mb-6 sm:mb-8">
                Every transaction is protected with atomic wallet operations, rate limiting, and automated fraud detection.
              </p>
              <ul className="space-y-3 sm:space-y-4">
                {trustPoints.map((point, i) => (
                  <li key={point} className="flex items-start gap-2 sm:gap-3 animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-accent mt-0.5 flex-shrink-0" />
                    <span className="text-sm sm:text-base text-foreground">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-center">
              <div className="w-full max-w-sm relative">
                {/* Card glow */}
                <div className="absolute -inset-4 bg-primary/[0.04] rounded-3xl blur-2xl animate-glow-pulse" />
                <div className="wallet-gradient rounded-2xl p-5 sm:p-6 text-primary-foreground relative">
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <CreditCard className="w-5 h-5" />
                    <span className="text-sm font-medium opacity-90">Wallet Balance</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-heading font-bold mb-2">₦25,400.00</h3>
                  <p className="text-xs sm:text-sm opacity-75 mb-4 sm:mb-6">Fund instantly via Paystack</p>
                  <div className="bg-primary-foreground/20 rounded-lg p-3 text-xs sm:text-sm space-y-1">
                    <div className="flex justify-between"><span className="opacity-75">MTN Airtime</span><span>-₦500</span></div>
                    <div className="flex justify-between"><span className="opacity-75">Data 2GB</span><span>-₦1,200</span></div>
                    <div className="flex justify-between"><span className="opacity-75">DSTV Compact</span><span>-₦10,500</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-16 md:py-24 bg-muted/30 relative overflow-hidden">
        <div className="orb w-64 h-64 bg-accent/[0.05] top-[-20%] left-[10%] animate-float" style={{ animationDelay: "3s" }} />
        <div className="orb w-48 h-48 bg-primary/[0.05] bottom-[-15%] right-[5%] animate-glow-pulse" />

        <div className="max-w-3xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-foreground mb-3 sm:mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-sm sm:text-lg text-muted-foreground mb-6 sm:mb-8">
            Create your free account in 30 seconds. No email verification required.
          </p>
          <Button size="lg" className="w-full sm:w-auto text-base px-10" onClick={() => navigate("/auth")}>
            Create Account Now <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 sm:py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md wallet-gradient flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-heading font-bold text-foreground">YOMIconnect</span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">© {new Date().getFullYear()} YOMIconnect. All rights reserved.</p>
        </div>
      </footer>

      <CheapestDealsPopup />
    </div>
  );
}
