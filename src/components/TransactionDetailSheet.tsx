import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Check, X, Clock, Copy, Share2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import type { DisplayTx } from "./TransactionList";

const fmtNGN = (a: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(a);

export default function TransactionDetailSheet({ tx, onClose }: { tx: DisplayTx | null; onClose: () => void }) {
  if (!tx) return null;
  const s = tx.status.toLowerCase();
  const isSuccess = s === "successful" || s === "success" || s === "completed";
  const isFailed = s === "failed" || s === "error";

  const Row = ({ label, value, copy }: { label: string; value: string; copy?: boolean }) => (
    <div className="flex items-start justify-between py-3 border-b border-border last:border-0 gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground text-right break-all flex items-center gap-1.5">
        {value}
        {copy && (
          <button onClick={() => { navigator.clipboard.writeText(value); toast.success("Copied"); }}
            className="text-primary"><Copy className="w-3.5 h-3.5" /></button>
        )}
      </span>
    </div>
  );

  return (
    <Sheet open={!!tx} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom"
        className="rounded-t-[28px] border-0 px-5 pb-8 pt-3 max-h-[85vh] overflow-y-auto">
        <div className="mx-auto w-10 h-1.5 rounded-full bg-muted mb-4" />
        <h3 className="text-lg font-bold text-center">Transaction Details</h3>

        <div className="flex flex-col items-center mt-5 mb-3">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center spring-in ${
            isSuccess ? "bg-success/15 text-success" : isFailed ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"
          }`}>
            {isSuccess ? <Check className="w-7 h-7" /> : isFailed ? <X className="w-7 h-7" /> : <Clock className="w-7 h-7" />}
          </div>
          <p className={`mt-2 font-bold ${
            isSuccess ? "text-success" : isFailed ? "text-destructive" : "text-warning"
          }`}>
            {isSuccess ? "Successful" : isFailed ? "Failed" : "Pending"}
          </p>
          <p className="text-2xl font-extrabold text-foreground mt-1">
            {tx.type === "credit" ? "+" : "-"}{fmtNGN(tx.amount)}
          </p>
        </div>

        <div className="bg-muted/40 rounded-2xl px-4 mt-2">
          <Row label="Type" value={tx.type === "credit" ? "Wallet Credit" : (tx.service_type || "Debit")} />
          {tx.provider && <Row label="Provider" value={tx.provider} />}
          {tx.recipient && <Row label="Recipient" value={tx.recipient} />}
          <Row label="Amount" value={fmtNGN(tx.amount)} />
          {tx.reference && <Row label="Reference" value={tx.reference} copy />}
          <Row label="Date & Time" value={format(new Date(tx.created_at), "MMM d, yyyy · h:mm a")} />
        </div>

        {isFailed && tx.failure_reason && (
          <div className="mt-4 p-3 rounded-xl border border-destructive/40 bg-destructive/5">
            <p className="text-xs font-semibold text-destructive uppercase tracking-wider mb-1">Reason</p>
            <p className="text-sm text-foreground">{tx.failure_reason}</p>
          </div>
        )}

        <div className="mt-5 space-y-2">
          {isSuccess && (
            <Button variant="outline" className="w-full h-12 rounded-xl border-primary text-primary"
              onClick={() => toast.success("Receipt shared")}>
              <Share2 className="w-4 h-4" /> Share Receipt
            </Button>
          )}
          <button onClick={onClose} className="w-full text-sm text-muted-foreground py-2">Close</button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
