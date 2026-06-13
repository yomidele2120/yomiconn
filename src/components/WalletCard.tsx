import { Wallet, Eye, EyeOff, Plus, History } from "lucide-react";
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
    <div className="relative rounded-[24px] p-6 text-white overflow-hidden shadow-premium wallet-gradient animate-fade-in">
      {/* glow */}
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-black/10 blur-3xl pointer-events-none" />

      <div className="relative flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4" />
          <span className="text-[11px] uppercase tracking-wider font-semibold opacity-90">Total Balance</span>
        </div>
        <button onClick={() => setShow(!show)} className="p-1.5 rounded-full hover:bg-white/10 transition">
          {show ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      </div>

      <div className="relative mb-4">
        {loading ? (
          <Skeleton className="h-10 w-52 bg-white/20" />
        ) : (
          <h2 className="text-[36px] font-extrabold tracking-tight leading-none">
            {show ? formatCurrency(balance) : "₦ ••••••"}
          </h2>
        )}
      </div>

      <div className="relative flex flex-wrap gap-2 mb-5">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium"
          style={{ background: "rgba(18,183,106,0.25)" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#12B76A]" /> Wallet Active
        </span>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium bg-white/20 backdrop-blur">
          Updated just now
        </span>
      </div>

      <div className="relative grid grid-cols-2 gap-2.5">
        <button onClick={onFundWallet}
          className="h-11 rounded-[10px] bg-white text-primary font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition">
          <Plus className="w-4 h-4" /> Fund Wallet
        </button>
        <button onClick={() => navigate("/transactions")}
          className="h-11 rounded-[10px] bg-white/20 text-white font-semibold text-sm flex items-center justify-center gap-1.5 backdrop-blur active:scale-[0.98] transition border border-white/20">
          <History className="w-4 h-4" /> History
        </button>
      </div>
    </div>
  );
}
