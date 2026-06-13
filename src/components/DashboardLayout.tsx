import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, History, LayoutGrid, User, Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { path: "/dashboard", label: "Home", icon: Home },
  { path: "/transactions", label: "History", icon: History },
  { path: "/dashboard#services", label: "Services", icon: LayoutGrid, match: "/dashboard" },
  { path: "/profile", label: "Profile", icon: User },
];

function initials(name: string | undefined, email: string | undefined) {
  if (name) return name.split(" ").map(s => s[0]).slice(0,2).join("").toUpperCase();
  if (email) return email[0].toUpperCase();
  return "U";
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const name = (user?.user_metadata as any)?.full_name as string | undefined;
  const firstName = name?.split(" ")[0];

  const showHeader = location.pathname === "/dashboard";

  return (
    <div className="min-h-screen bg-background">
      {showHeader && (
        <header className="px-5 pt-6 pb-3">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div>
              <p className="text-[15px] text-foreground">
                <span className="font-bold">{greeting()}, {firstName || "there"}</span> 👋
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Welcome back to YomiConnect</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate("/notifications")}
                className="relative w-10 h-10 rounded-full bg-card shadow-card flex items-center justify-center hover:bg-muted transition">
                <Bell className="w-5 h-5 text-foreground" />
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-destructive" />
              </button>
              <button onClick={() => navigate("/profile")}
                className="w-10 h-10 rounded-full wallet-gradient text-white text-sm font-bold flex items-center justify-center shadow-premium">
                {initials(name, user?.email)}
              </button>
            </div>
          </div>
        </header>
      )}

      <main className="max-w-lg mx-auto px-5 pt-2 pb-28">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border z-40"
        style={{ boxShadow: "0 -8px 24px rgba(26,26,46,0.06)" }}>
        <div className="max-w-lg mx-auto flex">
          {navItems.map((item) => {
            const target = item.match || item.path;
            const active = location.pathname === target;
            return (
              <button key={item.label}
                onClick={() => navigate(item.path.split("#")[0])}
                className="flex-1 flex flex-col items-center gap-1 py-3 transition-colors group">
                <item.icon className={`w-5 h-5 transition ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                <span className={`text-[11px] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}>{item.label}</span>
                <span className={`w-1 h-1 rounded-full ${active ? "bg-primary" : "bg-transparent"}`} />
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
