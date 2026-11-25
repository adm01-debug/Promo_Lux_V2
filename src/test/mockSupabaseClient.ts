import { vi } from "vitest";

export interface SupabaseCall {
  table: string;
  method: string;
  args: unknown[];
}

type SupabaseResult = { data?: unknown; error?: unknown };

const CHAIN_METHODS = [
  "select",
  "eq",
  "is",
  "not",
  "in",
  "order",
  "limit",
  "gte",
  "lte",
  "insert",
  "update",
  "upsert",
  "delete",
  "maybeSingle",
  "single",
];

/**
 * Client Supabase falso para testes de componente.
 *
 * O wrapper `withOrg` (usado por `db.from`) encadeia `.eq("organization_id")` e,
 * nas tabelas com exclusao reversivel, `.is("deleted_at", null)` em toda leitura.
 * O builder real do supabase-js tambem e aguardavel em qualquer ponto da cadeia
 * (`await supabase.from(t).select(...).eq(...)`).
 *
 * Este mock reproduz as duas coisas: qualquer metodo devolve o proprio builder e
 * `await` resolve o resultado configurado. `calls` registra cada chamada
 * (`table`, `method`, `args`) para que o teste prove que a consulta saiu
 * escopada pela organizacao ativa.
 */
export function createSupabaseClientMock(options: {
  /** Resultado resolvido quando o builder e aguardado. */
  result?: () => SupabaseResult;
  /** Registro compartilhado das chamadas (opcional). */
  calls?: SupabaseCall[];
  /** Metodos extras do client (rpc, functions, storage, ...). */
  extra?: Record<string, unknown>;
  /**
   * Substitui um metodo do builder por um mock proprio (o `vi.fn()` do teste).
   * Use quando o teste precisar assertar a chamada pelo nome do metodo.
   */
  builderOverrides?: Record<string, (...args: unknown[]) => unknown>;
}) {
  const calls = options.calls ?? [];
  const result = options.result ?? (() => ({ data: null, error: null }));

  const builderFor = (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const method of CHAIN_METHODS) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return builder;
      };
    }
    for (const [method, impl] of Object.entries(options.builderOverrides ?? {})) {
      builder[method] = impl;
    }
    builder.then = (
      onFulfilled?: (value: SupabaseResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => {
      const resolved = result();
      return Promise.resolve({ data: null, error: null, ...resolved }).then(
        onFulfilled,
        onRejected,
      );
    };
    return builder;
  };

  return {
    from: vi.fn((table: string) => builderFor(table)),
    ...options.extra,
  };
}
