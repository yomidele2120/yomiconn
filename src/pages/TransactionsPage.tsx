import DashboardLayout from "@/components/DashboardLayout";
import TransactionList from "@/components/TransactionList";
import { useWalletTransactions, useServiceTransactions } from "@/hooks/useWallet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function TransactionsPage() {
  const { data: walletTx, isLoading: wtLoading } = useWalletTransactions();
  const { data: serviceTx, isLoading: stLoading } = useServiceTransactions();

  const serviceAsTx = (serviceTx ?? []).map((s) => ({
    id: s.id,
    type: "debit" as const,
    amount: s.amount,
    description: `${s.service_type} - ${s.provider || ""}`,
    status: s.status,
    created_at: s.created_at,
  }));

  return (
    <DashboardLayout>
      <h2 className="text-xl font-heading font-bold mb-4">Transactions</h2>
      <Tabs defaultValue="wallet">
        <TabsList className="w-full">
          <TabsTrigger value="wallet" className="flex-1">Wallet</TabsTrigger>
          <TabsTrigger value="services" className="flex-1">Services</TabsTrigger>
        </TabsList>
        <TabsContent value="wallet" className="mt-4">
          <TransactionList transactions={walletTx ?? []} loading={wtLoading} />
        </TabsContent>
        <TabsContent value="services" className="mt-4">
          <TransactionList transactions={serviceAsTx} loading={stLoading} />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
