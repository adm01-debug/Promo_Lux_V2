/**
 * Tradução e padronização de mensagens de erro de OAuth/sync de e-mail.
 *
 * Recebe a string crua retornada pelos provedores (Google, Microsoft) ou pela
 * Edge Function de polling e devolve uma versão amigável em PT-BR explicando
 * o que aconteceu e qual ação o usuário precisa tomar.
 *
 * Mantida fora dos componentes para reutilização em badges, banners,
 * histórico de sync e logs de auditoria.
 */

export type EmailErrorKind = "auth" | "sync";
export type EmailErrorSeverity = "warning" | "error" | "fatal";

export interface EmailErrorInfo {
  /** Categoria do erro: requer reconexão (auth) ou é falha transitória de sync. */
  kind: EmailErrorKind;
  /** Gravidade — define cor e tom do badge. */
  severity: EmailErrorSeverity;
  /** Código curto (ex.: "401", "invalid_grant") para exibir junto ao label. */
  code: string | null;
  /** Título curto traduzido (≤ 30 chars). */
  title: string;
  /** Descrição em PT-BR explicando a causa provável. */
  description: string;
  /** Próximo passo recomendado em PT-BR. */
  actionHint: string;
  /** Mensagem original (truncada) para diagnóstico técnico. */
  raw: string;
}

/**
 * Padrões conhecidos. A ordem importa: o primeiro match vence — coloque os
 * mais específicos antes dos genéricos (ex.: `AADSTS70008` antes de `401`).
 */
const PATTERNS: Array<{
  match: RegExp;
  info: Omit<EmailErrorInfo, "raw" | "code"> & { code?: string };
}> = [
  // --- Google / Gmail ---
  {
    match: /invalid_grant/i,
    info: {
      kind: "auth",
      severity: "fatal",
      code: "invalid_grant",
      title: "Token revogado",
      description:
        "O acesso foi revogado pelo Google (senha alterada, permissão removida ou conta inativa há muito tempo).",
      actionHint: "Clique em Reconectar e autorize novamente o acesso ao Gmail.",
    },
  },
  {
    match: /invalid_token|token[_ ]expired/i,
    info: {
      kind: "auth",
      severity: "error",
      code: "invalid_token",
      title: "Token inválido",
      description: "O token OAuth não é mais válido e não pode ser renovado automaticamente.",
      actionHint: "Reconecte a conta para gerar um novo token.",
    },
  },
  {
    match: /admin_policy_enforced|access_denied/i,
    info: {
      kind: "auth",
      severity: "fatal",
      code: "access_denied",
      title: "Acesso negado pelo admin",
      description:
        "A política do Google Workspace bloqueou este aplicativo. Seu administrador precisa liberá-lo.",
      actionHint: "Peça ao admin do Workspace para autorizar o app e tente reconectar.",
    },
  },

  // --- Microsoft / Outlook ---
  {
    match: /AADSTS70008|AADSTS700082/i,
    info: {
      kind: "auth",
      severity: "fatal",
      code: "AADSTS70008",
      title: "Refresh token expirado",
      description:
        "O refresh token da Microsoft expirou por inatividade (90 dias sem uso) ou foi invalidado.",
      actionHint: "Reconecte a conta Outlook para gerar um novo token.",
    },
  },
  {
    match: /AADSTS50076|AADSTS50079/i,
    info: {
      kind: "auth",
      severity: "error",
      code: "AADSTS50076",
      title: "MFA exigido",
      description: "A Microsoft está exigindo autenticação multifator nesta conta.",
      actionHint: "Reconecte e complete o desafio de MFA quando solicitado.",
    },
  },
  {
    match: /AADSTS65001|consent_required/i,
    info: {
      kind: "auth",
      severity: "error",
      code: "consent_required",
      title: "Consentimento revogado",
      description: "O usuário ou o admin removeu o consentimento concedido a este app.",
      actionHint: "Reconecte para conceder o consentimento novamente.",
    },
  },

  // --- Códigos HTTP genéricos ---
  {
    match: /\b401\b|unauthorized/i,
    info: {
      kind: "auth",
      severity: "error",
      code: "401",
      title: "Não autorizado (401)",
      description: "Credenciais rejeitadas pelo provedor — token expirado ou removido.",
      actionHint: "Reconecte a conta para restaurar o acesso.",
    },
  },
  {
    match: /\b403\b|forbidden|insufficient[_ ]?(?:scope|permission)/i,
    info: {
      kind: "auth",
      severity: "error",
      code: "403",
      title: "Permissão insuficiente (403)",
      description: "O token está válido, mas faltam permissões para ler os e-mails.",
      actionHint: "Reconecte e marque todos os escopos solicitados.",
    },
  },
  {
    match: /\b429\b|rate[_ ]?limit|quota/i,
    info: {
      kind: "sync",
      severity: "warning",
      code: "429",
      title: "Limite de uso atingido",
      description: "O provedor está limitando temporariamente as requisições da sua conta.",
      actionHint: "Aguarde alguns minutos — o sistema tenta novamente automaticamente.",
    },
  },
  {
    match: /\b5\d{2}\b|service[_ ]?unavailable|internal[_ ]?error/i,
    info: {
      kind: "sync",
      severity: "warning",
      code: "5xx",
      title: "Provedor instável",
      description: "O servidor do provedor de e-mail respondeu com erro temporário.",
      actionHint: "Aguarde — o auto-retry vai tentar novamente em alguns minutos.",
    },
  },

  // --- Rede / timeout ---
  {
    match: /timeout|ETIMEDOUT|ENOTFOUND|ECONNRESET|network/i,
    info: {
      kind: "sync",
      severity: "warning",
      code: "network",
      title: "Falha de rede",
      description: "Não foi possível concluir a conexão com o provedor de e-mail.",
      actionHint: "Aguarde — uma nova tentativa será feita automaticamente.",
    },
  },

  // --- Reconexão sinalizada pela edge ---
  {
    match: /reconnect[_ ]?required|manual reconnection/i,
    info: {
      kind: "auth",
      severity: "fatal",
      code: "reconnect_required",
      title: "Reconexão manual",
      description: "O sistema esgotou as tentativas automáticas de renovar o token.",
      actionHint: "Reconecte a conta manualmente para retomar a sincronização.",
    },
  },
  {
    match: /refresh/i,
    info: {
      kind: "auth",
      severity: "error",
      code: "refresh_failed",
      title: "Falha ao renovar token",
      description: "O processo automático de renovar o token de acesso falhou.",
      actionHint: "Reconecte a conta para gerar um novo refresh token.",
    },
  },
];

