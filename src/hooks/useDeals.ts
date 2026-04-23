import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/withOrg";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface DealStage {
  id: string;
  name: string;
  color: string;
  position: number;
  probability: number;
  type: "open" | "won" | "lost";
}

export interface Deal {
  id: string;
  stage_id: string;
  title: string;
  description: string | null;
  value: number | null;
  currency: string;
  company_id: string | null;
  stakeholder_id: string | null;
  expected_close_date: string | null;
  closed_at: string | null;
  priority: "low" | "medium" | "high";
  tags: string[] | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export function useDealStages() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["deal_stages", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_stages")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DealStage[];
    },
  });

  // Auto-seed default stages
  useEffect(() => {
    if (!user || query.isLoading || query.data === undefined) return;
    if (query.data.length === 0) {
      (async () => {
        await supabase.rpc("create_default_deal_stages", { _user_id: user.id });
        qc.invalidateQueries({ queryKey: ["deal_stages", user.id] });
      })();
    }
  }, [user, query.data, query.isLoading, qc]);

  const createStage = useMutation({
    mutationFn: async (input: Partial<DealStage> & { name: string }) => {
      const { data, error } = await supabase
        .from("deal_stages")
        .insert({
          name: input.name,
          color: input.color ?? "#D4A520",
          position: input.position ?? (query.data?.length ?? 0),
          probability: input.probability ?? 0,
          type: input.type ?? "open",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal_stages", user?.id] });
      toast.success("Estágio criado");
    },
    onError: (e: Error) => toast.error("Erro ao criar estágio", { description: e.message }),
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<DealStage> & { id: string }) => {
      const { error } = await db.from("deal_stages").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deal_stages", user?.id] }),
  });

  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("deal_stages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal_stages", user?.id] });
      toast.success("Estágio removido");
    },
    onError: (e: Error) => toast.error("Não foi possível remover", { description: e.message }),
  });

  return { ...query, createStage, updateStage, deleteStage };
}

export function useDeals() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["deals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Deal[];
    },
  });

  const createDeal = useMutation({
    mutationFn: async (input: Partial<Deal> & { title: string; stage_id: string }) => {
      const { data, error } = await supabase
        .from("deals")
        .insert({
          title: input.title,
          stage_id: input.stage_id,
          description: input.description ?? null,
          value: input.value ?? 0,
          currency: input.currency ?? "BRL",
          company_id: input.company_id ?? null,
          stakeholder_id: input.stakeholder_id ?? null,
          expected_close_date: input.expected_close_date ?? null,
          priority: input.priority ?? "medium",
          tags: input.tags ?? [],
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deals", user?.id] });
      toast.success("Negócio criado");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const updateDeal = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Deal> & { id: string }) => {
      const { error } = await db.from("deals").update(patch).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: ["deals", user?.id] });
      const prev = qc.getQueryData<Deal[]>(["deals", user?.id]);
      qc.setQueryData<Deal[]>(["deals", user?.id], (old) =>
        (old ?? []).map((d) => (d.id === id ? { ...d, ...patch } as Deal : d)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["deals", user?.id], ctx.prev);
      toast.error("Erro ao atualizar negócio");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["deals", user?.id] }),
  });

  const deleteDeal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("deals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deals", user?.id] });
      toast.success("Negócio removido");
    },
  });

  return { ...query, createDeal, updateDeal, deleteDeal };
}

export interface DealActivity {
  id: string;
  deal_id: string;
  type: "note" | "call" | "email" | "meeting" | "stage_change" | "system";
  title: string;
  content: string | null;
  metadata: unknown;
  created_at: string;
}

export function useDealActivities(dealId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["deal_activities", dealId],
    enabled: !!dealId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_activities")
        .select("*")
        .eq("deal_id", dealId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DealActivity[];
    },
  });

  const addActivity = useMutation({
    mutationFn: async (input: { type: DealActivity["type"]; title: string; content?: string }) => {
      if (!dealId) throw new Error("No deal selected");
      const { error } = await db.from("deal_activities").insert({
        deal_id: dealId,
        type: input.type,
        title: input.title,
        content: input.content ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal_activities", dealId] });
      toast.success("Atividade adicionada");
    },
  });

  return { ...query, addActivity };
}

export interface DealTask {
  id: string;
  deal_id: string | null;
  title: string;
  description: string | null;
  due_at: string | null;
  remind_at: string | null;
  completed: boolean;
  completed_at: string | null;
  priority: "low" | "medium" | "high";
  created_at: string;
}

export function useDealTasks(dealId?: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["deal_tasks", user?.id, dealId ?? "all"],
    enabled: !!user,
    queryFn: async () => {
      let q = db.from("deal_tasks").select("*").order("due_at", { ascending: true, nullsFirst: false });
      if (dealId) q = q.eq("deal_id", dealId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DealTask[];
    },
  });

  const createTask = useMutation({
    mutationFn: async (input: Partial<DealTask> & { title: string }) => {
      const { error } = await db.from("deal_tasks").insert({
        deal_id: input.deal_id ?? dealId ?? null,
        title: input.title,
        description: input.description ?? null,
        due_at: input.due_at ?? null,
        remind_at: input.remind_at ?? null,
        priority: input.priority ?? "medium",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal_tasks"] });
      toast.success("Tarefa criada");
    },
  });

  const toggleTask = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from("deal_tasks")
        .update({ completed, completed_at: completed ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deal_tasks"] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("deal_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal_tasks"] });
      toast.success("Tarefa removida");
    },
  });

  return { ...query, createTask, toggleTask, deleteTask };
}