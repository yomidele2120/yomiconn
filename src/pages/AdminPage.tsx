import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { LogOut, Shield, Zap, AlertTriangle, Ban, RefreshCw, Settings, Loader2, Globe, Trash2, Plus, Key, Copy, Eye, EyeOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function AdminPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [fundUserId, setFundUserId] = useState("");
  const [fundAmount, setFundAmount] = useState("");

  // Settings state
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [profit1to3, setProfit1to3] = useState("");
  const [profit4plus, setProfit4plus] = useState("");
  const [feeBelow5k, setFeeBelow5k] = useState("");
  const [feeAbove5k, setFeeAbove5k] = useState("");
  const [pinRequired, setPinRequired] = useState("true");

  // API providers state
  const [newProviderKey, setNewProviderKey] = useState("");
  const [newProviderName, setNewProviderName] = useState("");
  const [newProviderUrl, setNewProviderUrl] = useState("");

  // Reseller API keys state
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newPartnerRateLimit, setNewPartnerRateLimit] = useState("30");
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  const { data: isAdmin, isLoading: roleLoading } = useQuery({
    queryKey: ["admin-check", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").single();
      return !!data;
    },
    enabled: !!user,
  });

  const { data: serviceTx } = useQuery({
    queryKey: ["admin-service-tx", statusFilter],
    queryFn: async () => {
      let query = supabase.from("service_transactions").select("*").order("created_at", { ascending: false }).limit(100);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data } = await query;
      return data || [];
    },
    enabled: isAdmin === true,
  });

  const { data: walletTx } = useQuery({
    queryKey: ["admin-wallet-tx"],
    queryFn: async () => {
      const { data } = await supabase.from("wallet_transactions").select("*").order("created_at", { ascending: false }).limit(100);
      return data || [];
    },
    enabled: isAdmin === true,
  });

  const { data: webhookLogs } = useQuery({
    queryKey: ["admin-webhooks"],
    queryFn: async () => {
      const { data } = await supabase.from("webhook_logs").select("*").order("created_at", { ascending: false }).limit(50);
      return data || [];
    },
    enabled: isAdmin === true,
  });

  const { data: fraudEvents } = useQuery({
    queryKey: ["admin-fraud-events"],
    queryFn: async () => {
      const { data } = await supabase.from("fraud_events").select("*").order("created_at", { ascending: false }).limit(50);
      return data || [];
    },
    enabled: isAdmin === true,
  });

  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, email, full_name, is_frozen, frozen_reason, frozen_at").order("created_at", { ascending: false }).limit(100);
      return data || [];
    },
    enabled: isAdmin === true,
  });

  // Load API providers
  const { data: apiProviders, refetch: refetchProviders } = useQuery({
    queryKey: ["admin-api-providers"],
    queryFn: async () => {
      const { data } = await supabase.from("api_providers").select("*").order("created_at", { ascending: true });
      return data || [];
    },
    enabled: isAdmin === true,
  });

  // Load reseller API keys
  const { data: resellerKeys, refetch: refetchResellerKeys } = useQuery({
    queryKey: ["admin-reseller-keys"],
    queryFn: async () => {
      const { data } = await supabase.from("reseller_api_keys").select("*").order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
    enabled: isAdmin === true,
  });

  // Load settings
  const { data: appSettings } = useQuery({
    queryKey: ["admin-app-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("key, value");
      const map: Record<string, any> = {};
      for (const row of data || []) {
        map[row.key] = row.value;
      }
      setProfit1to3(String(map.data_profit_1_3gb ?? 30));
      setProfit4plus(String(map.data_profit_4gb_plus ?? 50));
      setFeeBelow5k(String(map.funding_fee_below_5000 ?? 35));
      setFeeAbove5k(String(map.funding_fee_above_5000 ?? 50));
      setPinRequired(String(map.pin_required ?? "true"));
      return map;
    },
    enabled: isAdmin === true,
  });

  const handleFreezeToggle = async (userId: string, currentlyFrozen: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({
        is_frozen: !currentlyFrozen,
        frozen_reason: !currentlyFrozen ? "Manually frozen by admin" : null,
        frozen_at: !currentlyFrozen ? new Date().toISOString() : null,
      })
      .eq("user_id", userId);

    if (error) {
      toast.error("Failed to update account status");
    } else {
      toast.success(currentlyFrozen ? "Account unfrozen" : "Account frozen");
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
    }
  };

  const handleManualFund = async () => {
    if (!fundUserId || !fundAmount || Number(fundAmount) <= 0) {
      toast.error("Enter valid user ID and amount");
      return;
    }
    const { error } = await supabase.rpc("credit_wallet" as any, {
      p_user_id: fundUserId,
      p_amount: Number(fundAmount),
    });
    if (error) {
      toast.error("Fund failed: " + error.message);
    } else {
      toast.success(`₦${Number(fundAmount).toLocaleString()} credited`);
      setFundUserId("");
      setFundAmount("");
    }
  };

  const handleToggleProvider = async (id: string, currentActive: boolean) => {
    const { error } = await supabase.from("api_providers").update({ is_active: !currentActive } as any).eq("id", id);
    if (error) toast.error("Failed to update provider");
    else { toast.success(`Provider ${!currentActive ? "activated" : "deactivated"}`); refetchProviders(); }
  };

  const handleUpdateProviderUrl = async (id: string, url: string) => {
    const { error } = await supabase.from("api_providers").update({ base_url: url } as any).eq("id", id);
    if (error) toast.error("Failed to update URL");
    else { toast.success("Base URL updated"); refetchProviders(); }
  };

  const handleAddProvider = async () => {
    if (!newProviderKey || !newProviderName) { toast.error("Key and name required"); return; }
    const { error } = await supabase.from("api_providers").insert({ provider_key: newProviderKey, display_name: newProviderName, base_url: newProviderUrl, is_active: false } as any);
    if (error) toast.error("Failed to add: " + error.message);
    else { toast.success("Provider added"); setNewProviderKey(""); setNewProviderName(""); setNewProviderUrl(""); refetchProviders(); }
  };

  const handleDeleteProvider = async (id: string) => {
    const { error } = await supabase.from("api_providers").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else { toast.success("Provider removed"); refetchProviders(); }
  };

  // ── Reseller API Key handlers ──
  const generateApiKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const segments = Array.from({ length: 4 }, () =>
      Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    );
    return `yk_${segments.join('_')}`;
  };

  const handleCreateResellerKey = async () => {
    if (!newPartnerName.trim()) { toast.error("Partner name is required"); return; }
    const apiKey = generateApiKey();
    const { error } = await supabase.from("reseller_api_keys").insert({
      api_key: apiKey,
      partner_name: newPartnerName.trim(),
      rate_limit_per_minute: Number(newPartnerRateLimit) || 30,
      created_by: user!.id,
    } as any);
    if (error) { toast.error("Failed: " + error.message); return; }
    toast.success("API key created! Copy it now — it won't be shown again in full.");
    setNewPartnerName("");
    setNewPartnerRateLimit("30");
    setVisibleKeys(prev => ({ ...prev, [apiKey]: true }));
    refetchResellerKeys();
  };

  const handleToggleResellerKey = async (id: string, currentActive: boolean) => {
    const { error } = await supabase.from("reseller_api_keys").update({ is_active: !currentActive } as any).eq("id", id);
    if (error) toast.error("Failed to update");
    else { toast.success(`Key ${!currentActive ? "activated" : "deactivated"}`); refetchResellerKeys(); }
  };

  const handleDeleteResellerKey = async (id: string) => {
    const { error } = await supabase.from("reseller_api_keys").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else { toast.success("Key deleted"); refetchResellerKeys(); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const maskKey = (key: string) => key.slice(0, 6) + '•'.repeat(20) + key.slice(-4);

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      const updates = [
        { key: "data_profit_1_3gb", value: Number(profit1to3) },
        { key: "data_profit_4gb_plus", value: Number(profit4plus) },
        { key: "funding_fee_below_5000", value: Number(feeBelow5k) },
        { key: "funding_fee_above_5000", value: Number(feeAbove5k) },
        { key: "pin_required", value: pinRequired },
      ];

      for (const u of updates) {
        const { error } = await supabase
          .from("app_settings")
          .update({ value: u.value as any, updated_at: new Date().toISOString() })
          .eq("key", u.key);
        if (error) throw error;
      }

      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-app-settings"] });
    } catch (error: any) {
      toast.error("Failed to save: " + error.message);
    } finally {
      setSettingsSaving(false);
    }
  };

  if (roleLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Loading...</p></div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-heading font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">You don't have admin privileges.</p>
            <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      successful: "default", processing: "secondary", failed: "destructive",
      pending: "outline", initiated: "outline", refunded: "secondary",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg wallet-gradient flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-heading font-bold text-foreground">YOMIconnect Admin</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>Dashboard</Button>
            <Button variant="ghost" size="icon" onClick={async () => { await signOut(); navigate("/auth"); }}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs defaultValue="services">
          <TabsList className="flex-wrap">
            <TabsTrigger value="services">Service Tx</TabsTrigger>
            <TabsTrigger value="wallet">Wallet Tx</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="fraud">Fraud Events</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="api-config">API Config</TabsTrigger>
            <TabsTrigger value="reseller-keys">Reseller Keys</TabsTrigger>
          </TabsList>

          {/* Service Transactions */}
          <TabsContent value="services" className="mt-4">
            <div className="flex gap-2 mb-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="successful">Successful</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="initiated">Initiated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  <th className="text-left p-2 text-muted-foreground font-medium">Date</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Type</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Amount</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Phone</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Reference</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Status</th>
                </tr></thead>
                <tbody>
                  {(serviceTx || []).map((tx) => (
                    <tr key={tx.id} className="border-b border-border hover:bg-muted/50">
                      <td className="p-2">{format(new Date(tx.created_at), "MMM d, HH:mm")}</td>
                      <td className="p-2 capitalize">{tx.service_type}</td>
                      <td className="p-2">₦{tx.amount.toLocaleString()}</td>
                      <td className="p-2">{tx.phone_number || "-"}</td>
                      <td className="p-2 font-mono text-xs">{tx.reference?.slice(0, 20)}...</td>
                      <td className="p-2">{getStatusBadge(tx.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!serviceTx?.length && <p className="text-center py-8 text-muted-foreground">No transactions</p>}
            </div>
          </TabsContent>

          {/* Wallet Transactions */}
          <TabsContent value="wallet" className="mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  <th className="text-left p-2 text-muted-foreground font-medium">Date</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Type</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Amount</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Description</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Reference</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Status</th>
                </tr></thead>
                <tbody>
                  {(walletTx || []).map((tx) => (
                    <tr key={tx.id} className="border-b border-border hover:bg-muted/50">
                      <td className="p-2">{format(new Date(tx.created_at), "MMM d, HH:mm")}</td>
                      <td className="p-2 capitalize">{tx.type}</td>
                      <td className="p-2">₦{tx.amount.toLocaleString()}</td>
                      <td className="p-2">{tx.description || "-"}</td>
                      <td className="p-2 font-mono text-xs">{tx.reference?.slice(0, 20) || "-"}</td>
                      <td className="p-2">{getStatusBadge(tx.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!walletTx?.length && <p className="text-center py-8 text-muted-foreground">No transactions</p>}
            </div>
          </TabsContent>

          {/* Users */}
          <TabsContent value="users" className="mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  <th className="text-left p-2 text-muted-foreground font-medium">Email</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Name</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Status</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Action</th>
                </tr></thead>
                <tbody>
                  {(profiles || []).map((p: any) => (
                    <tr key={p.user_id} className="border-b border-border hover:bg-muted/50">
                      <td className="p-2">{p.email || "-"}</td>
                      <td className="p-2">{p.full_name || "-"}</td>
                      <td className="p-2">
                        {p.is_frozen ? (
                          <Badge variant="destructive"><Ban className="w-3 h-3 mr-1" />Frozen</Badge>
                        ) : (
                          <Badge variant="default">Active</Badge>
                        )}
                      </td>
                      <td className="p-2">
                        <Button
                          variant={p.is_frozen ? "outline" : "destructive"}
                          size="sm"
                          onClick={() => handleFreezeToggle(p.user_id, p.is_frozen)}
                        >
                          {p.is_frozen ? "Unfreeze" : "Freeze"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!profiles?.length && <p className="text-center py-8 text-muted-foreground">No users</p>}
            </div>
          </TabsContent>

          {/* Fraud Events */}
          <TabsContent value="fraud" className="mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  <th className="text-left p-2 text-muted-foreground font-medium">Date</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">User</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Event</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Description</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Resolved</th>
                </tr></thead>
                <tbody>
                  {(fraudEvents || []).map((ev: any) => (
                    <tr key={ev.id} className="border-b border-border hover:bg-muted/50">
                      <td className="p-2">{format(new Date(ev.created_at), "MMM d, HH:mm")}</td>
                      <td className="p-2 font-mono text-xs">{ev.user_id.slice(0, 8)}...</td>
                      <td className="p-2"><Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />{ev.event_type}</Badge></td>
                      <td className="p-2">{ev.description || "-"}</td>
                      <td className="p-2">{ev.resolved ? <Badge>Yes</Badge> : <Badge variant="outline">No</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!fraudEvents?.length && <p className="text-center py-8 text-muted-foreground">No fraud events</p>}
            </div>
          </TabsContent>

          {/* Webhooks */}
          <TabsContent value="webhooks" className="mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  <th className="text-left p-2 text-muted-foreground font-medium">Date</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Source</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Event</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Processed</th>
                </tr></thead>
                <tbody>
                  {(webhookLogs || []).map((log) => (
                    <tr key={log.id} className="border-b border-border hover:bg-muted/50">
                      <td className="p-2">{format(new Date(log.created_at), "MMM d, HH:mm")}</td>
                      <td className="p-2 capitalize">{log.source}</td>
                      <td className="p-2">{log.event_type || "-"}</td>
                      <td className="p-2">{log.processed ? <Badge>Yes</Badge> : <Badge variant="outline">No</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!webhookLogs?.length && <p className="text-center py-8 text-muted-foreground">No webhook logs</p>}
            </div>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-heading flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" /> Data Profit Margins
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label>1GB – 3GB Profit (₦)</Label>
                    <Input type="number" value={profit1to3} onChange={(e) => setProfit1to3(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>4GB+ Profit (₦)</Label>
                    <Input type="number" value={profit4plus} onChange={(e) => setProfit4plus(e.target.value)} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-heading flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" /> Wallet Funding Fees
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label>Fee for ≤₦5,000 (₦)</Label>
                    <Input type="number" value={feeBelow5k} onChange={(e) => setFeeBelow5k(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Fee for &gt;₦5,000 (₦)</Label>
                    <Input type="number" value={feeAbove5k} onChange={(e) => setFeeAbove5k(e.target.value)} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-heading flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" /> Transaction PIN
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label>Require PIN for purchases</Label>
                    <Select value={pinRequired} onValueChange={setPinRequired}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Enabled</SelectItem>
                        <SelectItem value="false">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Button onClick={handleSaveSettings} className="mt-4" disabled={settingsSaving}>
              {settingsSaving && <Loader2 className="animate-spin" />}
              Save All Settings
            </Button>
          </TabsContent>

          {/* Admin Tools */}
          <TabsContent value="tools" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-heading flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-primary" /> Manual Wallet Fund
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="User ID (UUID)" value={fundUserId} onChange={(e) => setFundUserId(e.target.value)} />
                <Input type="number" placeholder="Amount (₦)" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} min={1} />
                <Button onClick={handleManualFund}>Credit Wallet</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Config */}
          <TabsContent value="api-config" className="mt-4">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-heading flex items-center gap-2">
                    <Globe className="w-5 h-5 text-primary" /> API Providers
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(apiProviders || []).map((p: any) => (
                    <div key={p.id} className="flex flex-col gap-2 p-3 rounded-lg border border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Switch checked={p.is_active} onCheckedChange={() => handleToggleProvider(p.id, p.is_active)} />
                          <div>
                            <p className="font-medium text-foreground">{p.display_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{p.provider_key}</p>
                          </div>
                        </div>
                        <Badge variant={p.is_active ? "default" : "outline"}>{p.is_active ? "Active" : "Inactive"}</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          defaultValue={p.base_url}
                          placeholder="Base URL"
                          className="font-mono text-xs"
                          onBlur={(e) => {
                            if (e.target.value !== p.base_url) handleUpdateProviderUrl(p.id, e.target.value);
                          }}
                        />
                        <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => handleDeleteProvider(p.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {!apiProviders?.length && <p className="text-center py-4 text-muted-foreground">No providers configured</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-heading flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary" /> Add Provider
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input placeholder="Provider key (e.g. cheapdatahub)" value={newProviderKey} onChange={(e) => setNewProviderKey(e.target.value)} />
                  <Input placeholder="Display name" value={newProviderName} onChange={(e) => setNewProviderName(e.target.value)} />
                  <Input placeholder="Base URL" value={newProviderUrl} onChange={(e) => setNewProviderUrl(e.target.value)} />
                  <Button onClick={handleAddProvider}><Plus className="w-4 h-4 mr-1" /> Add Provider</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-heading flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" /> API Keys
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    API keys are stored securely as backend secrets. To update API keys, contact the system administrator or use the backend secrets manager. Current configured keys:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li className="flex items-center gap-2"><Badge variant="default">Set</Badge> CHEAPDATAHUB_API_KEY</li>
                    <li className="flex items-center gap-2"><Badge variant="default">Set</Badge> HADI_DATA_API</li>
                    <li className="flex items-center gap-2"><Badge variant="default">Set</Badge> BLESSDATA_API_KEY</li>
                    <li className="flex items-center gap-2"><Badge variant="default">Set</Badge> PAYSTACK_SECRET_KEY</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
