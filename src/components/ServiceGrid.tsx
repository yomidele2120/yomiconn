import { Phone, Wifi, Zap, Tv } from "lucide-react";
import { useNavigate } from "react-router-dom";

const services = [
  { id: "airtime", label: "Airtime", icon: Phone, path: "/services/airtime", color: "bg-primary/10 text-primary" },
  { id: "data", label: "Data", icon: Wifi, path: "/services/data", color: "bg-accent/10 text-accent" },
  { id: "electricity", label: "Electricity", icon: Zap, path: "/services/electricity", color: "bg-warning/10 text-warning" },
  { id: "cable", label: "Cable TV", icon: Tv, path: "/services/cable", color: "bg-destructive/10 text-destructive" },
];

export default function ServiceGrid() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-4 gap-3">
      {services.map((service) => (
        <button
          key={service.id}
          onClick={() => navigate(service.path)}
          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border hover:shadow-md transition-all duration-200 animate-fade-in"
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${service.color}`}>
            <service.icon className="w-6 h-6" />
          </div>
          <span className="text-xs font-medium text-foreground">{service.label}</span>
        </button>
      ))}
    </div>
  );
}
