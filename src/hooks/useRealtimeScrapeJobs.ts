import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Subscribe to realtime changes on scrape_jobs.
 * Notifies users when scrape jobs complete and persists notifications.
 */
export function useRealtimeScrapeJobs() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const channel = supabase
      .channel("scrape-jobs-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "scrape_jobs" },
        async (payload) => {
          const job = payload.new as any;
          const oldJob = payload.old as any;

          // Only notify on status transitions to completed/failed
          if (oldJob?.status === job?.status) return;

          queryClient.invalidateQueries({ queryKey: ["scrape-jobs"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });

          if (job.status === "completed") {
            const count = job.results_count ?? 0;
            const title = "✅ Raspagem concluída";
            const message = `"${job.name}" finalizou com ${count} resultado${count !== 1 ? "s" : ""}.`;

            toast({ title, description: message });

            if (user?.id) {
              await supabase.from("notifications").insert({
                user_id: user.id,
                title,
                message,
                type: "scrape",
                metadata: {
                  job_id: job.id,
                  job_name: job.name,
                  results_count: count,
                  source: job.source,
                },
              });
            }
          } else if (job.status === "failed") {
            const title = "❌ Raspagem falhou";
            const message = `"${job.name}" falhou: ${job.error_message ?? "erro desconhecido"}.`;

            toast({ title, description: message, variant: "destructive" });

            await supabase.from("notifications").insert({
              user_id: user?.id,
              title,
              message,
              type: "scrape",
              metadata: {
                job_id: job.id,
                job_name: job.name,
                error: job.error_message,
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
