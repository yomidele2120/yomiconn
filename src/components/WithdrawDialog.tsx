import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, X, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface Props { open: boolean; onOpenChange: (open: boolean) => void; walletBalance: number; }
interface Bank { id?: string | number; name: string; code: string; }

export default function WithdrawDialog({ open, onOpenChange, walletBalance }: Props) {
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [amount, setAmount] = useState("");
  const [resolving, setResolving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const qc = useQueryClient();

  const bank = useMemo(() => banks.find(b => b.code === bankCode), [banks, bankCode]);

  useEffect(() => {
    if (!open) return;
    setStep("form"); setAccountName(""); setAccountNumber(""); setAmount(""); setBankCode("");
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("bridgenetic-banks", { body: {} });
        const list = (data?.data || []).map((b: any) => ({ name: b.name, code: b.code || b.bank_code, id: b.id }));
        setBanks(list);
      } catch { toast.error("Failed to load banks"); }
    })();
  }, [open]);

  useEffect(() => {
    setAccountName("");
    if (accountNumber.length === 10 && bankCode) {
      (async () => {
        setResolving(true);
        try {
          const { data, error } = await supabase.functions.invoke("bridgenetic-resolve-account", {
            body: { account_number: accountNumber, bank_code: bankCode },
          });
          if (error) throw error;
          const name = data?.data?.account_name || data?.data?.customer_name;
          if (name) setAccountName(name);
          else toast.error(data?.error?.message || "Could not resolve account");
        } catch (e: any) {
          toast.error(e.message || "Resolve failed");
        } finally { setResolving(false); }
      })();
    }
  }, [accountNumber, bankCode]);

  const num = Number(amount) || 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("bridgenetic-withdraw", {
        body: { amount: num, bank_code: bankCode, bank_name: bank?.name, account_number: accountNumber, account_name: accountName },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Withdrawal initiated");
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["wallet-transactions"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Withdrawal failed");
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md mx-4 rounded-3xl p-0 border-0 overflow-hidden">
        <div className="bg-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="text-base font-bold">{step === "form" ? "Withdraw to Bank" : "Confirm Withdrawal"}</h3>
            <button onClick={() => onOpenChange(false)} className="p-1.5 rounded-full hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          </div>

          {step === "form" ? (
            <div className="px-5 py-5 space-y-4">
              <Field label="Bank">
                <select value={bankCode} onChange={(e) => setBankCode(e.target.value)}
                  className="w-full h-11 px-3 rounded-[10px] bg-surface-elevated border border-border text-sm text-foreground caret-current focus:outline-none focus:border-primary">
                  <option value="">Select bank</option>
                  {banks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                </select>
              </Field>

              <Field label="Account Number">
                <input inputMode="numeric" maxLength={10} value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit account number"
                  className="w-full h-11 px-3 rounded-[10px] bg-surface-elevated border border-border text-sm text-foreground caret-current placeholder:text-gray-400 focus:outline-none focus:border-primary" />
              </Field>

              {(resolving || accountName) && (
                <div className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-[10px] bg-primary/5 border border-primary/20">
                  {resolving ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> : <Check className="w-3.5 h-3.5 text-success" />}
                  <span className="font-semibold text-foreground">{resolving ? "Resolving..." : accountName}</span>
                </div>
              )}

              <Field label={`Amount (Balance: ₦${walletBalance.toLocaleString()})`}>
                <input inputMode="numeric" value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                  className="w-full h-11 px-3 rounded-[10px] bg-surface-elevated border border-border text-sm text-foreground caret-current placeholder:text-gray-400 focus:outline-none focus:border-primary" />
              </Field>

              <button
                disabled={!accountName || !num || num > walletBalance}
                onClick={() => setStep("confirm")}
                className="w-full h-12 rounded-[10px] bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 active:scale-[0.99] transition">
                {num > walletBalance ? "Insufficient balance" : "Continue"}
              </button>
            </div>
          ) : (
            <div className="px-5 py-5 space-y-4">
              <div className="rounded-2xl border border-border p-4 space-y-2.5">
                <Row label="Bank" value={bank?.name || ""} />
                <Row label="Account" value={`${accountNumber}`} />
                <Row label="Recipient" value={accountName} />
                <div className="border-t border-border pt-2.5">
                  <Row label="Amount" value={`₦${num.toLocaleString()}`} bold />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button onClick={() => setStep("form")} disabled={submitting}
                  className="h-11 rounded-[10px] bg-surface-elevated border border-border text-sm font-semibold">Back</button>
                <button onClick={handleSubmit} disabled={submitting}
                  className="h-11 rounded-[10px] bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-muted-foreground font-semibold mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm ${bold ? "font-extrabold text-primary text-base" : "font-semibold text-foreground"}`}>{value}</span>
    </div>
  );
}
