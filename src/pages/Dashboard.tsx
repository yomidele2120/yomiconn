import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import WalletCard from "@/components/WalletCard";
import ServiceGrid from "@/components/ServiceGrid";
import TransactionList from "@/components/TransactionList";
import FundWalletDialog from "@/components/FundWalletDialog";
import VirtualAccountCard from "@/components/VirtualAccountCard";
import WithdrawDialog from "@/components/WithdrawDialog";
import CheapestDealsPopup from "@/components/CheapestDealsPopup";
import { useWallet, useWalletTransactions } from "@/hooks/useWallet";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const [fundOpen, setFundOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: transactions, isLoading: txLoading } = useWalletTransactions();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.from("user_roles").select("role")
        .eq("user_id", user.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (isAdmin) navigate("/admin", { replace: true });
  }, [isAdmin, navigate]);


  const balance = Number(wallet?.balance ?? 0);
  const recent = (transactions ?? []).slice(0, 3).map((t: any) => ({
    id: t.id, type: t.type, amount: Number(t.amount), description: t.description,
    status: t.status, created_at: t.created_at, reference: t.reference,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <WalletCard balance={balance} loading={walletLoading}
          onFundWallet={() => setFundOpen(true)} />

        <VirtualAccountCard />

        <button onClick={() => setWithdrawOpen(true)}
          className="w-full h-11 rounded-[10px] bg-surface-elevated border border-border text-sm font-bold text-foreground flex items-center justify-center gap-2 active:scale-[0.98] transition hover:bg-surface-hover">
          <ArrowUpRight className="w-4 h-4 text-primary" />
          Withdraw to Bank
        </button>

        <div id="services">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground">Services</h3>
          </div>
          <ServiceGrid />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground">Recent Transactions</h3>
            <button onClick={() => navigate("/transactions")}
              className="text-xs font-semibold text-primary hover:underline">See All</button>
          </div>
          <TransactionList transactions={recent} loading={txLoading} />
        </div>
      </div>

      <FundWalletDialog open={fundOpen} onOpenChange={setFundOpen} />
      <WithdrawDialog open={withdrawOpen} onOpenChange={setWithdrawOpen} walletBalance={balance} />
      <CheapestDealsPopup />
    </DashboardLayout>
  );
}
