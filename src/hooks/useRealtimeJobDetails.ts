import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getActiveOrgId } from "@/integrations/supabase/withOrg";

export function useRealtimeJobDetails(jobId: string | null) {
  const queryClient = useQueryClient();
  const activeOrgId = getActiveOrgId();

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, activeOrgId, queryClient]);
}
