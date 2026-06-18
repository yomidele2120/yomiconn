import { Eye, EyeOff, Plus, History } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

interface WalletCardProps {
  balance: number;
  loading: boolean;
  onFundWallet: () => void;
}

export default function WalletCard({ balance, loading, onFundWallet }: WalletCardProps) {
  const [show, setShow] = useState(true);
  const navigate = useNavigate();
  const formatCurrency = (a: number) =>
    new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 2 }).format(a);

  return (
    <div className="relative rounded-[20px] p-6 bg-card border border-border shadow-premium animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <span className="label-eyebrow">Total Balance</span>
        <button onClick={() => setShow(!show)}
          className="w-8 h-8 rounded-full hover:bg-surface-hover flex items-center justify-center transition">
          {show ? <Eye className="w-4 h-4 text-muted-foreground" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
        </button>
      </div>

      <div className="mb-4">
        {loading ? (
          <Skeleton className="h-10 w-56 bg-surface-elevated" />
        ) : (
          <h2 className="text-foreground text-[38px] font-extrabold tracking-tight leading-none">
            {show ? formatCurrency(balance) : "₦ ••••••"}
          </h2>
        )}
      </div>

      <div className="h-px w-full mb-4" style={{ background: "hsl(var(--primary) / 0.3)" }} />

      <div className="flex flex-wrap gap-2 mb-5">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium pill-success">
          <span className="w-1.5 h-1.5 rounded-full bg-success" /> Active
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-surface-elevated text-muted-strong">
          <span className="w-1 h-1 rounded-full bg-muted-strong" /> Just updated
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button onClick={onFundWallet}
          className="h-11 rounded-[10px] bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition">
          <Plus className="w-4 h-4" /> Fund Wallet
        </button>
        <button onClick={() => navigate("/transactions")}
          className="h-11 rounded-[10px] bg-surface-elevated text-muted-foreground border border-border font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition hover:bg-surface-hover">
          <History className="w-4 h-4" /> History
        </button>
      </div>
    </div>
  );
}
