import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useTransactionPin() {
  const { user } = useAuth();

  const { data: hasPin, isLoading, refetch } = useQuery({
    queryKey: ["transaction-pin", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-pin", {
        body: { action: "check" },
      });
      if (error) throw error;
      return data?.has_pin ?? false;
    },
    enabled: !!user,
  });

  const setPin = async (pin: string) => {
    const { data, error } = await supabase.functions.invoke("manage-pin", {
      body: { action: "set", pin },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    await refetch();
    return data;
  };

  const verifyPin = async (pin: string): Promise<boolean> => {
    const { data, error } = await supabase.functions.invoke("manage-pin", {
      body: { action: "verify", pin },
    });
    if (error) throw error;
    return data?.valid ?? false;
  };

  const resetPin = async (currentPin: string, newPin: string) => {
    const { data, error } = await supabase.functions.invoke("manage-pin", {
      body: { action: "reset", pin: currentPin, new_pin: newPin },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  return { hasPin: hasPin ?? false, isLoading, setPin, verifyPin, resetPin, refetch };
}
