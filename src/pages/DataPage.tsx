import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Wifi } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/useWallet";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

const networks = [
  { id: "1", name: "MTN" },
  { id: "2", name: "Airtel" },
  { id: "3", name: "Glo" },
  { id: "4", name: "9mobile" },
];

interface DataBundle {
  id: string;
  name: string;
  price: number;
  displayPrice: number;
}

function applyMarkup(bundle: { size_mb?: number; price: number }): number {
  const sizeMB = bundle.size_mb || 0;
  if (sizeMB === 500) return bundle.price + 50;
  if (sizeMB === 1024) return bundle.price + 70;
  if (sizeMB >= 4096) return bundle.price + 100;
  return bundle.price;
}

export default function DataPage() {
  const navigate = useNavigate();
  const [network, setNetwork] = useState("");
  const [phone, setPhone] = useState("");
  const [bundleId, setBundleId] = useState("");
  const [bundles, setBundles] = useState<DataBundle[]>([]);
  const [bundlesLoading, setBundlesLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const { data: wallet } = useWallet();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (network) {
      fetchBundles(network);
    }
  }, [network]);

  const fetchBundles = async (networkId: string) => {
    setBundlesLoading(true);
    setBundleId("");
    try {
      const { data, error } = await supabase.functions.invoke("get-data-bundles", {
        body: { network_id: networkId },
      });
      if (error) throw error;
      setBundles(data?.bundles ?? []);
    } catch (error: any) {
      toast.error("Failed to load bundles");
      setBundles([]);
    } finally {
      setBundlesLoading(false);
    }
  };

  const selectedBundle = bundles.find((b) => b.id === bundleId);

  const handlePurchase = async () => {
    if (!network || !phone || !bundleId || !selectedBundle) {
      toast.error("Please fill all fields");
      return;
    }
    if ((wallet?.balance ?? 0) < selectedBundle.displayPrice) {
      toast.error("Insufficient wallet balance");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-service", {
        body: {
          service_type: "data",
          bundle_id: bundleId,
          phone_number: phone,
          amount: selectedBundle.displayPrice,
        },
      });
      if (error) throw error;
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
      <div className="space-y-4">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-heading">
              <Wifi className="w-5 h-5 text-accent" /> Buy Data Bundle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Network</Label>
              <Select value={network} onValueChange={setNetwork}>
                <SelectTrigger><SelectValue placeholder="Select network" /></SelectTrigger>
                <SelectContent>
                  {networks.map((n) => (
                    <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input type="tel" placeholder="08012345678" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={11} />
            </div>

            <div className="space-y-2">
              <Label>Data Bundle</Label>
              {bundlesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <Select value={bundleId} onValueChange={setBundleId} disabled={!bundles.length}>
                  <SelectTrigger><SelectValue placeholder={bundles.length ? "Select bundle" : "Select a network first"} /></SelectTrigger>
                  <SelectContent>
                    {bundles.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} — ₦{b.displayPrice.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedBundle && (
              <div className="p-3 rounded-lg bg-muted text-center">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-heading font-bold text-foreground">
                  ₦{selectedBundle.displayPrice.toLocaleString()}
                </p>
              </div>
            )}

            <Button onClick={handlePurchase} className="w-full" disabled={loading || !selectedBundle}>
              {loading && <Loader2 className="animate-spin" />}
              Buy Data Bundle
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
