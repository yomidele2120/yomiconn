import { Phone, Wifi, Tv, Zap, Gauge, GraduationCap, ArrowLeftRight, MoreHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const services = [
  { id: "data", label: "Buy Data", icon: Wifi, path: "/services/data", bg: "bg-primary/12 text-primary" },
  { id: "airtime", label: "Buy Airtime", icon: Phone, path: "/services/airtime", bg: "bg-[#3A8AE8]/12 text-[#3A8AE8]" },
  { id: "cable", label: "Cable TV", icon: Tv, path: "/services/cable", bg: "bg-[#F5A623]/15 text-[#F5A623]" },
  { id: "electricity", label: "Electricity", icon: Zap, path: "/services/electricity", bg: "bg-[#FACC15]/20 text-[#B07F0A]" },
  { id: "verify", label: "Verify Meter", icon: Gauge, path: "/services/electricity", bg: "bg-[#14B8A6]/15 text-[#14B8A6]" },
  { id: "exam", label: "Exam Pins", icon: GraduationCap, path: "#", bg: "bg-success/15 text-success" },
  { id: "transfer", label: "Transfer", icon: ArrowLeftRight, path: "#", bg: "bg-[#6366F1]/15 text-[#6366F1]" },
  { id: "more", label: "More", icon: MoreHorizontal, path: "/profile", bg: "bg-muted text-muted-foreground" },
];

export default function ServiceGrid() {
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-4 gap-3">
      {services.map((s, i) => (
        <button key={s.id}
          onClick={() => s.path === "#" ? toast.info(`${s.label} coming soon`) : navigate(s.path)}
          className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-card shadow-card hover:shadow-premium hover:-translate-y-0.5 transition-all duration-200 animate-fade-in"
          style={{ animationDelay: `${i * 0.04}s` }}>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.bg}`}>
            <s.icon className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-semibold text-foreground text-center leading-tight">{s.label}</span>
        </button>
      ))}
    </div>
  );
}
