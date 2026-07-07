import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import TransactionList, { DisplayTx } from "@/components/TransactionList";
import { useWalletTransactions, useServiceTransactions } from "@/hooks/useWallet";
import { SlidersHorizontal } from "lucide-react";

const FILTERS = ["All", "Data", "Airtime", "Cable", "Electricity", "Wallet", "Failed"] as const;
type Filter = typeof FILTERS[number];

export default function TransactionsPage() {
  const [filter, setFilter] = useState<Filter>("All");
  const { data: walletTx, isLoading: wtLoading } = useWalletTransactions();
  const { data: serviceTx, isLoading: stLoading } = useServiceTransactions();

  const all: DisplayTx[] = useMemo(() => {
    const w: DisplayTx[] = (walletTx ?? []).map((t: any) => ({
      id: t.id, type: t.type, amount: Number(t.amount), description: t.description,
      status: t.status, created_at: t.created_at, reference: t.reference,
    }));
    const s: DisplayTx[] = (serviceTx ?? []).map((t: any) => {
      const m = (t.metadata || {}) as any;
      const recipient = t.phone_number || m.phone_number || m.meter_no || m.smartcard_no || null;
      return {
        id: t.id, type: "debit", amount: Number(t.amount),
        description: `${t.service_type}${t.provider ? " - " + t.provider.split(":")[0] : ""}${recipient ? " · " + recipient : ""}`,
        status: t.status, created_at: t.created_at, reference: t.reference,
        provider: t.provider ? t.provider.split(":")[0] : null,
        service_type: t.service_type, recipient,
        failure_reason: t.failure_reason,
        phone_number: t.phone_number || m.phone_number || null,
        meter_number: m.meter_no || null,
        meter_type: m.meter_type || null,
        smartcard_number: m.smartcard_no || null,
        plan_name: m.plan_name || m.bundle_name || null,
        provider_reference: t.provider_reference || null,
        completed_at: t.completed_at || null,
      };
    });

    return [...w, ...s].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }, [walletTx, serviceTx]);

  const filtered = useMemo(() => {
    if (filter === "All") return all;
    if (filter === "Failed") return all.filter(t => t.status.toLowerCase().includes("fail"));
    if (filter === "Wallet") return all.filter(t => !t.service_type);
    return all.filter(t => (t.service_type || "").toLowerCase().includes(filter.toLowerCase())
      || (t.description || "").toLowerCase().includes(filter.toLowerCase()));
  }, [filter, all]);

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-foreground">Transaction History</h1>
        <button className="w-10 h-10 rounded-full bg-card shadow-card flex items-center justify-center">
          <SlidersHorizontal className="w-4 h-4 text-foreground" />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 mb-4 no-scrollbar">
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <button key={f} onClick={() => setFilter(f)}
              className={`shrink-0 px-4 h-9 rounded-full text-xs font-semibold transition ${
                active ? "bg-primary text-white shadow-premium" : "bg-card text-muted-foreground"
              }`}>
              {f}
            </button>
          );
        })}
      </div>

      <TransactionList transactions={filtered} loading={wtLoading || stLoading} grouped />
    </DashboardLayout>
  );
}
