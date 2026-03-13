import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/useWallet";
import { useQueryClient } from "@tanstack/react-query";

const discos = [
  { id: "ikeja-electric", name: "Ikeja Electric" },
  { id: "eko-electric", name: "Eko Electric" },
  { id: "abuja-electric", name: "Abuja Electric" },
  { id: "kano-electric", name: "Kano Electric" },
  { id: "enugu-electric", name: "Enugu Electric" },
  { id: "ibadan-electric", name: "Ibadan Electric" },
  { id: "port-harcourt-electric", name: "Port Harcourt Electric" },
  { id: "jos-electric", name: "Jos Electric" },
  { id: "kaduna-electric", name: "Kaduna Electric" },
  { id: "benin-electric", name: "Benin Electric" },
  { id: "yola-electric", name: "Yola Electric" },
];

export default function ElectricityPage() {
  const navigate = useNavigate();
  const [disco, setDisco] = useState("");
  const [meterNo, setMeterNo] = useState("");
  const [meterType, setMeterType] = useState("prepaid");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const { data: wallet } = useWallet();
  const queryClient = useQueryClient();

  const handlePurchase = async () => {
    if (!disco || !meterNo || !amount || !phone) {
      toast.error("Please fill all fields");
      return;
    }
    const numAmount = Number(amount);
    if (numAmount < 500) {
      toast.error("Minimum amount is ₦500");
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
          service_type: "electricity",
          disco,
          meter_no: meterNo,
          meter_type: meterType,
          amount: numAmount,
          phone_number: phone,
        },
      });
      if (error) throw error;
      toast.success("Electricity token purchase successful!");
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
              <Zap className="w-5 h-5 text-warning" /> Buy Electricity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Distribution Company</Label>
              <Select value={disco} onValueChange={setDisco}>
                <SelectTrigger><SelectValue placeholder="Select disco" /></SelectTrigger>
                <SelectContent>
                  {discos.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Meter Type</Label>
              <Select value={meterType} onValueChange={setMeterType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prepaid">Prepaid</SelectItem>
                  <SelectItem value="postpaid">Postpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Meter Number</Label>
              <Input placeholder="Enter meter number" value={meterNo} onChange={(e) => setMeterNo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input type="tel" placeholder="08012345678" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={11} />
            </div>
            <div className="space-y-2">
              <Label>Amount (₦)</Label>
              <Input type="number" placeholder="Enter amount" value={amount} onChange={(e) => setAmount(e.target.value)} min={500} />
            </div>
            <Button onClick={handlePurchase} className="w-full" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              Buy Electricity · ₦{Number(amount || 0).toLocaleString()}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
