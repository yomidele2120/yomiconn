import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import WalletCard from "@/components/WalletCard";
import ServiceGrid from "@/components/ServiceGrid";
import TransactionList from "@/components/TransactionList";
import FundWalletDialog from "@/components/FundWalletDialog";
import { useWallet, useWalletTransactions } from "@/hooks/useWallet";

export default function Dashboard() {
  const [fundOpen, setFundOpen] = useState(false);
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: transactions, isLoading: txLoading } = useWalletTransactions();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <WalletCard
          balance={wallet?.balance ?? 0}
          loading={walletLoading}
          onFundWallet={() => setFundOpen(true)}
        />

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Services</h3>
          <ServiceGrid />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Recent Transactions</h3>
          <TransactionList transactions={transactions ?? []} loading={txLoading} />
        </div>
      </div>

      <FundWalletDialog open={fundOpen} onOpenChange={setFundOpen} />
    </DashboardLayout>
  );
}
