# ADR-029 — Rodada #35: Fuzz de historyUtils + contrato tipado do DecisionMakersGrid

**Data:** 2026-07-22
**Status:** Aceito

## Contexto
R34 travou 66 asserções sobre `StatusBadge`, `constants` e `types`. Faltava
fechar duas lacunas apontadas: (a) `historyUtils` era testado só com payloads
"felizes" e (b) o contrato de props do `DecisionMakersGrid` (extraído em R31)
não tinha type-test — qualquer renomeação silenciosa quebraria em runtime.

## Decisão
1. **Preflight Monte Carlo (300 cenários, seed=3535):** p95=0,13ms. Gate PASS.
2. **`historyUtils.fuzz.test.ts`** — 7 casos com PRNG determinístico gerando 500
   payloads adversos (domínios malformados, datas inválidas, durações NaN/
   negativas, mensagens com *formula injection*). Travam 6 invariantes:
   - `filterHistory` nunca lança e retorna subconjunto do input.
   - `formatDurationMs` nunca vaza `NaN` para NaN/negativos/Infinity.
   - `normalizeDomain` converge (ponto fixo em ≤3 iterações).
   - `findRecentDuplicate` ignora entradas `queued/processing`.
   - `sanitizeCsvCell` neutraliza `=+-@\t\r`.
   - `buildHistoryCsvRows` preserva as 9 colunas esperadas e nenhuma célula
     escapa a sanitização.
3. **`DecisionMakersGrid.test-d.ts`** — 7 type-tests via `expectTypeOf` fixando
   assinatura exata de todas as props, incluindo o payload discriminado
   `onOpenDetails({ type: "certifications" | "courses" | "awards"; dm })`.

## Consequências
- Regressões silenciosas em `historyUtils` (função pura crítica ao histórico do
  Oráculo) passam a falhar no CI antes do deploy.
- Contrato de `DecisionMakersGridProps` fica auto-documentado e trava a
  refatoração futura (R36+).
- Descoberta lateral: `normalizeDomain` não é idempotente em 1 passo para
  inputs com `www.` duplicado — comportamento aceito e coberto por teste de
  convergência (ponto fixo em 2 passos).

## Referências
- `src/components/lux/lusha/__tests__/historyUtils.fuzz.test.ts`
- `src/components/lux/lusha/DecisionMakersGrid.test-d.ts`
- `scripts/mc-r35-preflight.ts`
