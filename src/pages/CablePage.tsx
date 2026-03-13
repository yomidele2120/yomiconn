import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Tv } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/useWallet";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

const cableProviders = [
  { id: "dstv", name: "DSTV" },
  { id: "gotv", name: "GOtv" },
  { id: "startimes", name: "Startimes" },
];

interface CablePlan {
  id: string;
  name: string;
  price: number;
}

export default function CablePage() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState("");
  const [smartcard, setSmartcard] = useState("");
  const [planId, setPlanId] = useState("");
  const [plans, setPlans] = useState<CablePlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const { data: wallet } = useWallet();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (provider) {
      fetchPlans(provider);
    }
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

  const handlePurchase = async () => {
    if (!provider || !smartcard || !planId || !selectedPlan) {
      toast.error("Please fill all fields");
      return;
    }
    if ((wallet?.balance ?? 0) < selectedPlan.price) {
      toast.error("Insufficient wallet balance");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-service", {
        body: {
          service_type: "cable",
          smartcard_no: smartcard,
          plan_id: planId,
          amount: selectedPlan.price,
        },
      });
      if (error) throw error;
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
      <div className="space-y-4">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-heading">
              <Tv className="w-5 h-5 text-destructive" /> Cable TV Subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Cable Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                <SelectContent>
                  {cableProviders.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Smartcard Number</Label>
              <Input placeholder="Enter smartcard number" value={smartcard} onChange={(e) => setSmartcard(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Subscription Plan</Label>
              {plansLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={planId} onValueChange={setPlanId} disabled={!plans.length}>
                  <SelectTrigger><SelectValue placeholder={plans.length ? "Select plan" : "Select provider first"} /></SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — ₦{p.price.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedPlan && (
              <div className="p-3 rounded-lg bg-muted text-center">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-heading font-bold text-foreground">
                  ₦{selectedPlan.price.toLocaleString()}
                </p>
              </div>
            )}

            <Button onClick={handlePurchase} className="w-full" disabled={loading || !selectedPlan}>
              {loading && <Loader2 className="animate-spin" />}
              Subscribe
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
