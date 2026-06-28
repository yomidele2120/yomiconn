import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Check, Loader2, Building2, RefreshCw } from "lucide-react";

interface VA {
  account_number: string;
  account_name: string;
  bank_name: string;
}

export default function VirtualAccountCard() {
  const [va, setVa] = useState<VA | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("profiles")
      .select("bn_account_number, bn_account_name, bn_bank_name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data?.bn_account_number) {
      setVa({
        account_number: data.bn_account_number,
        account_name: data.bn_account_name || "",
        bank_name: data.bn_bank_name || "",
      });
    }
    setLoading(false);
  };

  useEffect(() => { fetchProfile(); }, []);

  const generate = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("bridgenetic-create-va", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const d = data?.data;
      if (d?.account_number) {
        setVa({ account_number: d.account_number, account_name: d.account_name, bank_name: d.bank_name });
        toast.success("Virtual account created");
      } else {
        toast.error("Unable to create account");
      }
    } catch (e: any) {
      const message = e?.context?.error || e?.message || "Failed to create account";
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const copy = async () => {
    if (!va) return;
    await navigator.clipboard.writeText(va.account_number);
    setCopied(true);
    toast.success("Account number copied");
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading) {
    return <div className="rounded-[20px] p-5 bg-card border border-border h-32 animate-pulse" />;
  }

  if (!va) {
    return (
      <div className="rounded-[20px] p-5 bg-card border border-border">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-foreground">My Virtual Account</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Get a dedicated account number to fund your wallet instantly.</p>
          </div>
        </div>
        <button onClick={generate} disabled={creating}
          className="mt-4 w-full h-11 rounded-[10px] bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {creating ? "Generating..." : "Generate Account"}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-[20px] p-5 bg-card border border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          <span className="label-eyebrow">My Virtual Account</span>
        </div>
        <button onClick={fetchProfile} className="w-7 h-7 rounded-full hover:bg-surface-hover flex items-center justify-center transition">
          <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      <div className="space-y-2.5 mb-4">
        <Row label="Bank" value={va.bank_name} />
        <Row label="Account Name" value={va.account_name} />
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[11px] text-muted-foreground mb-0.5">Account Number</div>
            <div className="text-[22px] font-extrabold tracking-wider text-foreground">{va.account_number}</div>
          </div>
          <button onClick={copy}
            className="h-9 px-3 rounded-[8px] bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 active:scale-[0.98] transition">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Send any amount to this account to fund your Yomiconnect wallet instantly.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value || "—"}</span>
    </div>
  );
}
