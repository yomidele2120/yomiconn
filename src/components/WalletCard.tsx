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
    <div className="wallet-gradient rounded-2xl p-4 sm:p-6 text-primary-foreground animate-fade-in">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-xs sm:text-sm font-medium opacity-90">Wallet Balance</span>
        </div>
        <button
          onClick={() => setShowBalance(!showBalance)}
          className="opacity-80 hover:opacity-100 transition-opacity"
        >
          {showBalance ? <Eye className="w-4 h-4 sm:w-5 sm:h-5" /> : <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" />}
        </button>
      </div>
      <div className="mb-4 sm:mb-6">
        {loading ? (
          <Skeleton className="h-8 sm:h-10 w-40 sm:w-48 bg-primary-foreground/20" />
        ) : (
          <h2 className="text-2xl sm:text-3xl font-heading font-bold">
            {showBalance ? formatCurrency(balance) : "₦ ••••••"}
          </h2>
        )}
      </div>
      <Button variant="wallet" size="sm" onClick={onFundWallet} className="bg-primary-foreground/20 hover:bg-primary-foreground/30 border border-primary-foreground/30 text-xs sm:text-sm">
        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        Fund Wallet
      </Button>
    </div>
  );
}
