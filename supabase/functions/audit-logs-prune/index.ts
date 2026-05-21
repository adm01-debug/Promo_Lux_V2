import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Cron function to prune old audit logs and api_request_logs
 * Recommended to run weekly or monthly.
 */

serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const RETENTION_DAYS = 90;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  const cutoffStr = cutoffDate.toISOString();

  console.log(`Pruning logs older than ${cutoffStr}...`);

  try {
    // Prune audit_logs
    const { count: auditCount, error: auditError } = await supabase
      .from('audit_logs')
      .delete({ count: 'exact' })
      .lt('created_at', cutoffStr);

    if (auditError) throw auditError;

    // Prune api_request_logs
    const { count: apiCount, error: apiError } = await supabase
      .from('api_request_logs')
      .delete({ count: 'exact' })
      .lt('created_at', cutoffStr);

    if (apiError) throw apiError;
    
    // Prune health_checks
    const { count: healthCount, error: healthError } = await supabase
      .from('health_checks')
      .delete({ count: 'exact' })
      .lt('created_at', cutoffStr);

    if (healthError) throw healthError;

    return new Response(JSON.stringify({
      success: true,
      pruned: {
        audit_logs: auditCount,
        api_request_logs: apiCount,
        health_checks: healthCount
      }
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Prune error:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
});
