import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useWalletTransactions, useServiceTransactions } from "@/hooks/useWallet";
import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";
import {
  BellOff, CheckCircle2, XCircle, Clock, Wallet, Wifi, Phone, Tv, Zap, Sparkles, Filter
} from "lucide-react";
import { useNavigate } from "react-router-dom";

type Notif = {
  id: string;
  kind: "success" | "failed" | "pending" | "credit" | "info";
  service?: string;
  title: string;
  body: string;
  amount?: number;
  created_at: string;
};

const FILTERS = ["All", "Unread", "Transactions", "Wallet"] as const;
type Filter = typeof FILTERS[number];

const fmtNGN = (a: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(a);

function iconFor(n: Notif) {
  const s = (n.service || "").toLowerCase();
  if (n.kind === "credit") return { Icon: Wallet, tone: "bg-success/15 text-success" };
  if (s.includes("data")) return { Icon: Wifi, tone: "bg-primary/15 text-primary" };
  if (s.includes("airtime")) return { Icon: Phone, tone: "bg-[#3A8AE8]/15 text-[#3A8AE8]" };
  if (s.includes("cable")) return { Icon: Tv, tone: "bg-[#F5A623]/20 text-[#F5A623]" };
  if (s.includes("electric")) return { Icon: Zap, tone: "bg-[#FACC15]/25 text-[#B07F0A]" };
  if (n.kind === "failed") return { Icon: XCircle, tone: "bg-destructive/15 text-destructive" };
  if (n.kind === "pending") return { Icon: Clock, tone: "bg-warning/15 text-warning" };
  return { Icon: Sparkles, tone: "bg-primary/15 text-primary" };
}

function groupKey(date: string) {
  const d = new Date(date);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMMM d");
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { data: walletTx, isLoading: wL } = useWalletTransactions();
  const { data: serviceTx, isLoading: sL } = useServiceTransactions();
  const [filter, setFilter] = useState<Filter>("All");
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("yc_read_notifs") || "[]")); }
    catch { return new Set(); }
  });

  const markAllRead = () => {
    const all = new Set(notifs.map(n => n.id));
    setReadIds(all);
    localStorage.setItem("yc_read_notifs", JSON.stringify([...all]));
  };

  const markRead = (id: string) => {
    const next = new Set(readIds); next.add(id);
    setReadIds(next);
    localStorage.setItem("yc_read_notifs", JSON.stringify([...next]));
  };

  const notifs: Notif[] = useMemo(() => {
    const out: Notif[] = [];

    for (const t of (serviceTx ?? []) as any[]) {
      const s = (t.status || "").toLowerCase();
      const kind: Notif["kind"] =
        s === "successful" || s === "success" || s === "completed" ? "success"
        : s === "failed" || s === "error" ? "failed" : "pending";
      const svc = t.service_type || "Service";
      out.push({
        id: `s-${t.id}`,
        kind,
        service: svc,
        title:
          kind === "success" ? `${capitalize(svc)} purchase successful` :
          kind === "failed"  ? `${capitalize(svc)} purchase failed` :
                               `${capitalize(svc)} purchase processing`,
        body:
          (t.phone_number ? `To ${t.phone_number}` : "") +
          (t.reference ? `${t.phone_number ? " · " : ""}Ref ${String(t.reference).slice(-8)}` : ""),
        amount: Number(t.amount),
        created_at: t.created_at,
      });
    }

    for (const t of (walletTx ?? []) as any[]) {
      if (t.type === "credit" && (t.status || "").toLowerCase() === "successful") {
        out.push({
          id: `w-${t.id}`,
          kind: "credit",
          title: "Wallet funded",
          body: t.description || "Payment received",
          amount: Number(t.amount),
          created_at: t.created_at,
        });
      }
    }

    return out.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }, [walletTx, serviceTx]);

  const filtered = useMemo(() => {
    if (filter === "Unread") return notifs.filter(n => !readIds.has(n.id));
    if (filter === "Transactions") return notifs.filter(n => n.kind !== "credit");
    if (filter === "Wallet") return notifs.filter(n => n.kind === "credit");
    return notifs;
  }, [filter, notifs, readIds]);

  const unreadCount = notifs.filter(n => !readIds.has(n.id)).length;

  const grouped: Record<string, Notif[]> = {};
  for (const n of filtered) (grouped[groupKey(n.created_at)] = grouped[groupKey(n.created_at)] || []).push(n);

  const loading = wL || sL;

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Notifications</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {unreadCount > 0 ? `${unreadCount} new ${unreadCount === 1 ? "alert" : "alerts"}` : "You're all caught up"}
          </p>
        </div>
        <button onClick={markAllRead}
          disabled={unreadCount === 0}
          className="text-primary text-xs font-semibold disabled:text-muted-foreground disabled:opacity-60">
          Mark all read
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 mb-3 no-scrollbar">
        {FILTERS.map((f) => {
          const active = f === filter;
          const count = f === "Unread" ? unreadCount : 0;
          return (
            <button key={f} onClick={() => setFilter(f)}
              className={`shrink-0 px-4 h-9 rounded-full text-xs font-semibold transition flex items-center gap-1.5 ${
                active ? "bg-primary text-white shadow-premium" : "bg-card text-muted-foreground"
              }`}>
              {f === "All" && <Filter className="w-3 h-3" />}
              {f}
              {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${active ? "bg-white/20" : "bg-destructive text-white"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-[78px] bg-muted animate-pulse rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20 bg-card rounded-3xl shadow-card">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <BellOff className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-foreground font-semibold">No notifications</p>
          <p className="text-muted-foreground text-sm mt-1 max-w-xs px-4">
            Your transactions, alerts, and wallet activity will appear here.
          </p>
          <button onClick={() => navigate("/dashboard")}
            className="mt-5 px-5 h-10 rounded-xl wallet-gradient text-white text-sm font-semibold shadow-premium">
            Go to Dashboard
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([day, items]) => (
            <div key={day}>
              <p className="label-eyebrow mb-2 px-1">{day}</p>
              <div className="space-y-2">
                {items.map((n) => {
                  const { Icon, tone } = iconFor(n);
                  const unread = !readIds.has(n.id);
                  return (
                    <button key={n.id} onClick={() => { markRead(n.id); navigate("/transactions"); }}
                      className={`w-full text-left flex items-start gap-3 p-3 rounded-2xl shadow-card transition-all hover:shadow-premium ${
                        unread ? "bg-card border border-primary/15" : "bg-card"
                      }`}>
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${tone}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[14px] font-semibold text-foreground truncate">{n.title}</p>
                          {unread && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                        </div>
                        {n.body && <p className="text-[12px] text-muted-foreground truncate">{n.body}</p>}
                        <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                          {formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      {typeof n.amount === "number" && (
                        <span className={`text-[13px] font-bold shrink-0 ${
                          n.kind === "credit" ? "text-success" :
                          n.kind === "failed" ? "text-muted-foreground line-through" :
                          "text-foreground"
                        }`}>
                          {n.kind === "credit" ? "+" : "-"}{fmtNGN(n.amount)}
                        </span>
                      )}
                      {n.kind === "success" && !n.amount && <CheckCircle2 className="w-4 h-4 text-success" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

function capitalize(s: string) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
