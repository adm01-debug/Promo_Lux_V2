import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/withOrg";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/** Polls deal_tasks every 60s and fires a toast when remind_at passes. */
export function useTaskReminders() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fired = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    const check = async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await db
        .from("deal_tasks")
        .select("id,title,remind_at,reminded,completed")
        .eq("user_id", user.id)
        .eq("completed", false)
        .eq("reminded", false)
        .lte("remind_at", nowIso)
        .not("remind_at", "is", null);

      if (error || !data) return;

      for (const t of data) {
        if (fired.current.has(t.id)) continue;
        fired.current.add(t.id);
        toast.info("⏰ Lembrete de tarefa", {
          description: t.title,
          duration: 10000,
        });
        await db.from("deal_tasks").update({ reminded: true }).eq("id", t.id);
      }
      if (data.length) qc.invalidateQueries({ queryKey: ["deal_tasks"] });
    };

    check();
    const i = window.setInterval(check, 60_000);
    return () => window.clearInterval(i);
  }, [user, qc]);
}