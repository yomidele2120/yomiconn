import { format, isToday, isYesterday } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, Wifi, Phone, Tv, Zap } from "lucide-react";
import { useState } from "react";
import TransactionDetailSheet from "./TransactionDetailSheet";

export interface DisplayTx {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  status: string;
  created_at: string;
  reference?: string | null;
  provider?: string | null;
  service_type?: string | null;
  recipient?: string | null;
  failure_reason?: string | null;
}

interface Props {
  transactions: DisplayTx[];
  loading: boolean;
  grouped?: boolean;
}

function iconFor(tx: DisplayTx) {
  const desc = (tx.description || "").toLowerCase();
  const svc = (tx.service_type || "").toLowerCase();
  if (svc.includes("data") || desc.includes("data")) return { Icon: Wifi, bg: "bg-primary/15 text-primary" };
  if (svc.includes("airtime") || desc.includes("airtime")) return { Icon: Phone, bg: "bg-[#3A8AE8]/15 text-[#3A8AE8]" };
  if (svc.includes("cable") || desc.includes("cable") || desc.includes("dstv")) return { Icon: Tv, bg: "bg-[#F5A623]/20 text-[#F5A623]" };
  if (svc.includes("electric") || desc.includes("electric")) return { Icon: Zap, bg: "bg-[#FACC15]/25 text-[#B07F0A]" };
  if (tx.type === "credit") return { Icon: ArrowDownLeft, bg: "bg-success/15 text-success" };
  return { Icon: ArrowUpRight, bg: "bg-destructive/15 text-destructive" };
}

function statusPill(status: string) {
  const s = status.toLowerCase();
  if (s === "successful" || s === "success" || s === "completed")
    return { label: "Success", className: "bg-success/12 text-success" };
  if (s === "failed" || s === "error")
    return { label: "Failed", className: "bg-destructive/12 text-destructive" };
  if (s === "initiated" || s === "processing")
    return { label: "Processing", className: "bg-warning/15 text-warning" };
  if (s === "refunded")
    return { label: "Refunded", className: "bg-primary/12 text-primary" };
  return { label: "Pending", className: "bg-warning/15 text-warning" };
}

function groupKey(date: string) {
  const d = new Date(date);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMMM d, yyyy");
}

const fmtNGN = (a: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(a);

export default function TransactionList({ transactions, loading, grouped }: Props) {
  const [selected, setSelected] = useState<DisplayTx | null>(null);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-[72px] bg-muted animate-pulse rounded-2xl" />)}
      </div>
    );
  }

  if (!transactions.length) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm bg-card rounded-2xl shadow-card">
        No transactions yet
      </div>
    );
  }

  const groups: Record<string, DisplayTx[]> = {};
  if (grouped) {
    for (const tx of transactions) {
      const k = groupKey(tx.created_at);
      (groups[k] = groups[k] || []).push(tx);
    }
  } else {
    groups["__"] = transactions;
  }

  return (
    <>
      <div className="space-y-5">
        {Object.entries(groups).map(([key, items]) => (
          <div key={key}>
            {grouped && (
              <p className="label-eyebrow mb-2 px-1">{key}</p>
            )}
            <div className="space-y-2">
              {items.map((tx) => {
                const { Icon, bg } = iconFor(tx);
                const pill = statusPill(tx.status);
                return (
                  <button key={tx.id} onClick={() => setSelected(tx)}
                    className="w-full text-left flex items-center gap-3 p-3 rounded-2xl bg-card shadow-card hover:shadow-premium transition-all">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${bg}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-foreground truncate">
                        {tx.description || (tx.type === "credit" ? "Wallet Funded" : "Service Purchase")}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(new Date(tx.created_at), "MMM d · h:mm a")}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-[15px] font-bold ${tx.type === "credit" ? "text-success" : "text-foreground"}`}>
                        {tx.type === "credit" ? "+" : "-"}{fmtNGN(tx.amount)}
                      </p>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${pill.className}`}>
                        {pill.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <TransactionDetailSheet tx={selected} onClose={() => setSelected(null)} />
    </>
  );
}
