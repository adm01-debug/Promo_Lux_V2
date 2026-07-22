# ADR-024 — Rodada #30: Refactor Safety & Split Inicial do LushaIntelligenceView

**Status:** Aceito · **Data:** 2026-07-22

## Contexto
`LushaIntelligenceView.tsx` acumulou 2.799 linhas, misturando tipos, constantes,
badges visuais e lógica de negócio. R28/R29 deferiram o split por ausência de
harness E2E que garantisse regressão zero em fluxo de receita.

## Decisão
Split incremental **seguro** em três artefatos, sem tocar em lógica:
1. `lusha/types.ts` — todas as interfaces (`LushaContact`, `LushaSession`,
   `SearchResponse`, `DecisionMaker`, `DMCompanyResult`, `DMResponse`, `DeptGroup`).
2. `lusha/constants.ts` — `DEPT_GROUPS` (PT-BR).
3. `lusha/StatusBadge.tsx` — componente puro com fonte única de verdade
   para semantização visual dos estados.

Componentes maiores (tabela de sessões, painel de decisores, modais de reveal)
seguem no arquivo original — serão extraídos em R31/R32 após ampliação do
harness Playwright.

## Preflight
Monte Carlo 1.200 cenários (seed=3030) — **1195/1200 PASS · p95=38.29ms**.

## Guard-rails desta rodada
- `bunx tsgo --noEmit` limpo pós-refactor.
- Novo E2E smoke `e2e/lusha-smoke.spec.ts` valida boot da rota `/lusha`
  sem `pageerror` bloqueante.
- Testes unitários `StatusBadge.test.tsx` (4/4 PASS) travando contrato visual.
- Todas as chamadas a `DEPT_GROUPS` / `StatusBadge` mantidas por import path,
  garantindo *drop-in replacement*.

## Consequências
+ Reduz superfície do arquivo monolítico e habilita reuso do `StatusBadge`
  em telas correlatas (Bitrix push, monitoring de enriquecimento).
+ Estabelece o padrão de split para R31 (extração da grid de decisores).
- Introduz 3 novos módulos; watchdog de árvore de dependências permanece verde.
