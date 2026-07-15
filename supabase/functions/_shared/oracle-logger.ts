// ============================================================================
// _shared/oracle-logger.ts
// Logger estruturado para as edges do Oracle v2. Grava em automation_execution_logs
// e emite JSON no stdout (ADR-006).
// ============================================================================
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface OracleLoggerInit {
  admin: SupabaseClient;
  source: string;
  correlationId: string;
  userId: string | null;
  organizationId: string | null;
}

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  step: string;
  phase?: string;
  status?: "success" | "degraded" | "error" | "skipped";
  message: string;
  level?: LogLevel;
  durationMs?: number;
  httpStatus?: number;
  transient?: boolean;
  errorDetail?: string;
  failureReason?: string;
  attempt?: number;
  maxAttempts?: number;
  metadata?: Record<string, unknown>;
}

export class OracleLogger {
  constructor(private readonly init: OracleLoggerInit) {}

  async log(entry: LogEntry): Promise<void> {
    const level = entry.level ?? (entry.status === "error" ? "error" : "info");
    const record = {
      function: this.init.source,
      request_id: this.init.correlationId,
      level,
      msg: entry.message,
      duration_ms: entry.durationMs,
      step: entry.step,
      ts: new Date().toISOString(),
    };
    // ADR-006 structured log
    console.log(JSON.stringify(record));

    try {
      await this.init.admin.from("automation_execution_logs").insert({
        user_id: this.init.userId,
        organization_id: this.init.organizationId,
        source: this.init.source,
        step_name: entry.step,
        phase: entry.phase ?? null,
        status: entry.status ?? (level === "error" ? "error" : "success"),
        level,
        message: entry.message,
        failure_reason: entry.failureReason ?? null,
        error_detail: entry.errorDetail ?? null,
        http_status: entry.httpStatus ?? null,
        transient: entry.transient ?? null,
        duration_ms: entry.durationMs ?? null,
        attempt: entry.attempt ?? null,
        max_attempts: entry.maxAttempts ?? null,
        correlation_id: this.init.correlationId,
        metadata: entry.metadata ?? null,
      });
    } catch (err) {
      console.error(
        JSON.stringify({
          function: this.init.source,
          request_id: this.init.correlationId,
          level: "error",
          msg: "logger_insert_failed",
          error: (err as Error).message,
          ts: new Date().toISOString(),
        }),
      );
    }
  }
}
