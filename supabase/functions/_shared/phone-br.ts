// ============================================================================
// _shared/phone-br.ts
// Normalização de telefones brasileiros. Formato canônico: E.164 +55...
// Detecta 10 dígitos (fixo) e 11 dígitos (celular com 9).
// Números internacionais não-BR são retornados sem alteração se tiverem "+".
// ============================================================================

const BR_DDDS = new Set([
  11,12,13,14,15,16,17,18,19,
  21,22,24,27,28,
  31,32,33,34,35,37,38,
  41,42,43,44,45,46,47,48,49,
  51,53,54,55,
  61,62,63,64,65,66,67,68,69,
  71,73,74,75,77,79,
  81,82,83,84,85,86,87,88,89,
  91,92,93,94,95,96,97,98,99,
]);

export interface NormalizedPhone {
  raw: string;
  e164: string | null;
  ddd: number | null;
  is_mobile: boolean;
  country: "BR" | "INTL" | "UNKNOWN";
}

export function normalizePhoneBR(input: string | null | undefined): NormalizedPhone {
  const raw = (input ?? "").trim();
  if (!raw) return { raw: "", e164: null, ddd: null, is_mobile: false, country: "UNKNOWN" };

  // Já em E.164 internacional não-BR
  if (raw.startsWith("+") && !raw.startsWith("+55")) {
    return { raw, e164: raw.replace(/[^\d+]/g, ""), ddd: null, is_mobile: false, country: "INTL" };
  }

  const digits = raw.replace(/\D/g, "");
  let local = digits;
  if (local.startsWith("55") && (local.length === 12 || local.length === 13)) {
    local = local.slice(2);
  } else if (local.startsWith("0055")) {
    local = local.slice(4);
  }

  if (local.length !== 10 && local.length !== 11) {
    return { raw, e164: null, ddd: null, is_mobile: false, country: "UNKNOWN" };
  }
  const ddd = parseInt(local.slice(0, 2), 10);
  if (!BR_DDDS.has(ddd)) {
    return { raw, e164: null, ddd: null, is_mobile: false, country: "UNKNOWN" };
  }
  const rest = local.slice(2);
  const isMobile = rest.length === 9 && rest.startsWith("9");
  return {
    raw,
    e164: `+55${local}`,
    ddd,
    is_mobile: isMobile,
    country: "BR",
  };
}
