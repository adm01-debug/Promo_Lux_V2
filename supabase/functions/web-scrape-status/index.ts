// web-scrape-status
// Consulta status + resultado de uma task de web scrape por task_id.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json(401, { error: "missing_authorization" });

  const url = new URL(req.url);
  const taskId = url.searchParams.get("task_id");
  if (!taskId) return json(400, { error: "missing_task_id" });

  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: task, error } = await supabase
    .from("web_scrape_queue")
    .select("id, status, attempts, max_attempts, last_error, trace_id, url, result_id, created_at, updated_at")
    .eq("id", taskId)
    .maybeSingle();

  if (error) return json(500, { error: error.message });
  if (!task) return json(404, { error: "not_found" });

  let result = null;
  if (task.result_id) {
    const { data: r } = await supabase
      .from("web_scrape_results")
      .select("id, url, final_url, http_status, title, description, markdown, links, extracted_json, bytes, duration_ms, fetched_at, partial_content")
      .eq("id", task.result_id)
      .maybeSingle();
    result = r;
  }

  return json(200, { task, result });
});
