import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function checkCircuitBreaker(supabase: SupabaseClient, serviceName: string): Promise<boolean> {
  const { data: cb } = await supabase
    .from("circuit_breakers")
    .select("*")
    .eq("service_name", serviceName)
    .maybeSingle();

  if (!cb) {
    await supabase.from("circuit_breakers").insert({ service_name: serviceName });
    return true;
  }

  if (cb.state === "open") {
    const now = new Date();
    const openedAt = new Date(cb.opened_at);
    if (now.getTime() - openedAt.getTime() > cb.reset_timeout_ms) {
      // Transition to half-open
      await supabase.from("circuit_breakers").update({ state: "half-open" }).eq("service_name", serviceName);
      return true;
    }
    return false;
  }

  return true;
}

export async function reportSuccess(supabase: SupabaseClient, serviceName: string) {
  await supabase
    .from("circuit_breakers")
    .update({ state: "closed", failure_count: 0, last_failure_at: null, opened_at: null })
    .eq("service_name", serviceName);
}

export async function reportFailure(supabase: SupabaseClient, serviceName: string) {
  const { data: cb } = await supabase
    .from("circuit_breakers")
    .select("*")
    .eq("service_name", serviceName)
    .single();

  const newCount = cb.failure_count + 1;
  const updates: Record<string, unknown> = { failure_count: newCount, last_failure_at: new Date().toISOString() };

  if (newCount >= cb.threshold) {
    updates.state = "open";
    updates.opened_at = new Date().toISOString();
  }

  await supabase.from("circuit_breakers").update(updates).eq("service_name", serviceName);
}
