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
          // Evita count=exact (scan completo). Badge exibe "99+" acima do teto,
          // então basta contar até MAX_UNREAD + 1 via limit — index-only scan.
          const MAX_UNREAD = 99;
          const { data, error } = await db
            .from("notifications")
            .select("id")
            .eq("read", false)
            .limit(MAX_UNREAD + 1);
          if (error) throw error;
          return data?.length ?? 0;
        },
    refetchInterval: 30_000,
  });
  return data ?? 0;
};
