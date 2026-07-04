import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Wifi, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/useWallet";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TransactionPinDialog from "@/components/TransactionPinDialog";
import { detectNetwork } from "@/lib/networkDetect";

const networks = [
  { id: "1", name: "MTN", color: "bg-warning text-white" },
  { id: "2", name: "Airtel", color: "bg-destructive text-white" },
  { id: "3", name: "Glo", color: "bg-success text-white" },
  { id: "4", name: "9mobile", color: "bg-foreground text-white" },
];

const PROVIDERS = [
  { key: "cheapdatahub", label: "Provider 1", sub: "CheapDataHub" },
  { key: "elrufaidatalink", label: "Provider 2", sub: "ElRufaiDataSub" },
] as const;
type ProviderKey = typeof PROVIDERS[number]["key"] | "";

interface DataBundle {
  id: string;
  name: string;
  price: number;
  displayPrice: number;
  provider_source: string;
  provider_plan_id: string;
}

export default function DataPage() {
  const navigate = useNavigate();
  const [network, setNetwork] = useState("");
  const [phone, setPhone] = useState("");
  const [bundleId, setBundleId] = useState("");
  const [bundles, setBundles] = useState<DataBundle[]>([]);
  const [bundlesLoading, setBundlesLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [providerKey, setProviderKey] = useState<ProviderKey>("");
  const [bundleError, setBundleError] = useState("");
  const [autoDetected, setAutoDetected] = useState(false);
  const { data: wallet } = useWallet();
  const queryClient = useQueryClient();
  const balance = wallet?.balance ?? 0;

  useEffect(() => {
    setBundles([]);
    setBundleId("");
    setBundleError("");
    if (network && providerKey) fetchBundles(network, providerKey);
  }, [network, providerKey]);

  // Auto-detect network from phone prefix
  useEffect(() => {
    const detected = detectNetwork(phone);
    if (detected && detected.id !== network) {
      setNetwork(detected.id);
      setAutoDetected(true);
    } else if (!detected) {
      setAutoDetected(false);
    }
  }, [phone]);

  const fetchBundles = async (networkId: string, source: ProviderKey) => {
    setBundlesLoading(true);
    setBundleId("");
    setBundleError("");
    try {
      const { data, error } = await supabase.functions.invoke("get-data-bundles", {
        body: { network_id: networkId, provider_source: source },
      });
      if (error) throw error;
      const list = data?.bundles ?? [];
      setBundles(list);
      if (!list.length) setBundleError("No bundles available for this network/provider.");
    } catch {
      setBundleError("Unable to load available bundles. Please try again.");
      setBundles([]);
    } finally {
      setBundlesLoading(false);
    }
  };

  const selectedBundle = bundles.find((b) => b.id === bundleId);

  const handlePurchaseClick = () => {
    if (!network || !phone || !selectedBundle) return toast.error("Please fill all fields");
    if (balance < selectedBundle.displayPrice) return toast.error("Insufficient balance. Please fund your wallet.");
    setShowPin(true);
  };

  const handlePurchase = async () => {
    if (!selectedBundle) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-service", {
        body: {
          service_type: "data",
          bundle_id: selectedBundle.provider_plan_id,
          provider_plan_id: selectedBundle.provider_plan_id,
          provider_source: selectedBundle.provider_source,
          provider_id: network,
          network_id: network,
          phone_number: phone,
          amount: selectedBundle.displayPrice,
        },
      });
      if (error) {
        const errBody = typeof error === 'object' && 'context' in error ? await (error as any).context?.json?.().catch(() => null) : null;
        throw new Error(errBody?.error || error.message || "Purchase failed");
      }
      if (data?.error || !data?.success) throw new Error(data?.error || "Purchase failed");
      toast.success("Data bundle purchase successful!");
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
            <Wifi className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Buy Data Bundle</h1>
            <p className="text-xs text-muted-foreground">Wallet balance ₦{balance.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-card rounded-3xl p-5 shadow-card space-y-5">
          {/* 1. Phone Number */}
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

          {/* 2. Network */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="label-eyebrow">Select Network</p>
              {autoDetected && network && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
                  <Sparkles className="w-3 h-3" /> Auto-detected
                </span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {networks.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => { setNetwork(n.id); setAutoDetected(false); }}
                  className={`h-16 rounded-2xl flex items-center justify-center text-xs font-semibold border-2 transition ${
                    network === n.id ? `${n.color} border-transparent shadow-premium scale-[1.02]` : "bg-muted/60 border-transparent hover:bg-muted"
                  }`}
                >
                  {n.name}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Provider dropdown */}
          <div>
            <p className="label-eyebrow mb-2">Select Provider</p>
            <Select value={providerKey} onValueChange={(v) => setProviderKey(v as ProviderKey)}>
              <SelectTrigger className="h-14 rounded-2xl bg-muted/60 border-transparent text-base">
                <SelectValue placeholder="Choose a provider" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    <span className="font-semibold">{p.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{p.sub}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 4. Bundle */}
          <div>
            <p className="label-eyebrow mb-2">Choose Bundle</p>
            {!providerKey ? (
              <div className="rounded-2xl bg-muted/60 p-6 text-center text-sm text-muted-foreground">
                Select a provider to view bundles
              </div>
            ) : !network ? (
              <div className="rounded-2xl bg-muted/60 p-6 text-center text-sm text-muted-foreground">
                Pick a network first
              </div>
            ) : bundlesLoading ? (
              <div className="grid grid-cols-2 gap-2">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
              </div>
            ) : bundleError ? (
              <div className="rounded-2xl bg-destructive/10 p-4 text-center text-sm text-destructive">
                {bundleError}
                <button
                  onClick={() => fetchBundles(network, providerKey)}
                  className="block mx-auto mt-2 text-xs font-semibold underline text-destructive"
                >
                  Retry
                </button>
              </div>
            ) : bundles.length === 0 ? (
              <div className="rounded-2xl bg-muted/60 p-6 text-center text-sm text-muted-foreground">
                No bundles available
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-1">
                {bundles.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBundleId(b.id)}
                    className={`rounded-2xl p-3 text-left border-2 transition ${
                      bundleId === b.id
                        ? "border-primary bg-primary/5 shadow-premium"
                        : "border-transparent bg-muted/60 hover:bg-muted"
                    }`}
                  >
                    <div className="text-sm font-semibold leading-tight">{b.name}</div>
                    <div className="text-primary font-bold mt-1">₦{b.displayPrice.toLocaleString()}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedBundle && (
            <div className={`rounded-2xl p-3 text-sm flex justify-between ${balance < selectedBundle.displayPrice ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
              <span>{balance < selectedBundle.displayPrice ? "Insufficient balance" : "Balance after purchase"}</span>
              <span className="font-bold">₦{Math.max(0, balance - selectedBundle.displayPrice).toLocaleString()}</span>
            </div>
          )}

          <button
            onClick={handlePurchaseClick}
            disabled={loading || !selectedBundle}
            className="w-full h-[52px] rounded-xl wallet-gradient text-white font-semibold shadow-premium active:scale-[0.99] transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {selectedBundle ? `Buy · ₦${selectedBundle.displayPrice.toLocaleString()}` : "Select a bundle"}
          </button>
        </div>
      </div>

      <TransactionPinDialog
        open={showPin}
        onOpenChange={setShowPin}
        onVerified={handlePurchase}
        description={`Enter your PIN to confirm ₦${selectedBundle?.displayPrice.toLocaleString() || '0'} data purchase.`}
      />
    </DashboardLayout>
  );
}
