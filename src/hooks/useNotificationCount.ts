import { useDemo } from "@/contexts/demo-context";
import { DEMO_NOTIFICATIONS } from "@/lib/demoData";
import { db } from "@/integrations/supabase/withOrg";
import { useQuery } from "@tanstack/react-query";

/** Unread notifications count (real or demo mode), polled every 30s. */
export const useNotificationCount = () => {
  const { isDemoMode } = useDemo();
  const { data } = useQuery({
    queryKey: ["notifications-count", isDemoMode],
    queryFn: isDemoMode
      ? () => DEMO_NOTIFICATIONS.filter((n) => !n.read).length
      : async () => {
          const { count, error } = await db
            .from("notifications")
            .select("*", { count: "exact", head: true })
            .eq("read", false);
          if (error) throw error;
          return count ?? 0;
        },
    refetchInterval: 30_000,
  });
  return data ?? 0;
};
