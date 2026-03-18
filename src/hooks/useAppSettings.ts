import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AppSettings {
  data_profit_1_3gb: number;
  data_profit_4gb_plus: number;
  funding_fee_below_5000: number;
  funding_fee_above_5000: number;
  pin_required: boolean;
}

const DEFAULTS: AppSettings = {
  data_profit_1_3gb: 30,
  data_profit_4gb_plus: 50,
  funding_fee_below_5000: 35,
  funding_fee_above_5000: 50,
  pin_required: true,
};

export function useAppSettings() {
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value");
      if (error) throw error;

      const settings: AppSettings = { ...DEFAULTS };
      for (const row of data || []) {
        const key = row.key as keyof AppSettings;
        if (key in settings) {
          const val = row.value as any;
          if (key === "pin_required") {
            settings[key] = val === true || val === "true";
          } else {
            settings[key] = typeof val === "number" ? val : Number(val);
          }
        }
      }
      return settings;
    },
    staleTime: 5 * 60 * 1000, // cache 5 min
  });
}

export function getFundingFee(amount: number, settings?: AppSettings): number {
  const s = settings || DEFAULTS;
  return amount <= 5000 ? s.funding_fee_below_5000 : s.funding_fee_above_5000;
}
