import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Phone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/useWallet";
import { useQueryClient } from "@tanstack/react-query";
import TransactionPinDialog from "@/components/TransactionPinDialog";

const providers = [
  { id: "1", name: "MTN", color: "bg-warning text-white" },
  { id: "2", name: "Airtel", color: "bg-destructive text-white" },
  { id: "3", name: "Glo", color: "bg-success text-white" },
  { id: "4", name: "9mobile", color: "bg-foreground text-white" },
];

const DEFAULT_AIRTIME_PROVIDER = "cheapdatahub";

export default function AirtimePage() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const { data: wallet } = useWallet();
  const queryClient = useQueryClient();

  const quickAmounts = [100, 200, 500, 1000, 2000, 5000];
  const numAmount = Number(amount) || 0;
  const balance = wallet?.balance ?? 0;

  const handlePurchaseClick = () => {
    if (!provider || !phone || !amount) return toast.error("Please fill all fields");
    if (numAmount < 50) return toast.error("Minimum amount is ₦50");
    if (balance < numAmount) return toast.error("Insufficient balance. Please fund your wallet.");
    setShowPin(true);
  };

  const handlePurchase = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-service", {
        body: {
          service_type: "airtime",
          provider_id: provider,
          phone_number: phone,
          amount: numAmount,
          provider_source: DEFAULT_AIRTIME_PROVIDER,
        },
      });
      if (error) {
        const errBody = typeof error === 'object' && 'context' in error ? await (error as any).context?.json?.().catch(() => null) : null;
        throw new Error(errBody?.error || error.message || "Purchase failed");
      }
      if (data?.error) throw new Error(data.error);
      toast.success("Airtime purchase successful!");
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["service-transactions"] });
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Purchase failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-lg mx-auto pb-24">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl wallet-gradient flex items-center justify-center shadow-premium">
            <Phone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Buy Airtime</h1>
            <p className="text-xs text-muted-foreground">Wallet balance ₦{balance.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-card rounded-3xl p-5 shadow-card space-y-5">
          <div>
            <p className="label-eyebrow mb-3">Select Network</p>
            <div className="grid grid-cols-4 gap-2">
              {providers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id)}
                  className={`h-16 rounded-2xl flex flex-col items-center justify-center text-xs font-semibold border-2 transition ${
                    provider === p.id
                      ? `${p.color} border-transparent shadow-premium scale-[1.02]`
                      : "bg-muted/60 border-transparent text-foreground hover:bg-muted"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="label-eyebrow mb-2">Phone Number</p>
            <Input
              type="tel"
              placeholder="08012345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              maxLength={11}
              className="h-14 rounded-2xl bg-muted/60 border-transparent text-base"
            />
          </div>

          <div>
            <p className="label-eyebrow mb-2">Amount</p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-primary">₦</span>
              <Input
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-14 rounded-2xl bg-muted/60 border-transparent text-base pl-9 font-semibold"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {quickAmounts.map((qa) => (
                <button
                  key={qa}
                  type="button"
                  onClick={() => setAmount(String(qa))}
                  className={`h-10 rounded-xl text-sm font-semibold transition ${
                    numAmount === qa
                      ? "bg-primary text-white"
                      : "bg-muted/60 text-foreground hover:bg-muted"
                  }`}
                >
                  ₦{qa.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {numAmount >= 50 && (
            <div className={`rounded-2xl p-3 text-sm flex justify-between ${balance < numAmount ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
              <span>{balance < numAmount ? "Insufficient balance" : "Balance after purchase"}</span>
              <span className="font-bold">₦{Math.max(0, balance - numAmount).toLocaleString()}</span>
            </div>
          )}

          <button
            onClick={handlePurchaseClick}
            disabled={loading}
            className="w-full h-[52px] rounded-xl wallet-gradient text-white font-semibold shadow-premium active:scale-[0.99] transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Buy Airtime · ₦{numAmount.toLocaleString()}
          </button>
        </div>
      </div>

      <TransactionPinDialog
        open={showPin}
        onOpenChange={setShowPin}
        onVerified={handlePurchase}
        description={`Enter your PIN to confirm ₦${numAmount.toLocaleString()} airtime purchase.`}
      />
    </DashboardLayout>
  );
}
