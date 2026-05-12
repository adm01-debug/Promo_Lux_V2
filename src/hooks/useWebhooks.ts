import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/withOrg";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  total_sent: number;
  total_failed: number;
  last_triggered_at: string | null;
  created_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event: string;
  payload: unknown;
  status: "pending" | "success" | "failed" | "retrying";
  status_code: number | null;
  response_body: string | null;
  error_message: string | null;
  attempts: number;
  delivered_at: string | null;
  created_at: string;
}

export const WEBHOOK_EVENTS = [
  "companies.insert", "companies.update", "companies.delete",
  "deals.insert", "deals.update", "deals.delete",
  "stakeholders.insert", "stakeholders.update", "stakeholders.delete",
  "security.org_violation_threshold",
  "scrape_jobs.completed", "scrape_jobs.failed",
  "workflows.completed", "workflows.failed",
] as const;

export function useWebhooks() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["webhooks", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db.from("webhooks").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Webhook[];
    },
  });

  const createWebhook = useMutation({
    mutationFn: async (input: { name: string; url: string; events: string[] }) => {
      const { error } = await db.from("webhooks").insert({
        name: input.name, url: input.url, events: input.events,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webhooks", user?.id] }); toast.success("Webhook criado"); },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const updateWebhook = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Webhook> & { id: string }) => {
      const { error } = await db.from("webhooks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks", user?.id] }),
  });

  const deleteWebhook = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("webhooks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webhooks", user?.id] }); toast.success("Webhook removido"); },
  });

  return { ...query, createWebhook, updateWebhook, deleteWebhook };
}

export function useWebhookDeliveries(webhookId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["webhook_deliveries", webhookId],
    enabled: !!webhookId && !!user,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_deliveries")
        .select("*")
        .eq("webhook_id", webhookId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as WebhookDelivery[];
    },
  });

  const replay = useMutation({
    mutationFn: async (deliveryId: string) => {
      // Reset delivery state so the dispatcher will pick it up even if it
      // previously hit MAX_ATTEMPTS or was marked as failed.
      const { error: resetErr } = await supabase
        .from("webhook_deliveries")
        .update({
          status: "pending",
          attempts: 0,
          next_retry_at: new Date().toISOString(),
          error_message: null,
          status_code: null,
          response_body: null,
          delivered_at: null,
        })
        .eq("id", deliveryId);
      if (resetErr) throw resetErr;

      const { data, error } = await supabase.functions.invoke("webhook-dispatcher", {
        body: { delivery_id: deliveryId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webhook_deliveries", webhookId] }); toast.success("Reenvio disparado"); },
    onError: (e: Error) => toast.error("Falha no reenvio", { description: e.message }),
  });

  return { ...query, replay };
}