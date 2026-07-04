import { useEffect, useState } from "react";
import { X, Flame, ArrowRight, Loader2, Wifi } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Deal {
  network_id: string;
  network_name: string;
  size_label: string;
  price: number;
  validity: string;
  provider_source: string;
  provider_label: string;
  name: string;
}

const DISMISS_KEY = "cheapest-deals-popup-dismissed";

export default function CheapestDealsPopup() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Dismissed today?
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed) {
        const day = new Date(dismissed).toDateString();
        if (day === new Date().toDateString()) return;
      }
    } catch { /* ignore */ }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("get-cheapest-bundles");
        if (cancelled) return;
        const list: Deal[] = (data?.deals || []).slice(0, 4);
        if (list.length === 0) return;
        setDeals(list);
        // Small delay so it feels intentional
        setTimeout(() => !cancelled && setOpen(true), 900);
      } catch {
        // fail silently
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const dismissToday = () => {
    try { localStorage.setItem(DISMISS_KEY, new Date().toISOString()); } catch { /* ignore */ }
    setOpen(false);
  };

  if (!open) return null;

  const top = deals[0];
  const providerLabel = top?.provider_label || "Provider 1";
  const providerName = top?.provider_source === "elrufaidatalink" ? "ElRufaiDataSub" : "CheapDataHub";

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
         onClick={() => setOpen(false)}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-3xl bg-card border border-border shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-primary/20 via-primary/5 to-transparent p-5 border-b border-border">
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-surface-elevated hover:bg-surface-hover flex items-center justify-center transition"
          >
            <X className="w-4 h-4 text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center">
              <Flame className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground leading-tight">🔥 Cheapest Data Deals Today</h3>
              <p className="text-xs text-muted-foreground">Best value bundles right now</p>
            </div>
          </div>
        </div>

        {/* Deals */}
        <div className="p-5 space-y-2 max-h-[45vh] overflow-y-auto">
          {loading && deals.length === 0 ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : (
            deals.map((d, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-surface-elevated border border-border">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Wifi className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-foreground truncate">
                      {d.network_name} · {d.size_label}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {d.validity ? `${d.validity} · ` : ""}{d.provider_label}
                    </div>
                  </div>
                </div>
                <div className="text-primary font-bold text-sm shrink-0">₦{d.price.toLocaleString()}</div>
              </div>
            ))
          )}
        </div>

        {/* CTA / Instructions */}
        {top && (
          <div className="px-5 pb-3">
            <div className="rounded-2xl bg-primary/5 border border-primary/20 p-3 text-xs text-foreground/90 leading-relaxed">
              <p className="font-semibold text-foreground mb-1">How to buy the top deal:</p>
              <ol className="space-y-0.5 list-decimal list-inside">
                <li>Open Data Purchase</li>
                <li>Enter your phone number</li>
                <li>Select <span className="font-semibold">{top.network_name}</span></li>
                <li>Choose <span className="font-semibold">{providerLabel}</span> ({providerName})</li>
                <li>Pick the <span className="font-semibold">{top.size_label}</span> bundle · ₦{top.price.toLocaleString()}</li>
                <li>Complete payment</li>
              </ol>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-5 pt-2 space-y-2">
          <button
            onClick={() => { setOpen(false); navigate("/auth"); }}
            className="w-full h-12 rounded-2xl wallet-gradient text-white font-semibold shadow-premium active:scale-[0.99] transition flex items-center justify-center gap-2"
          >
            Get Started <ArrowRight className="w-4 h-4" />
          </button>
          <div className="flex items-center justify-between">
            <button onClick={dismissToday} className="text-xs text-muted-foreground hover:text-foreground underline">
              Don't show again today
            </button>
            <button onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
