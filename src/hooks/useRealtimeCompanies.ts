import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Subscribe to realtime changes on the companies table.
 * Auto-invalidates relevant queries, shows a toast, and
 * persists a notification when scraped companies arrive.
 */
export function useRealtimeCompanies() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const channel = supabase
      .channel("companies-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "companies" },
        async (payload) => {
          queryClient.invalidateQueries({ queryKey: ["companies-list"] });
          queryClient.invalidateQueries({ queryKey: ["companies-map"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
          queryClient.invalidateQueries({ queryKey: ["recent-companies"] });

          if (payload.eventType === "INSERT") {
            const company = payload.new as any;
            const name = company?.name ?? "Nova empresa";
            const source = company?.source ?? "manual";
            const sector = company?.sector ?? "";
            const location = company?.location ?? "";

            const isScraped = source !== "manual";

            const title = isScraped
              ? "🔍 Nova empresa raspada"
              : "🏢 Nova empresa adicionada";

            const details = [sector, location].filter(Boolean).join(" · ");
            const description = `"${name}"${details ? ` — ${details}` : ""}`;

            toast({ title, description });

            // Persist notification in DB for the notifications panel
            await supabase.from("notifications").insert({
              title,
              message: description,
              type: isScraped ? "scrape" : "system",
              metadata: {
                company_id: company?.id,
                company_name: name,
                source,
                sector,
                location,
              },
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
