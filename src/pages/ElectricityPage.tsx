import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Zap, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/useWallet";
import { useQueryClient } from "@tanstack/react-query";
import TransactionPinDialog from "@/components/TransactionPinDialog";

const discos = [
  { id: "ikeja-electric", name: "Ikeja Electric" },
  { id: "eko-electric", name: "Eko Electric" },
  { id: "abuja-electric", name: "Abuja Electric" },
  { id: "kano-electric", name: "Kano Electric" },
  { id: "enugu-electric", name: "Enugu Electric" },
  { id: "ibadan-electric", name: "Ibadan Electric" },
  { id: "port-harcourt-electric", name: "Port Harcourt Electric" },
  { id: "jos-electric", name: "Jos Electric" },
  { id: "kaduna-electric", name: "Kaduna Electric" },
  { id: "benin-electric", name: "Benin Electric" },
  { id: "yola-electric", name: "Yola Electric" },
];

// Approximate tariff rates per kWh by disco (Band A ~₦225/kWh avg)
const TARIFF_PER_KWH: Record<string, number> = {
  "ikeja-electric": 225,
  "eko-electric": 225,
  "abuja-electric": 225,
  "kano-electric": 209,
  "enugu-electric": 225,
  "ibadan-electric": 225,
  "port-harcourt-electric": 225,
  "jos-electric": 209,
  "kaduna-electric": 209,
  "benin-electric": 225,
  "yola-electric": 209,
};

type Step = "details" | "amount" | "confirm";

interface MeterInfo {
  verified: boolean;
  customer_name: string | null;
  meter_no: string;
  meter_type: string;
  disco: string;
  address?: string | null;
  message?: string;
}

