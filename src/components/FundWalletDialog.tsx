import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings, getFundingFee } from "@/hooks/useAppSettings";

interface FundWalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FundWalletDialog({ open, onOpenChange }: FundWalletDialogProps) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { data: settings } = useAppSettings();

  const numAmount = Number(amount) || 0;
  const fee = numAmount >= 100 ? getFundingFee(numAmount, settings) : 0;
  const totalPayment = numAmount + fee;

  const quickAmounts = [500, 1000, 2000, 5000];

  const handleFund = async () => {
    if (!numAmount || numAmount < 100) {
      toast.error("Minimum amount is ₦100");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("initialize-payment", {
        body: { amount: numAmount, fee },
      });

      if (error) throw error;

      if (data?.authorization_url && data?.reference) {
        window.open(data.authorization_url, "_blank");
        onOpenChange(false);
        navigate(`/payment-waiting?ref=${data.reference}`);
      } else {
        toast.error("Failed to initialize payment");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to initialize payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md mx-4">
        <DialogHeader>
          <DialogTitle className="font-heading">Fund Wallet</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Amount (₦)</Label>
            <Input
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={100}
            />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {quickAmounts.map((qa) => (
              <Button
                key={qa}
                variant="outline"
                size="sm"
                onClick={() => setAmount(String(qa))}
                className="text-xs"
              >
                ₦{qa.toLocaleString()}
              </Button>
            ))}
          </div>

          {numAmount >= 100 && (
            <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Funding Amount</span>
                <span className="font-medium">₦{numAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transaction Fee</span>
                <span className="font-medium">₦{fee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1 mt-1">
                <span className="font-semibold">Total Payment</span>
                <span className="font-bold text-primary">₦{totalPayment.toLocaleString()}</span>
              </div>
            </div>
          )}

          <Button onClick={handleFund} className="w-full" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            Pay ₦{totalPayment.toLocaleString()} with Paystack
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
