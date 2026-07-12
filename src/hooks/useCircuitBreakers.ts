import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type CircuitBreakerState = "closed" | "open" | "half-open";

export interface CircuitBreaker {
  service_name: string;
  state: CircuitBreakerState;
  failure_count: number;
  last_failure_at: string | null;
  opened_at: string | null;
  threshold: number;
  reset_timeout_ms: number;
}

/**
 * Lê o estado dos disjuntores (circuit breakers) dos serviços externos.
 * Atualiza a cada 10s para refletir aberturas/fechamentos quase em tempo real.
 */
export function useCircuitBreakers() {
  return useQuery({
    queryKey: ["circuit-breakers"],
    queryFn: async (): Promise<CircuitBreaker[]> => {
      const { data, error } = await supabase
        .from("circuit_breakers")
        .select("*")
        .order("service_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CircuitBreaker[];
    },
    refetchInterval: 10_000,
  });
}

/**
 * Reset manual de um disjuntor — reabre o circuito (estado "closed") e zera a
 * contagem de falhas. Restrito a administradores no banco (RPC SECURITY DEFINER).
 */
export function useResetCircuitBreaker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (serviceName: string) => {
      const { data, error } = await supabase.rpc("reset_circuit_breaker", {
        _service_name: serviceName,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["circuit-breakers"] });
      toast.success("Disjuntor reiniciado com sucesso.");
    },
    onError: (err: Error) => {
      toast.error(`Falha ao reiniciar disjuntor: ${err.message}`);
    },
  });
}
