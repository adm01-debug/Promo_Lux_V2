/**
 * Definições de constantes para o sistema IPC.
 * Evita magic numbers espalhados pelo codebase.
 */

export const IPC_WEIGHTS = {
  SECTOR_MATCH: 30,
  LOCATION_MATCH: 20,
  HAS_EMAIL: 15,
  HAS_PHONE: 10,
  HAS_WEBSITE: 10,
  HIGH_RATING: 15, // >= 4 stars
} as const;

export const IPC_THRESHOLDS = {
  QUALIFIED: 75,
  MAX_SCORE: 100,
  DEFAULT_BASE_SCORE: 50,
} as const;

export const BUNDLE_BUDGETS = {
  MAX_GZIP_SIZE_KB: 250,
} as const;

export const APP_CONFIG = {
  TIMEZONE: "America/Sao_Paulo",
  DEFAULT_LOCALE: "pt-BR",
} as const;
