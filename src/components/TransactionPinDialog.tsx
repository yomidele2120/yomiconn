import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, Delete } from "lucide-react";
import { toast } from "sonner";
import { useTransactionPin } from "@/hooks/useTransactionPin";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
  title?: string;
  description?: string;
}

export default function TransactionPinDialog({ open, onOpenChange, onVerified, description }: Props) {
  const { hasPin, setPin, verifyPin } = useTransactionPin();
  const isSetup = !hasPin;
  const [pin, setPinValue] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => { if (!open) { setPinValue(""); setConfirmPin(""); } }, [open]);

  const submit = async (value: string) => {
    setLoading(true);
    try {
      const ok = await verifyPin(value);
      if (!ok) { setShake(true); setTimeout(() => setShake(false), 400); toast.error("Incorrect PIN"); setPinValue(""); return; }
      onVerified(); onOpenChange(false);
    } catch (e: any) { toast.error(e.message || "PIN error"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!isSetup && pin.length === 4) submit(pin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const handleSetup = async () => {
    if (pin.length < 4 || pin.length > 6) { toast.error("PIN must be 4-6 digits"); return; }
    if (pin !== confirmPin) { toast.error("PINs do not match"); return; }
    setLoading(true);
    try {
      await setPin(pin); toast.success("PIN set"); onVerified(); onOpenChange(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const pad = ["1","2","3","4","5","6","7","8","9","","0","del"];
  const onTap = (k: string) => {
    if (k === "") return;
    if (k === "del") setPinValue(p => p.slice(0, -1));
    else if (pin.length < 4) setPinValue(p => p + k);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm mx-4 rounded-[28px] p-7 border-0">
        {isSetup ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center mb-2">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-bold text-lg">Set Transaction PIN</h3>
              <p className="text-sm text-muted-foreground mt-1">Create a 4-digit PIN to secure purchases.</p>
            </div>
            <div className="space-y-2">
              <Label>New PIN</Label>
              <Input type="password" inputMode="numeric" maxLength={4} placeholder="••••"
                value={pin} onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))} />
            </div>
            <div className="space-y-2">
              <Label>Confirm PIN</Label>
              <Input type="password" inputMode="numeric" maxLength={4} placeholder="••••"
                value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))} />
            </div>
            <button onClick={handleSetup} disabled={loading}
              className="w-full h-[52px] rounded-xl wallet-gradient text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Set PIN & Continue
            </button>
          </div>
        ) : (
          <div>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center mb-2">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-bold text-xl">Enter PIN</h3>
              <p className="text-sm text-muted-foreground mt-1">{description || "Confirm your purchase"}</p>
            </div>

            <div className={`flex justify-center gap-4 my-6 ${shake ? "animate-pulse" : ""}`}
              style={shake ? { animation: "shake 0.4s" } : undefined}>
              {[0, 1, 2, 3].map(i => (
                <span key={i} className={`w-4 h-4 rounded-full border-2 transition ${
                  pin.length > i ? "bg-primary border-primary" : "border-muted-foreground/40"
                }`} />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto">
              {pad.map((k, i) => (
                <button key={i} disabled={k === "" || loading} onClick={() => onTap(k)}
                  className={`h-[60px] rounded-2xl text-xl font-bold transition active:scale-95 ${
                    k === "" ? "invisible" :
                    k === "del" ? "bg-transparent text-muted-foreground" :
                    "bg-muted hover:bg-primary hover:text-white text-foreground"
                  }`}>
                  {k === "del" ? <Delete className="w-5 h-5 mx-auto" /> : k}
                </button>
              ))}
            </div>

            <button onClick={() => onOpenChange(false)} className="w-full mt-5 text-destructive text-sm font-semibold">
              Cancel
            </button>
          </div>
        )}
        <style>{`@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}`}</style>
      </DialogContent>
    </Dialog>
  );
}
