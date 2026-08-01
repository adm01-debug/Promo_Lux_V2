/**
 * Helpers puros de UI/formatação do Oracle v2.
 * Extraídos para permitir testes unitários sem montar contexto de React/Query.
 */

import type { PushBitrixResponse } from "./useOracleV2";

export interface BitrixReadiness {
  pronto: boolean;
  /** Mensagem PT-BR explicando o que falta; null quando pronto. */
  motivoBloqueio: string | null;
}

/**
 * Avalia se os campos do destino Bitrix estão prontos para envio.
 * Regras: company_id não vazio; user_id somente dígitos.
 */
export function computeBitrixReadiness(
  bitrixCompanyId: string,
  bitrixUserId: string,
): BitrixReadiness {
  const companyOk = bitrixCompanyId.trim().length > 0;
  const userTrim = bitrixUserId.trim();
  const userOk = userTrim.length > 0 && /^\d+$/.test(userTrim);
  if (companyOk && userOk) return { pronto: true, motivoBloqueio: null };

  const faltas: string[] = [];
  if (!companyOk) faltas.push("ID da empresa no Bitrix");
  if (userTrim.length === 0) faltas.push("ID do responsável no Bitrix");
  else if (!/^\d+$/.test(userTrim)) faltas.push("ID do responsável precisa ser numérico");

  return { pronto: false, motivoBloqueio: `Preencha: ${faltas.join(" e ")}.` };
}

export interface PushResumoTexto {
  /** Tom sugerido para o toast. */
  tone: "success" | "warning" | "error";
  /** Texto pronto para exibir. */
  mensagem: string;
}

/**
 * Formata o toast de resumo do push ao Bitrix a partir da resposta da edge.
 * Inclui um prefixo curto do correlation_id para rastreio em suporte.
 */
export function formatPushResumo(data: PushBitrixResponse): PushResumoTexto {
  const { sent, duplicates, errors, sem_dado } = data.summary;
  const partes: string[] = [];
  if (sent > 0) partes.push(`${sent} cadastrado(s)`);
  if (duplicates > 0) partes.push(`${duplicates} já existia(m)`);
  if (sem_dado > 0) partes.push(`${sem_dado} sem email/telefone`);
  if (errors > 0) partes.push(`${errors} com erro`);
  const resumo = partes.join(", ") || "nada a enviar";
  const cid = data.correlation_id ? ` (ref: ${data.correlation_id.slice(0, 8)})` : "";

  if (errors > 0 && sent === 0) {
    return { tone: "error", mensagem: `Envio ao Bitrix falhou: ${resumo}.${cid}` };
  }
  if (errors > 0) return { tone: "warning", mensagem: `Bitrix: ${resumo}.${cid}` };
  return { tone: "success", mensagem: `Bitrix: ${resumo}.${cid}` };
}
