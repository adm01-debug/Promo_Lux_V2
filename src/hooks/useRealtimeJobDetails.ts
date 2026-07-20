import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/contexts/active-org-context";

export function useRealtimeJobDetails(jobId: string | null) {
  const queryClient = useQueryClient();
  // Ver useRealtimeCompanies.ts: Context reativo em vez de snapshot estático.
  const { activeOrgId } = useActiveOrganization();

  useEffect(() => {
    if (!jobId || !activeOrgId) return;

    const channel = supabase
      .channel(`job-details:${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "automation_steps",
          filter: `job_id=eq.${jobId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["automation-steps", jobId] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "scrape_jobs",
          filter: `id=eq.${jobId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["scrape-job", jobId] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "scrape_results",
          filter: `job_id=eq.${jobId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["scrape-results", jobId] });
          queryClient.invalidateQueries({ queryKey: ["scrape-job", jobId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, activeOrgId, queryClient]);
}
