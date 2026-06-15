import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Tv } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/useWallet";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import TransactionPinDialog from "@/components/TransactionPinDialog";

const cableProviders = [
  { id: "dstv", name: "DSTV", color: "bg-secondary text-white" },
  { id: "gotv", name: "GOtv", color: "bg-success text-white" },
  { id: "startimes", name: "Startimes", color: "bg-warning text-white" },
];

interface CablePlan {
  id: string;
  name: string;
  price: number;
  provider_source: string;
  provider_plan_id: string;
}

export default function CablePage() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState("");
  const [smartcard, setSmartcard] = useState("");
  const [planId, setPlanId] = useState("");
  const [plans, setPlans] = useState<CablePlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const { data: wallet } = useWallet();
  const queryClient = useQueryClient();
  const balance = wallet?.balance ?? 0;

  useEffect(() => {
    if (provider) fetchPlans(provider);
  }, [provider]);

  const fetchPlans = async (providerId: string) => {
    setPlansLoading(true);
    setPlanId("");
    try {
      const { data, error } = await supabase.functions.invoke("get-cable-plans", {
        body: { provider_id: providerId },
      });
      if (error) throw error;
      setPlans(data?.plans ?? []);
    } catch {
      toast.error("Failed to load plans");
      setPlans([]);
    } finally {
      setPlansLoading(false);
    }
  };

  const selectedPlan = plans.find((p) => p.id === planId);

  const handlePurchaseClick = () => {
    if (!provider || !smartcard || !selectedPlan) return toast.error("Please fill all fields");
    if (balance < selectedPlan.price) return toast.error("Insufficient balance. Please fund your wallet.");
    setShowPin(true);
  };

  const handlePurchase = async () => {
    if (!selectedPlan) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-service", {
        body: {
          service_type: "cable",
          smartcard_no: smartcard,
          plan_id: selectedPlan.provider_plan_id,
          provider_plan_id: selectedPlan.provider_plan_id,
          provider_source: selectedPlan.provider_source,
          amount: selectedPlan.price,
        },
      });
      if (error) {
        const errBody = typeof error === 'object' && 'context' in error ? await (error as any).context?.json?.().catch(() => null) : null;
        throw new Error(errBody?.error || error.message || "Purchase failed");
      }
      if (data?.error || !data?.success) throw new Error(data?.error || "Purchase failed");
      toast.success("Cable subscription successful!");
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
            <Tv className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Cable TV</h1>
            <p className="text-xs text-muted-foreground">Wallet balance ₦{balance.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-card rounded-3xl p-5 shadow-card space-y-5">
          <div>
            <p className="label-eyebrow mb-3">Select Provider</p>
            <div className="grid grid-cols-3 gap-2">
              {cableProviders.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id)}
                  className={`h-16 rounded-2xl flex items-center justify-center text-xs font-semibold border-2 transition ${
                    provider === p.id ? `${p.color} border-transparent shadow-premium scale-[1.02]` : "bg-muted/60 border-transparent hover:bg-muted"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="label-eyebrow mb-2">Smartcard / IUC Number</p>
            <Input
              placeholder="Enter smartcard number"
              value={smartcard}
              onChange={(e) => setSmartcard(e.target.value.replace(/\s/g, ""))}
              className="h-14 rounded-2xl bg-muted/60 border-transparent text-base"
            />
          </div>

          <div>
            <p className="label-eyebrow mb-2">Subscription Plan</p>
            {plansLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}
              </div>
            ) : plans.length === 0 ? (
              <div className="rounded-2xl bg-muted/60 p-6 text-center text-sm text-muted-foreground">
                {provider ? "No plans available" : "Pick a provider first"}
              </div>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {plans.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlanId(p.id)}
                    className={`w-full flex items-center justify-between rounded-2xl p-4 border-2 transition ${
                      planId === p.id ? "border-primary bg-primary/5 shadow-premium" : "border-transparent bg-muted/60 hover:bg-muted"
                    }`}
                  >
                    <span className="text-sm font-semibold">{p.name}</span>
                    <span className="text-primary font-bold">₦{p.price.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedPlan && (
            <div className={`rounded-2xl p-3 text-sm flex justify-between ${balance < selectedPlan.price ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
              <span>{balance < selectedPlan.price ? "Insufficient balance" : "Balance after purchase"}</span>
              <span className="font-bold">₦{Math.max(0, balance - selectedPlan.price).toLocaleString()}</span>
            </div>
          )}

          <button
            onClick={handlePurchaseClick}
            disabled={loading || !selectedPlan}
            className="w-full h-[52px] rounded-xl wallet-gradient text-white font-semibold shadow-premium active:scale-[0.99] transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {selectedPlan ? `Subscribe · ₦${selectedPlan.price.toLocaleString()}` : "Select a plan"}
          </button>
        </div>
      </div>

      <TransactionPinDialog
        open={showPin}
        onOpenChange={setShowPin}
        onVerified={handlePurchase}
        description={`Enter your PIN to confirm ₦${selectedPlan?.price.toLocaleString() || '0'} cable subscription.`}
      />
    </DashboardLayout>
  );
}
