import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings, getFundingFee } from "@/hooks/useAppSettings";

interface Props { open: boolean; onOpenChange: (open: boolean) => void; }

export default function FundWalletDialog({ open, onOpenChange }: Props) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { data: settings } = useAppSettings();

  const num = Number(amount) || 0;
  const fee = num >= 100 ? getFundingFee(num, settings) : 0;
  const total = num + fee;
  const quick = [500, 1000, 2000, 5000];

  const handleFund = async () => {
    if (num < 200) { toast.error("Minimum amount is ₦200"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("initialize-payment", {
        body: { amount: num, fee },
      });
      if (error) throw error;
      if (data?.authorization_url && data?.reference) {
        window.open(data.authorization_url, "_blank");
        onOpenChange(false);
        navigate(`/payment-waiting?ref=${data.reference}`);
      } else { toast.error("Failed to initialize payment"); }
    } catch (e: any) { toast.error(e.message || "Failed to initialize payment"); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md mx-4 rounded-3xl p-0 border-0 overflow-hidden">
        <div className="bg-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="text-base font-bold">Fund Wallet</h3>
            <button onClick={() => onOpenChange(false)} className="p-1.5 rounded-full hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 py-5 space-y-5">
            <div className="bg-muted/40 rounded-2xl p-5 text-center">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-primary text-2xl font-bold">₦</span>
                <input
                  inputMode="numeric" placeholder="0"
                  value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                  className="bg-transparent text-[40px] font-extrabold text-foreground w-40 text-center caret-current placeholder:text-gray-400 focus:outline-none"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Minimum ₦200</p>
              <div className="flex gap-2 justify-center mt-4 flex-wrap">
                {quick.map((q) => (
                  <button key={q} onClick={() => setAmount(String(q))}
                    className="px-3 h-8 rounded-full bg-card border border-border text-xs font-semibold hover:bg-primary hover:text-white hover:border-primary transition">
                    ₦{q.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {num >= 100 && (
              <div className="rounded-2xl border border-border p-4 space-y-2 text-sm">
                <Row label="Amount to credit" value={`₦${num.toLocaleString()}`} />
                <Row label="Transaction fee" value={`₦${fee.toLocaleString()}`} valueClass="text-warning" />
                <div className="border-t border-border pt-2">
                  <Row label="Total to pay" value={`₦${total.toLocaleString()}`} valueClass="text-primary font-bold text-base" />
                </div>
              </div>
            )}

            <div className="rounded-2xl border-2 border-primary bg-primary/5 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-xs font-bold text-primary">P</div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Pay with Paystack</p>
                <p className="text-xs text-muted-foreground">Secure card / bank transfer</p>
              </div>
              <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-xs">✓</div>
            </div>

            <button onClick={handleFund} disabled={loading || num < 200}
              className="w-full h-[52px] rounded-xl wallet-gradient text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 shadow-premium active:scale-[0.99] transition">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Pay ₦{total.toLocaleString()}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold text-foreground ${valueClass}`}>{value}</span>
    </div>
  );
}
