import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/withOrg";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

/** Polls deal_tasks every 60s and fires a toast when remind_at passes. */
export function useTaskReminders() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fired = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    // Rodada #27: proteção contra race conditions —
    // se o usuário deslogar ou trocar de sessão no meio de um fetch, a
    // flag `cancelled` impede que `db.update` execute com `user.id`
    // obsoleto (potencial escrita cross-tenant após signOut).
    let cancelled = false;

    const check = async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("deal_tasks")
        .select("id,title,remind_at,reminded,completed")
        .eq("user_id", user.id)
        .eq("completed", false)
        .eq("reminded", false)
        .lte("remind_at", nowIso)
        .not("remind_at", "is", null);

      if (cancelled || error || !data) return;

      for (const t of data) {
        if (cancelled) return;
        if (fired.current.has(t.id)) continue;
        fired.current.add(t.id);
        toast.info("⏰ Lembrete de tarefa", {
          description: t.title,
          duration: 10000,
        });
        const { error: updErr } = await db.from("deal_tasks").update({ reminded: true }).eq("id", t.id);
        if (updErr) {
          // Rollback do set para permitir nova tentativa; sem isso, uma falha
          // transitória silenciava o lembrete permanentemente (memory leak leve
          // + reminder perdido) até o refresh da página.
          fired.current.delete(t.id);
        }
      }
      if (data.length && !cancelled) qc.invalidateQueries({ queryKey: ["deal_tasks"] });
    };

    check();
    const i = window.setInterval(check, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(i);
    };
  }, [user, qc]);
}
