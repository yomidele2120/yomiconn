import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Phone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/useWallet";
import { useQueryClient } from "@tanstack/react-query";

const providers = [
  { id: "1", name: "MTN" },
  { id: "2", name: "Airtel" },
  { id: "3", name: "Glo" },
  { id: "4", name: "9mobile" },
];

// Default provider source for airtime — can be toggled per-network in future
const DEFAULT_AIRTIME_PROVIDER = "cheapdatahub";

export default function AirtimePage() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const { data: wallet } = useWallet();
  const queryClient = useQueryClient();

  const quickAmounts = [100, 200, 500, 1000];

  const handlePurchase = async () => {
    if (!provider || !phone || !amount) {
      toast.error("Please fill all fields");
      return;
    }
    const numAmount = Number(amount);
    if (numAmount < 50) {
      toast.error("Minimum amount is ₦50");
      return;
    }
    if ((wallet?.balance ?? 0) < numAmount) {
      toast.error("Insufficient wallet balance");
      return;
    }

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
      if (error) throw error;
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
      <div className="space-y-4">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-heading">
              <Phone className="w-5 h-5 text-primary" /> Buy Airtime
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Network Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger><SelectValue placeholder="Select network" /></SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input type="tel" placeholder="08012345678" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={11} />
            </div>
            <div className="space-y-2">
              <Label>Amount (₦)</Label>
              <Input type="number" placeholder="Enter amount" value={amount} onChange={(e) => setAmount(e.target.value)} min={50} />
            </div>
            <div className="flex gap-2">
              {quickAmounts.map((qa) => (
                <Button key={qa} variant="outline" size="sm" onClick={() => setAmount(String(qa))} className="flex-1">
                  ₦{qa}
                </Button>
              ))}
            </div>
            <Button onClick={handlePurchase} className="w-full" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              Buy Airtime · ₦{Number(amount || 0).toLocaleString()}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
