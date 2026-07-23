/**
 * Utilitários de CNPJ — normalização e validação dos dígitos verificadores.
 * Espelha a lógica usada na edge function `cnpj-enrich`.
 */

/** Remove qualquer caractere não numérico. */
export function normalizeCnpj(cnpj: string): string {
  return (cnpj ?? "").replace(/\D+/g, "");
}

/** Formata 14 dígitos no padrão 00.000.000/0000-00. Retorna a entrada se não tiver 14 dígitos. */
export function formatCnpj(cnpj: string): string {
  const digits = normalizeCnpj(cnpj);
  if (digits.length !== 14) return cnpj;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

/**
 * Valida um CNPJ (14 dígitos + checagem dos dois dígitos verificadores).
 * Aceita string com ou sem máscara. Rejeita sequências repetidas (ex.: 00000000000000).
 */
export function isValidCnpj(cnpj: string): boolean {
  const digits = normalizeCnpj(cnpj);
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const calc = (base: string, weights: number[]): number => {
    const sum = base.split("").reduce((acc, d, i) => acc + Number(d) * weights[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(digits.slice(0, 12), w1);
  const d2 = calc(digits.slice(0, 12) + d1, w2);
  return d1 === Number(digits[12]) && d2 === Number(digits[13]);
}