export default function ElectricityPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("details");
  const [disco, setDisco] = useState("");
  const [meterNo, setMeterNo] = useState("");
  const [meterType, setMeterType] = useState("prepaid");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [meterInfo, setMeterInfo] = useState<MeterInfo | null>(null);
  const [verifyError, setVerifyError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { data: wallet } = useWallet();
  const queryClient = useQueryClient();

  const discoName = discos.find((d) => d.id === disco)?.name || disco;

  const estimatedUnits = useMemo(() => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount < 500 || !disco) return null;
    const tariff = TARIFF_PER_KWH[disco] || 225;
    return (numAmount / tariff).toFixed(1);
  }, [amount, disco]);

  const handleVerifyMeter = async () => {
    if (!disco || !meterNo) {
      toast.error("Please select a disco and enter meter number");
      return;
    }
    if (meterNo.length < 6) {
      toast.error("Please enter a valid meter number");
      return;
    }

    setVerifying(true);
    setVerifyError("");
    setMeterInfo(null);

    try {
      const { data, error } = await supabase.functions.invoke("verify-meter", {
        body: { disco, meter_no: meterNo, meter_type: meterType },
      });

      if (error) throw error;

      if (data.error) throw new Error(data.error);

      setMeterInfo(data);

      if (data.verified && data.customer_name) {
        toast.success("Meter verified successfully");
        setStep("amount");
      } else if (!data.verified) {
        // Fallback: allow user to proceed but warn
        setMeterInfo(data);
        setStep("amount");
        toast.info("Meter verification unavailable. Please confirm your meter number.");
      }
    } catch (error: any) {
      setVerifyError(error.message || "Failed to verify meter");
      toast.error(error.message || "Meter verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const handlePurchase = async () => {
    setShowConfirm(false);
    const numAmount = Number(amount);

    if ((wallet?.balance ?? 0) < numAmount) {
      toast.error("Insufficient wallet balance");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-service", {
        body: {
          service_type: "electricity",
          disco,
          meter_no: meterNo,
          meter_type: meterType,
          amount: numAmount,
          phone_number: phone,
          provider_source: "cheapdatahub",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const token = data?.data?.token || data?.data?.electricity_token || null;

      toast.success(
        token
          ? `Purchase successful! Token: ${token}`
          : "Electricity purchase successful!",
        { duration: 10000 }
      );

      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["service-transactions"] });
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Purchase failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-lg mx-auto">
        <button
          onClick={() => {
            if (step === "amount") {
              setStep("details");
            } else if (step === "confirm") {
              setStep("amount");
            } else {
              navigate("/dashboard");
            }
          }}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {step === "details" ? "Back" : step === "amount" ? "Change Meter" : "Edit Amount"}
        </button>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {(["details", "amount", "confirm"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : (["details", "amount", "confirm"].indexOf(step) > i)
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              {i < 2 && (
                <div
                  className={`w-8 h-0.5 ${
                    ["details", "amount", "confirm"].indexOf(step) > i
                      ? "bg-accent"
                      : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
          <span className="text-xs text-muted-foreground ml-2">
            {step === "details" ? "Verify Meter" : step === "amount" ? "Enter Amount" : "Confirm"}
          </span>
        </div>

        {/* STEP 1: Meter Details & Verification */}
        {step === "details" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-heading">
                <Zap className="w-5 h-5 text-warning" /> Verify Your Meter
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Distribution Company</Label>
                <Select value={disco} onValueChange={(v) => { setDisco(v); setMeterInfo(null); setVerifyError(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select disco" /></SelectTrigger>
                  <SelectContent>
                    {discos.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Meter Type</Label>
                <Select value={meterType} onValueChange={(v) => { setMeterType(v); setMeterInfo(null); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prepaid">Prepaid</SelectItem>
                    <SelectItem value="postpaid">Postpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Meter Number</Label>
                <Input
                  placeholder="Enter meter number"
                  value={meterNo}
                  onChange={(e) => { setMeterNo(e.target.value); setMeterInfo(null); setVerifyError(""); }}
                />
              </div>

              {verifyError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {verifyError}
                </div>
              )}

              <Button onClick={handleVerifyMeter} className="w-full" disabled={verifying || !disco || !meterNo}>
                {verifying ? (
                  <>
                    <Loader2 className="animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" /> Verify Meter
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* STEP 2: Amount & Unit Estimation */}
        {step === "amount" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-heading">
                <Zap className="w-5 h-5 text-warning" /> Enter Amount
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Verified meter info banner */}
              <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-accent">
                  {meterInfo?.verified ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-warning" />
                  )}
                  {meterInfo?.verified ? "Meter Verified" : "Unverified Meter"}
                </div>
                {meterInfo?.customer_name && (
                  <p className="text-base font-semibold text-foreground">{meterInfo.customer_name}</p>
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                  <span>Meter No:</span>
                  <span className="font-medium text-foreground">{meterNo}</span>
                  <span>Disco:</span>
                  <span className="font-medium text-foreground">{discoName}</span>
                  <span>Type:</span>
                  <span className="font-medium text-foreground capitalize">{meterType}</span>
                </div>
                {meterInfo?.address && (
                  <p className="text-xs text-muted-foreground mt-1">📍 {meterInfo.address}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  type="tel"
                  placeholder="08012345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={11}
                />
              </div>

              <div className="space-y-2">
                <Label>Amount (₦)</Label>
                <Input
                  type="number"
                  placeholder="Minimum ₦500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={500}
                />
              </div>

              {/* Dynamic unit estimation */}
              {estimatedUnits && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-center space-y-1">
                  <p className="text-xs text-muted-foreground">Estimated Electricity Units</p>
                  <p className="text-2xl font-bold text-primary">{estimatedUnits} kWh</p>
                  <p className="text-xs text-muted-foreground">
                    Based on {discoName} tariff (~₦{TARIFF_PER_KWH[disco] || 225}/kWh)
                  </p>
                </div>
              )}

              {/* Wallet balance */}
              <div className="text-xs text-muted-foreground text-right">
                Wallet balance: ₦{(wallet?.balance ?? 0).toLocaleString()}
              </div>

              <Button
                onClick={() => {
                  if (!phone || !amount) {
                    toast.error("Please fill all fields");
                    return;
                  }
                  if (Number(amount) < 500) {
                    toast.error("Minimum amount is ₦500");
                    return;
                  }
                  if ((wallet?.balance ?? 0) < Number(amount)) {
                    toast.error("Insufficient wallet balance");
                    return;
                  }
                  setStep("confirm");
                }}
                className="w-full"
                disabled={!phone || !amount || Number(amount) < 500}
              >
                Continue · ₦{Number(amount || 0).toLocaleString()}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* STEP 3: Confirmation */}
        {step === "confirm" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-heading">
                <ShieldCheck className="w-5 h-5 text-accent" /> Confirm Purchase
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-card p-4 space-y-3">
                {meterInfo?.customer_name && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Customer Name</span>
                    <span className="text-sm font-semibold">{meterInfo.customer_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Meter Number</span>
                  <span className="text-sm font-semibold">{meterNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Distribution Company</span>
                  <span className="text-sm font-semibold">{discoName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Meter Type</span>
                  <span className="text-sm font-semibold capitalize">{meterType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Phone</span>
                  <span className="text-sm font-semibold">{phone}</span>
                </div>

                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Amount</span>
                    <span className="text-lg font-bold text-primary">₦{Number(amount).toLocaleString()}</span>
                  </div>
                  {estimatedUnits && (
                    <div className="flex justify-between mt-1">
                      <span className="text-sm text-muted-foreground">Est. Units</span>
                      <span className="text-sm font-semibold text-accent">{estimatedUnits} kWh</span>
                    </div>
                  )}
                </div>
              </div>

              <Button
                onClick={() => setShowConfirm(true)}
                className="w-full"
                variant="wallet"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" /> Pay ₦{Number(amount).toLocaleString()}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Final confirmation dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Electricity Purchase</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to pay <strong>₦{Number(amount).toLocaleString()}</strong> for electricity on meter{" "}
              <strong>{meterNo}</strong> ({discoName}).
              {meterInfo?.customer_name && (
                <> Customer: <strong>{meterInfo.customer_name}</strong>.</>
              )}
              {" "}This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePurchase}>Confirm Purchase</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
