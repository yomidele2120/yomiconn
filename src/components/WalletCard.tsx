import { Wallet, Eye, EyeOff, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface WalletCardProps {
  balance: number;
  loading: boolean;
  onFundWallet: () => void;
}

export default function WalletCard({ balance, loading, onFundWallet }: WalletCardProps) {
  const [showBalance, setShowBalance] = useState(true);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="wallet-gradient rounded-2xl p-6 text-primary-foreground animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          <span className="text-sm font-medium opacity-90">Wallet Balance</span>
        </div>
        <button
          onClick={() => setShowBalance(!showBalance)}
          className="opacity-80 hover:opacity-100 transition-opacity"
        >
          {showBalance ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
        </button>
      </div>
      <div className="mb-6">
        {loading ? (
          <Skeleton className="h-10 w-48 bg-primary-foreground/20" />
        ) : (
          <h2 className="text-3xl font-heading font-bold">
            {showBalance ? formatCurrency(balance) : "₦ ••••••"}
          </h2>
        )}
      </div>
      <Button variant="wallet" size="lg" onClick={onFundWallet} className="bg-primary-foreground/20 hover:bg-primary-foreground/30 border border-primary-foreground/30">
        <Plus className="w-4 h-4" />
        Fund Wallet
      </Button>
    </div>
  );
}
