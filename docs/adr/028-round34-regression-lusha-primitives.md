# ADR-028 — Rodada #34: Regressão para primitivas Lusha (StatusBadge, constants, types)

**Status:** Aceito · **Data:** 2026-07-22

## Contexto
As R30–R31 extraíram três primitivas do monólito `LushaIntelligenceView.tsx`:
`StatusBadge` (semantização visual de 13 estados), `DEPT_GROUPS` (grupos de
departamentos PT-BR) e o barril de `types.ts` (8 contratos). Ficaram cobertas
apenas 4 asserções pontuais para o badge — insuficiente para travar mudanças
acidentais em labels, cores, remoção de chaves ou renomeações de campo.

## Decisão
Adicionar suite de regressão **exclusivamente sobre testes**, sem tocar em
código de produção:

- `StatusBadge.test.tsx`: 4 → 21 asserções. `it.each` cobre as 13 chaves do
  `map` (label PT-BR + família de cor via regex) e agrupamentos semânticos
  (`error*` = destructive, `pending*` = Pendente). Fallbacks: `null`,
  string vazia, whitespace, status desconhecido.
- `constants.test.ts` (novo): 5 grupos em ordem estável, labels/items
  não-vazios, invariante de unicidade cross-group e snapshot flat da lista de
  departamentos.
- `types.test-d.ts` (novo, type-only): `expectTypeOf` valida shape dos 8
  contratos, incluindo fixtures mínimas e máximas (`DecisionMaker` com todos
  os opcionais LinkedIn/X).

## Guard-rails
- Sem alteração em `.tsx` de produção.
- `bunx vitest run src/components/lux/lusha/` esperado verde.
- `bunx tsgo --noEmit` limpo.

## Consequências
+ Qualquer remoção/renomeação de estado no `StatusBadge` ou de departamento no
  `DEPT_GROUPS` quebra o CI imediatamente.
+ Contratos de tipo passam a ser executáveis, não apenas documentação.
- +3 arquivos de teste; custo de manutenção proporcional ao snapshot inline
  de departamentos (atualização deliberada quando negócio evoluir).
