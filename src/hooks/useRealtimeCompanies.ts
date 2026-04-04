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
    if (!user?.id) return;
    const channel = supabase
      .channel(`private:${user.id}:companies`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "companies", filter: `user_id=eq.${user.id}` },
        async (payload) => {
          queryClient.invalidateQueries({ queryKey: ["companies-list"] });
          queryClient.invalidateQueries({ queryKey: ["companies-map"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
          queryClient.invalidateQueries({ queryKey: ["recent-companies"] });

          if (payload.eventType === "INSERT") {
            const company = payload.new as Record<string, unknown>;
            const name = (company?.name as string) ?? "Nova empresa";
            const source = (company?.source as string) ?? "manual";
            const sector = (company?.sector as string) ?? "";
            const location = (company?.location as string) ?? "";

            const isScraped = source !== "manual";

            const title = isScraped
              ? "🔍 Nova empresa raspada"
              : "🏢 Nova empresa adicionada";

            const details = [sector, location].filter(Boolean).join(" · ");
            const description = `"${name}"${details ? ` — ${details}` : ""}`;

            toast({ title, description });

            // Persist notification in DB for the notifications panel
            if (!user?.id) return;
            await supabase.from("notifications").insert([{
              user_id: user.id,
              title,
              message: description,
              type: isScraped ? "scrape" : "system",
              metadata: {
                company_id: (company?.id as string) ?? null,
                company_name: name,
                source,
                sector,
                location,
              },
            }]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, toast, user?.id]);
}
