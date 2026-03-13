import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useWallet() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["wallet", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useWalletTransactions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["wallet-transactions", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useServiceTransactions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["service-transactions", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("service_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}
