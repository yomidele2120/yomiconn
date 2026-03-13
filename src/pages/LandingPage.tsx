import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Zap, Shield, Wifi, Phone, Tv, CreditCard, ArrowRight, CheckCircle } from "lucide-react";

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

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg wallet-gradient flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-xl font-heading font-bold text-foreground">YOMIconnect</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")}>Sign In</Button>
            <Button onClick={() => navigate("/auth")}>
              Get Started <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 wallet-gradient opacity-5" />
        <div className="max-w-6xl mx-auto px-4 py-20 md:py-32 relative">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Shield className="w-3.5 h-3.5" /> Secure & Instant VTU Platform
            </div>
            <h1 className="text-4xl md:text-6xl font-heading font-extrabold text-foreground leading-tight mb-6">
              Pay Bills in <span className="text-primary">Seconds</span>, Not Minutes
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
              Buy airtime, data, electricity tokens, and cable TV subscriptions instantly.
              Fund your wallet with Paystack and enjoy the fastest VTU experience in Nigeria.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" className="text-base px-8" onClick={() => navigate("/auth")}>
                Create Free Account <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <Button size="lg" variant="outline" className="text-base px-8" onClick={() => navigate("/auth")}>
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-3">All Your Bills, One Platform</h2>
            <p className="text-muted-foreground text-lg max-w-lg mx-auto">Top up, subscribe, and pay — all from your YOMIconnect wallet.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-card rounded-xl p-6 border border-border hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
                <div className="w-12 h-12 rounded-lg wallet-gradient flex items-center justify-center mb-4">
                  <f.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-heading font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust / Security */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-4">Built for Security & Speed</h2>
              <p className="text-muted-foreground text-lg mb-8">
                Every transaction is protected with atomic wallet operations, rate limiting, and automated fraud detection.
                Your money is safe with YOMIconnect.
              </p>
              <ul className="space-y-4">
                {trustPoints.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                    <span className="text-foreground">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-center">
              <div className="w-full max-w-sm">
                <div className="wallet-gradient rounded-2xl p-6 text-primary-foreground">
                  <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="w-5 h-5" />
                    <span className="text-sm font-medium opacity-90">Wallet Balance</span>
                  </div>
                  <h3 className="text-3xl font-heading font-bold mb-2">₦25,400.00</h3>
                  <p className="text-sm opacity-75 mb-6">Fund instantly via Paystack</p>
                  <div className="bg-primary-foreground/20 rounded-lg p-3 text-sm space-y-1">
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
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Create your free account in 30 seconds. No email verification required.
          </p>
          <Button size="lg" className="text-base px-10" onClick={() => navigate("/auth")}>
            Create Account Now <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md wallet-gradient flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-heading font-bold text-foreground">YOMIconnect</span>
          </div>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} YOMIconnect. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
