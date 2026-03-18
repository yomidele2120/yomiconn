import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useTransactionPin } from "@/hooks/useTransactionPin";

interface TransactionPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
  title?: string;
  description?: string;
}

export default function TransactionPinDialog({
  open,
  onOpenChange,
  onVerified,
  title = "Enter Transaction PIN",
  description = "Enter your 4-6 digit PIN to confirm this purchase.",
}: TransactionPinDialogProps) {
  const { hasPin, setPin, verifyPin } = useTransactionPin();
  const [pin, setPinValue] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const isSetup = !hasPin;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (isSetup) {
        if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
          toast.error("PIN must be 4-6 digits");
          return;
        }
        if (pin !== confirmPin) {
          toast.error("PINs do not match");
          return;
        }
        await setPin(pin);
        toast.success("Transaction PIN set successfully!");
        onVerified();
        onOpenChange(false);
      } else {
        const valid = await verifyPin(pin);
        if (!valid) {
          toast.error("Incorrect PIN. Please try again.");
          return;
        }
        onVerified();
        onOpenChange(false);
      }
    } catch (error: any) {
      toast.error(error.message || "PIN operation failed");
    } finally {
      setLoading(false);
      setPinValue("");
      setConfirmPin("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            {isSetup ? <ShieldCheck className="w-5 h-5 text-primary" /> : <Lock className="w-5 h-5 text-primary" />}
            {isSetup ? "Set Transaction PIN" : title}
          </DialogTitle>
          <DialogDescription>
            {isSetup
              ? "Create a 4-6 digit PIN to secure your transactions. You'll need this for every purchase."
              : description}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{isSetup ? "New PIN" : "PIN"}</Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••"
              value={pin}
              onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
              autoFocus
            />
          </div>
          {isSetup && (
            <div className="space-y-2">
              <Label>Confirm PIN</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          )}
          <Button
            onClick={handleSubmit}
            className="w-full"
            disabled={loading || pin.length < 4}
          >
            {loading && <Loader2 className="animate-spin" />}
            {isSetup ? "Set PIN & Continue" : "Confirm"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
