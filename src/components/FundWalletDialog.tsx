import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface FundWalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FundWalletDialog({ open, onOpenChange }: FundWalletDialogProps) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const quickAmounts = [500, 1000, 2000, 5000];

  const handleFund = async () => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount < 100) {
      toast.error("Minimum amount is ₦100");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("initialize-payment", {
        body: { amount: numAmount },
      });

      if (error) throw error;

      if (data?.authorization_url && data?.reference) {
        // Open Paystack in new tab and navigate to waiting page
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
          <Button onClick={handleFund} className="w-full" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            Pay with Paystack
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
