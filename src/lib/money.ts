/**
 * Dinheiro no front: `deals.currency` não tem restrição no banco, então um
 * funil pode ter negócios em moedas diferentes. Todo total precisa ser
 * agrupado por moeda antes de ser somado e rotulado — somar tudo e chamar de
 * real é o defeito que este módulo evita (achado G29-4).
 */

export interface CurrencyTotal {
  /** Código da moeda, em maiúsculas (ex.: "BRL", "USD"). */
  currency: string;
  total: number;
}

const FALLBACK_CURRENCY = "BRL";

function normalizeCurrency(code: string | null | undefined): string {
  const trimmed = (code ?? "").trim().toUpperCase();
  return trimmed === "" ? FALLBACK_CURRENCY : trimmed;
}

/**
 * Soma os valores agrupando por moeda, na ordem em que as moedas aparecem.
 * Valores nulos ou não numéricos contam como zero.
 */
export function groupByCurrency<T>(
  items: readonly T[],
  valueOf: (item: T) => number | string | null | undefined,
  currencyOf: (item: T) => string | null | undefined,
): CurrencyTotal[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    const currency = normalizeCurrency(currencyOf(item));
    const parsed = Number(valueOf(item) ?? 0);
    const amount = Number.isFinite(parsed) ? parsed : 0;
    totals.set(currency, (totals.get(currency) ?? 0) + amount);
  }
  return Array.from(totals, ([currency, total]) => ({ currency, total }));
}

/** Formata um valor na moeda informada; código inválido não derruba a tela. */
export function formatMoney(value: number, currency: string | null | undefined): string {
  const code = normalizeCurrency(currency);
  const amount = Number.isFinite(value) ? value : 0;
  try {
    return amount.toLocaleString("pt-BR", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    });
  } catch {
    return `${code} ${amount.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
  }
}

/** Junta os totais numa linha só: "R$ 10.000 · US$ 2.000". */
export function formatCurrencyTotals(totals: readonly CurrencyTotal[]): string {
  return totals.map((t) => formatMoney(t.total, t.currency)).join(" · ");
}