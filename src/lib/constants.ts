/**
 * Definições de constantes gerais do sistema.
 * Evita magic numbers espalhados pelo codebase.
 *
 * O scoring IPC (pesos/thresholds) vive só em
 * supabase/functions/_shared/domain/ipc/scoring.ts — é a única
 * implementação que roda de verdade (persiste ipc_score via gmaps-proxy).
 * Chegou a existir uma cópia frontend (src/lib/ipc.ts) com pesos e regras
 * diferentes dessa, mas nunca foi importada por nenhum componente —
 * removida para não convergir em código morto divergente de novo.
 */

export const BUNDLE_BUDGETS = {
  MAX_GZIP_SIZE_KB: 250,
} as const;

export const APP_CONFIG = {
  TIMEZONE: "America/Sao_Paulo",
  DEFAULT_LOCALE: "pt-BR",
} as const;
