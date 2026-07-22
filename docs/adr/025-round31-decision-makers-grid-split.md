# ADR-025 — Rodada #31: Split do DecisionMakersGrid

**Status:** Aceito · **Data:** 2026-07-22

## Contexto
A R30 (ADR-024) reduziu `LushaIntelligenceView.tsx` de 2.799 → 2.706 linhas
extraindo tipos, constantes e o `StatusBadge`, mas o **grid de resultados de
decisores** (linhas 1862–2205, ~343 linhas com tooltips, linhas de tabela,
lógica de reveal) continuava dentro do arquivo monolítico. Com o harness
Playwright (`e2e/lusha-smoke.spec.ts`) já ativo, esta rodada executa o split
que estava deferido.

## Decisão
Extrair `DecisionMakersGrid` como componente **puro e controlado**:

- `src/components/lux/lusha/DecisionMakersGrid.tsx` — componente + sub-componente
  interno `DecisionMakerRow` (`React.memo` em ambos), sem estado próprio, sem
  hooks de dados. Recebe `results`, `revealedData`, `revealingIds` e 3
  callbacks (`onReveal`, `onClearReveal`, `onOpenDetails`) além de
  `seniorityBadgeClass`.
- `src/components/lux/lusha/types.ts` — adiciona a interface `RevealedEntry`
  (antes inline no `useState<Record<string, {...}>>` do pai).
- O pai (`LushaIntelligenceView.tsx`) mantém 100% do estado, mutações
  (`dmMutation`, `handleReveal`), o modal de detalhes e o painel de sessões.

## Guard-rails desta rodada
- `bunx tsgo --noEmit` limpo pós-refactor.
- E2E smoke `e2e/lusha-smoke.spec.ts` continua verde (rota `/lusha` boota sem
  `pageerror`).
- Novo `DecisionMakersGrid.test.tsx` — 8 casos cobrindo:
  header do domínio, badge de erro (não renderiza tabela), linhas por
  decisor com LinkedIn, callbacks `onReveal` / `onClearReveal` /
  `onOpenDetails(type: "certifications")`, estados `revealed` (mailto/tel +
  botão desabilitado) e `revealing` (spinner + botão desabilitado).
- JSX copiado literalmente do bloco original — classes, ícones, tooltips e
  ordem das colunas idênticos.

## Consequências
+ `LushaIntelligenceView.tsx` cai de 2.706 → ~2.380 linhas (-12%).
+ Grid ganha teste unitário rápido (sem depender do E2E) que trava a
  semantização de estados de reveal e o contrato dos handlers.
+ `DecisionMakerRow` memoizado — updates de `revealedData[dm.id]` não
  re-renderizam linhas irmãs durante bursts de reveal.
- Três props extras no boundary pai→filho (aceito: torna o componente
  testável isoladamente).

## Próximos passos (R32)
Extrair a **tabela de sessões** e os **modais de detalhes** (`detailsModal`)
para fechar o split estrutural do módulo Lusha.
