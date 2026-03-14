import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Clock, AlertCircle, Loader2, Zap, RefreshCw, Copy } from "lucide-react";

const POLL_INTERVAL = 5000;
const SESSION_DURATION = 10 * 60; // 10 minutes in seconds

export default function PaymentWaitingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const reference = searchParams.get("ref");

  const [status, setStatus] = useState<string>("waiting_for_payment");
  const [amount, setAmount] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState(SESSION_DURATION);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);

  const checkPayment = useCallback(async () => {
    if (!reference || !user) return;
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-payment", {
        body: { reference },
      });
      if (error) throw error;

      if (data?.status === "completed") {
        setStatus("completed");
        setAmount(data.amount);
        queryClient.invalidateQueries({ queryKey: ["wallet"] });
        queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
        toast.success(`₦${data.amount.toLocaleString()} credited to your wallet!`);
      } else if (data?.status === "expired") {
        setStatus("expired");
      } else {
        setStatus(data?.status || "waiting_for_payment");
      }
    } catch {
      // Silent fail on poll
    } finally {
      setChecking(false);
    }
  }, [reference, user, queryClient]);

  // Polling
  useEffect(() => {
    if (status === "completed" || status === "expired" || status === "failed") return;

    const interval = setInterval(checkPayment, POLL_INTERVAL);
    checkPayment(); // Initial check

    return () => clearInterval(interval);
  }, [checkPayment, status]);

  // Countdown timer
  useEffect(() => {
    if (status === "completed" || status === "expired") return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setStatus("expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleCopy = () => {
    if (reference) {
      navigator.clipboard.writeText(reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!reference) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-lg font-heading font-bold mb-2">Invalid Payment Session</h2>
            <p className="text-sm text-muted-foreground mb-4">No payment reference found.</p>
            <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-lg wallet-gradient flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-xl font-heading">
            {status === "completed"
              ? "Payment Confirmed!"
              : status === "expired"
              ? "Session Expired"
              : "Waiting for Payment"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Status icon */}
          <div className="flex justify-center">
            {status === "completed" ? (
              <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-accent" />
              </div>
            ) : status === "expired" ? (
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-destructive" />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                <Clock className="w-10 h-10 text-primary" />
              </div>
            )}
          </div>

          {/* Message */}
          <p className="text-center text-sm text-muted-foreground">
            {status === "completed"
              ? `Your wallet has been credited with ₦${amount.toLocaleString()}.`
              : status === "expired"
              ? "This payment session has expired. You can retry the payment."
              : "Complete your payment using your bank or mobile banking app. This page will automatically update once payment is confirmed."}
          </p>

          {/* Reference */}
          <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Payment Reference</span>
              <button onClick={handleCopy} className="text-xs text-primary flex items-center gap-1 hover:underline">
                <Copy className="w-3 h-3" />
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="font-mono text-xs text-foreground break-all">{reference}</p>
          </div>

          {/* Timer */}
          {status !== "completed" && status !== "expired" && (
            <div className="text-center space-y-1">
              <p className="text-3xl font-heading font-bold text-foreground">{formatTime(timeLeft)}</p>
              <p className="text-xs text-muted-foreground">Session active for {Math.ceil(timeLeft / 60)} more minutes</p>
              <div className="flex items-center justify-center gap-1 text-xs text-primary mt-2">
                {checking ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                Auto-checking every 5 seconds
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            {status === "completed" && (
              <Button className="w-full" onClick={() => navigate("/dashboard")}>
                Go to Dashboard
              </Button>
            )}
            {status === "expired" && (
              <>
                <Button className="w-full" onClick={() => navigate("/dashboard")}>
                  Retry Payment
                </Button>
                <Button variant="outline" className="w-full" onClick={() => navigate("/dashboard")}>
                  Go to Dashboard
                </Button>
              </>
            )}
            {status !== "completed" && status !== "expired" && (
              <Button variant="outline" className="w-full" onClick={() => navigate("/dashboard")}>
                Return to Dashboard
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