const FALLBACK_AUTH_HINTS = [
  "revoked",
  "reconnect",
  "unauthorized",
  "401",
  "403",
  "invalid_grant",
  "invalid_token",
  "token_expired",
  "refresh",
];

function looksLikeAuth(err: string): boolean {
  const e = err.toLowerCase();
  return FALLBACK_AUTH_HINTS.some((h) => e.includes(h));
}

/**
 * Traduz uma mensagem de erro crua para o formato padronizado.
 *
 * Sempre retorna um `EmailErrorInfo` — quando nenhum padrão conhecido bate,
 * usa um fallback genérico (auth ou sync) preservando o trecho original.
 */
export function describeEmailError(rawInput: string | null | undefined): EmailErrorInfo | null {
  if (!rawInput) return null;
  const raw = rawInput.trim();
  if (!raw) return null;

  for (const { match, info } of PATTERNS) {
    if (match.test(raw)) {
      return {
        ...info,
        code: info.code ?? null,
        raw: raw.slice(0, 240),
      };
    }
  }

  if (looksLikeAuth(raw)) {
    return {
      kind: "auth",
      severity: "error",
      code: null,
      title: "Falha de autenticação",
      description: "O provedor recusou as credenciais atuais desta conta.",
      actionHint: "Reconecte a conta para restaurar o acesso.",
      raw: raw.slice(0, 240),
    };
  }

  return {
    kind: "sync",
    severity: "warning",
    code: null,
    title: "Erro de sincronização",
    description: "Não foi possível concluir a última verificação de e-mails.",
    actionHint: "O sistema tentará novamente em breve. Se persistir, reconecte a conta.",
    raw: raw.slice(0, 240),
  };
}

/** Helper rápido — mantém compatibilidade com o `isAuthError` antigo. */
export function isAuthErrorMessage(err: string | null | undefined): boolean {
  const info = describeEmailError(err);
  return info?.kind === "auth";
}