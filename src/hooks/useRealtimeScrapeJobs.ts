import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db, getActiveOrgId } from "@/integrations/supabase/withOrg";
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
  const activeOrgId = getActiveOrgId();

  useEffect(() => {
    if (!user?.id || !activeOrgId) return;

    const channel = supabase
      .channel(`org:${activeOrgId}:scrape-jobs`)
      .on(
        "postgres_changes",
        { 
          event: "UPDATE", 
          schema: "public", 
          table: "scrape_jobs", 
          filter: `organization_id=eq.${activeOrgId}` 
        },
        async (payload) => {
          const job = payload.new as Record<string, unknown>;
          const oldJob = payload.old as Record<string, unknown>;

          // Only notify on status transitions to completed/failed
          if (oldJob?.status === job?.status) return;

          queryClient.invalidateQueries({ queryKey: ["scrape-jobs"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });

          if (job.status === "completed") {
            const count = job.results_count ?? 0;
            const title = "✅ Raspagem concluída";
            const message = `"${job.name}" finalizou com ${count} resultado${count !== 1 ? "s" : ""}.`;

            toast({ title, description: message });

            await db.from("notifications").insert([{
              user_id: user.id,
              organization_id: activeOrgId,
              title,
              message,
              type: "scrape",
              metadata: {
                job_id: String(job.id ?? ""),
                job_name: String(job.name ?? ""),
                results_count: Number(count),
                source: String(job.source ?? ""),
              },
            }]);
          } else if (job.status === "failed") {
            const title = "❌ Raspagem falhou";
            const message = `"${String(job.name ?? "")}" falhou: ${String(job.error_message ?? "erro desconhecido")}.`;

            toast({ title, description: message, variant: "destructive" });

            await db.from("notifications").insert([{
              user_id: user.id,
              organization_id: activeOrgId,
              title,
              message,
              type: "scrape",
              metadata: {
                job_id: String(job.id ?? ""),
                job_name: String(job.name ?? ""),
                error: String(job.error_message ?? ""),
              },
            }]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, toast, user?.id, activeOrgId]);
}
