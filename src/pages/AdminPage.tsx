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
import { format } from "date-fns";
import { LogOut, Shield, Zap, AlertTriangle, Ban, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function AdminPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [fundUserId, setFundUserId] = useState("");
  const [fundAmount, setFundAmount] = useState("");

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
            <TabsTrigger value="tools">Tools</TabsTrigger>
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
        </Tabs>
      </main>
    </div>
  );
}
