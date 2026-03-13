import { format } from "date-fns";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  status: string;
  created_at: string;
}

interface TransactionListProps {
  transactions: Transaction[];
  loading: boolean;
}

export default function TransactionList({ transactions, loading }: TransactionListProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "successful": return "text-success";
      case "failed": return "text-destructive";
      case "processing": return "text-warning";
      default: return "text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (!transactions.length) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No transactions yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((tx) => (
        <div
          key={tx.id}
          className="flex items-center justify-between p-3 rounded-lg bg-card border border-border hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
              tx.type === "credit" ? "bg-success/10" : "bg-destructive/10"
            }`}>
              {tx.type === "credit" ? (
                <ArrowDownLeft className="w-4 h-4 text-success" />
              ) : (
                <ArrowUpRight className="w-4 h-4 text-destructive" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {tx.description || (tx.type === "credit" ? "Wallet Funded" : "Service Purchase")}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(tx.created_at), "MMM d, yyyy · h:mm a")}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-sm font-semibold ${tx.type === "credit" ? "text-success" : "text-foreground"}`}>
              {tx.type === "credit" ? "+" : "-"}{formatCurrency(tx.amount)}
            </p>
            <p className={`text-xs capitalize ${getStatusColor(tx.status)}`}>{tx.status}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
