import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Subscribe to realtime changes on the companies table.
 * Auto-invalidates relevant queries and shows a toast on inserts.
 */
export function useRealtimeCompanies() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const channel = supabase
      .channel("companies-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "companies" },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["companies-list"] });
          queryClient.invalidateQueries({ queryKey: ["companies-map"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });

          if (payload.eventType === "INSERT") {
            const name = (payload.new as any)?.name ?? "Nova empresa";
            toast({
              title: "Nova empresa detectada",
              description: `"${name}" foi adicionada ao sistema.`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, toast]);
}
