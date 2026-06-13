import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import WalletCard from "@/components/WalletCard";
import ServiceGrid from "@/components/ServiceGrid";
import TransactionList from "@/components/TransactionList";
import FundWalletDialog from "@/components/FundWalletDialog";
import { useWallet, useWalletTransactions } from "@/hooks/useWallet";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [fundOpen, setFundOpen] = useState(false);
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: transactions, isLoading: txLoading } = useWalletTransactions();
  const navigate = useNavigate();

  const recent = (transactions ?? []).slice(0, 3).map((t: any) => ({
    id: t.id, type: t.type, amount: Number(t.amount), description: t.description,
    status: t.status, created_at: t.created_at, reference: t.reference,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <WalletCard balance={Number(wallet?.balance ?? 0)} loading={walletLoading}
          onFundWallet={() => setFundOpen(true)} />

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
    </DashboardLayout>
  );
}
