import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { Badge } from "@/components/ui/badge";

const cableProviders = [
  { id: "dstv", name: "DSTV" },
  { id: "gotv", name: "GOTV" },
  { id: "startimes", name: "Startimes" },
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
  const { cable } = useParams();
  const [planId, setPlanId] = useState("");
  const [phone, setPhone] = useState("");
  const [cablePlans, setCablePlans] = useState<CablePlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const { data: wallet } = useWallet();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (cable) {
      fetchCablePlans(cable);
    }
  }, [cable]);

  const fetchCablePlans = async (cable: string) => {
    setPlansLoading(true);
    setPlanId("");
    try {
      const { data, error } = await supabase.functions.invoke("get-cable-plans", {
        body: { cable },
      });
      if (error) throw error;
      setCablePlans(data?.plans ?? []);
    } catch (error: any) {
      toast.error("Failed to load cable plans");
      setCablePlans([]);
    } finally {
      setPlansLoading(false);
    }
  };

  const selectedPlan = cablePlans.find((b) => b.id === planId);

  const handlePurchase = async () => {
    if (!cable || !phone || !planId || !selectedPlan) {
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
          plan_id: selectedPlan.provider_plan_id,
          provider_plan_id: selectedPlan.provider_plan_id,
          provider_source: selectedPlan.provider_source,
          cable: cable,
          phone_number: phone,
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
              <Tv className="w-5 h-5 text-primary" /> {cable?.toUpperCase()} Subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Cable Provider</Label>
              <Select value={cable} disabled>
                <SelectTrigger>
                  <SelectValue placeholder="Select cable provider" />
                </SelectTrigger>
                <SelectContent>
                  {cableProviders.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Smart Card/IUC Number</Label>
              <Input type="tel" placeholder="Enter number" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Cable Plan</Label>
              {plansLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <Select value={planId} onValueChange={setPlanId} disabled={!cablePlans.length}>
                  <SelectTrigger>
                    <SelectValue placeholder={cablePlans.length ? "Select a plan" : "Select a cable provider first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {cablePlans.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} — ₦{b.price.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedPlan && (
              <div className="p-3 rounded-lg bg-muted text-center space-y-1">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-heading font-bold text-foreground">₦{selectedPlan.price.toLocaleString()}</p>
                <Badge variant="outline" className="text-xs">
                  {selectedPlan.provider_source === "blessdata" ? "BlessData" : "CheapDataHub"}
                </Badge>
              </div>
            )}

            <Button onClick={handlePurchase} className="w-full" disabled={loading || !selectedPlan}>
              {loading && <Loader2 className="animate-spin" />}
              Subscribe Now
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
