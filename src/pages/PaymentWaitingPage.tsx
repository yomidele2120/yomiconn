import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Clock, AlertCircle } from "lucide-react";

const POLL_INTERVAL = 5000;
const SESSION_DURATION = 10 * 60;

export default function PaymentWaitingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const reference = searchParams.get("ref");

  const [status, setStatus] = useState("waiting_for_payment");
  const [amount, setAmount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SESSION_DURATION);

  const checkPayment = useCallback(async () => {
    if (!reference || !user) return;
    try {
      const { data, error } = await supabase.functions.invoke("verify-payment", { body: { reference } });
      if (error) throw error;
      if (data?.status === "completed") {
        setStatus("completed"); setAmount(data.amount);
        queryClient.invalidateQueries({ queryKey: ["wallet"] });
        queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
        toast.success(`₦${data.amount.toLocaleString()} credited!`);
        setTimeout(() => navigate("/dashboard"), 2000);
      } else if (data?.status === "expired") setStatus("expired");
      else setStatus(data?.status || "waiting_for_payment");
    } catch {}
  }, [reference, user, queryClient, navigate]);

  useEffect(() => {
    if (["completed", "expired", "failed"].includes(status)) return;
    checkPayment();
    const i = setInterval(checkPayment, POLL_INTERVAL);
    return () => clearInterval(i);
  }, [checkPayment, status]);

  useEffect(() => {
    if (["completed", "expired"].includes(status)) return;
    const t = setInterval(() => setTimeLeft(p => p <= 1 ? (setStatus("expired"), 0) : p - 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  if (!reference) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="bg-card rounded-3xl p-8 text-center max-w-sm shadow-premium">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-destructive" />
          <h2 className="font-bold text-lg">Invalid Payment Session</h2>
          <button onClick={() => navigate("/dashboard")}
            className="mt-4 w-full h-12 rounded-xl wallet-gradient text-white font-semibold">Dashboard</button>
        </div>
      </div>
    );
  }

  const step1Done = true;
  const step2Done = status === "completed";
  const step3Done = status === "completed";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top half */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden"
        style={{ background: "linear-gradient(135deg,#6C3AE8 0%, #4F2BD1 100%)" }}>
        {[0, 1, 2].map(i => (
          <span key={i} className="absolute w-32 h-32 rounded-full border-2 border-white/40 pulse-ring"
            style={{ animationDelay: `${i * 0.8}s` }} />
        ))}
        <div className="relative w-20 h-20 rounded-full bg-white/15 backdrop-blur flex items-center justify-center">
          <Clock className="w-10 h-10 text-white" style={{ animation: "spin 6s linear infinite" }} />
        </div>
      </div>

      {/* Bottom card */}
      <div className="bg-card rounded-t-[32px] -mt-8 px-6 pt-7 pb-8 shadow-premium relative z-10">
        <h2 className="text-[22px] font-bold text-center">
          {status === "completed" ? "Payment Confirmed!" : status === "expired" ? "Session Expired" : "Waiting for Payment"}
        </h2>
        <p className="text-sm text-muted-foreground text-center mt-2 max-w-sm mx-auto">
          {status === "completed"
            ? `₦${amount.toLocaleString()} credited. Redirecting…`
            : "Complete your payment on the Paystack page. This screen will update automatically."}
        </p>

        <div className="mt-4 mx-auto inline-flex items-center px-4 py-1.5 rounded-full bg-muted font-mono text-xs text-foreground">
          Ref: {reference.slice(0, 24)}…
        </div>

        <div className="mt-5 h-1 w-full bg-muted rounded-full overflow-hidden">
          {status !== "completed" && (
            <div className="h-full w-1/3 bg-primary rounded-full scan-bar" />
          )}
        </div>

        <div className="mt-6 space-y-3">
          <Step done={step1Done} active={false} label="Payment initiated" />
          <Step done={step2Done} active={!step2Done} label="Awaiting confirmation" />
          <Step done={step3Done} active={false} label="Wallet credited" />
        </div>

        <div className="text-center mt-6 text-xs text-muted-foreground">
          Time left: <span className="font-mono">{Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,"0")}</span>
        </div>

        <button onClick={() => navigate("/dashboard")}
          className="w-full mt-5 text-destructive text-sm font-medium py-2">
          {status === "completed" ? "Go to Dashboard" : "Cancel Payment"}
        </button>
      </div>
    </div>
  );
}

function Step({ done, active, label }: { done: boolean; active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${
        done ? "bg-success" : active ? "bg-primary" : "bg-muted"
      } ${active ? "animate-pulse" : ""}`}>
        {done ? <Check className="w-3.5 h-3.5" /> : null}
      </span>
      <span className={`text-sm ${done ? "text-foreground font-semibold" : active ? "text-foreground" : "text-muted-foreground"}`}>
        {label}
      </span>
    </div>
  );
}
