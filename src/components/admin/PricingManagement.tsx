import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ProviderPlan {
  id: string;
  service_type: "data" | "cable";
  network_id: string;
  provider_source: string;
  provider_plan_id: string;
  name: string;
  size_mb: number | null;
  provider_cost: number;
  profit_amount: number;
  profit_percent: number;
  is_active: boolean;
  last_synced_at: string;
}

const NETWORK_LABEL: Record<string, string> = {
  "1": "MTN", "2": "Airtel", "3": "Glo", "4": "9mobile",
  dstv: "DSTV", gotv: "GOtv", startimes: "Startimes",
};

function sellingPrice(p: ProviderPlan): number {
  return Math.round((Number(p.provider_cost) + Number(p.profit_amount) + (Number(p.provider_cost) * Number(p.profit_percent) / 100)) * 100) / 100;
}

export default function PricingManagement() {
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [serviceFilter, setServiceFilter] = useState<"all" | "data" | "cable">("all");
  const [networkFilter, setNetworkFilter] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [edits, setEdits] = useState<Record<string, { profit_amount?: string; profit_percent?: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["admin-provider-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_plans")
        .select("*")
        .order("service_type")
        .order("network_id")
        .order("provider_cost");
      if (error) throw error;
      return (data || []) as ProviderPlan[];
    },
  });

  const filtered = (plans || []).filter((p) => {
    if (!showInactive && !p.is_active) return false;
    if (serviceFilter !== "all" && p.service_type !== serviceFilter) return false;
    if (networkFilter !== "all" && p.network_id !== networkFilter) return false;
    return true;
  });

  const lastSync = plans?.length
    ? plans.reduce((max, p) => (p.last_synced_at > max ? p.last_synced_at : max), plans[0].last_synced_at)
    : null;

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-cheapdatahub-catalog", { body: {} });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Sync failed");
      toast.success(`Synced ${data.total} plans (${data.inserted} new, ${data.updated} updated, ${data.disabled} disabled)`);
      qc.invalidateQueries({ queryKey: ["admin-provider-plans"] });
    } catch (e: any) {
      toast.error(e.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleActive = async (plan: ProviderPlan) => {
    const { error } = await supabase
      .from("provider_plans")
      .update({ is_active: !plan.is_active })
      .eq("id", plan.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-provider-plans"] });
  };

  const handleSaveProfit = async (plan: ProviderPlan) => {
    const edit = edits[plan.id];
    if (!edit) return;
    const amt = edit.profit_amount !== undefined ? Number(edit.profit_amount) : plan.profit_amount;
    const pct = edit.profit_percent !== undefined ? Number(edit.profit_percent) : plan.profit_percent;
    if (isNaN(amt) || isNaN(pct) || amt < 0 || pct < 0) return toast.error("Invalid profit values");

    setSavingId(plan.id);
    const { error } = await supabase
      .from("provider_plans")
      .update({ profit_amount: amt, profit_percent: pct })
      .eq("id", plan.id);
    setSavingId(null);
    if (error) return toast.error(error.message);
    toast.success("Profit updated");
    setEdits((e) => { const n = { ...e }; delete n[plan.id]; return n; });
    qc.invalidateQueries({ queryKey: ["admin-provider-plans"] });
  };

  const networkOptions = Array.from(new Set((plans || []).map(p => p.network_id))).sort();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle>Pricing Management</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {plans?.length || 0} plans · Last sync: {lastSync ? format(new Date(lastSync), "MMM d, HH:mm") : "never"}
            </p>
          </div>
          <Button onClick={handleSync} disabled={syncing} size="sm">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync from CheapDataHub
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={serviceFilter} onValueChange={(v: any) => { setServiceFilter(v); setNetworkFilter("all"); }}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              <SelectItem value="data">Data</SelectItem>
              <SelectItem value="cable">Cable</SelectItem>
            </SelectContent>
          </Select>
          <Select value={networkFilter} onValueChange={setNetworkFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All networks</SelectItem>
              {networkOptions.map((n) => (
                <SelectItem key={n} value={n}>{NETWORK_LABEL[n] || n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} />
            Show inactive
          </label>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading plans…</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No plans. Click <strong>Sync from CheapDataHub</strong> to import.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left p-2">Service</th>
                  <th className="text-left p-2">Network</th>
                  <th className="text-left p-2">Plan</th>
                  <th className="text-right p-2">Cost</th>
                  <th className="text-right p-2">Profit ₦</th>
                  <th className="text-right p-2">Profit %</th>
                  <th className="text-right p-2">Selling</th>
                  <th className="text-center p-2">Active</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const edit = edits[p.id] || {};
                  const dirty = edit.profit_amount !== undefined || edit.profit_percent !== undefined;
                  const previewAmt = edit.profit_amount !== undefined ? Number(edit.profit_amount) : p.profit_amount;
                  const previewPct = edit.profit_percent !== undefined ? Number(edit.profit_percent) : p.profit_percent;
                  const previewPrice = Math.round((Number(p.provider_cost) + (isNaN(previewAmt) ? 0 : previewAmt) + (Number(p.provider_cost) * (isNaN(previewPct) ? 0 : previewPct) / 100)) * 100) / 100;
                  return (
                    <tr key={p.id} className="border-b hover:bg-muted/30">
                      <td className="p-2"><Badge variant="outline">{p.service_type}</Badge></td>
                      <td className="p-2">{NETWORK_LABEL[p.network_id] || p.network_id}</td>
                      <td className="p-2 max-w-[260px] truncate" title={p.name}>{p.name}</td>
                      <td className="p-2 text-right tabular-nums">₦{Number(p.provider_cost).toLocaleString()}</td>
                      <td className="p-2">
                        <Input
                          type="number"
                          className="h-8 w-20 text-right tabular-nums"
                          value={edit.profit_amount ?? String(p.profit_amount)}
                          onChange={(e) => setEdits((s) => ({ ...s, [p.id]: { ...s[p.id], profit_amount: e.target.value } }))}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          className="h-8 w-20 text-right tabular-nums"
                          value={edit.profit_percent ?? String(p.profit_percent)}
                          onChange={(e) => setEdits((s) => ({ ...s, [p.id]: { ...s[p.id], profit_percent: e.target.value } }))}
                        />
                      </td>
                      <td className="p-2 text-right tabular-nums font-semibold text-primary">
                        ₦{previewPrice.toLocaleString()}
                      </td>
                      <td className="p-2 text-center">
                        <Switch checked={p.is_active} onCheckedChange={() => handleToggleActive(p)} />
                      </td>
                      <td className="p-2">
                        {dirty && (
                          <Button size="sm" variant="outline" disabled={savingId === p.id} onClick={() => handleSaveProfit(p)}>
                            {savingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
